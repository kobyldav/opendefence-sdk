import test from "node:test";
import assert from "node:assert/strict";
import { SensorsModule } from "@opendefence/sensors";
import { TrackManager } from "@opendefence/fusion";
import { AppendOnlyEventLog, lastWriteWins } from "@opendefence/edge";

test("fusion associates nearby position observations", () => {
  const sensors = new SensorsModule(); const tracks = new TrackManager(8);
  const t = new Date("2026-09-27T12:00:00Z");
  const a = sensors.normalize({ sensorId:"s1", observedAt:t, value:{xM:100,yM:200}, uncertainty:{stddev:5} });
  const b = sensors.normalize({ sensorId:"s2", observedAt:new Date(t.getTime()+1000), value:{xM:102,yM:199}, uncertainty:{stddev:5} });
  const ta = tracks.ingest(a); const tb = tracks.ingest(b);
  assert.equal(ta.id, tb.id); assert.equal(tracks.list(new Date(t.getTime()+1000)).length, 1);
});

test("edge log is append-only and imports idempotently", () => {
  const a = new AppendOnlyEventLog("a"); const b = new AppendOnlyEventLog("b");
  a.append("asset:1","update",{health:0.9});
  assert.equal(b.import(a.all()),1); assert.equal(b.import(a.all()),0);
  const winner = lastWriteWins({value:1,updatedAt:new Date(0),nodeId:"a"},{value:2,updatedAt:new Date(1),nodeId:"b"});
  assert.equal(winner.value,2);
});
