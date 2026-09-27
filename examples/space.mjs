import { OpenDefence } from "@opendefence/sdk";

const defence = new OpenDefence();
const results = await defence.space.catalog.search({ group: "stations" });
const orbit = results[0];
if (!orbit) throw new Error("No catalog result");

const from = new Date();
const to = new Date(from.getTime() + 24 * 60 * 60_000);
const windows = await defence.space.accessWindows(
  orbit,
  { latDeg: 50.0, lonDeg: 15.0, altitudeM: 300 },
  from,
  to,
  { minElevationDeg: 10, stepSeconds: 30 },
);

console.log(orbit.name, windows.slice(0, 3));
