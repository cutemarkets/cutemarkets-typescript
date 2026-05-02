import { CuteMarketsClient } from "cutemarkets-typescript";

function spreadPct(contract: {
  last_quote?: { bid?: number; ask?: number };
}): number | null {
  const bid = contract.last_quote?.bid;
  const ask = contract.last_quote?.ask;
  if (bid === undefined || ask === undefined) {
    return null;
  }
  const mid = (bid + ask) / 2;
  if (mid <= 0) {
    return null;
  }
  return (ask - bid) / mid;
}

const client = new CuteMarketsClient({ apiKey: process.env.CUTEMARKETS_API_KEY });
const ticker = process.env.CUTEMARKETS_UNDERLYING ?? "SPY";

const chain = await client.options.chain(ticker, {
  contract_type: "call",
  limit: 100,
});

const ranked = chain.results
  .filter((contract) => {
    const spread = spreadPct(contract);
    return spread !== null && spread <= 0.2 && (contract.open_interest ?? 0) >= 100;
  })
  .sort((left, right) => (right.open_interest ?? 0) - (left.open_interest ?? 0))
  .slice(0, 10);

for (const contract of ranked) {
  console.log(
    contract.details?.ticker,
    contract.details?.expiration_date,
    contract.details?.strike_price,
    `oi=${contract.open_interest}`,
    `iv=${contract.implied_volatility}`,
  );
}
