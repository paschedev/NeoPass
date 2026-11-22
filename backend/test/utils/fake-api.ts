import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReceivedRequest {
  method: string;
  path: string;
  authorization?: string;
  body: string;
}

export interface FakeApi {
  url: string;
  received: ReceivedRequest[];
  close: () => Promise<void>;
}

// Local HTTP server in place of a third-party API, for the tests that run the
// real SDK: it answers each request with the JSON `respond` gives for its path
// and keeps what it received.
export async function startFakeApi(
  respond: (path: string) => unknown,
): Promise<FakeApi> {
  const received: ReceivedRequest[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      const path = req.url ?? '';
      received.push({
        method: req.method ?? '',
        path,
        authorization: req.headers.authorization,
        body,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(respond(path)));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

// A fetch that would leave this machine fails: no test calls a real API.
export function blockExternalFetch() {
  const realFetch = global.fetch;
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (!url.startsWith('http://127.0.0.1:')) {
        return Promise.reject(new Error(`Blocked request to ${url}`));
      }
      return realFetch(input, init);
    });
}
