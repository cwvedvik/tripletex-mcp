import { describe, it, expect } from 'vitest';
import {
  TripletexClient,
  TripletexApiError,
  type TripletexClientOptions,
} from '../../src/tripletex-client.js';
import { mockFetch, mockSleep } from '../helpers/mock-fetch.js';

/**
 * Non-rate-limit behavior lockdown for TripletexClient.
 *
 * Sibling agents are adding 429 retry logic. This file exists so that
 * pre-existing behavior (session lifecycle, 401 one-shot refresh, body
 * parsing, HTTP verb helpers, error envelope) cannot silently regress
 * while that refactor is in flight. 429-specific coverage lives in
 * `rate-limit.test.ts`.
 */

const PROD_BASE = 'https://tripletex.no/v2';
const TEST_BASE = 'https://api-test.tripletex.tech/v2';
const CONSUMER = 'consumer-xyz';
const EMPLOYEE = 'employee-abc';
const SESSION = 'sess-abc';

/**
 * Build a fresh options bag for the client. Callers override `fetch`/`sleep`
 * per test. Keeping a helper avoids repeating the required-options boilerplate
 * in every `describe`.
 */
function buildOptions(
  overrides: Partial<TripletexClientOptions> = {},
): TripletexClientOptions {
  return {
    consumerToken: CONSUMER,
    employeeToken: EMPLOYEE,
    baseUrl: PROD_BASE,
    ...overrides,
  };
}

/**
 * Compute the yyyy-MM-dd date string for "tomorrow" at call time. The client
 * uses `new Date()` internally, so snapshotting here right before constructing
 * the client keeps the test robust against the 23:59:59.999 rollover case.
 */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const sessionSuccess = {
  status: 200,
  body: { value: { id: 1, token: SESSION, expirationDate: '2099-12-31' } },
};

describe('constructor', () => {
  it('uses explicit consumer/employee tokens and defaults baseUrl to prod', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 99 } } },
    ]);
    const client = new TripletexClient({
      consumerToken: CONSUMER,
      employeeToken: EMPLOYEE,
      fetch: fetchHandle.fetch,
      sleep: mockSleep().sleep,
    });

    await client.get('/project');

    expect(fetchHandle.calls[0].url.startsWith(`${PROD_BASE}/token/session/:create`)).toBe(true);
    const sessionUrl = new URL(fetchHandle.calls[0].url);
    expect(sessionUrl.searchParams.get('consumerToken')).toBe(CONSUMER);
    expect(sessionUrl.searchParams.get('employeeToken')).toBe(EMPLOYEE);
    expect(fetchHandle.calls[1].url.startsWith(`${PROD_BASE}/project`)).toBe(true);
  });

  it('honors an explicit baseUrl override', async () => {
    const customBase = 'https://tripletex.example.test/v2';
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: [] } },
    ]);
    const client = new TripletexClient(
      buildOptions({ baseUrl: customBase, fetch: fetchHandle.fetch }),
    );

    await client.get('/project');

    expect(fetchHandle.calls[0].url.startsWith(`${customBase}/token/session/:create`)).toBe(true);
    expect(fetchHandle.calls[1].url.startsWith(`${customBase}/project`)).toBe(true);
  });

  it('throws when called with no options and env vars are missing', () => {
    // Snapshot and strip the env vars so the no-options branch hits the
    // missing-vars guard. Restore in `finally` so other tests in the file
    // are unaffected regardless of throw behavior.
    const origConsumer = process.env.TRIPLETEX_CONSUMER_TOKEN;
    const origEmployee = process.env.TRIPLETEX_EMPLOYEE_TOKEN;
    delete process.env.TRIPLETEX_CONSUMER_TOKEN;
    delete process.env.TRIPLETEX_EMPLOYEE_TOKEN;
    try {
      expect(() => new TripletexClient()).toThrow(/Missing TRIPLETEX_CONSUMER_TOKEN/);
    } finally {
      if (origConsumer !== undefined) process.env.TRIPLETEX_CONSUMER_TOKEN = origConsumer;
      if (origEmployee !== undefined) process.env.TRIPLETEX_EMPLOYEE_TOKEN = origEmployee;
    }
  });

  it('passes a test-environment baseUrl through to every request', async () => {
    // The env-var path uses TRIPLETEX_ENV=test; here we mirror that behavior
    // via options to match the existing test convention (options-based
    // injection, no env stubs).
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 7 } } },
    ]);
    const client = new TripletexClient(
      buildOptions({ baseUrl: TEST_BASE, fetch: fetchHandle.fetch }),
    );

    await client.get('/project');

    expect(fetchHandle.calls[0].url.startsWith(`${TEST_BASE}/token/session/:create`)).toBe(true);
    expect(fetchHandle.calls[1].url.startsWith(`${TEST_BASE}/project`)).toBe(true);
  });
});

