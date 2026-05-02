import { CuteMarketsClient } from "cutemarkets-typescript";

const client = new CuteMarketsClient({ apiKey: process.env.CUTEMARKETS_API_KEY });
const asOf = process.env.CUTEMARKETS_AS_OF ?? "2026-01-15";
const underlying = process.env.CUTEMARKETS_UNDERLYING ?? "MSFT";

const page = await client.options.contracts.list({
  underlying_ticker: underlying,
  as_of: asOf,
  expiration_date_gte: "2026-01-22",
  expiration_date_lte: "2026-03-01",
  limit: 5,
});

console.log(`[contracts.list] ${underlying} as_of=${asOf} count=${page.results.length}`);
for (const contract of page.results) {
  console.log(contract.ticker, contract.contract_type, contract.expiration_date, contract.strike_price);
}
