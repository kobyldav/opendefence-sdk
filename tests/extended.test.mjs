import test from "node:test";
import assert from "node:assert/strict";
import { SpectrumModule } from "@opendefence/spectrum";
import { AuditLog } from "@opendefence/audit";
import { RouteGraph } from "@opendefence/routing";
import { finiteNumber, combine, nonEmptyString } from "@opendefence/validation";
import { parseKvn, detectCcsdsOrbitMessageType } from "@opendefence/interoperability";

test("passive spectrum analysis detects a peak", () => {
  const s = new SpectrumModule();
  const samples = [
    { frequencyHz: 100, powerDbm: -100 },
    { frequencyHz: 101, powerDbm: -99 },
    { frequencyHz: 102, powerDbm: -70 },
    { frequencyHz: 103, powerDbm: -98 },
    { frequencyHz: 104, powerDbm: -101 },
  ];
  assert.equal(s.detectPeaks(samples, 15).length, 1);
  assert.ok(s.occupancy(samples, -90).occupiedFraction > 0);
});

test("audit log hash chain verifies", async () => {
  const log = new AuditLog();
  await log.append({ actor: "operator", action: "read", resource: "telemetry", payload: { id: 1 } });
  await log.append({ actor: "operator", action: "ack", resource: "event:1" });
  assert.equal(await log.verify(), true);
});

test("routing finds the least-cost path", () => {
  const g = new RouteGraph();
  g.add({ from: "A", to: "B", cost: 2, bidirectional: true });
  g.add({ from: "B", to: "C", cost: 2, bidirectional: true });
  g.add({ from: "A", to: "C", cost: 10, bidirectional: true });
  assert.deepEqual(g.shortest("A", "C"), { nodes: ["A", "B", "C"], cost: 4 });
});

test("validation composes field validators", () => {
  const result = combine({ name: "node", health: 0.8 }, {
    name: nonEmptyString,
    health: finiteNumber({ min: 0, max: 1 }),
  });
  assert.equal(result.valid, true);
});

test("CCSDS KVN helper detects OMM", () => {
  const msg = parseKvn(`CCSDS_OMM_VERS = 3.0\nMETA_START\nOBJECT_NAME = TEST\nMETA_STOP\nMEAN_MOTION = 15.5`);
  assert.equal(detectCcsdsOrbitMessageType(msg), "OMM");
});
