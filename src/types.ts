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

export interface ResponseMeta {
  status?: string;
  request_id?: string;
  rate_limit?: RateLimitInfo;
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

export interface StockSnapshot {
  ticker?: unknown;
  day?: unknown;
  min?: unknown;
  prevDay?: unknown;
  lastTrade?: unknown;
  lastQuote?: unknown;
  updated?: number;
  [key: string]: unknown;
}

export interface StockSnapshotResponse extends ResponseMeta {
  tickers?: StockSnapshot[];
  ticker?: StockSnapshot;
  results?: StockSnapshot[] | StockSnapshot;
}

export interface StockTicker {
  ticker?: string;
  name?: string;
  market?: string;
  locale?: string;
  primary_exchange?: string;
  type?: string;
  active?: boolean;
  currency_name?: string;
  [key: string]: unknown;
}

export interface StockTickerType {
  code?: string;
  description?: string;
  asset_class?: string;
  locale?: string;
  [key: string]: unknown;
}

export interface StockRelatedTicker {
  ticker?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface StockTrade {
  conditions?: number[];
  exchange?: number;
  id?: string;
  price?: number;
  sequence_number?: number;
  sip_timestamp?: number;
  participant_timestamp?: number;
  size?: number;
  tape?: number;
  [key: string]: unknown;
}

export interface StockQuote {
  ask_exchange?: number;
  ask_price?: number;
  ask_size?: number;
  bid_exchange?: number;
  bid_price?: number;
  bid_size?: number;
  sequence_number?: number;
  sip_timestamp?: number;
  tape?: number;
  [key: string]: unknown;
}

export interface StockLastQuote {
  T?: string;
  P?: number;
  S?: number;
  p?: number;
  s?: number;
  t?: number;
  x?: number;
  y?: number;
  q?: number;
  z?: number;
  [key: string]: unknown;
}

export interface IndicatorValue {
  timestamp?: number;
  value?: number;
  signal?: number;
  histogram?: number;
}

export interface IndicatorResult {
  values?: IndicatorValue[];
  underlying?: {
    url?: string;
    aggregates?: unknown[];
  };
}

export interface PaperAccount {
  id?: string;
  name?: string;
  status?: string;
  currency?: string;
  initial_cash?: string;
  cash?: string;
  generation?: number;
  created_at?: string;
  updated_at?: string;
  reset_at?: string | null;
  [key: string]: unknown;
}

export interface PaperAccountSummary {
  equity?: string;
  cash?: string;
  market_value?: string;
  initial_cash?: string;
  realized_pl?: string;
  unrealized_pl?: string;
  drawdown?: string;
  closed_trades?: number;
  winning_trades?: number;
  win_rate?: string;
  [key: string]: unknown;
}

export interface PaperAccountPayload extends ResponseMeta {
  account?: PaperAccount;
  summary?: PaperAccountSummary;
}

export interface PaperOrder {
  id?: string;
  client_order_id?: string;
  symbol?: string;
  asset_class?: string;
  qty?: string;
  filled_qty?: string;
  side?: string;
  type?: string;
  time_in_force?: string;
  limit_price?: string | null;
  status?: string;
  position_intent?: string;
  order_class?: string;
  extended_hours?: boolean;
  average_fill_price?: string | null;
  filled_avg_price?: string | null;
  rejected_reason?: string;
  submitted_at?: string;
  updated_at?: string;
  filled_at?: string | null;
  canceled_at?: string | null;
  [key: string]: unknown;
}

export interface PaperPosition {
  id?: string;
  symbol?: string;
  asset_class?: string;
  qty?: string;
  avg_entry_price?: string;
  market_price?: string;
  market_value?: string;
  cost_basis?: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
  realized_pl?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface PaperFill {
  id?: string;
  order_id?: string;
  symbol?: string;
  asset_class?: string;
  side?: string;
  qty?: string;
  price?: string;
  gross_amount?: string;
  realized_pl?: string;
  market_timestamp?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PaperEquitySnapshot {
  timestamp?: string;
  equity?: string;
  cash?: string;
  market_value?: string;
  realized_pl?: string;
  unrealized_pl?: string;
  [key: string]: unknown;
}
