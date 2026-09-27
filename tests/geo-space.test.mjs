import test from "node:test";
import assert from "node:assert/strict";
import { geodeticToEcef, ecefToGeodetic, haversineDistanceM } from "@opendefence/geo";
import { ommToMeanOrbit, TwoBodyPropagator, groundPoint } from "@opendefence/space";

test("WGS84 round trip is stable", () => {
  const p = { latDeg: 50.0, lonDeg: 15.0, altitudeM: 350 };
  const q = ecefToGeodetic(geodeticToEcef(p));
  assert.ok(haversineDistanceM(p, q) < 0.01);
  assert.ok(Math.abs((q.altitudeM ?? 0) - 350) < 0.02);
});

test("OMM normalization and two-body propagation produce finite state", () => {
  const orbit = ommToMeanOrbit({
    OBJECT_NAME: "TEST", NORAD_CAT_ID: 12345, EPOCH: "2026-09-27T00:00:00Z",
    MEAN_MOTION: 15.5, ECCENTRICITY: 0.001, INCLINATION: 51.6,
    RA_OF_ASC_NODE: 20, ARG_OF_PERICENTER: 30, MEAN_ANOMALY: 10,
  }, "fixture");
  const state = new TwoBodyPropagator().propagate(orbit, new Date("2026-09-27T00:10:00Z"));
  assert.ok(Number.isFinite(state.positionM.x));
  const gp = groundPoint(state); assert.ok(gp.latDeg >= -90 && gp.latDeg <= 90);
});
