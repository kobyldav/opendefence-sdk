import test from "node:test";
import assert from "node:assert/strict";
import { HttpClient, MemoryCache } from "@opendefence/core";

test("HttpClient retries and caches GET responses", async () => {
  let calls = 0;
  const client = new HttpClient({
    cache: new MemoryCache(), retries: 1, retryDelayMs: 1,
    fetch: async () => {
      calls++;
      if (calls === 1) return new Response("temporary", { status: 503 });
      return Response.json({ ok: true, calls });
    },
  });
  const a = await client.json("https://example.invalid/data");
  const b = await client.json("https://example.invalid/data");
  assert.equal(a.ok, true); assert.deepEqual(b, a); assert.equal(calls, 2);
});
