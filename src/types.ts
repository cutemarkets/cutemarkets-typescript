export interface ErrorPayload {
  code?: string;
  message?: string;
}

export interface ApiResponse<T> {
  status?: string;
  request_id?: string;
  next_url?: string | null;
  results: T;
  error?: ErrorPayload;
  rate_limit?: RateLimitInfo;
}

export interface Page<T> extends ApiResponse<T[]> {}

export interface RateLimitInfo {
  plan?: string;
  limit_minute?: string;
  remaining_minute?: number;
  limit_day?: string;
  remaining_day?: number;
}

export interface TickerSearchResult {
  symbol?: string;
  name?: string;
}

export interface ExpirationsResponse {
  status?: string;
  request_id?: string;
  ticker?: string;
  results: string[];
}

export interface ContractDetails {
  ticker?: string;
  contract_type?: string;
  exercise_style?: string;
  expiration_date?: string;
  strike_price?: number;
  shares_per_contract?: number;
}

export interface Greeks {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface DayBar {
  close?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  change?: number;
  change_percent?: number;
}

export interface LastQuote {
  bid?: number;
  ask?: number;
  midpoint?: number;
  bid_size?: number;
  ask_size?: number;
  last_updated?: number;
}

export interface EmbeddedLastTrade {
  price?: number;
  size?: number;
  sip_timestamp?: number;
}

export interface UnderlyingAsset {
  price?: number;
  ticker?: string;
  last_updated?: number;
}

export interface ContractSnapshot {
  break_even_price?: number;
  day?: DayBar;
  details?: ContractDetails;
  greeks?: Greeks;
  implied_volatility?: number;
  last_quote?: LastQuote;
  last_trade?: EmbeddedLastTrade;
  open_interest?: number;
  underlying_asset?: UnderlyingAsset;
  fmv?: number;
}

export interface Contract {
  ticker?: string;
  underlying_ticker?: string;
  contract_type?: string;
  exercise_style?: string;
  expiration_date?: string;
  strike_price?: number;
  shares_per_contract?: number;
  primary_exchange?: string;
}

export interface Quote {
  bid_price?: number;
  ask_price?: number;
  bid_size?: number;
  ask_size?: number;
  sip_timestamp?: number;
  sequence_number?: number;
}

export interface Trade {
  price?: number;
  size?: number;
  sip_timestamp?: number;
  participant_timestamp?: number;
  exchange?: number;
}

export interface LastTrade {
  T?: string;
  p?: number;
  s?: number;
  t?: number;
  x?: number;
}

export interface Aggregate {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  vw?: number;
  t?: number;
  n?: number;
}

export interface SystemStatus {
  status?: string;
  request_id?: string;
  services?: Record<string, unknown>;
}
