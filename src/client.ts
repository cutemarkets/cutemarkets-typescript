import { CuteMarketsApiError } from "./errors.js";
import type {
  Aggregate,
  ApiResponse,
  Contract,
  ContractSnapshot,
  ExpirationsResponse,
  LastTrade,
  Page,
  Quote,
  RateLimitInfo,
  SystemStatus,
  TickerSearchResult,
  Trade,
} from "./types.js";

type Primitive = string | number | boolean | Date | null | undefined;
export type QueryParams = Record<string, Primitive>;

export interface CuteMarketsClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function appendQuery(url: URL, params?: QueryParams): void {
  if (!params) {
    return;
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const serialized =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "boolean"
          ? (value ? "true" : "false")
          : String(value);
    const normalizedKey = key.replace(/_(gte|gt|lte|lt)$/, ".$1");
    url.searchParams.set(normalizedKey, serialized);
  }
}

function parseRateLimit(headers: Headers): RateLimitInfo {
  const parseIntValue = (value: string | null): number | undefined => {
    if (value === null || value === "") {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    plan: headers.get("x-ratelimit-plan") ?? undefined,
    limit_minute: headers.get("x-ratelimit-limit-minute") ?? undefined,
    remaining_minute: parseIntValue(headers.get("x-ratelimit-remaining-minute")),
    limit_day: headers.get("x-ratelimit-limit-day") ?? undefined,
    remaining_day: parseIntValue(headers.get("x-ratelimit-remaining-day")),
  };
}

function mergeResponseMeta<T extends object>(payload: T, response: Response): T {
  return {
    ...payload,
    rate_limit: parseRateLimit(response.headers),
  } as T;
}

async function parseJson<T extends object>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  const enriched = mergeResponseMeta(payload, response);
  if (!response.ok) {
    const meta = enriched as unknown as Partial<ApiResponse<unknown>>;
    const error = meta.error;
    throw new CuteMarketsApiError(error?.message ?? `Request failed with ${response.status}`, {
      status: response.status,
      code: error?.code,
      requestId: meta.request_id,
      rateLimit: meta.rate_limit,
    });
  }
  return enriched;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class CuteMarketsClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers?: HeadersInit;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  public lastRequestId?: string;
  public lastRateLimit?: RateLimitInfo;

  public readonly tickers: {
    search: (params?: QueryParams) => Promise<ApiResponse<TickerSearchResult[]>>;
    searchAll: (params?: QueryParams) => AsyncIterable<TickerSearchResult>;
    expirations: (ticker: string) => Promise<ExpirationsResponse>;
  };

  public readonly options: {
    chain: (ticker: string, params?: QueryParams) => Promise<Page<ContractSnapshot>>;
    chainAll: (ticker: string, params?: QueryParams) => AsyncIterable<ContractSnapshot>;
    snapshot: (underlying: string, optionContract: string) => Promise<ApiResponse<ContractSnapshot>>;
    contracts: {
      list: (params?: QueryParams) => Promise<Page<Contract>>;
      listAll: (params?: QueryParams) => AsyncIterable<Contract>;
      get: (optionsTicker: string, params?: QueryParams) => Promise<ApiResponse<Contract>>;
    };
    quotes: {
      list: (optionsTicker: string, params?: QueryParams) => Promise<Page<Quote>>;
      listAll: (optionsTicker: string, params?: QueryParams) => AsyncIterable<Quote>;
    };
    trades: {
      list: (optionsTicker: string, params?: QueryParams) => Promise<Page<Trade>>;
      listAll: (optionsTicker: string, params?: QueryParams) => AsyncIterable<Trade>;
      last: (optionsTicker: string) => Promise<ApiResponse<LastTrade>>;
    };
    aggs: {
      range: (
        ticker: string,
        multiplier: number,
        timespan: string,
        from: string,
        to: string,
        params?: QueryParams,
      ) => Promise<ApiResponse<Aggregate[]>>;
      previous: (ticker: string, params?: QueryParams) => Promise<ApiResponse<Aggregate>>;
    };
  };

  constructor(options: CuteMarketsClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.CUTEMARKETS_API_KEY;
    this.baseUrl = (options.baseUrl ?? "https://api.cutemarkets.com").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.headers = options.headers;
    this.timeoutMs = Math.max(1, Math.trunc(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    this.maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES));

    this.tickers = {
      search: (params = {}) => this.requestPage<TickerSearchResult>("/v1/tickers/search/", params),
      searchAll: (params = {}) => this.paginate(() => this.requestPage<TickerSearchResult>("/v1/tickers/search/", params)),
      expirations: (ticker) =>
        this.request<ExpirationsResponse>(`/v1/tickers/expirations/${encodeURIComponent(ticker)}/`),
    };

    this.options = {
      chain: (ticker, params = {}) =>
        this.requestPage<ContractSnapshot>(`/v1/options/chain/${encodeURIComponent(ticker)}/`, params),
      chainAll: (ticker, params = {}) =>
        this.paginate(() => this.requestPage<ContractSnapshot>(`/v1/options/chain/${encodeURIComponent(ticker)}/`, params)),
      snapshot: (underlying, optionContract) =>
        this.request<ApiResponse<ContractSnapshot>>(
          `/v1/options/snapshot/${encodeURIComponent(underlying)}/${encodeURIComponent(optionContract)}/`,
        ),
      contracts: {
        list: (params = {}) => this.requestPage<Contract>("/v1/options/contracts/", params),
        listAll: (params = {}) => this.paginate(() => this.requestPage<Contract>("/v1/options/contracts/", params)),
        get: (optionsTicker, params = {}) =>
          this.request<ApiResponse<Contract>>(`/v1/options/contracts/${encodeURIComponent(optionsTicker)}/`, params),
      },
      quotes: {
        list: (optionsTicker, params = {}) =>
          this.requestPage<Quote>(`/v1/options/quotes/${encodeURIComponent(optionsTicker)}/`, params),
        listAll: (optionsTicker, params = {}) =>
          this.paginate(() => this.requestPage<Quote>(`/v1/options/quotes/${encodeURIComponent(optionsTicker)}/`, params)),
      },
      trades: {
        list: (optionsTicker, params = {}) =>
          this.requestPage<Trade>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/`, params),
        listAll: (optionsTicker, params = {}) =>
          this.paginate(() => this.requestPage<Trade>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/`, params)),
        last: (optionsTicker) =>
          this.request<ApiResponse<LastTrade>>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/last/`),
      },
      aggs: {
        range: (ticker, multiplier, timespan, from, to, params = {}) =>
          this.request<ApiResponse<Aggregate[]>>(
            `/v1/options/aggs/${encodeURIComponent(ticker)}/${multiplier}/${encodeURIComponent(timespan)}/${from}/${to}/`,
            params,
          ),
        previous: (ticker, params = {}) =>
          this.request<ApiResponse<Aggregate>>(`/v1/options/aggs/${encodeURIComponent(ticker)}/prev/`, params),
      },
    };
  }

  public async status(): Promise<SystemStatus> {
    return this.request<SystemStatus>("/v1/status/");
  }

  public async nextPage<T>(page: ApiResponse<T[]>): Promise<Page<T> | null> {
    if (!page.next_url) {
      return null;
    }
    return this.requestAbsolute<Page<T>>(page.next_url);
  }

  public async *paginate<T>(request: (() => Promise<Page<T>>) | Page<T>): AsyncIterable<T> {
    let page = typeof request === "function" ? await request() : request;
    while (page) {
      for (const item of page.results ?? []) {
        yield item;
      }
      const next = await this.nextPage(page);
      if (!next) {
        break;
      }
      page = next;
    }
  }

  private async requestPage<T>(path: string, params?: QueryParams): Promise<Page<T>> {
    return this.request<Page<T>>(path, params);
  }

  private async request<T extends object>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQuery(url, params);
    return this.executeRequest<T>(url);
  }

  private async requestAbsolute<T extends object>(urlLike: string): Promise<T> {
    const url = new URL(urlLike);
    return this.executeRequest<T>(url);
  }

  private async executeRequest<T extends object>(url: URL): Promise<T> {
    const headers = new Headers(this.headers);
    headers.set("Accept", "application/json");
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          await sleep(200 * (attempt + 1));
          continue;
        }
        const parsed = await parseJson<T>(response);
        const meta = parsed as unknown as Partial<ApiResponse<unknown>>;
        this.lastRequestId = meta.request_id;
        this.lastRateLimit = meta.rate_limit;
        return parsed;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error instanceof CuteMarketsApiError) {
          this.lastRequestId = error.requestId;
          this.lastRateLimit = (error.rateLimit ?? undefined) as RateLimitInfo | undefined;
          if (RETRYABLE_STATUS_CODES.has(error.status) && attempt < this.maxRetries) {
            await sleep(200 * (attempt + 1));
            continue;
          }
        }
        if (attempt < this.maxRetries) {
          await sleep(200 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("CuteMarkets request failed");
  }
}
