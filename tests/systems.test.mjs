import test from "node:test";
import assert from "node:assert/strict";
import { OpenDefence, StacProvider, GridElevationProvider } from "@opendefence/sdk";
import { Scenario } from "@opendefence/simulation";
import { PolicyEngine } from "@opendefence/security";

test("top-level client exposes integrated modules", () => {
  const sdk = new OpenDefence({ nodeId:"edge-1", elevationProvider:new GridElevationProvider({latDeg:0,lonDeg:0},1,1,[[0,0],[0,0]]) });
  assert.equal(sdk.version,"0.1.0"); assert.equal(sdk.edge.status().nodeId,"edge-1"); assert.ok(sdk.terrain);
});

test("simulation is deterministic", () => {
  const a = new Scenario(42), b = new Scenario(42);
  assert.equal(a.rng.random(), b.rng.random()); assert.equal(a.rng.normal(), b.rng.normal());
});

test("policy engine defaults deny and allows explicit rules", () => {
  const p = new PolicyEngine([{id:"readers",effect:"allow",actions:["read"],resources:["telemetry"],roles:["analyst"]}]);
  assert.equal(p.authorize({subject:{id:"u",roles:["analyst"]},action:"read",resource:"telemetry"}).allow,true);
  assert.equal(p.authorize({subject:{id:"u",roles:["analyst"]},action:"write",resource:"telemetry"}).allow,false);
});

test("STAC provider is constructible without network access", () => {
  const p = new StacProvider("https://example.invalid/stac/"); assert.equal(p.id,"stac");
});
