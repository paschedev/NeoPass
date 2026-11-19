import { Logger } from '@nestjs/common';
import type { Request, RequestHandler } from 'express';
import { createHmac, randomBytes } from 'node:crypto';
import { BlockList, isIP } from 'node:net';

// TEMPORARY (VER-04): shows how Railway's proxies hand requests to the app, to
// choose where the client IP comes from. Delete it once that is settled.
// It only looks at GET / and never logs a full address: each one is its kind
// plus a short keyed hash. The key lives in memory only, so the hashes cannot
// be reversed and change on every restart. Addresses from the documentation
// ranges are logged as they are: they are the fake ones sent on purpose to see
// whether a header can be forged.

const MAX_LINES = 300;

type Subnet = [network: string, prefix: number, type: 'ipv4' | 'ipv6'];

function blockList(subnets: Subnet[]) {
  const list = new BlockList();
  for (const [network, prefix, type] of subnets) {
    list.addSubnet(network, prefix, type);
  }
  return list;
}

const KINDS: [kind: string, list: BlockList][] = [
  [
    'doc',
    blockList([
      ['192.0.2.0', 24, 'ipv4'],
      ['198.51.100.0', 24, 'ipv4'],
      ['203.0.113.0', 24, 'ipv4'],
      ['2001:db8::', 32, 'ipv6'],
    ]),
  ],
  [
    'loopback',
    blockList([
      ['127.0.0.0', 8, 'ipv4'],
      ['::1', 128, 'ipv6'],
    ]),
  ],
  [
    'private',
    blockList([
      ['10.0.0.0', 8, 'ipv4'],
      ['172.16.0.0', 12, 'ipv4'],
      ['192.168.0.0', 16, 'ipv4'],
      ['fc00::', 7, 'ipv6'],
    ]),
  ],
  ['cgnat', blockList([['100.64.0.0', 10, 'ipv4']])],
  [
    'linklocal',
    blockList([
      ['169.254.0.0', 16, 'ipv4'],
      ['fe80::', 10, 'ipv6'],
    ]),
  ],
];

export function describeAddress(
  raw: string | undefined,
  key: Buffer,
): string | null {
  if (raw === undefined) return null;
  let value = raw.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  let suffix = '';
  const withPort = /^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(value);
  if (withPort) {
    value = withPort[1];
    suffix = '+port';
  }
  const version = isIP(value);
  if (!version) return 'invalid';

  const type = version === 4 ? 'ipv4' : 'ipv6';
  const kind =
    KINDS.find(([, list]) => list.check(value, type))?.[0] ?? 'public';
  if (kind === 'doc') return `doc:${value}${suffix}`;
  const hash = createHmac('sha256', key)
    .update(value)
    .digest('hex')
    .slice(0, 6);
  return `${kind}:${hash}${suffix}`;
}

export function describeProxyChain(req: Request, key: Buffer) {
  const header = (name: string) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value.join(',') : value;
  };
  const forwardedFor = header('x-forwarded-for');
  return {
    xff:
      forwardedFor === undefined
        ? null
        : forwardedFor.split(',').map((entry) => describeAddress(entry, key)),
    realIp: describeAddress(header('x-real-ip'), key),
    envoy: describeAddress(header('x-envoy-external-address'), key),
    reqIp: describeAddress(req.ip, key),
    socket: describeAddress(req.socket.remoteAddress, key),
    edge: header('x-railway-edge')?.slice(0, 40) ?? null,
    headers: Object.keys(req.headers).sort().slice(0, 40),
    replica: process.env.RAILWAY_REPLICA_ID?.slice(0, 8) ?? null,
  };
}

export function proxyChainProbe(): RequestHandler {
  const key = randomBytes(32);
  const logger = new Logger('ProxyChain');
  let lines = 0;
  return (req, _res, next) => {
    if (req.method === 'GET' && req.path === '/' && lines < MAX_LINES) {
      lines++;
      logger.log(JSON.stringify(describeProxyChain(req, key)));
    }
    next();
  };
}
