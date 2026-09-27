import { OpenDefence, GridElevationProvider } from "@opendefence/sdk";

const defence = new OpenDefence({
  nodeId: "demo-edge",
  elevationProvider: new GridElevationProvider(
    { latDeg: 50, lonDeg: 15 }, 0.01, 0.01,
    [[250,252,254],[252,255,258],[254,258,262]],
  ),
});

const asset = defence.fleet.registry.upsert({
  id: "platform-1", type: "mobile-edge-node", status: "available",
  capabilities: ["sensor-host", "relay"], energyFraction: 0.9,
  connectivity: "intermittent", lastUpdate: new Date(),
});

const observation = defence.sensors.ingest(defence.sensors.normalize({
  sensorId: "temp-1", value: { temperatureC: 23.5 },
}));

const event = defence.edge.replica.log.append(`asset:${asset.id}`, "telemetry", observation.value);
const twin = defence.twin.create(asset);
twin.apply({ id: event.id, at: event.at, type: "telemetry", payload: observation.value });

console.log({
  readiness: defence.fleet.registry.readiness(),
  sensor: defence.sensors.store.health("temp-1"),
  twin: twin.state(),
  edge: defence.edge.status(),
});
