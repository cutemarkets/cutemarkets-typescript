# CuteMarkets TypeScript SDK for Real-Time and Historical Options Data

The official TypeScript SDK for [CuteMarkets](https://cutemarkets.com). Use it to access a real-time and historical options data API from Node, server-side Next.js, and modern JavaScript runtimes.

This package focuses on the workflows developers actually search for: options chain API access, historical contracts with `as_of`, quotes, trades, aggregates, expirations, and lightweight utilities for earnings research and scanner construction.

Quick links:

- [Get API key](https://cutemarkets.com/signup)
- [Read docs](https://cutemarkets.com/docs)
- [Explore the Python SDK](https://github.com/cutemarkets/cutemarkets-python)

## Use Cases

- Build an options chain scanner in Node or Next.js.
- Reconstruct historical contracts with `as_of`.
- Estimate implied move around earnings from the ATM straddle.
- Pull quotes, trades, and aggregates into a research or alerting workflow.

## Explore Examples

- [examples/historical-contracts-as-of.ts](examples/historical-contracts-as-of.ts)
- [examples/earnings-implied-move.ts](examples/earnings-implied-move.ts)
- [examples/build-options-chain-scanner.ts](examples/build-options-chain-scanner.ts)
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
```

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
