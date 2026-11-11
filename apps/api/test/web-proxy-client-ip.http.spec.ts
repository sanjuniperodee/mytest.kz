import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AddressInfo } from 'net';
import { NextRequest } from 'next/server';
import { configureTrustProxy, resolveTrustProxy } from '../src/common/http/trust-proxy';
// The real Next proxy handler and helpers (apps/web), run against a real Nest app + ThrottlerGuard.
import { GET as webProxyGet } from '../../web/app/api/v1/[...path]/route';
import { apiInternalOrigin } from '../../web/lib/api-origin';
import { clientIpFromNginx, setForwardedClientIp } from '../../web/lib/client-ip';

/**
 * Rate limits must count per real visitor for traffic that comes through the web app's proxy:
 *
 *   browser → nginx (my-test.kz) → Next route handler → Nest        (API_INTERNAL_URL=http://127.0.0.1:<port>)
 *
 * and a client-sent X-Forwarded-For must never choose the bucket. The ThrottlerGuard keys on `req.ip`,
 * which Express derives from the socket and X-Forwarded-For according to `trust proxy`.
 */

const LIMIT = 5;
const SERVER_PUBLIC_IP = '94.131.93.92';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

/** Shows what the API actually received from the proxy. */
@Controller('echo')
class EchoController {
  @Get()
  echo(@Req() req: Request) {
    return {
      ip: req.ip,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
      xRealIp: req.headers['x-real-ip'] ?? null,
      forwarded: req.headers['forwarded'] ?? null,
    };
  }
}

type Booted = { app: INestApplication; origin: string };

async function bootApi(trustProxy?: string): Promise<Booted> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMIT }])],
    controllers: [PingController, EchoController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureTrustProxy(app, trustProxy); // same function main.ts calls
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, origin: `http://127.0.0.1:${port}` };
}

/** What nginx in front of Next hands to the route handler: XFF = browser's value + ", " + $remote_addr, X-Real-IP = $remote_addr. */
function nginxWeb(remoteAddr: string, browserHeaders: Record<string, string> = {}): Headers {
  const headers = new Headers(browserHeaders);
  const sent = headers.get('x-forwarded-for');
  headers.set('x-forwarded-for', sent ? `${sent}, ${remoteAddr}` : remoteAddr);
  headers.set('x-real-ip', remoteAddr);
  return headers;
}

async function viaWebProxy(path: string, headers: Headers): Promise<Response> {
  return webProxyGet(new NextRequest(`https://my-test.kz/api/v1/${path}`, { headers }), {
    params: Promise.resolve({ path: [path] }),
  });
}

const remainingOf = (res: Response) => Number(res.headers.get('x-ratelimit-remaining'));

