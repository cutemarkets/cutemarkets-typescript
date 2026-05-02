import type { ContractSnapshot } from "cutemarkets-typescript";

import { client } from "../lib/cutemarkets.js";

function spreadPct(contract: ContractSnapshot): number | null {
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

export default async function Page(): Promise<JSX.Element> {
  const chain = await client.options.chain("SPY", { contract_type: "call", limit: 50 });
  const rows = chain.results
    .filter((contract: ContractSnapshot) => {
      const spread = spreadPct(contract);
      return spread !== null && spread <= 0.2;
    })
    .sort(
      (left: ContractSnapshot, right: ContractSnapshot) => (right.open_interest ?? 0) - (left.open_interest ?? 0),
    )
    .slice(0, 10);

  return (
    <main>
      <h1>SPY chain scanner</h1>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Expiry</th>
            <th>Strike</th>
            <th>Open interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contract: ContractSnapshot) => (
            <tr key={contract.details?.ticker}>
              <td>{contract.details?.ticker}</td>
              <td>{contract.details?.expiration_date}</td>
              <td>{contract.details?.strike_price}</td>
              <td>{contract.open_interest}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
