export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type Clock = () => Date;

export interface Provenance {
  provider: string;
  sourceId?: string;
  observedAt?: Date;
  receivedAt: Date;
  sdkVersion?: string;
  transforms?: string[];
  integrity?: string;
}

export interface DataQuality {
  completeness: number;
  confidence?: number;
  freshnessMs?: number;
  accuracy?: number;
  consistency?: number;
  flags: string[];
}

export interface Estimate<T> {
  value: T;
  timestamp: Date;
  provenance: Provenance;
  quality: DataQuality;
  uncertainty?: unknown;
}

export class OpenDefenceError extends Error {
  code: string;
  constructor(message: string, code = "OPENDEFENCE_ERROR", options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}
export class ValidationError extends OpenDefenceError {
  constructor(message: string) { super(message, "VALIDATION_ERROR"); }
}
export class TimeoutError extends OpenDefenceError {
  constructor(message = "Request timed out") { super(message, "TIMEOUT"); }
}
export class CircuitOpenError extends OpenDefenceError {
  constructor() { super("Circuit breaker is open", "CIRCUIT_OPEN"); }
}
export class HttpError extends OpenDefenceError {
  readonly status: number;
  readonly body?: string;
  constructor(status: number, message: string, body?: string) {
    super(message, "HTTP_ERROR");
    this.status = status;
    if (body !== undefined) this.body = body;
  }
}
export class RateLimitError extends HttpError {
  readonly retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number, body?: string) {
    super(429, message, body);
    this.code = "RATE_LIMIT";
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear?(): Promise<void>;
}

type CacheEntry<T> = { value: T; expiresAt: number };
export class MemoryCache implements CacheAdapter {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  constructor(private readonly maxEntries = 1_000, private readonly now = () => Date.now()) {}
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (this.entries.size >= this.maxEntries) {
      const first = this.entries.keys().next().value as string | undefined;
      if (first) this.entries.delete(first);
    }
    this.entries.set(key, { value, expiresAt: this.now() + Math.max(0, ttlMs) });
  }
  async delete(key: string): Promise<void> { this.entries.delete(key); }
  async clear(): Promise<void> { this.entries.clear(); }
}

export class TieredCache implements CacheAdapter {
  constructor(private readonly tiers: CacheAdapter[]) {
    if (tiers.length === 0) throw new ValidationError("TieredCache requires at least one tier");
  }
  async get<T>(key: string): Promise<T | undefined> {
    for (let i = 0; i < this.tiers.length; i++) {
      const value = await this.tiers[i]!.get<T>(key);
      if (value !== undefined) {
        await Promise.all(this.tiers.slice(0, i).map(t => t.set(key, value, 60_000)));
        return value;
      }
    }
    return undefined;
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await Promise.all(this.tiers.map(t => t.set(key, value, ttlMs)));
  }
  async delete(key: string): Promise<void> { await Promise.all(this.tiers.map(t => t.delete(key))); }
  async clear(): Promise<void> { await Promise.all(this.tiers.map(t => t.clear?.())); }
}

export type TelemetryEvent =
  | { type: "request"; url: string; method: string }
  | { type: "response"; url: string; status: number; durationMs: number }
  | { type: "cache-hit"; url: string }
  | { type: "retry"; url: string; attempt: number; delayMs: number }
  | { type: "error"; url: string; error: unknown }
  | { type: "circuit-open"; url: string };

export interface HttpClientOptions {
  fetch?: typeof fetch;
  cache?: CacheAdapter | false;
  cacheTtlMs?: number;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
  minRequestIntervalMs?: number;
  headers?: HeadersInit;
  onTelemetry?: (event: TelemetryEvent) => void;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
}

export interface RequestOptions extends RequestInit {
  cacheTtlMs?: number;
  parseAs?: "json" | "text" | "arrayBuffer";
  dedupe?: boolean;
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new ValidationError("maxConcurrency must be >= 1");
  }
  async acquire(): Promise<() => void> {
    if (this.active >= this.max) await new Promise<void>(resolve => this.waiting.push(resolve));
    this.active++;
    return () => {
      this.active--;
      this.waiting.shift()?.();
    };
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxRequests: number;
}

