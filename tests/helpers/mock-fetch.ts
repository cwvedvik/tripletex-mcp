/**
 * Test helpers for injecting a fake `fetch` and `sleep` into TripletexClient.
 *
 * The client under test accepts `fetch` and `sleep` via its options, so these
 * helpers let tests feed a scripted sequence of responses and assert on
 * captured calls / requested delays without touching any global.
 */

export interface MockResponseSpec {
  /** HTTP status code, e.g. 200, 401, 429, 500. */
  status: number;
  /** Response headers (e.g. { "X-Rate-Limit-Reset": "2" }). Case-insensitive match by the client. */
  headers?: Record<string, string>;
  /** JSON body — will be JSON.stringified. Mutually exclusive with bodyText. */
  body?: unknown;
  /** Raw text body. Mutually exclusive with body. */
  bodyText?: string;
}

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface MockFetchHandle {
  /** The fake fetch. Pass to TripletexClient options as `fetch`. */
  fetch: typeof globalThis.fetch;
  /** All captured calls, in order. */
  calls: FetchCall[];
  /** How many queued responses are still unconsumed. */
  remaining(): number;
}

export interface MockSleepHandle {
  /** The fake sleep. Pass to TripletexClient options as `sleep`. */
  sleep: (ms: number) => Promise<void>;
  /** Every sleep duration requested, in order. */
  delays: number[];
  /** Total ms requested so far. */
  totalMs(): number;
}

/**
 * Build a Response object from a MockResponseSpec. Validates exclusivity of
 * `body` / `bodyText` and defaults Content-Type to application/json when a
 * JSON `body` is supplied and the caller hasn't set it explicitly.
 */
function buildResponse(spec: MockResponseSpec): Response {
  if (spec.body !== undefined && spec.bodyText !== undefined) {
    throw new Error('mock spec: pass either body or bodyText, not both');
  }

  const headers = new Headers(spec.headers ?? {});
  let bodyPayload: string | null = null;

  if (spec.bodyText !== undefined) {
    bodyPayload = spec.bodyText;
  } else if (spec.body !== undefined) {
    bodyPayload = JSON.stringify(spec.body);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  // The Fetch spec forbids a body on 204/205/304 responses and the Response
  // constructor throws if you try. Force null body for those statuses so mocks
  // of "empty body" responses (which are common in tests) build cleanly.
  const statusForbidsBody =
    spec.status === 204 || spec.status === 205 || spec.status === 304;
  const finalBody = statusForbidsBody ? null : bodyPayload;

  return new Response(finalBody, {
    status: spec.status,
    headers,
  });
}

/**
 * Collapse a HeadersInit / Headers / plain object into a Record<string, string>.
 * Headers#forEach yields lower-cased keys, which is the standard normalization.
 */
function headersToRecord(
  headers: HeadersInit | Headers | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers === undefined) {
    return out;
  }
  const normalized = headers instanceof Headers ? headers : new Headers(headers);
  normalized.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Extract url / method / headers / body from the fetch arguments, handling
 * both the (input, init) and (Request) call forms.
 */
async function captureCall(
  input: Parameters<typeof globalThis.fetch>[0],
  init: Parameters<typeof globalThis.fetch>[1],
): Promise<FetchCall> {
  if (input instanceof Request) {
    // A Request carries its own url/method/headers/body. If init is also
    // supplied, fetch semantics say init wins for the provided fields, so
    // mirror that.
    const method = init?.method ?? input.method;
    const headers = headersToRecord(
      init?.headers !== undefined ? init.headers : input.headers,
    );
    let body: string | undefined;
    if (init?.body !== undefined && init.body !== null) {
      body = typeof init.body === 'string' ? init.body : String(init.body);
    } else {
      // Drain the request body as text. A GET/HEAD Request has no body and
      // .text() returns ''.
      try {
        const cloned = input.clone();
        const text = await cloned.text();
        body = text === '' ? undefined : text;
      } catch {
        body = undefined;
      }
    }
    return {
      url: input.url,
      method,
      headers,
      body,
    };
  }

  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method ?? 'GET';
  const headers = headersToRecord(init?.headers);
  let body: string | undefined;
  if (init?.body !== undefined && init.body !== null) {
    body = typeof init.body === 'string' ? init.body : String(init.body);
  }
  return { url, method, headers, body };
}

/**
 * Build a fake fetch that returns the given responses in sequence.
 * If more calls are made than responses queued, the next call throws
 * with a helpful message so tests fail loudly rather than returning undefined.
 */
export function mockFetch(responses: MockResponseSpec[]): MockFetchHandle {
  // Eagerly validate every spec so mis-specified mocks fail at setup time
  // rather than after N calls.
  for (const spec of responses) {
    if (spec.body !== undefined && spec.bodyText !== undefined) {
      throw new Error('mock spec: pass either body or bodyText, not both');
    }
  }

  const queue: MockResponseSpec[] = [...responses];
  const calls: FetchCall[] = [];

  const fakeFetch: typeof globalThis.fetch = async (input, init) => {
    const call = await captureCall(input, init);
    calls.push(call);
    const next = queue.shift();
    if (next === undefined) {
      throw new Error(
        `mockFetch: no more responses queued; unexpected call to ${call.url}`,
      );
    }
    return buildResponse(next);
  };

  return {
    fetch: fakeFetch,
    calls,
    remaining: () => queue.length,
  };
}

/**
 * Build a fake sleep that resolves immediately but records the requested
 * duration. Tests can then assert on delays without actually waiting.
 */
export function mockSleep(): MockSleepHandle {
  const delays: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    delays.push(ms);
    return Promise.resolve();
  };
  return {
    sleep,
    delays,
    totalMs: () => delays.reduce((sum, d) => sum + d, 0),
  };
}