describe('session token lifecycle', () => {
  it('creates a session on the first call with the tomorrow expirationDate and reuses it as Basic auth', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 99, name: 'Acme' } } },
    ]);
    const expected = tomorrowIso();
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    const result = await client.get('/project');

    // First call is the session create.
    expect(fetchHandle.calls[0].method).toBe('PUT');
    const sessionUrl = new URL(fetchHandle.calls[0].url);
    expect(sessionUrl.origin + sessionUrl.pathname).toBe(
      `${PROD_BASE}/token/session/:create`,
    );
    expect(sessionUrl.searchParams.get('consumerToken')).toBe(CONSUMER);
    expect(sessionUrl.searchParams.get('employeeToken')).toBe(EMPLOYEE);
    // Allow same-day tolerance if the test straddles midnight.
    const actualExpDate = sessionUrl.searchParams.get('expirationDate');
    expect(actualExpDate).toBeTruthy();
    expect(actualExpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([expected, tomorrowIso()]).toContain(actualExpDate);

    // Second call carries the session token from the mocked session response
    // as the Basic auth subject (username "0", password <sessionToken>).
    expect(fetchHandle.calls[1].method).toBe('GET');
    const expectedAuth =
      'Basic ' + Buffer.from(`0:${SESSION}`).toString('base64');
    expect(fetchHandle.calls[1].headers['authorization']).toBe(expectedAuth);
    expect(result).toEqual({ value: { id: 99, name: 'Acme' } });
  });

  it('reuses the cached session across subsequent data calls (no second session create)', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: [{ id: 1 }] } },
      { status: 200, body: { value: [{ id: 2 }] } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    await client.get('/project');
    await client.get('/project');

    // Exactly 3 fetches: one session create, two data calls. The second data
    // call must NOT trigger another session create.
    expect(fetchHandle.calls).toHaveLength(3);
    expect(fetchHandle.calls[0].url).toContain('/token/session/:create');
    expect(fetchHandle.calls[1].url).toContain('/project');
    expect(fetchHandle.calls[2].url).toContain('/project');
    expect(fetchHandle.calls[1].url).not.toContain('/token/session/:create');
    expect(fetchHandle.calls[2].url).not.toContain('/token/session/:create');
  });
});

describe('401 retry behavior', () => {
  it('retries once on 401 by re-creating the session and succeeds on the second data call', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 401, bodyText: 'session expired' },
      // Second session-create returns a fresh token value to prove the client
      // picked up the new session rather than silently reusing the stale one.
      {
        status: 200,
        body: { value: { id: 2, token: 'sess-fresh', expirationDate: '2099-12-31' } },
      },
      { status: 200, body: { value: { id: 5, name: 'Beta' } } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    const result = await client.get('/project');

    expect(fetchHandle.calls).toHaveLength(4);
    expect(fetchHandle.calls[0].url).toContain('/token/session/:create');
    expect(fetchHandle.calls[1].url).toContain('/project');
    expect(fetchHandle.calls[2].url).toContain('/token/session/:create');
    expect(fetchHandle.calls[3].url).toContain('/project');
    // The retried data call should use the refreshed session token.
    const refreshedAuth =
      'Basic ' + Buffer.from('0:sess-fresh').toString('base64');
    expect(fetchHandle.calls[3].headers['authorization']).toBe(refreshedAuth);
    expect(result).toEqual({ value: { id: 5, name: 'Beta' } });
  });

  it('throws TripletexApiError with status 401 when a second 401 arrives (no infinite loop)', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 401, bodyText: 'session expired' },
      sessionSuccess,
      { status: 401, bodyText: 'still unauthorized' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    let caught: unknown;
    try {
      await client.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    const apiErr = caught as TripletexApiError;
    expect(apiErr.status).toBe(401);
    expect(apiErr.message).toContain('/project');
    // Exactly 4 fetches — one-shot retry, no further attempts.
    expect(fetchHandle.calls).toHaveLength(4);
  });
});

