# CuteMarkets TypeScript SDK for Stocks, Options, and Paper Trading

The official TypeScript SDK for [CuteMarkets](https://cutemarkets.com). Use it to access real-time and historical stocks and options data plus paper trading from Node, server-side Next.js, and modern JavaScript runtimes.

This package focuses on the workflows developers actually search for: stock snapshots and bars, options chain API access, historical contracts with `as_of`, quotes, trades, aggregates, expirations, paper accounts/orders, and lightweight utilities for earnings research and scanner construction.

Quick links:

- [Get API key](https://cutemarkets.com/signup)
- [Read docs](https://cutemarkets.com/docs)
- [Explore the Python SDK](https://github.com/cutemarkets/cutemarkets-python)

## Use Cases

- Build an options chain scanner in Node or Next.js.
- Build stock watchlists, movers screens, chart data loaders, and quote-aware stock tools.
- Reconstruct historical contracts with `as_of`.
- Estimate implied move around earnings from the ATM straddle.
- Submit simulated stock or single-leg option orders to CuteMarkets paper trading.
- Pull quotes, trades, and aggregates into a research or alerting workflow.

## Explore Examples

- [examples/historical-contracts-as-of.ts](examples/historical-contracts-as-of.ts)
- [examples/earnings-implied-move.ts](examples/earnings-implied-move.ts)
- [examples/build-options-chain-scanner.ts](examples/build-options-chain-scanner.ts)
- [examples/stocks-quickstart.ts](examples/stocks-quickstart.ts)
- [examples/paper-trading-quickstart.ts](examples/paper-trading-quickstart.ts)
- [examples/nextjs-chain-scanner/README.md](examples/nextjs-chain-scanner/README.md)

## Installation

```bash
npm install cutemarkets-typescript
```

## Quick Start

```ts
import { CuteMarketsClient } from "cutemarkets-typescript";

const client = new CuteMarketsClient({ apiKey: process.env.CUTEMARKETS_API_KEY });

const chain = await client.options.chain("SPY", { limit: 5 });
for (const contract of chain.results) {
  console.log(contract.details?.ticker, contract.implied_volatility);
}

console.log(client.lastRequestId, client.lastRateLimit?.remaining_minute);

const snapshot = await client.stocks.snapshot("AAPL");
console.log(snapshot.ticker ?? snapshot);

const account = await client.paper.accounts.create({ name: "sdk-sandbox", initial_cash: 100000 });
await client.paper.orders.submit(account.account!.id!, {
  symbol: "AAPL",
  qty: 1,
  side: "buy",
  type: "market",
  time_in_force: "day",
  client_order_id: "typescript-demo-aapl-1",
});
```

## Authentication

`apiKey` remains backward compatible and applies to every namespace. For product-scoped deployments, pass dedicated keys or use product env vars:

```ts
const client = new CuteMarketsClient({
  optionsApiKey: process.env.CUTEMARKETS_OPTIONS_API_KEY,
  stocksApiKey: process.env.CUTEMARKETS_STOCKS_API_KEY,
  paperApiKey: process.env.CUTEMARKETS_PAPER_API_KEY,
});
```

Resolution order per namespace is: explicit product key, explicit `apiKey`, product env var, then `CUTEMARKETS_API_KEY`.

## Why this SDK instead of raw fetch calls

Raw `fetch` works, but most developers end up rebuilding the same plumbing in every project: authentication, query serialization, path escaping, response typing, and error handling. This SDK gives you a small typed surface so your application code can focus on chain filtering, historical contract reconstruction, and event-study logic.

## Available Surfaces

- `client.status()`
- `client.nextPage(page)`
- `client.paginate(...)`
- `client.tickers.search(...)`
- `client.tickers.searchAll(...)`
- `client.tickers.expirations(ticker)`
- `client.options.chain(ticker, params)`
- `client.options.chainAll(ticker, params)`
- `client.options.snapshot(underlying, optionContract)`
- `client.options.contracts.list(params)`
- `client.options.contracts.listAll(params)`
- `client.options.contracts.get(optionsTicker, params)`
- `client.options.quotes.list(optionsTicker, params)`
- `client.options.quotes.listAll(optionsTicker, params)`
- `client.options.trades.list(optionsTicker, params)`
- `client.options.trades.listAll(optionsTicker, params)`
- `client.options.trades.last(optionsTicker)`
- `client.options.aggs.range(ticker, multiplier, timespan, from, to, params)`
- `client.options.aggs.previous(ticker)`
- `client.stocks.snapshot(ticker, params)`
- `client.stocks.snapshots.all(params)`
- `client.stocks.snapshots.movers(direction, params)`
- `client.stocks.tickers.list(params)` / `.listAll(params)` / `.get(ticker, params)` / `.related(ticker, params)` / `.types(params)`
- `client.stocks.trades.list(ticker, params)` / `.listAll(ticker, params)` / `.last(ticker, params)`
- `client.stocks.quotes.list(ticker, params)` / `.listAll(ticker, params)` / `.last(ticker, params)`
- `client.stocks.aggs.grouped(date, params)` / `.range(...)` / `.rangeAll(...)` / `.previous(ticker, params)` / `.openClose(ticker, date, params)`
- `client.stocks.indicators.sma/ema/macd/rsi(ticker, params)`
- `client.paper.accounts.list/create/get/update/delete/reset/summary/portfolioHistory(...)`
- `client.paper.orders.list/submit/get/cancel/byClientOrderId(...)`
- `client.paper.positions(accountId)`, `client.paper.fills(accountId)`, `client.paper.portfolioHistory(accountId)`, `client.paper.account(accountId)`

## Development

```bash
npm install
npm run build
npm run check:examples
```

## Related Repositories

- [cutemarkets-python](https://github.com/cutemarkets/cutemarkets-python)
- [cutebacktests](https://github.com/cutemarkets/cutebacktests)
- [cute-intraday-option-strats](https://github.com/cutemarkets/cute-intraday-option-strats)

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for the npm release checklist.
