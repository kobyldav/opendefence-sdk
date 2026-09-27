import test from "node:test";
import assert from "node:assert/strict";
import { HttpClient } from "@opendefence/core";
import { CelesTrakProvider } from "@opendefence/space";
import { StacProvider } from "@opendefence/eo";

test("CelesTrak provider uses OMM JSON query format", async () => {
  let requested = "";
  const http = new HttpClient({ fetch: async input => { requested = String(input); return Response.json([]); }, retries: 0, cache: false });
  const provider = new CelesTrakProvider(http);
  await provider.search({ group: "stations" });
  const url = new URL(requested);
  assert.equal(url.searchParams.get("FORMAT"), "JSON");
  assert.equal(url.searchParams.get("GROUP"), "STATIONS");
});

test("STAC search normalizes core EO fields", async () => {
  let body;
  const http = new HttpClient({ fetch: async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ features: [{ id: "scene-1", collection: "demo", geometry: null, bbox: [14,49,15,50], properties: { datetime: "2026-09-27T10:00:00Z", platform: "demo-sat", instruments: ["cam"], "eo:cloud_cover": 4 }, assets: { data: { href: "https://example.invalid/scene.tif" } } }] });
  }, retries: 0, cache: false });
  const stac = new StacProvider("https://example.invalid/stac/", http, "fixture");
  const result = await stac.search({ bbox: [14,49,15,50], cloudCoverMax: 10 });
  assert.deepEqual(body.bbox, [14,49,15,50]);
  assert.equal(result[0].platform, "demo-sat");
  assert.equal(result[0].provenance.provider, "fixture");
});
