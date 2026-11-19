import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  describeAddress,
  describeProxyChain,
  proxyChainProbe,
} from './proxy-chain-probe';

const KEY = Buffer.alloc(32, 7);

function fakeRequest({
  method = 'GET',
  path = '/',
  headers = {},
  ip = '10.1.2.3',
  socket = '::ffff:10.9.8.7',
}: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  ip?: string;
  socket?: string;
} = {}) {
  return {
    method,
    path,
    headers,
    ip,
    socket: { remoteAddress: socket },
  } as unknown as Request;
}

describe('registro temporal de la cadena de proxies', () => {
  it('nunca muestra una IP completa, ni pública ni interna', () => {
    const line = JSON.stringify(
      describeProxyChain(
        fakeRequest({
          headers: {
            'x-forwarded-for': '181.45.12.34, 10.1.2.3',
            'x-real-ip': '181.45.12.34',
          },
        }),
        KEY,
      ),
    );

    expect(line).not.toContain('181.45');
    expect(line).not.toContain('10.1.2.3');
    expect(line).not.toContain('10.9.8.7');
  });

  it('dice de qué tipo es cada dirección de la cadena', () => {
    const chain = describeProxyChain(
      fakeRequest({
        headers: { 'x-forwarded-for': '181.45.12.34, 100.64.3.4, 10.1.2.3' },
      }),
      KEY,
    );

    expect(chain.xff?.map((entry) => entry?.split(':')[0])).toEqual([
      'public',
      'cgnat',
      'private',
    ]);
    expect(chain.reqIp).toMatch(/^private:/);
    expect(chain.socket).toMatch(/^private:/);
    expect(chain.realIp).toBeNull();
  });

  it('la misma IP da siempre el mismo código y otra IP da otro', () => {
    expect(describeAddress('181.45.12.34', KEY)).toBe(
      describeAddress(' 181.45.12.34', KEY),
    );
    expect(describeAddress('181.45.12.34', KEY)).not.toBe(
      describeAddress('181.45.12.35', KEY),
    );
    expect(describeAddress('::ffff:10.1.2.3', KEY)).toBe(
      describeAddress('10.1.2.3', KEY),
    );
  });

  it('muestra completas las IPs de documentación, que son las inventadas a propósito', () => {
    expect(describeAddress('203.0.113.7', KEY)).toBe('doc:203.0.113.7');
    expect(describeAddress('198.51.100.9', KEY)).toBe('doc:198.51.100.9');
  });

  it('marca lo que no es una IP sin mostrarlo', () => {
    expect(describeAddress('<script>', KEY)).toBe('invalid');
    expect(describeAddress('181.45.12.34:5555', KEY)).toMatch(
      /^public:[0-9a-f]{6}\+port$/,
    );
  });

  it('solo registra GET / y se corta a las 300 líneas', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const probe = proxyChainProbe();
    const next = jest.fn() as NextFunction;
    const res = {} as Response;

    probe(fakeRequest({ path: '/events' }), res, next);
    probe(fakeRequest({ method: 'POST' }), res, next);
    for (let i = 0; i < 301; i++) probe(fakeRequest(), res, next);

    expect(log).toHaveBeenCalledTimes(300);
    expect(next).toHaveBeenCalledTimes(303);
    log.mockRestore();
  });
});
