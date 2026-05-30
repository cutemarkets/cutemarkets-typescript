import assert from "node:assert/strict";
import test from "node:test";

import { CuteMarketsApiError, CuteMarketsClient } from "../dist/src/index.js";

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers,
  });
}

test("client sets auth headers and exposes request metadata", async () => {
  const client = new CuteMarketsClient({
    apiKey: "cm_test",
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.get("authorization"), "Bearer cm_test");
      assert.equal(url.toString(), "https://api.cutemarkets.com/v1/options/chain/SPY/?limit=5");
      return jsonResponse(
        { results: [], request_id: "req_123" },
        {
          headers: {
            "x-ratelimit-plan": "free",
            "x-ratelimit-limit-minute": "100",
            "x-ratelimit-remaining-minute": "98",
          },
        },
      );
    },
  });

  const page = await client.options.chain("SPY", { limit: 5 });
  assert.equal(page.request_id, "req_123");
  assert.equal(client.lastRequestId, "req_123");
  assert.equal(page.rate_limit.plan, "free");
  assert.equal(client.lastRateLimit.remaining_minute, 98);
});

test("client serializes range filters", async () => {
  const seen = [];
  const client = new CuteMarketsClient({
    fetchImpl: async (url) => {
      seen.push(url.toString());
      return jsonResponse({ results: [] });
    },
  });

  await client.options.contracts.list({
    expiration_date_gte: "2026-05-01",
    strike_price_lte: 450,
  });

  assert.match(seen[0], /expiration_date\.gte=2026-05-01/);
  assert.match(seen[0], /strike_price\.lte=450/);
});

test("client retries on retryable HTTP errors", async () => {
  let calls = 0;
  const client = new CuteMarketsClient({
    maxRetries: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { message: "retry" } }, { status: 429 });
      }
      return jsonResponse({ results: [], request_id: "req_retry" });
    },
  });

  const page = await client.options.chain("SPY", { limit: 1 });
  assert.equal(calls, 2);
  assert.equal(page.request_id, "req_retry");
});

test("paginate follows next_url", async () => {
  let calls = 0;
  const client = new CuteMarketsClient({
    apiKey: "cm_test",
    fetchImpl: async (url) => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({
          results: [{ details: { ticker: "A" } }],
          next_url: "https://api.cutemarkets.com/v1/options/contracts/?cursor=2",
        });
      }
      assert.equal(url.toString(), "https://api.cutemarkets.com/v1/options/contracts/?cursor=2");
      return jsonResponse({
        results: [{ details: { ticker: "B" } }],
        next_url: null,
      });
    },
  });

  const seen = [];
  for await (const row of client.options.chainAll("SPY", { limit: 1 })) {
    seen.push(row.details.ticker);
  }

  assert.deepEqual(seen, ["A", "B"]);
  assert.equal(calls, 2);
});

test("client surfaces API errors with request id", async () => {
  const client = new CuteMarketsClient({
    maxRetries: 0,
    fetchImpl: async () =>
      jsonResponse(
        {
          error: { message: "forbidden", code: "forbidden" },
          request_id: "req_err",
        },
        { status: 403 },
      ),
  });

  await assert.rejects(
    () => client.options.snapshot("SPY", "O:SPY260501C00500000"),
    (error) => {
      assert.ok(error instanceof CuteMarketsApiError);
      assert.equal(error.status, 403);
      assert.equal(error.requestId, "req_err");
      return true;
    },
  );
});

test("stocks namespace uses stock key and follows next_url with same key", async () => {
  const seenAuth = [];
  let calls = 0;
  const client = new CuteMarketsClient({
    apiKey: "cm_default",
    stocksApiKey: "cm_stock",
    fetchImpl: async (url, init) => {
      calls += 1;
      seenAuth.push(init.headers.get("authorization"));
      if (calls === 1) {
        assert.equal(url.toString(), "https://api.cutemarkets.com/v1/stocks/aggs/AAPL/1/day/2026-05-01/2026-05-06/?limit=1");
        return jsonResponse({
          results: [{ T: "AAPL", c: 190 }],
          next_url: "https://api.cutemarkets.com/v1/stocks/aggs/AAPL/1/day/next",
        });
      }
      assert.equal(url.toString(), "https://api.cutemarkets.com/v1/stocks/aggs/AAPL/1/day/next");
      return jsonResponse({ results: [{ T: "AAPL", c: 191 }] });
    },
  });

  const rows = [];
  for await (const row of client.stocks.aggs.rangeAll("AAPL", 1, "day", "2026-05-01", "2026-05-06", { limit: 1 })) {
    rows.push(row.c);
  }
  assert.deepEqual(rows, [190, 191]);
  assert.deepEqual(seenAuth, ["Bearer cm_stock", "Bearer cm_stock"]);
});

test("explicit apiKey overrides product env vars unless product key is explicit", async () => {
  process.env.CUTEMARKETS_STOCKS_API_KEY = "cm_stock_env";
  const client = new CuteMarketsClient({
    apiKey: "cm_default",
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.get("authorization"), "Bearer cm_default");
      return jsonResponse({ results: { T: "AAPL", p: 190 } });
    },
  });
  await client.stocks.trades.last("AAPL");

  const productClient = new CuteMarketsClient({
    apiKey: "cm_default",
    stocksApiKey: "cm_stock_explicit",
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.get("authorization"), "Bearer cm_stock_explicit");
      return jsonResponse({ results: { T: "AAPL", p: 190 } });
    },
  });
  await productClient.stocks.trades.last("AAPL");
  delete process.env.CUTEMARKETS_STOCKS_API_KEY;
});

test("paper namespace sends JSON bodies and handles delete without content", async () => {
  const accountId = "11111111-1111-1111-1111-111111111111";
  const orderId = "22222222-2222-2222-2222-222222222222";
  const seen = [];
  const client = new CuteMarketsClient({
    paperApiKey: "cm_paper",
    fetchImpl: async (url, init) => {
      seen.push({ url: url.toString(), method: init.method, auth: init.headers.get("authorization"), body: init.body ? JSON.parse(init.body) : null });
      if (url.pathname === "/v1/paper/accounts/" && init.method === "POST") {
        return jsonResponse({ account: { id: accountId, name: "sandbox" }, summary: { cash: "100000.0000" } }, { status: 201 });
      }
      if (url.pathname.endsWith("/orders/") && init.method === "POST") {
        return jsonResponse({ id: orderId, symbol: "AAPL", status: "filled" }, { status: 201 });
      }
      if (url.pathname.endsWith(`/${accountId}/`) && init.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ results: [] });
    },
  });

  const account = await client.paper.accounts.create({ name: "sandbox", initial_cash: 100000 });
  assert.equal(account.account.id, accountId);
  const order = await client.paper.orders.submit(accountId, {
    symbol: "AAPL",
    qty: 1,
    side: "buy",
    type: "market",
    client_order_id: "agent-aapl-1",
  });
  assert.equal(order.status, "filled");
  await client.paper.accounts.delete(accountId);

  assert.equal(seen[0].auth, "Bearer cm_paper");
  assert.deepEqual(seen[0].body, { name: "sandbox", initial_cash: "100000" });
  assert.equal(seen[1].body.client_order_id, "agent-aapl-1");
  assert.equal(seen[2].method, "DELETE");
});