describe('response body parsing', () => {
  it('parses a JSON response body into an object', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 42, name: 'Gamma' } } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    const result = await client.get('/project');

    expect(result).toEqual({ value: { id: 42, name: 'Gamma' } });
  });

  it('returns {} when the response body is empty (e.g. 204 No Content)', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 204, bodyText: '' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    const result = await client.delete('/project/1');

    expect(result).toEqual({});
  });

  it('returns the raw string when the response body is not valid JSON', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, bodyText: 'OK' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    const result = await client.get('/project');

    expect(result).toBe('OK');
  });
});

describe('HTTP method helpers', () => {
  it('POST sends method=POST with a JSON-stringified body', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 10 } } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    await client.post('/foo', { bar: 1 });

    expect(fetchHandle.calls[1].method).toBe('POST');
    expect(fetchHandle.calls[1].body).toBe(JSON.stringify({ bar: 1 }));
    expect(fetchHandle.calls[1].headers['content-type']).toBe('application/json');
  });

  it('PUT sends method=PUT with a JSON-stringified body', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: { id: 11 } } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    await client.put('/foo/11', { bar: 2 });

    expect(fetchHandle.calls[1].method).toBe('PUT');
    expect(fetchHandle.calls[1].body).toBe(JSON.stringify({ bar: 2 }));
  });

  it('DELETE sends method=DELETE with no body', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 204, bodyText: '' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    await client.delete('/foo/11');

    expect(fetchHandle.calls[1].method).toBe('DELETE');
    expect(fetchHandle.calls[1].body).toBeUndefined();
  });

  it('GET builds the URL with every supplied query param', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 200, body: { value: [] } },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    await client.get('/x', { a: '1', b: '2' });

    expect(fetchHandle.calls[1].method).toBe('GET');
    const url = new URL(fetchHandle.calls[1].url);
    expect(url.origin + url.pathname).toBe(`${PROD_BASE}/x`);
    // Assert on individual params rather than whole query string —
    // URLSearchParams preserves insertion order in practice but the
    // test guards against the intent, not the encoding.
    expect(url.searchParams.get('a')).toBe('1');
    expect(url.searchParams.get('b')).toBe('2');
    expect(fetchHandle.calls[1].body).toBeUndefined();
  });
});

describe('error responses', () => {
  it('throws TripletexApiError with status 500 and bodyText preserved', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 500, bodyText: 'boom: database offline' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    let caught: unknown;
    try {
      await client.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    const apiErr = caught as TripletexApiError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.bodyText).toContain('boom: database offline');
    expect(apiErr.name).toBe('TripletexApiError');
  });

  it('throws TripletexApiError with status 404 when the resource is missing', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 404, bodyText: 'not found' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    let caught: unknown;
    try {
      await client.get('/project/9999');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    const apiErr = caught as TripletexApiError;
    expect(apiErr.status).toBe(404);
    expect(apiErr.name).toBe('TripletexApiError');
  });

  it('sets the thrown error name to "TripletexApiError"', async () => {
    const fetchHandle = mockFetch([
      sessionSuccess,
      { status: 400, bodyText: 'bad request' },
    ]);
    const client = new TripletexClient(
      buildOptions({ fetch: fetchHandle.fetch }),
    );

    let caught: unknown;
    try {
      await client.get('/project');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TripletexApiError);
    expect((caught as Error).name).toBe('TripletexApiError');
  });
});
