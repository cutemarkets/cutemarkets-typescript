import { CuteMarketsClient } from "cutemarkets-typescript";

function midpoint(contract: { last_quote?: { bid?: number; ask?: number } }): number | null {
  const bid = contract.last_quote?.bid;
  const ask = contract.last_quote?.ask;
  if (bid === undefined || ask === undefined) {
    return null;
  }
  return (bid + ask) / 2;
}

const client = new CuteMarketsClient({ apiKey: process.env.CUTEMARKETS_API_KEY });
const underlying = process.env.CUTEMARKETS_UNDERLYING ?? "MSFT";
const eventDate = process.env.CUTEMARKETS_EVENT_DATE ?? "2026-04-29";

const expirations = await client.tickers.expirations(underlying);
const expiry = expirations.results.find((value) => value >= eventDate);
if (!expiry) {
  throw new Error(`No listed expiration found on or after ${eventDate}`);
}

const chain = await client.options.chain(underlying, { expiration_date: expiry, limit: 250 });
const spot = chain.results[0]?.underlying_asset?.price;
if (!spot) {
  throw new Error("Missing underlying price on the option chain snapshot.");
}

const sorted = [...chain.results]
  .filter((contract) => contract.details?.strike_price !== undefined)
  .sort(
    (left, right) =>
      Math.abs((left.details?.strike_price ?? 0) - spot) -
      Math.abs((right.details?.strike_price ?? 0) - spot),
  );

const call = sorted.find((contract) => contract.details?.contract_type === "call");
const put = sorted.find(
  (contract) =>
    contract.details?.contract_type === "put" &&
    contract.details?.strike_price === call?.details?.strike_price,
);

if (!call || !put) {
  throw new Error("Could not find an ATM call/put pair.");
}

const callMid = midpoint(call);
const putMid = midpoint(put);
if (callMid === null || putMid === null) {
  throw new Error("ATM pair did not contain a complete bid/ask.");
}

const straddleMid = callMid + putMid;
console.log({
  underlying,
  eventDate,
  expiry,
  spot,
  strike: call.details?.strike_price,
  straddleMid,
  impliedMovePct: straddleMid / spot,
});
