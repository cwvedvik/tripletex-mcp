/**
 * Tripletex API Client
 * Handles authentication and HTTP requests to the Tripletex REST API.
 *
 * Standalone MCP: pass no constructor args — reads TRIPLETEX_* env vars.
 * Programmatic use: pass TripletexClientOptions (matches multi-tenant host apps).
 */

const PROD_BASE = "https://tripletex.no/v2";
const TEST_BASE = "https://api-test.tripletex.tech/v2";

interface SessionToken {
  token: string;
  expiresAt: string;
}

export interface TripletexClientOptions {
  consumerToken: string;
  employeeToken: string;
  baseUrl?: string;
  /** Max retries on 429. Default 3. */
  maxRetries?: number;
  /** Initial backoff in ms when no rate-limit header present. Default 1000. */
  initialBackoffMs?: number;
  /** Override fetch (for tests or custom transports). Default globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Override sleep (for tests). Default setTimeout-based. */
  sleep?: (ms: number) => Promise<void>;
}

export class TripletexApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly bodyText: string
  ) {
    super(message);
    this.name = "TripletexApiError";
  }
}

export class TripletexRateLimitError extends TripletexApiError {
  constructor(
    message: string,
    status: number,
    bodyText: string,
    public readonly retryAfterMs: number,
  ) {
    super(message, status, bodyText);
    this.name = "TripletexRateLimitError";
  }
}

export function computeBackoffMs(
  attempt: number,
  headers: Headers,
  initialBackoffMs: number,
): number {
  const reset = headers.get("X-Rate-Limit-Reset");
  if (reset !== null && !Number.isNaN(Number(reset))) {
    return Math.max(0, Number(reset) * 1000);
  }
  const retryAfter = headers.get("Retry-After");
  if (retryAfter !== null && !Number.isNaN(Number(retryAfter))) {
    return Math.max(0, Number(retryAfter) * 1000);
  }
  return initialBackoffMs * (attempt + 1);
}

export class TripletexClient {
  private consumerToken: string;
  private employeeToken: string;
  private baseUrl: string;
  private session: SessionToken | null = null;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options?: TripletexClientOptions) {
    if (options) {
      this.consumerToken = options.consumerToken;
      this.employeeToken = options.employeeToken;
      this.baseUrl = options.baseUrl ?? PROD_BASE;
      this.maxRetries = options.maxRetries ?? 3;
      this.initialBackoffMs = options.initialBackoffMs ?? 1000;
      this.fetchImpl = options.fetch ?? globalThis.fetch;
      this.sleepImpl =
        options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
      return;
    }
    const consumer = process.env.TRIPLETEX_CONSUMER_TOKEN;
    const employee = process.env.TRIPLETEX_EMPLOYEE_TOKEN;
    if (!consumer || !employee) {
      throw new Error(
        "Missing TRIPLETEX_CONSUMER_TOKEN or TRIPLETEX_EMPLOYEE_TOKEN env vars"
      );
    }
    this.consumerToken = consumer;
    this.employeeToken = employee;
    this.baseUrl =
      process.env.TRIPLETEX_ENV === "test" ? TEST_BASE : PROD_BASE;
    this.maxRetries = 3;
    this.initialBackoffMs = 1000;
    this.fetchImpl = globalThis.fetch;
    this.sleepImpl = (ms: number) => new Promise((r) => setTimeout(r, ms));
  }

  private async createSession(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expDate = tomorrow.toISOString().split("T")[0];

    const url = `${this.baseUrl}/token/session/:create?consumerToken=${encodeURIComponent(this.consumerToken)}&employeeToken=${encodeURIComponent(this.employeeToken)}&expirationDate=${expDate}`;

    const res = await this.fetchImpl(url, { method: "PUT" });
    if (!res.ok) {
      const text = await res.text();
      throw new TripletexApiError(
        `Session create failed (${res.status})`,
        res.status,
        text
      );
    }
    const data = (await res.json()) as { value: { token: string } };
    this.session = {
      token: data.value.token,
      expiresAt: expDate,
    };
  }

  private async ensureSession(): Promise<string> {
    const now = new Date().toISOString().split("T")[0];
    if (!this.session || this.session.expiresAt <= now) {
      await this.createSession();
    }
    return this.session!.token;
  }

  private authHeader(sessionToken: string): string {
    return "Basic " + Buffer.from(`0:${sessionToken}`).toString("base64");
  }

  private async fetchWithRetry(
    method: string,
    path: string,
    buildRequest: () => Promise<Response>,
  ): Promise<Response> {
    let sessionRefreshed = false;
    let attempt = 0;

    for (;;) {
      const res = await buildRequest();

      if (res.status === 401 && !sessionRefreshed) {
        this.session = null;
        sessionRefreshed = true;
        continue;
      }

      if (res.status === 429) {
        const backoffMs = computeBackoffMs(
          attempt,
          res.headers,
          this.initialBackoffMs,
        );
        if (attempt >= this.maxRetries) {
          const text = await res.text();
          throw new TripletexRateLimitError(
            `Tripletex ${method} ${path} rate limited (429) after ${attempt} retries`,
            429,
            text,
            backoffMs,
          );
        }
        await this.sleepImpl(backoffMs);
        attempt++;
        continue;
      }

      return res;
    }
  }

  async request(
    method: string,
    path: string,
    params?: Record<string, string>,
    body?: unknown,
  ): Promise<unknown> {
    const res = await this.fetchWithRetry(method, path, async () => {
      const token = await this.ensureSession();
      const url = new URL(`${this.baseUrl}${path}`);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v);
        }
      }
      return this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: this.authHeader(token),
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    });

    const text = await res.text();
    if (!res.ok) {
      throw new TripletexApiError(
        `Tripletex ${method} ${path} (${res.status})`,
        res.status,
        text,
      );
    }
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async get(path: string, params?: Record<string, string>) {
    return this.request("GET", path, params);
  }

  async post(path: string, body: unknown, params?: Record<string, string>) {
    return this.request("POST", path, params, body);
  }

  async put(path: string, body: unknown, params?: Record<string, string>) {
    return this.request("PUT", path, params, body);
  }

  async delete(path: string, params?: Record<string, string>) {
    return this.request("DELETE", path, params);
  }

  /**
   * POST multipart/form-data (e.g. voucher import or attachment). Does not set Content-Type;
   * fetch sets the boundary automatically.
   */
  async postMultipart(
    path: string,
    formData: FormData,
    params?: Record<string, string>
  ): Promise<unknown> {
    return this.multipartRequest("POST", path, params, formData);
  }

  private async multipartRequest(
    method: "POST",
    path: string,
    params: Record<string, string> | undefined,
    formData: FormData,
  ): Promise<unknown> {
    const res = await this.fetchWithRetry(method, path, async () => {
      const token = await this.ensureSession();
      const url = new URL(`${this.baseUrl}${path}`);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        }
      }
      return this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: this.authHeader(token),
          Accept: "application/json",
        },
        body: formData,
      });
    });

    const text = await res.text();
    if (!res.ok) {
      throw new TripletexApiError(
        `Tripletex ${method} ${path} (${res.status})`,
        res.status,
        text,
      );
    }
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}
