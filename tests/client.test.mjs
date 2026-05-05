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