class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private halfOpenRequests = 0;
  constructor(private readonly options: CircuitBreakerOptions) {}
  canRequest(now = Date.now()): boolean {
    if (this.failures < this.options.failureThreshold) return true;
    if (now - this.openedAt >= this.options.resetTimeoutMs && this.halfOpenRequests < this.options.halfOpenMaxRequests) {
      this.halfOpenRequests++;
      return true;
    }
    return false;
  }
  success(): void { this.failures = 0; this.openedAt = 0; this.halfOpenRequests = 0; }
  failure(now = Date.now()): void {
    this.failures++;
    if (this.failures >= this.options.failureThreshold) this.openedAt = now;
    this.halfOpenRequests = 0;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, (date - Date.now()) / 1000);
  return undefined;
}

function abortSignalWithTimeout(timeoutMs: number, outer?: AbortSignal | null): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);
  const onAbort = () => controller.abort(outer?.reason);
  outer?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => { clearTimeout(timer); outer?.removeEventListener("abort", onAbort); },
  };
}

export class HttpClient {
  private readonly fetcher: typeof fetch;
  private readonly cache: CacheAdapter | false;
  private readonly cacheTtlMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private readonly minRequestIntervalMs: number;
  private readonly headers: HeadersInit;
  private readonly telemetry: ((event: TelemetryEvent) => void) | undefined;
  private readonly semaphore: Semaphore;
  private readonly breaker?: CircuitBreaker;
  private lastRequestAt = 0;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: HttpClientOptions = {}) {
    this.fetcher = options.fetch ?? fetch;
    this.cache = options.cache === false ? false : (options.cache ?? new MemoryCache());
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.retries = options.retries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 0;
    this.headers = options.headers ?? {};
    this.telemetry = options.onTelemetry;
    this.semaphore = new Semaphore(options.maxConcurrency ?? 6);
    if (options.circuitBreaker !== false) {
      this.breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000, halfOpenMaxRequests: 1, ...options.circuitBreaker });
    }
  }

  async request<T>(url: string | URL, options: RequestOptions = {}): Promise<T> {
    const method = (options.method ?? "GET").toUpperCase();
    const parseAs = options.parseAs ?? "json";
    const key = `${method}:${url.toString()}:${stableStringify(options.body ?? null)}:${parseAs}`;
    const cacheable = method === "GET" && this.cache !== false;
    if (cacheable) {
      const cached = await this.cache.get<T>(key);
      if (cached !== undefined) { this.telemetry?.({ type: "cache-hit", url: url.toString() }); return cached; }
    }
    if (method === "GET" && options.dedupe !== false) {
      const pending = this.inflight.get(key);
      if (pending) return pending as Promise<T>;
    }
    const promise = this.execute<T>(url, options, method, parseAs, key, cacheable);
    if (method === "GET" && options.dedupe !== false) this.inflight.set(key, promise);
    try { return await promise; } finally { this.inflight.delete(key); }
  }

  async json<T>(url: string | URL, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, parseAs: "json" });
  }

  private async execute<T>(url: string | URL, options: RequestOptions, method: string, parseAs: "json" | "text" | "arrayBuffer", key: string, cacheable: boolean): Promise<T> {
    const fullUrl = url.toString();
    if (this.breaker && !this.breaker.canRequest()) { this.telemetry?.({ type: "circuit-open", url: fullUrl }); throw new CircuitOpenError(); }
    const release = await this.semaphore.acquire();
    try {
      const wait = this.minRequestIntervalMs - (Date.now() - this.lastRequestAt);
      if (wait > 0) await sleep(wait);
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        const started = Date.now();
        const { signal, cleanup } = abortSignalWithTimeout(this.timeoutMs, options.signal);
        try {
          this.lastRequestAt = Date.now();
          this.telemetry?.({ type: "request", url: fullUrl, method });
          const response = await this.fetcher(url, { ...options, method, signal, headers: { ...Object.fromEntries(new Headers(this.headers)), ...Object.fromEntries(new Headers(options.headers)) } });
          const durationMs = Date.now() - started;
          this.telemetry?.({ type: "response", url: fullUrl, status: response.status, durationMs });
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            if (response.status === 429) throw new RateLimitError(`Rate limited: ${fullUrl}`, retryAfterSeconds(response.headers.get("retry-after")), body);
            throw new HttpError(response.status, `HTTP ${response.status} for ${fullUrl}`, body);
          }
          const value = (parseAs === "json" ? await response.json() : parseAs === "text" ? await response.text() : await response.arrayBuffer()) as T;
          this.breaker?.success();
          if (cacheable && this.cache) await this.cache.set(key, value, options.cacheTtlMs ?? this.cacheTtlMs);
          return value;
        } catch (error) {
          lastError = error;
          const retryable = error instanceof RateLimitError || error instanceof TimeoutError || error instanceof TypeError || (error instanceof HttpError && error.status >= 500);
          if (!retryable || attempt >= this.retries) {
            this.breaker?.failure();
            this.telemetry?.({ type: "error", url: fullUrl, error });
            throw error;
          }
          const serverDelay = error instanceof RateLimitError ? (error.retryAfterSeconds ?? 0) * 1000 : 0;
          const backoff = Math.max(serverDelay, this.retryDelayMs * 2 ** attempt * (0.75 + Math.random() * 0.5));
          this.telemetry?.({ type: "retry", url: fullUrl, attempt: attempt + 1, delayMs: backoff });
          await sleep(backoff);
        } finally { cleanup(); }
      }
      throw lastError;
    } finally { release(); }
  }
}

