import { CuteMarketsClient } from "cutemarkets-typescript";

const client = new CuteMarketsClient({
  paperApiKey: process.env.CUTEMARKETS_PAPER_API_KEY,
});

const accountName = process.env.CUTEMARKETS_PAPER_ACCOUNT_NAME ?? "typescript-demo";
const symbol = process.env.CUTEMARKETS_PAPER_SYMBOL ?? "AAPL";

const existingAccounts = await client.paper.accounts.list({ limit: 100 });
let account = existingAccounts.results?.find((item) => item.name === accountName);

if (!account?.id) {
  const created = await client.paper.accounts.create({
    name: accountName,
    initial_cash: 100000,
  });
  account = created.account;
}

if (!account?.id) {
  throw new Error("Paper account creation did not return an account id.");
}

const order = await client.paper.orders.submit(account.id, {
  symbol,
  qty: 1,
  side: "buy",
  type: "market",
  time_in_force: "day",
  client_order_id: `typescript-demo-${symbol.toLowerCase()}-${Date.now()}`,
});

const positions = await client.paper.positions(account.id);
console.log({
  account: account.id,
  orderId: order.id,
  submittedSymbol: symbol,
  openPositions: positions.results?.length ?? 0,
});
