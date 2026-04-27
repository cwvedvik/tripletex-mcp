import { describe, it, expect } from 'vitest';
import {
  TripletexClient,
  TripletexApiError,
  TripletexRateLimitError,
  computeBackoffMs,
} from '../../src/tripletex-client.js';
import {
  mockFetch,
  mockSleep,
  type MockResponseSpec,
} from '../helpers/mock-fetch.js';

/**
 * Tests for 429 rate-limit backoff behaviour in TripletexClient.
 *
 * Coverage:
 *   - `computeBackoffMs` header-priority math in isolation.
 *   - `request()` retry loop on 429 with header-aware delays.
 *   - Interaction between 429 retries and the one-shot 401 session refresh.
 *   - Non-429 happy paths continue to work after the refactor.
 */

/** Standard session-create success response used as the first mock entry. */
const SESSION_CREATE_OK: MockResponseSpec = {
  status: 200,
  body: {
    value: { id: 1, token: 'sess-abc', expirationDate: '2099-12-31' },
  },
};

/** Common client options wiring a fresh fetch + sleep into the client. */
function makeClient(
  fetchImpl: typeof globalThis.fetch,
  sleepImpl: (ms: number) => Promise<void>,
  overrides: { maxRetries?: number; initialBackoffMs?: number } = {},
): TripletexClient {
  return new TripletexClient({
    consumerToken: 'c-token',
    employeeToken: 'e-token',
    fetch: fetchImpl,
    sleep: sleepImpl,
    initialBackoffMs: overrides.initialBackoffMs ?? 100,
    maxRetries: overrides.maxRetries ?? 3,
  });
}

describe('computeBackoffMs', () => {
  it('prefers X-Rate-Limit-Reset (seconds) when present and numeric', () => {
    const headers = new Headers({ 'X-Rate-Limit-Reset': '2' });
    expect(computeBackoffMs(0, headers, 1000)).toBe(2000);
  });

  it('falls back to Retry-After (seconds) when X-Rate-Limit-Reset is absent', () => {
    const headers = new Headers({ 'Retry-After': '5' });
    expect(computeBackoffMs(0, headers, 1000)).toBe(5000);
  });

  it('uses exponential fallback when neither header is present', () => {
    const headers = new Headers();
    expect(computeBackoffMs(0, headers, 1000)).toBe(1000);
    expect(computeBackoffMs(1, headers, 1000)).toBe(2000);
    expect(computeBackoffMs(2, headers, 1000)).toBe(3000);
  });

  it('treats a NaN X-Rate-Limit-Reset as absent and falls through to Retry-After', () => {
    const headers = new Headers({
      'X-Rate-Limit-Reset': 'abc',
      'Retry-After': '5',
    });
    expect(computeBackoffMs(0, headers, 1000)).toBe(5000);
  });

  it('falls all the way through to exponential when both headers are malformed', () => {
    const headers = new Headers({
      'X-Rate-Limit-Reset': 'abc',
      'Retry-After': 'xyz',
    });
    expect(computeBackoffMs(1, headers, 500)).toBe(1000);
  });

  it('clamps a negative X-Rate-Limit-Reset to zero', () => {
    const headers = new Headers({ 'X-Rate-Limit-Reset': '-5' });
    expect(computeBackoffMs(0, headers, 1000)).toBe(0);
  });
});

describe('429 retry behavior', () => {
  it('retries a single 429 using X-Rate-Limit-Reset and returns the 200 body', async () => {
    const successBody = { value: { id: 99, name: 'Acme' } };
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429, headers: { 'X-Rate-Limit-Reset': '2' } },
      { status: 200, body: successBody },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    const result = await client.get('/project');

    expect(result).toEqual(successBody);
    expect(sleepHandle.delays).toEqual([2000]);
    expect(fetchHandle.calls).toHaveLength(3);
    // Third call (after session-create + 429) hits the real endpoint again.
    expect(fetchHandle.calls[2]?.url).toContain('/project');
    expect(fetchHandle.calls[2]?.method).toBe('GET');
  });

  it('uses Retry-After when X-Rate-Limit-Reset is absent', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429, headers: { 'Retry-After': '3' } },
      { status: 200, body: { ok: true } },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    await client.get('/project');

    expect(sleepHandle.delays).toEqual([3000]);
  });

  it('falls back to exponential backoff when neither header is present', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429 },
      { status: 200, body: { ok: true } },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep, {
      initialBackoffMs: 100,
    });

    await client.get('/project');

    // attempt=0, initialBackoffMs=100 -> 100 * (0 + 1) = 100
    expect(sleepHandle.delays).toEqual([100]);
  });

  it('retries twice when two 429s arrive in a row', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429 },
      { status: 429, headers: { 'Retry-After': '2' } },
      { status: 200, body: { ok: true } },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep, {
      initialBackoffMs: 100,
    });

    const result = await client.get('/project');

    expect(result).toEqual({ ok: true });
    // session-create + 429 + 429 + 200
    expect(fetchHandle.calls).toHaveLength(4);
    expect(sleepHandle.delays).toHaveLength(2);
    // attempt 0 -> exponential 100, attempt 1 -> Retry-After 2000
    expect(sleepHandle.delays).toEqual([100, 2000]);
  });

  it('throws TripletexRateLimitError once retries are exhausted', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep, {
      maxRetries: 2,
      initialBackoffMs: 100,
    });

    await expect(client.get('/project')).rejects.toThrow(TripletexRateLimitError);

    // Re-run to inspect the thrown instance. Fresh mocks because the previous
    // queue is drained and calls were captured.
    const fetchHandle2 = mockFetch([
      SESSION_CREATE_OK,
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
      { status: 429, headers: { 'Retry-After': '1' }, bodyText: 'slow down' },
    ]);
    const sleepHandle2 = mockSleep();
    const client2 = makeClient(fetchHandle2.fetch, sleepHandle2.sleep, {
      maxRetries: 2,
      initialBackoffMs: 100,
    });

    let caught: unknown;
    try {
      await client2.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexRateLimitError);
    expect(caught).toBeInstanceOf(TripletexApiError);
    const rateErr = caught as TripletexRateLimitError;
    expect(rateErr.status).toBe(429);
    expect(typeof rateErr.retryAfterMs).toBe('number');
    expect(rateErr.retryAfterMs).toBeGreaterThan(0);
    // session-create + initial + 2 retries = 4 fetches total
    expect(fetchHandle2.calls).toHaveLength(4);
    // Two sleeps between the three 429 attempts.
    expect(sleepHandle2.delays).toHaveLength(2);
  });

  it('prefers X-Rate-Limit-Reset over Retry-After when both are present', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      {
        status: 429,
        headers: { 'X-Rate-Limit-Reset': '2', 'Retry-After': '10' },
      },
      { status: 200, body: { ok: true } },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    await client.get('/project');

    expect(sleepHandle.delays).toEqual([2000]);
  });
});