describe('web proxy → API rate limits are per real client IP', () => {
  let api: Booted;
  let previousInternalUrl: string | undefined;

  beforeAll(async () => {
    api = await bootApi(); // production default: trust proxy = loopback
    previousInternalUrl = process.env.API_INTERNAL_URL;
    process.env.API_INTERNAL_URL = api.origin; // what the owner sets on prod: the API on loopback
  });

  afterAll(async () => {
    if (previousInternalUrl === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = previousInternalUrl;
    await api?.app.close();
  });

  it('two different visitors get separate x-ratelimit-remaining counters', async () => {
    const alice = '203.0.113.10';
    const bob = '203.0.113.20';

    const a1 = await viaWebProxy('ping', nginxWeb(alice));
    const a2 = await viaWebProxy('ping', nginxWeb(alice));
    const a3 = await viaWebProxy('ping', nginxWeb(alice));
    expect([a1, a2, a3].map((r) => r.status)).toEqual([200, 200, 200]);
    expect([a1, a2, a3].map(remainingOf)).toEqual([LIMIT - 1, LIMIT - 2, LIMIT - 3]);

    // Bob starts a fresh counter although Alice used three requests a moment ago.
    const b1 = await viaWebProxy('ping', nginxWeb(bob));
    expect(b1.status).toBe(200);
    expect(remainingOf(b1)).toBe(LIMIT - 1);

    // And Alice's counter was not touched by Bob.
    const a4 = await viaWebProxy('ping', nginxWeb(alice));
    expect(remainingOf(a4)).toBe(LIMIT - 4);
  });

  it('a forged X-Forwarded-For / X-Real-IP / Forwarded from the browser does not open a new bucket', async () => {
    const mallory = '203.0.113.30';
    const seen: number[] = [];

    for (let i = 0; i < LIMIT; i++) {
      const res = await viaWebProxy(
        'ping',
        nginxWeb(mallory, {
          'x-forwarded-for': `198.51.100.${i + 1}`, // a fresh made-up address every request
          'x-real-ip': `198.51.100.${i + 100}`,
          forwarded: `for=198.51.100.${i + 200}`,
        }),
      );
      expect(res.status).toBe(200);
      seen.push(remainingOf(res));
    }
    // One bucket for Mallory: the counter keeps going down instead of restarting at LIMIT - 1.
    expect(seen).toEqual([LIMIT - 1, LIMIT - 2, LIMIT - 3, LIMIT - 4, LIMIT - 5]);

    // Limit exhausted: one more forged address is still refused...
    const blocked = await viaWebProxy('ping', nginxWeb(mallory, { 'x-forwarded-for': '198.51.100.250' }));
    expect(blocked.status).toBe(429);

    // ...and a bystander is not affected by Mallory's burst.
    const bystander = await viaWebProxy('ping', nginxWeb('203.0.113.40'));
    expect(bystander.status).toBe(200);
    expect(remainingOf(bystander)).toBe(LIMIT - 1);
  });

  it('forges also fail when the browser spoofs ANOTHER visitor: the victim keeps their own full bucket', async () => {
    const victim = '203.0.113.50';
    const attacker = '203.0.113.60';

    for (let i = 0; i < LIMIT; i++) {
      const res = await viaWebProxy('ping', nginxWeb(attacker, { 'x-forwarded-for': victim }));
      expect(res.status).toBe(200);
    }
    const attackerBlocked = await viaWebProxy('ping', nginxWeb(attacker, { 'x-forwarded-for': victim }));
    expect(attackerBlocked.status).toBe(429);

    const victimRequest = await viaWebProxy('ping', nginxWeb(victim));
    expect(victimRequest.status).toBe(200);
    expect(remainingOf(victimRequest)).toBe(LIMIT - 1);
  });

  it('the API receives exactly one X-Forwarded-For (the visitor) and no other client-address headers', async () => {
    const res = await viaWebProxy(
      'echo',
      nginxWeb('203.0.113.70', {
        'x-forwarded-for': '198.51.100.7, 198.51.100.8',
        'x-real-ip': '198.51.100.9',
        forwarded: 'for=198.51.100.10',
      }),
    );
    expect(await res.json()).toEqual({
      ip: '203.0.113.70',
      xForwardedFor: '203.0.113.70',
      xRealIp: null,
      forwarded: null,
    });
  });

  it('headers that disagree (a browser wrote one of them) are trusted by neither: no per-visitor bucket is chosen', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.80', 'x-real-ip': '198.51.100.1' });
    const res = await viaWebProxy('echo', headers);
    const body = await res.json();
    expect(body.xForwardedFor).toBeNull();
    expect(body.ip).toBe('127.0.0.1'); // the proxy's own address, never an address the browser picked
  });
});

describe('direct API traffic (api.my-test.kz: mobile, Telegram) keeps working', () => {
  let api: Booted;
  beforeAll(async () => {
    api = await bootApi();
  });
  afterAll(async () => {
    await api?.app.close();
  });

  const hit = (xff: string) => fetch(`${api.origin}/api/v1/ping`, { headers: { 'x-forwarded-for': xff } });

  it('nginx-api appends the real address, so a forged left part does not choose the bucket', async () => {
    const real = '203.0.113.90';
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) seen.push(remainingOf(await hit(`198.51.100.${i + 1}, ${real}`)));
    expect(seen).toEqual([LIMIT - 1, LIMIT - 2, LIMIT - 3]);
  });
});