export function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, Math.max(0, ms))); }
export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function assertFinite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new ValidationError(`${name} must be finite`);
  return value;
}
export function assertRange(value: number, min: number, max: number, name: string): number {
  assertFinite(value, name);
  if (value < min || value > max) throw new ValidationError(`${name} must be in [${min}, ${max}]`);
  return value;
}
export function iso(date: Date | string | number): string { return new Date(date).toISOString(); }
export function nowProvenance(provider: string, sourceId?: string, clock: Clock = () => new Date()): Provenance {
  const value: Provenance = { provider, receivedAt: clock() };
  if (sourceId !== undefined) value.sourceId = sourceId;
  return value;
}
export function freshnessMs(provenance: Provenance, now = new Date()): number | undefined {
  const source = provenance.observedAt ?? provenance.receivedAt;
  return Number.isFinite(source.getTime()) ? Math.max(0, now.getTime() - source.getTime()) : undefined;
}
export function dataQuality(input: Partial<DataQuality> = {}): DataQuality {
  return { completeness: clamp(input.completeness ?? 1, 0, 1), flags: [...(input.flags ?? [])], ...(input.confidence === undefined ? {} : { confidence: clamp(input.confidence, 0, 1) }), ...(input.freshnessMs === undefined ? {} : { freshnessMs: Math.max(0, input.freshnessMs) }), ...(input.accuracy === undefined ? {} : { accuracy: input.accuracy }), ...(input.consistency === undefined ? {} : { consistency: clamp(input.consistency, 0, 1) }) };
}

export interface Page<T> { items: T[]; next?: string; count?: number; }
export interface Provider<TQuery, TResult> {
  readonly id: string;
  query(query: TQuery): Promise<TResult>;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, Provider<unknown, unknown>>();
  register<TQ, TR>(provider: Provider<TQ, TR>): this {
    if (this.providers.has(provider.id)) throw new ValidationError(`Provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider as Provider<unknown, unknown>);
    return this;
  }
  get<TQ, TR>(id: string): Provider<TQ, TR> {
    const provider = this.providers.get(id);
    if (!provider) throw new ValidationError(`Unknown provider: ${id}`);
    return provider as Provider<TQ, TR>;
  }
  has(id: string): boolean { return this.providers.has(id); }
  ids(): string[] { return [...this.providers.keys()].sort(); }
}
