import { CuteMarketsApiError } from "./errors.js";
import type {
  Aggregate,
  ApiResponse,
  Contract,
  ContractSnapshot,
  ExpirationsResponse,
  LastTrade,
  Quote,
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

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T> | Record<string, unknown>;
  if (!response.ok) {
    const error = (payload as ApiResponse<T>).error;
    throw new CuteMarketsApiError(error?.message ?? `Request failed with ${response.status}`, {
      status: response.status,
      code: error?.code,
      requestId: (payload as ApiResponse<T>).request_id,
    });
  }
  return payload as T;
}

export class CuteMarketsClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers?: HeadersInit;

  public readonly tickers: {
    search: (params?: QueryParams) => Promise<ApiResponse<TickerSearchResult[]>>;
    expirations: (ticker: string) => Promise<ExpirationsResponse>;
  };

  public readonly options: {
    chain: (ticker: string, params?: QueryParams) => Promise<ApiResponse<ContractSnapshot[]>>;
    snapshot: (underlying: string, optionContract: string) => Promise<ApiResponse<ContractSnapshot>>;
    contracts: {
      list: (params?: QueryParams) => Promise<ApiResponse<Contract[]>>;
      get: (optionsTicker: string, params?: QueryParams) => Promise<ApiResponse<Contract>>;
    };
    quotes: {
      list: (optionsTicker: string, params?: QueryParams) => Promise<ApiResponse<Quote[]>>;
    };
    trades: {
      list: (optionsTicker: string, params?: QueryParams) => Promise<ApiResponse<Trade[]>>;
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

    this.tickers = {
      search: (params = {}) => this.request<ApiResponse<TickerSearchResult[]>>("/v1/tickers/search/", params),
      expirations: (ticker) =>
        this.request<ExpirationsResponse>(`/v1/tickers/expirations/${encodeURIComponent(ticker)}/`),
    };

    this.options = {
      chain: (ticker, params = {}) =>
        this.request<ApiResponse<ContractSnapshot[]>>(`/v1/options/chain/${encodeURIComponent(ticker)}/`, params),
      snapshot: (underlying, optionContract) =>
        this.request<ApiResponse<ContractSnapshot>>(
          `/v1/options/snapshot/${encodeURIComponent(underlying)}/${encodeURIComponent(optionContract)}/`,
        ),
      contracts: {
        list: (params = {}) => this.request<ApiResponse<Contract[]>>("/v1/options/contracts/", params),
        get: (optionsTicker, params = {}) =>
          this.request<ApiResponse<Contract>>(`/v1/options/contracts/${encodeURIComponent(optionsTicker)}/`, params),
      },
      quotes: {
        list: (optionsTicker, params = {}) =>
          this.request<ApiResponse<Quote[]>>(`/v1/options/quotes/${encodeURIComponent(optionsTicker)}/`, params),
      },
      trades: {
        list: (optionsTicker, params = {}) =>
          this.request<ApiResponse<Trade[]>>(`/v1/options/trades/${encodeURIComponent(optionsTicker)}/`, params),
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

  private async request<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQuery(url, params);

    const headers = new Headers(this.headers);
    headers.set("Accept", "application/json");
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers,
    });
    return parseJson<T>(response);
  }
}