describe('through the PUBLIC api url (no API_INTERNAL_URL): the problem and the TRUST_PROXY alternative', () => {
  // nginx-api sees the web server's own public address as the peer and appends it after the address Next sent.
  const viaPublicUrl = (api: Booted, client: string) =>
    fetch(`${api.origin}/api/v1/ping`, { headers: { 'x-forwarded-for': `${client}, ${SERVER_PUBLIC_IP}` } });

  it('default trust (loopback): every visitor lands in the server-address bucket', async () => {
    const api = await bootApi();
    try {
      expect(remainingOf(await viaPublicUrl(api, '203.0.113.101'))).toBe(LIMIT - 1);
      // A different visitor continues the same counter — the bug.
      expect(remainingOf(await viaPublicUrl(api, '203.0.113.102'))).toBe(LIMIT - 2);
    } finally {
      await api.app.close();
    }
  });

  it(`TRUST_PROXY=loopback,${SERVER_PUBLIC_IP}: visitors are separated again`, async () => {
    const api = await bootApi(`loopback,${SERVER_PUBLIC_IP}`);
    try {
      expect(remainingOf(await viaPublicUrl(api, '203.0.113.101'))).toBe(LIMIT - 1);
      expect(remainingOf(await viaPublicUrl(api, '203.0.113.102'))).toBe(LIMIT - 1);
      expect(remainingOf(await viaPublicUrl(api, '203.0.113.101'))).toBe(LIMIT - 2);
    } finally {
      await api.app.close();
    }
  });
});

describe('resolveTrustProxy', () => {
  it('defaults to loopback, passes lists through, reads a plain number as a hop count', () => {
    expect(resolveTrustProxy(undefined)).toBe('loopback');
    expect(resolveTrustProxy('  ')).toBe('loopback');
    expect(resolveTrustProxy('loopback,94.131.93.92')).toBe('loopback,94.131.93.92');
    expect(resolveTrustProxy('1')).toBe(1);
  });
});

describe('web helpers', () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it('clientIpFromNginx takes the last X-Forwarded-For entry, never the first', () => {
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.5' }))).toBe('203.0.113.5');
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('clientIpFromNginx accepts X-Real-IP alone, and both when they agree', () => {
    expect(clientIpFromNginx(headers({ 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
    expect(
      clientIpFromNginx(headers({ 'x-real-ip': '2001:db8::1', 'x-forwarded-for': 'junk-from-browser, 2001:DB8::1' })),
    ).toBe('2001:db8::1');
  });

  it('clientIpFromNginx ignores the loopback X-Forwarded-For that Next fills in when nginx sent none', () => {
    // Observed with `next start`: nginx sets only X-Real-IP → Next adds XFF = its socket peer (nginx, loopback).
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '::ffff:127.0.0.1', 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '::1' }))).toBeNull();
    // A browser cannot use this to pick an address: its forged entries are left of the one nginx appended.
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '127.0.0.1, 203.0.113.5', 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('clientIpFromNginx refuses disagreeing, malformed or missing values', () => {
    expect(clientIpFromNginx(headers({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '203.0.113.6' }))).toBeNull();
    expect(clientIpFromNginx(headers({ 'x-forwarded-for': '203.0.113.5, not-an-ip' }))).toBeNull();
    expect(clientIpFromNginx(headers({ 'x-real-ip': '203.0.113.5, 1.2.3.4' }))).toBeNull();
    expect(clientIpFromNginx(headers({}))).toBeNull();
  });

  it('setForwardedClientIp replaces every client-address header with one X-Forwarded-For', () => {
    const h = headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-real-ip': '3.3.3.3', forwarded: 'for=4.4.4.4', accept: '*/*' });
    setForwardedClientIp(h, '203.0.113.5');
    expect(h.get('x-forwarded-for')).toBe('203.0.113.5');
    expect(h.get('x-real-ip')).toBeNull();
    expect(h.get('forwarded')).toBeNull();
    expect(h.get('accept')).toBe('*/*');

    setForwardedClientIp(h, null);
    expect(h.get('x-forwarded-for')).toBeNull();
  });

  it('apiInternalOrigin falls back to the public origin and trims a trailing slash', () => {
    const previous = process.env.API_INTERNAL_URL;
    try {
      delete process.env.API_INTERNAL_URL;
      expect(apiInternalOrigin()).toMatch(/^https?:\/\/[^/]+$/);
      process.env.API_INTERNAL_URL = ' http://127.0.0.1:3001/ ';
      expect(apiInternalOrigin()).toBe('http://127.0.0.1:3001');
    } finally {
      if (previous === undefined) delete process.env.API_INTERNAL_URL;
      else process.env.API_INTERNAL_URL = previous;
    }
  });
});
