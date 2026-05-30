import { CuteMarketsApiError } from "./errors.js";
import type {
  Aggregate,
  ApiResponse,
  Contract,
  ContractSnapshot,
  ExpirationsResponse,
  IndicatorResult,
  LastTrade,
  Page,
  PaperAccount,
  PaperAccountPayload,
  PaperAccountSummary,
  PaperEquitySnapshot,
  PaperFill,
  PaperOrder,
  PaperPosition,
  Quote,
  RateLimitInfo,
  StockLastQuote,
  StockQuote,
  StockRelatedTicker,
  StockSnapshot,
  StockSnapshotResponse,
  StockTicker,
  StockTickerType,
  StockTrade,
  SystemStatus,
  TickerSearchResult,
  Trade,
} from "./types.js";

type Primitive = string | number | boolean | Date | null | undefined;
export type QueryParams = Record<string, Primitive>;

export interface CuteMarketsClientOptions {
  apiKey?: string;
  optionsApiKey?: string;
  stocksApiKey?: string;
  paperApiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function resolveProductApiKey(
  explicitProduct: string | undefined,
  explicitDefault: string | undefined,
  envName: string,
): string | undefined {
  if (explicitProduct) {
    return explicitProduct;
  }
  if (explicitDefault) {
    return explicitDefault;
  }
  return process.env[envName] ?? process.env.CUTEMARKETS_API_KEY;
}

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
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : {}) as T;
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
  private readonly optionsApiKey?: string;
  private readonly stocksApiKey?: string;
  private readonly paperApiKey?: string;
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

  public readonly stocks: {
    snapshots: {
      all: (params?: QueryParams) => Promise<StockSnapshotResponse>;
      get: (ticker: string, params?: QueryParams) => Promise<StockSnapshot>;
      movers: (direction: "gainers" | "losers" | string, params?: QueryParams) => Promise<StockSnapshotResponse>;
    };
    snapshot: (ticker: string, params?: QueryParams) => Promise<StockSnapshot>;
    tickers: {
      list: (params?: QueryParams) => Promise<Page<StockTicker>>;
      listAll: (params?: QueryParams) => AsyncIterable<StockTicker>;
      types: (params?: QueryParams) => Promise<Page<StockTickerType>>;
      get: (ticker: string, params?: QueryParams) => Promise<ApiResponse<StockTicker>>;
      related: (ticker: string, params?: QueryParams) => Promise<Page<StockRelatedTicker>>;
    };
    trades: {
      list: (ticker: string, params?: QueryParams) => Promise<Page<StockTrade>>;
      listAll: (ticker: string, params?: QueryParams) => AsyncIterable<StockTrade>;
      last: (ticker: string, params?: QueryParams) => Promise<ApiResponse<LastTrade>>;
    };
    quotes: {
      list: (ticker: string, params?: QueryParams) => Promise<Page<StockQuote>>;
      listAll: (ticker: string, params?: QueryParams) => AsyncIterable<StockQuote>;
      last: (ticker: string, params?: QueryParams) => Promise<ApiResponse<StockLastQuote>>;
    };
    aggs: {
      grouped: (date: string, params?: QueryParams) => Promise<Page<Aggregate>>;
      range: (
        ticker: string,
        multiplier: number,
        timespan: string,
        from: string,
        to: string,
        params?: QueryParams,
      ) => Promise<ApiResponse<Aggregate[]>>;
      rangeAll: (
        ticker: string,
        multiplier: number,
        timespan: string,
        from: string,
        to: string,
        params?: QueryParams,
      ) => AsyncIterable<Aggregate>;
      previous: (ticker: string, params?: QueryParams) => Promise<ApiResponse<Aggregate>>;
      openClose: (ticker: string, date: string, params?: QueryParams) => Promise<ApiResponse<Aggregate>>;
    };
    openClose: (ticker: string, date: string, params?: QueryParams) => Promise<ApiResponse<Aggregate>>;
    indicators: {
      sma: (ticker: string, params?: QueryParams) => Promise<ApiResponse<IndicatorResult>>;
      ema: (ticker: string, params?: QueryParams) => Promise<ApiResponse<IndicatorResult>>;
      macd: (ticker: string, params?: QueryParams) => Promise<ApiResponse<IndicatorResult>>;
      rsi: (ticker: string, params?: QueryParams) => Promise<ApiResponse<IndicatorResult>>;
    };
  };

  public readonly paper: {
    accounts: {
      list: (params?: QueryParams) => Promise<Page<PaperAccount>>;
      listAll: (params?: QueryParams) => AsyncIterable<PaperAccount>;
      create: (body?: { name?: string; initial_cash?: string | number }) => Promise<PaperAccountPayload>;
      get: (accountId: string) => Promise<PaperAccountPayload>;
      update: (accountId: string, body: { name: string }) => Promise<PaperAccountPayload>;
      delete: (accountId: string) => Promise<void>;
      reset: (
        accountId: string,
        body?: { confirm?: boolean; initial_cash?: string | number; reason?: string },
      ) => Promise<PaperAccountPayload>;
      summary: (accountId: string) => Promise<PaperAccountSummary>;
      portfolioHistory: (accountId: string) => Promise<Page<PaperEquitySnapshot>>;
    };
    orders: {
      list: (accountId: string, params?: QueryParams) => Promise<Page<PaperOrder>>;
      listAll: (accountId: string, params?: QueryParams) => AsyncIterable<PaperOrder>;
      submit: (
        accountId: string,
        body: {
          symbol: string;
          qty: string | number;
          side: "buy" | "sell" | string;
          type: "market" | "limit" | string;
          time_in_force?: string;
          limit_price?: string | number;
          client_order_id?: string;
          position_intent?: string;
          [key: string]: unknown;
        },
      ) => Promise<PaperOrder>;
      get: (accountId: string, orderId: string) => Promise<PaperOrder>;
      cancel: (accountId: string, orderId: string) => Promise<PaperOrder>;
      byClientOrderId: (accountId: string, clientOrderId: string) => Promise<PaperOrder>;
    };
    positions: (accountId: string) => Promise<Page<PaperPosition>>;
    fills: (accountId: string) => Promise<Page<PaperFill>>;
    portfolioHistory: (accountId: string) => Promise<Page<PaperEquitySnapshot>>;
    account: (accountId: string) => Promise<PaperAccountSummary>;
  };

  constructor(options: CuteMarketsClientOptions = {}) {
    this.optionsApiKey = resolveProductApiKey(options.optionsApiKey, options.apiKey, "CUTEMARKETS_OPTIONS_API_KEY");
    this.stocksApiKey = resolveProductApiKey(options.stocksApiKey, options.apiKey, "CUTEMARKETS_STOCKS_API_KEY");
    this.paperApiKey = resolveProductApiKey(options.paperApiKey, options.apiKey, "CUTEMARKETS_PAPER_API_KEY");
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
        this.requestPage<ContractSnapshot>(`/v1/options/chain/${encodeURIComponent(ticker)}/`, params, this.optionsApiKey),
      chainAll: (ticker, params = {}) =>
        this.paginate(() => this.requestPage<ContractSnapshot>(`/v1/options/chain/${encodeURIComponent(ticker)}/`, params, this.optionsApiKey), this.optionsApiKey),
      snapshot: (underlying, optionContract) =>
        this.request<ApiResponse<ContractSnapshot>>(
          `/v1/options/snapshot/${encodeURIComponent(underlying)}/${encodeURIComponent(optionContract)}/`,
          undefined,
          { apiKey: this.optionsApiKey },
        ),
      contracts: {
        list: (params = {}) => this.requestPage<Contract>("/v1/options/contracts/", params, this.optionsApiKey),
        listAll: (params = {}) => this.paginate(() => this.requestPage<Contract>("/v1/options/contracts/", params, this.optionsApiKey), this.optionsApiKey),
        get: (optionsTicker, params = {}) =>
          this.request<ApiResponse<Contract>>(`/v1/options/contracts/${encodeURIComponent(optionsTicker)}/`, params, { apiKey: this.optionsApiKey }),
      },
      quotes: {
        list: (optionsTicker, params = {}) =>
          this.requestPage<Quote>(`/v1/options/quotes/${encodeURIComponent(optionsTicker)}/`, params, this.optionsApiKey),
        listAll: (optionsTicker, params = {}) =>
          this.paginate(() => this.requestPage<Quote>(`/v1/options/quotes/${encodeURIComponent(optionsTicker)}/`, params, this.optionsApiKey), this.optionsApiKey),
      },
      trades: {
        list: (optionsTicker, params = {}) =>
          this.requestPage<Trade>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/`, params, this.optionsApiKey),
        listAll: (optionsTicker, params = {}) =>
          this.paginate(() => this.requestPage<Trade>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/`, params, this.optionsApiKey), this.optionsApiKey),
        last: (optionsTicker) =>
          this.request<ApiResponse<LastTrade>>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/last/`, undefined, { apiKey: this.optionsApiKey }),
      },
      aggs: {
        range: (ticker, multiplier, timespan, from, to, params = {}) =>
          this.request<ApiResponse<Aggregate[]>>(
            `/v1/options/aggs/${encodeURIComponent(ticker)}/${multiplier}/${encodeURIComponent(timespan)}/${from}/${to}/`,
            params,
            { apiKey: this.optionsApiKey },
          ),
        previous: (ticker, params = {}) =>
          this.request<ApiResponse<Aggregate>>(`/v1/options/aggs/${encodeURIComponent(ticker)}/prev/`, params, { apiKey: this.optionsApiKey }),
      },
    };

    this.stocks = {
      snapshots: {
        all: (params = {}) => this.request<StockSnapshotResponse>("/v1/stocks/snapshot/", params, { apiKey: this.stocksApiKey }),
        get: async (ticker, params = {}) => {
          const payload = await this.request<StockSnapshotResponse>(`/v1/stocks/snapshot/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey });
          if (payload.results && !Array.isArray(payload.results)) {
            return payload.results;
          }
          return payload.ticker ?? (payload.results?.[0] as StockSnapshot | undefined) ?? (payload as unknown as StockSnapshot);
        },
        movers: (direction, params = {}) =>
          this.request<StockSnapshotResponse>(`/v1/stocks/snapshot/movers/${encodeURIComponent(direction)}/`, params, { apiKey: this.stocksApiKey }),
      },
      snapshot: (ticker, params = {}) => this.stocks.snapshots.get(ticker, params),
      tickers: {
        list: (params = {}) => this.requestPage<StockTicker>("/v1/stocks/tickers/", params, this.stocksApiKey),
        listAll: (params = {}) => this.paginate(() => this.requestPage<StockTicker>("/v1/stocks/tickers/", params, this.stocksApiKey), this.stocksApiKey),
        types: (params = {}) => this.requestPage<StockTickerType>("/v1/stocks/tickers/types/", params, this.stocksApiKey),
        get: (ticker, params = {}) =>
          this.request<ApiResponse<StockTicker>>(`/v1/stocks/tickers/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey }),
        related: (ticker, params = {}) =>
          this.requestPage<StockRelatedTicker>(`/v1/stocks/tickers/${encodeURIComponent(ticker)}/related/`, params, this.stocksApiKey),
      },
      trades: {
        list: (ticker, params = {}) => this.requestPage<StockTrade>(`/v1/stocks/trades/${encodeURIComponent(ticker)}/`, params, this.stocksApiKey),
        listAll: (ticker, params = {}) =>
          this.paginate(() => this.requestPage<StockTrade>(`/v1/stocks/trades/${encodeURIComponent(ticker)}/`, params, this.stocksApiKey), this.stocksApiKey),
        last: (ticker, params = {}) =>
          this.request<ApiResponse<LastTrade>>(`/v1/stocks/trades/${encodeURIComponent(ticker)}/last/`, params, { apiKey: this.stocksApiKey }),
      },
      quotes: {
        list: (ticker, params = {}) => this.requestPage<StockQuote>(`/v1/stocks/quotes/${encodeURIComponent(ticker)}/`, params, this.stocksApiKey),
        listAll: (ticker, params = {}) =>
          this.paginate(() => this.requestPage<StockQuote>(`/v1/stocks/quotes/${encodeURIComponent(ticker)}/`, params, this.stocksApiKey), this.stocksApiKey),
        last: (ticker, params = {}) =>
          this.request<ApiResponse<StockLastQuote>>(`/v1/stocks/quotes/${encodeURIComponent(ticker)}/last/`, params, { apiKey: this.stocksApiKey }),
      },
      aggs: {
        grouped: (date, params = {}) => this.requestPage<Aggregate>(`/v1/stocks/aggs/grouped/${date}/`, params, this.stocksApiKey),
        range: (ticker, multiplier, timespan, from, to, params = {}) =>
          this.request<ApiResponse<Aggregate[]>>(
            `/v1/stocks/aggs/${encodeURIComponent(ticker)}/${multiplier}/${encodeURIComponent(timespan)}/${from}/${to}/`,
            params,
            { apiKey: this.stocksApiKey },
          ),
        rangeAll: (ticker, multiplier, timespan, from, to, params = {}) =>
          this.paginate(
            () => this.requestPage<Aggregate>(
              `/v1/stocks/aggs/${encodeURIComponent(ticker)}/${multiplier}/${encodeURIComponent(timespan)}/${from}/${to}/`,
              params,
              this.stocksApiKey,
            ),
            this.stocksApiKey,
          ),
        previous: (ticker, params = {}) =>
          this.request<ApiResponse<Aggregate>>(`/v1/stocks/aggs/${encodeURIComponent(ticker)}/prev/`, params, { apiKey: this.stocksApiKey }),
        openClose: (ticker, date, params = {}) =>
          this.request<ApiResponse<Aggregate>>(`/v1/stocks/open-close/${encodeURIComponent(ticker)}/${date}/`, params, { apiKey: this.stocksApiKey }),
      },
      openClose: (ticker, date, params = {}) => this.stocks.aggs.openClose(ticker, date, params),
      indicators: {
        sma: (ticker, params = {}) =>
          this.request<ApiResponse<IndicatorResult>>(`/v1/stocks/indicators/sma/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey }),
        ema: (ticker, params = {}) =>
          this.request<ApiResponse<IndicatorResult>>(`/v1/stocks/indicators/ema/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey }),
        macd: (ticker, params = {}) =>
          this.request<ApiResponse<IndicatorResult>>(`/v1/stocks/indicators/macd/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey }),
        rsi: (ticker, params = {}) =>
          this.request<ApiResponse<IndicatorResult>>(`/v1/stocks/indicators/rsi/${encodeURIComponent(ticker)}/`, params, { apiKey: this.stocksApiKey }),
      },
    };

    this.paper = {
      accounts: {
        list: (params = {}) => this.requestPage<PaperAccount>("/v1/paper/accounts/", params, this.paperApiKey),
        listAll: (params = {}) => this.paginate(() => this.requestPage<PaperAccount>("/v1/paper/accounts/", params, this.paperApiKey), this.paperApiKey),
        create: (body = {}) =>
          this.request<PaperAccountPayload>("/v1/paper/accounts/", undefined, {
            method: "POST",
            apiKey: this.paperApiKey,
            body: { name: body.name ?? "Paper Account", initial_cash: String(body.initial_cash ?? "100000") },
          }),
        get: (accountId) =>
          this.request<PaperAccountPayload>(`/v1/paper/accounts/${accountId}/`, undefined, { apiKey: this.paperApiKey }),
        update: (accountId, body) =>
          this.request<PaperAccountPayload>(`/v1/paper/accounts/${accountId}/`, undefined, { method: "PATCH", apiKey: this.paperApiKey, body }),
        delete: async (accountId) => {
          await this.request<Record<string, never>>(`/v1/paper/accounts/${accountId}/`, undefined, { method: "DELETE", apiKey: this.paperApiKey });
        },
        reset: (accountId, body = {}) =>
          this.request<PaperAccountPayload>(`/v1/paper/accounts/${accountId}/reset/`, undefined, {
            method: "POST",
            apiKey: this.paperApiKey,
            body: { confirm: body.confirm ?? true, ...(body.initial_cash === undefined ? {} : { initial_cash: String(body.initial_cash) }), ...(body.reason ? { reason: body.reason } : {}) },
          }),
        summary: (accountId) =>
          this.request<PaperAccountSummary>(`/v1/paper/accounts/${accountId}/account/`, undefined, { apiKey: this.paperApiKey }),
        portfolioHistory: (accountId) =>
          this.requestPage<PaperEquitySnapshot>(`/v1/paper/accounts/${accountId}/portfolio/history/`, undefined, this.paperApiKey),
      },
      orders: {
        list: (accountId, params = {}) => this.requestPage<PaperOrder>(`/v1/paper/accounts/${accountId}/orders/`, params, this.paperApiKey),
        listAll: (accountId, params = {}) =>
          this.paginate(() => this.requestPage<PaperOrder>(`/v1/paper/accounts/${accountId}/orders/`, params, this.paperApiKey), this.paperApiKey),
        submit: (accountId, body) =>
          this.request<PaperOrder>(`/v1/paper/accounts/${accountId}/orders/`, undefined, {
            method: "POST",
            apiKey: this.paperApiKey,
            body: { ...body, qty: String(body.qty), ...(body.limit_price === undefined ? {} : { limit_price: String(body.limit_price) }) },
          }),
        get: (accountId, orderId) =>
          this.request<PaperOrder>(`/v1/paper/accounts/${accountId}/orders/${orderId}/`, undefined, { apiKey: this.paperApiKey }),
        cancel: (accountId, orderId) =>
          this.request<PaperOrder>(`/v1/paper/accounts/${accountId}/orders/${orderId}/`, undefined, { method: "DELETE", apiKey: this.paperApiKey }),
        byClientOrderId: (accountId, clientOrderId) =>
          this.request<PaperOrder>(`/v1/paper/accounts/${accountId}/orders:by_client_order_id`, { client_order_id: clientOrderId }, { apiKey: this.paperApiKey }),
      },
      positions: (accountId) => this.requestPage<PaperPosition>(`/v1/paper/accounts/${accountId}/positions/`, undefined, this.paperApiKey),
      fills: (accountId) => this.requestPage<PaperFill>(`/v1/paper/accounts/${accountId}/fills/`, undefined, this.paperApiKey),
      portfolioHistory: (accountId) => this.paper.accounts.portfolioHistory(accountId),
      account: (accountId) => this.paper.accounts.summary(accountId),
    };
  }

  public async status(): Promise<SystemStatus> {
    return this.request<SystemStatus>("/v1/status/", undefined, { apiKey: undefined });
  }

  public async nextPage<T>(page: ApiResponse<T[]>, apiKey = this.optionsApiKey): Promise<Page<T> | null> {
    if (!page.next_url) {
      return null;
    }
    return this.requestAbsolute<Page<T>>(page.next_url, { apiKey });
  }

  public async *paginate<T>(request: (() => Promise<Page<T>>) | Page<T>, apiKey = this.optionsApiKey): AsyncIterable<T> {
    let page = typeof request === "function" ? await request() : request;
    while (page) {
      for (const item of page.results ?? []) {
        yield item;
      }
      const next = await this.nextPage(page, apiKey);
      if (!next) {
        break;
      }
      page = next;
    }
  }

  private async requestPage<T>(path: string, params?: QueryParams, apiKey = this.optionsApiKey): Promise<Page<T>> {
    return this.request<Page<T>>(path, params, { apiKey });
  }

  private async request<T extends object>(
    path: string,
    params?: QueryParams,
    options: { method?: string; apiKey?: string; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQuery(url, params);
    return this.executeRequest<T>(url, { apiKey: this.optionsApiKey, ...options });
  }

  private async requestAbsolute<T extends object>(
    urlLike: string,
    options: { method?: string; apiKey?: string; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(urlLike);
    return this.executeRequest<T>(url, { apiKey: this.optionsApiKey, ...options });
  }

  private async executeRequest<T extends object>(
    url: URL,
    options: { method?: string; apiKey?: string; body?: unknown } = {},
  ): Promise<T> {
    const headers = new Headers(this.headers);
    headers.set("Accept", "application/json");
    if (options.apiKey) {
      headers.set("Authorization", `Bearer ${options.apiKey}`);
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: options.method ?? "GET",
          headers,
          body,
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