describe('401 + 429 composition', () => {
  it('handles 401 then 429 then 200 — session refresh then rate-limit retry', async () => {
    // Flow:
    //   1. session-create (PUT /token/session/:create) -> 200
    //   2. GET /project -> 401 (triggers session refresh)
    //   3. session-create again -> 200
    //   4. GET /project -> 429
    //   5. GET /project -> 200
    const successBody = { value: { id: 42 } };
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 401, bodyText: 'expired' },
      SESSION_CREATE_OK,
      { status: 429, headers: { 'X-Rate-Limit-Reset': '1' } },
      { status: 200, body: successBody },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    const result = await client.get('/project');

    expect(result).toEqual(successBody);
    expect(fetchHandle.calls).toHaveLength(5);
    expect(sleepHandle.delays).toEqual([1000]);
  });

  it('handles 429 then 401 then 200 — rate-limit retry precedes session refresh', async () => {
    // Flow:
    //   1. session-create -> 200
    //   2. GET /project -> 429
    //   3. GET /project -> 401 (sessionRefreshed flipped, session nulled)
    //   4. session-create -> 200
    //   5. GET /project -> 200
    const successBody = { value: { id: 7 } };
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 429, headers: { 'X-Rate-Limit-Reset': '1' } },
      { status: 401, bodyText: 'expired' },
      SESSION_CREATE_OK,
      { status: 200, body: successBody },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    const result = await client.get('/project');

    expect(result).toEqual(successBody);
    expect(fetchHandle.calls).toHaveLength(5);
    expect(sleepHandle.delays).toEqual([1000]);
  });

  it('does not retry a second 401 — session refresh is one-shot', async () => {
    // Flow:
    //   1. session-create -> 200
    //   2. GET /project -> 401 (sessionRefreshed=true, session nulled)
    //   3. session-create -> 200
    //   4. GET /project -> 401 (second 401, NOT retried -> surfaces as error)
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 401, bodyText: 'expired' },
      SESSION_CREATE_OK,
      { status: 401, bodyText: 'still unauthorized' },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    let caught: unknown;
    try {
      await client.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    // The second 401 must surface — it must NOT be a rate-limit error.
    expect(caught).not.toBeInstanceOf(TripletexRateLimitError);
    const apiErr = caught as TripletexApiError;
    expect(apiErr.status).toBe(401);
    expect(fetchHandle.calls).toHaveLength(4);
    expect(sleepHandle.delays).toEqual([]);
  });
});

describe('normal non-429 paths still work', () => {
  it('returns the parsed JSON body on a 200 response', async () => {
    const body = { value: { id: 1, name: 'Hello' } };
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 200, body },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    const result = await client.get('/project');

    expect(result).toEqual(body);
    expect(sleepHandle.delays).toEqual([]);
  });

  it('throws TripletexApiError with status 500 on a 500 response', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 500, bodyText: 'boom' },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    let caught: unknown;
    try {
      await client.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    expect(caught).not.toBeInstanceOf(TripletexRateLimitError);
    const apiErr = caught as TripletexApiError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.bodyText).toBe('boom');
  });

  it('returns an empty object when the response body is empty (204-style)', async () => {
    const fetchHandle = mockFetch([
      SESSION_CREATE_OK,
      { status: 204, bodyText: '' },
    ]);
    const sleepHandle = mockSleep();
    const client = makeClient(fetchHandle.fetch, sleepHandle.sleep);

    const result = await client.get('/project');

    expect(result).toEqual({});
  });
});
