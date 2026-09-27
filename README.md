# OpenDefence SDK

**OpenDefence SDK** is a zero-runtime-dependency TypeScript engineering toolkit for resilient geospatial, space, Earth-observation, sensor, communications, PNT, edge, logistics, fleet, digital-twin and simulation applications.

It is designed as a **defence-oriented systems engineering and situational-awareness SDK**, not as a weapon-control library. The public core intentionally excludes weapon targeting, fire-control, engagement logic, autonomous attack decisions, electronic attack/jamming control, offensive cyber tooling, and direct satellite-command implementations.

The design follows three principles:

1. **Normalize heterogeneous data** into stable engineering models.
2. **Carry uncertainty, quality and provenance** alongside important data.
3. **Remain useful at the edge** when bandwidth, connectivity or upstream providers fail.

OpenDefence can be used as a complete package:

```bash
npm install @opendefence/sdk
```

or as focused capability packages:

```bash
npm install @opendefence/core @opendefence/geo @opendefence/space
```

> **Important:** OpenDefence is engineering/development software. It is not certified or validated as the sole basis for safety-critical, flight-critical, navigation-critical, security-critical or operational decisions. Validate models, providers, assumptions, data lineage and requirements independently for your deployment.

---

## 1. Architecture

```text
                         ┌─────────────────────────┐
                         │   @opendefence/sdk      │
                         │ composition / facade    │
                         └────────────┬────────────┘
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
        ▼                             ▼                              ▼
  DATA / PROVIDERS              ENGINEERING                    EDGE / SYSTEMS
  ───────────────               ───────────                    ──────────────
  Earth observation             geodesy                       event log
  STAC                          terrain                       synchronization
  CelesTrak / OMM               uncertainty                   digital twin
  OGC Features                  communications                simulation
  CCSDS KVN                     PNT                            fleet
  sensors                       fusion                        maintenance
  environment                   energy                        logistics
                                                               cyber posture
                                                               policy engine
```

The SDK is a monorepo of capability packages. Each package has a narrow dependency graph and can be built and published independently.

---

## 2. Packages

| Package | Purpose |
|---|---|
| `@opendefence/core` | HTTP resilience, cache, provider registry, provenance, quality, errors |
| `@opendefence/geo` | WGS-84, ECEF, ENU, look angles, geodesic utilities, polygons, spatial index |
| `@opendefence/uncertainty` | covariance, Gaussian fusion, Mahalanobis distance, Monte Carlo primitives |
| `@opendefence/terrain` | elevation providers, terrain profiles, slope and line-of-sight |
| `@opendefence/space` | OMM normalization, two-body propagation, ground tracks, access windows, CelesTrak |
| `@opendefence/eo` | STAC provider, normalized Earth-observation products, temporal coverage |
| `@opendefence/environment` | normalized environmental/weather provider interface |
| `@opendefence/sensors` | sensor registry, normalized observations, storage and health |
| `@opendefence/fusion` | generic kinematic association and constant-velocity Kalman tracking |
| `@opendefence/comms` | RF/link budgets, thermal noise, channel capacity, network graph |
| `@opendefence/pnt` | normalized PNT solutions, covariance-weighted fusion and quality |
| `@opendefence/edge` | append-only event log, offline replica, synchronization primitives |
| `@opendefence/logistics` | inventory, endurance, stock coverage and transport capacity |
| `@opendefence/fleet` | asset state, availability and readiness summaries |
| `@opendefence/maintenance` | maintenance due logic, reliability and simple RUL helpers |
| `@opendefence/energy` | battery, solar, fuel-energy and duty-cycle power models |
| `@opendefence/twin` | event-driven asset digital twins and snapshots |
| `@opendefence/simulation` | deterministic PRNG, event scheduling, replayable scenarios |
| `@opendefence/security` | zero-trust-style policy engine, canonical JSON and integrity helpers |
| `@opendefence/cyber` | defensive software inventory, SBOM ingestion and vulnerability posture |
| `@opendefence/interoperability` | OGC API Features client and CCSDS KVN/ODM message helpers |
| `@opendefence/ai` | provider-neutral inference routing and anomaly-analysis primitives |
| `@opendefence/spectrum` | passive spectrum statistics, occupancy and peak detection |
| `@opendefence/audit` | hash-chained audit events and integrity verification |
| `@opendefence/telemetry` | counters, gauges and telemetry sinks |
| `@opendefence/validation` | composable validation primitives |
| `@opendefence/data` | ring buffers, time-series helpers and data-volume utilities |
| `@opendefence/reporting` | readiness reports and CSV export |
| `@opendefence/routing` | generic least-cost graph routing for logistics/rescue workflows |
| `@opendefence/testing` | fake clocks, fixture fetch and in-memory sync transport |
| `@opendefence/sdk` | full facade and re-exports |

---

## 3. Quick start

```ts
import { OpenDefence } from "@opendefence/sdk";

const defence = new OpenDefence({
  nodeId: "edge-node-alpha",
});

console.log(defence.version);
console.log(defence.edge.status());
console.log(defence.fleet.registry.readiness());
```

`OpenDefence` is deliberately a composition layer. Capability packages remain directly importable and usable without the facade.

---

## 4. Core HTTP resilience

The HTTP client includes:

- in-memory or custom caching
- tiered cache composition
- in-flight GET deduplication
- exponential retry with jitter
- `Retry-After` handling
- timeouts
- concurrency limiting
- optional request spacing
- circuit breaker
- telemetry hooks
- JSON, text and ArrayBuffer responses

```ts
import {
  HttpClient,
  MemoryCache,
} from "@opendefence/core";

const http = new HttpClient({
  cache: new MemoryCache(5_000),
  cacheTtlMs: 5 * 60_000,
  retries: 3,
  retryDelayMs: 300,
  timeoutMs: 15_000,
  maxConcurrency: 4,
  minRequestIntervalMs: 100,
  onTelemetry(event) {
    console.log(event);
  },
});
```

### Cache adapters

Implement the small interface to use IndexedDB, Redis, KV, D1, SQLite-backed storage or an application-specific persistent store:

```ts
interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear?(): Promise<void>;
}
```

---

## 5. Provenance and data quality

Important data should not become a naked number after passing through several systems.

```ts
interface Provenance {
  provider: string;
  sourceId?: string;
  observedAt?: Date;
  receivedAt: Date;
  sdkVersion?: string;
  transforms?: string[];
  integrity?: string;
}
```

```ts
interface DataQuality {
  completeness: number;
  confidence?: number;
  freshnessMs?: number;
  accuracy?: number;
  consistency?: number;
  flags: string[];
}
```

This makes it possible for downstream systems to distinguish live observations from cached, estimated, simulated or unverified data.

---

## 6. Geospatial engine

```ts
import {
  geodeticToEcef,
  ecefToGeodetic,
  haversineDistanceM,
  initialBearingDeg,
  destinationPoint,
  pointInPolygon,
  SpatialGridIndex,
} from "@opendefence/geo";
```

Included primitives:

- WGS-84 geodetic ↔ ECEF
- ECEF → local ENU
- topocentric azimuth/elevation/range
- haversine distance
- initial bearing
- destination point
- great-circle interpolation
- bounding boxes
- point-in-polygon
- polygon centroid
- spherical horizon line-of-sight
- lightweight in-memory spatial grid index
- basic GeoJSON point normalization

The package is intentionally dependency-free. A production application can add a dedicated GIS engine for advanced CRS transforms and use OpenDefence as the normalized systems layer.

---

## 7. Terrain

Terrain is provider-driven. OpenDefence does not force a DEM source.

```ts
import {
  GridElevationProvider,
  TerrainEngine,
} from "@opendefence/terrain";

const provider = new GridElevationProvider(
  { latDeg: 50, lonDeg: 15 },
  0.001,
  0.001,
  elevationGrid,
);

const terrain = new TerrainEngine(provider);

const profile = await terrain.profile(
  { latDeg: 50.00, lonDeg: 15.00 },
  { latDeg: 50.05, lonDeg: 15.10 },
  256,
);

const visible = await terrain.lineOfSight(
  { latDeg: 50.00, lonDeg: 15.00, altitudeM: 10 },
  { latDeg: 50.05, lonDeg: 15.10, altitudeM: 10 },
);
```

`ElevationProvider` can be backed by COG tiles, local DEM files, a database, an API or device-local raster storage.

---

## 8. Space and satellite data

The public space layer covers catalog access, orbit normalization and analysis. It does **not** implement a general satellite remote-control API.

```ts
const satellites = await defence.space.catalog.search({
  group: "stations",
});

const orbit = satellites[0];

if (orbit) {
  const track = await defence.space.groundTrack(
    orbit,
    new Date(),
    new Date(Date.now() + 90 * 60_000),
    30,
  );

  const windows = await defence.space.accessWindows(
    orbit,
    {
      latDeg: 50.0,
      lonDeg: 15.0,
      altitudeM: 300,
    },
    new Date(),
    new Date(Date.now() + 24 * 60 * 60_000),
    { minElevationDeg: 10, stepSeconds: 30 },
  );
}
```

### Orbit fidelity

OpenDefence ships a deterministic `TwoBodyPropagator` so the SDK works without runtime dependencies.

```ts
interface OrbitPropagator {
  propagate(
    orbit: MeanOrbit,
    at: Date,
  ): Promise<StateVector> | StateVector;
}
```

For accurate GP propagation, plug in a validated SGP4 implementation rather than pretending that two-body propagation is equivalent.

### OMM

```ts
import { ommToMeanOrbit } from "@opendefence/space";

const orbit = ommToMeanOrbit(record, "my-provider");
```

The normalized model contains:

- epoch
- semi-major axis
- eccentricity
- inclination
- RAAN
- argument of periapsis
- mean anomaly
- mean motion
- provenance

### Authorized command boundary

The public SDK exposes only an abstraction:

```ts
interface AuthorizedCommandTransport {
  validate(
    envelope: AuthorizedCommandEnvelope,
  ): Promise<ValidationResult>;

  submitAuthorized(
    envelope: AuthorizedCommandEnvelope,
  ): Promise<CommandReceipt>;
}
```

A real operator-specific uplink implementation belongs in a separately governed private adapter with its own authentication, approvals, auditing and operational controls.

---

## 9. Earth observation / STAC

```ts
import { StacProvider } from "@opendefence/eo";

const stac = new StacProvider(
  "https://your-stac-api.example/",
  undefined,
  "primary-eo",
);

const defence = new OpenDefence({
  eoProviders: [stac],
});

const products = await defence.eo.search({
  bbox: [14.0, 49.5, 15.0, 50.5],
  from: "2026-09-20T00:00:00Z",
  to: "2026-09-27T23:59:59Z",
  cloudCoverMax: 20,
  limit: 100,
});
```

Normalized EO products keep provider-specific properties available while exposing stable fields for:

- ID and collection
- geometry / bbox
- acquisition time
- platform
- instruments
- cloud cover
- assets
- provenance

### Why STAC

STAC provides a provider-neutral way to search spatiotemporal assets. The SDK uses the STAC API search model but does not hard-code one commercial or governmental EO backend.

---

## 10. OGC API Features interoperability

```ts
const ogc = defence.interop.ogcFeatures(
  "https://geo.example/api/",
);

const collections = await ogc.collections();

const items = await ogc.items(
  "infrastructure",
  {
    bbox: {
      west: 14,
      south: 49,
      east: 15,
      north: 50,
    },
    limit: 500,
  },
);
```

The current client focuses on read/discovery operations so it can act as an interoperable ingestion layer.

---

## 11. CCSDS orbit-message helpers

```ts
import {
  parseKvn,
  detectCcsdsOrbitMessageType,
} from "@opendefence/interoperability";

const message = parseKvn(kvnText);
const type = detectCcsdsOrbitMessageType(message);
```

The current parser provides generic KVN section extraction and ODM-type detection for OPM/OMM/OEM/OCM. It is not yet a complete schema validator for every CCSDS ODM field.

---

## 12. Sensors

```ts
const observation = defence.sensors.normalize({
  sensorId: "weather-01",
  observedAt: new Date(),
  location: {
    latDeg: 50,
    lonDeg: 15,
  },
  value: {
    temperatureC: 12.4,
  },
  uncertainty: {
    stddev: 0.2,
    units: "C",
  },
});

defence.sensors.ingest(observation);

console.log(
  defence.sensors.store.health("weather-01"),
);
```

The observation envelope is intentionally generic so environmental, industrial, robotics, space and other sensor domains can share the same transport and provenance patterns.

---

## 13. Generic fusion and uncertainty

The fusion package contains generic kinematic estimation primitives. It is not weapon engagement or fire-control logic.

```ts
const track = defence.fusion.tracks.ingest(
  defence.sensors.normalize({
    sensorId: "position-source-a",
    value: {
      xM: 100,
      yM: 200,
    },
    uncertainty: {
      stddev: 5,
      units: "m",
    },
  }),
);
```

Current fusion support:

- 2D constant-velocity Kalman model
- covariance propagation
- Mahalanobis association gate
- multi-source track source list
- confidence accumulation
- stale-track pruning
- generic temporal correlation

Uncertainty package:

```ts
import {
  combineIndependent,
  covariancePropagate,
  mahalanobisDistance,
  confidenceInterval,
  monteCarlo,
  percentile,
} from "@opendefence/uncertainty";
```

---

## 14. Communications

```ts
const link = defence.comms.linkBudget({
  frequencyHz: 2.4e9,
  distanceM: 10_000,
  transmitPowerDbm: 30,
  transmitGainDbi: 6,
  receiveGainDbi: 12,
  systemLossDb: 3,
  receiverSensitivityDbm: -95,
});
```

Included:

- wavelength
- free-space path loss
- received-power estimate
- link margin
- thermal noise
- Shannon channel capacity
- generic connectivity graph
- shortest-latency path
- geographical link distance

For deployment-specific propagation, fading or terrain-aware RF models, add a dedicated model and keep the normalized result structure.

---

## 15. PNT

```ts
const fused = defence.pnt.fuse([
  {
    position: { latDeg: 50, lonDeg: 15 },
    time: new Date(),
    provider: "source-a",
    covariance: [[25, 0], [0, 25]],
  },
  {
    position: { latDeg: 50.00001, lonDeg: 15.00002 },
    time: new Date(),
    provider: "source-b",
    covariance: [[100, 0], [0, 100]],
  },
]);
```

The fusion helper uses local metric coordinates and covariance weighting. It is a systems primitive, not a replacement for a validated navigation filter.

---

## 16. Edge / offline-first operation

```ts
const edge = defence.edge.replica;

edge.log.append(
  "asset:vehicle-7",
  "telemetry",
  { temperatureC: 71.2 },
);

edge.setOnline(false);

// Continue recording locally.
edge.log.append(
  "asset:vehicle-7",
  "telemetry",
  { temperatureC: 72.1 },
);
```

The edge model provides:

- append-only events
- per-stream monotonic sequence numbers
- idempotent import
- cursors
- sync-transport abstraction
- offline state
- snapshotting
- deterministic last-write-wins helper

A production deployment can connect this to SQLite, IndexedDB, RocksDB, durable objects or another persistent store.

---

## 17. Fleet and readiness

```ts
const asset = defence.fleet.registry.upsert({
  id: "vehicle-001",
  type: "ground-platform",
  status: "available",
  capabilities: ["transport", "relay"],
  fuelFraction: 0.82,
  energyFraction: 0.94,
  connectivity: "online",
  lastUpdate: new Date(),
});

console.log(defence.fleet.registry.readiness());
```

Readiness is deliberately transparent and simple. Applications can define organization-specific readiness policies above the normalized asset model.

---

## 18. Logistics

```ts
const inventory = defence.logistics.inventory();

inventory.upsert({
  id: "filter-A",
  quantity: 120,
  unit: "pcs",
  reorderPoint: 30,
  reorderQuantity: 100,
});

inventory.transact(
  "filter-A",
  -5,
  "scheduled maintenance",
);

console.log(inventory.lowStock());
```

Utilities include:

- inventory ledger
- low-stock detection
- endurance
- reorder-point calculation
- days of supply
- effective transport capacity

---

## 19. Maintenance and reliability

```ts
const isDue = defence.maintenance.due(
  {
    id: "svc-500h",
    assetType: "vehicle",
    intervalHours: 500,
    task: "scheduled inspection",
  },
  {
    operatingHours: 1_450,
    lastServiceHours: 1_000,
  },
);
```

Additional helpers:

- exponential failure probability
- Weibull reliability
- linear remaining-useful-life estimate

These are engineering estimates, not an OEM maintenance authority.

---

## 20. Energy

```ts
const energyWh = defence.energy.batteryEnergyWh(
  48,
  100,
);

const load = defence.energy.averageLoadW([
  { name: "compute", watts: 90, dutyCycle: 0.8 },
  { name: "radio", watts: 25, dutyCycle: 0.3 },
]);

const hours = defence.energy.runtimeHours(
  energyWh,
  load,
  0.8,
);
```

---

## 21. Digital twins

```ts
const twin = defence.twin.create(asset);

twin.apply({
  id: "evt-1",
  at: new Date(),
  type: "telemetry",
  payload: {
    engineTemperatureC: 78,
  },
});

const snapshot = twin.snapshot();
```

Current twin model:

- normalized asset baseline
- event history
- telemetry materialization
- maintenance event count
- versioning
- serialization / restoration

---

## 22. Deterministic simulation

```ts
const scenario = defence.sim.scenario({
  seed: 42,
  startTimeMs: 0,
});

scenario.on("sensor.sample", (_event, state) => {
  state.data["samples"] =
    Number(state.data["samples"] ?? 0) + 1;
});

scenario.schedule({
  atMs: 1_000,
  type: "sensor.sample",
});

scenario.run(10_000);
```

The included `XorShift32` PRNG makes deterministic fixtures and regression scenarios easy to reproduce.

---

## 23. Security and policy

OpenDefence uses explicit policy decisions rather than assuming network location implies trust.

```ts
const policy = defence.security.policy;

policy.add({
  id: "telemetry-read",
  effect: "allow",
  actions: ["read"],
  resources: ["telemetry"],
  roles: ["analyst"],
  requireTrustedDevice: true,
});

const decision = policy.authorize({
  subject: {
    id: "user-7",
    roles: ["analyst"],
  },
  device: {
    id: "tablet-9",
    trusted: true,
  },
  action: "read",
  resource: "telemetry",
});
```

The security package also provides:

- deterministic canonical JSON
- SHA-256 digest
- HMAC-SHA256 integrity helper

Cryptographic deployment policy, key custody, hardware-backed identities and certificate lifecycle remain deployment responsibilities.

---

## 24. Defensive cyber posture

The cyber package is intentionally defensive.

```ts
const components = defence.cyber.parseCycloneDx(
  cycloneDxDocument,
);

defence.cyber.inventory.upsertAsset({
  id: "edge-node-1",
  components,
  lastAssessedAt: new Date(),
});
```

Supported concepts:

- software inventory
- CycloneDX component extraction
- vulnerability metadata
- patch state
- defensive posture summaries

It does not contain exploitation, persistence, credential theft or offensive automation.

---

## 25. AI / inference abstraction

The SDK does not depend on one model runtime.

```ts
interface InferenceProvider {
  readonly id: string;

  available(): Promise<boolean> | boolean;

  supports(
    model: ModelReference,
  ): Promise<boolean> | boolean;

  infer<I, O>(
    model: ModelReference,
    input: I,
  ): Promise<O>;
}
```

This can wrap:

- ONNX Runtime
- WebGPU
- WASM
- platform accelerators
- a local inference server
- an approved remote inference service

The package also includes a dependency-free statistical z-score anomaly helper.

---

## 26. Environment providers

```ts
interface EnvironmentProvider {
  readonly id: string;

  snapshot(
    location: GeoPoint,
    at?: Date,
  ): Promise<EnvironmentSnapshot>;
}
```

No single weather provider is hard-coded. This keeps API keys, provider licensing and deployment choices outside the SDK core.

---

## 27. Provider philosophy

OpenDefence separates:

```text
provider-specific payload
         ↓
validation / normalization
         ↓
stable OpenDefence model
         ↓
engineering / fusion / twin / simulation
```

Provider changes should not force the whole application to consume a new vendor schema.

The SDK also keeps raw provider metadata where useful, so normalization does not destroy information.

---

## 28. Accuracy tiers

Not every function has equal fidelity.

### Tier A — deterministic primitives

Examples:

- geodetic/ECEF transforms
- matrix operations
- link-budget arithmetic
- inventory arithmetic
- energy conversions
- hashing

These should have strong unit coverage and known-reference tests.

### Tier B — first-order engineering models

Examples:

- spherical geodesic helpers
- spherical horizon LOS
- two-body orbit propagation
- free-space RF loss
- simple PNT fusion
- reliability estimates

Useful for architecture, simulation, sanity checks and non-critical systems work.

### Tier C — provider fidelity

Examples:

- STAC data
- CelesTrak OMM data
- OGC API responses
- environmental adapters

Accuracy and currency are bounded by the upstream source.

### Tier D — adapter-required high-fidelity models

Examples deliberately left pluggable:

- validated SGP4/SDP4
- high-order geopotential propagation
- precision atmospheric models
- full terrain/radio propagation suites
- high-fidelity navigation filters
- organization-specific security identities
- specialized EO processing

The SDK provides interfaces so stronger backends can replace first-order models without rewriting application code.

---

## 29. Explicit public-core exclusions

The project intentionally does not provide public modules for:

```text
weapon targeting
fire-control solutions
weapon employment
engagement optimization
autonomous attack decisions
jamming / electronic attack control
offensive cyber exploitation
credential theft / persistence
operator-specific satellite uplink implementation
```

This is also an architectural advantage: the public SDK remains broadly usable for aerospace, defence engineering, critical infrastructure, emergency response, robotics, industrial systems, Earth observation and research.

---

## 30. Runtime targets

The core avoids runtime npm dependencies and uses standard JavaScript/Web APIs.

Primary targets:

- Node.js 18+
- Bun / compatible modern runtimes
- modern browsers
- workers with Fetch/WebCrypto support
- React Native environments with appropriate Web API support
- edge gateways

Individual private provider adapters may impose additional requirements.

---

## 31. Repository layout

```text
opendefence-sdk/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
├── examples/
├── packages/
│   ├── ai/
│   ├── comms/
│   ├── core/
│   ├── cyber/
│   ├── edge/
│   ├── energy/
│   ├── environment/
│   ├── eo/
│   ├── fleet/
│   ├── fusion/
│   ├── geo/
│   ├── interoperability/
│   ├── logistics/
│   ├── maintenance/
│   ├── pnt/
│   ├── reporting/
│   ├── routing/
│   ├── sdk/
│   ├── spectrum/
│   ├── security/
│   ├── sensors/
│   ├── simulation/
│   ├── space/
│   ├── telemetry/
│   ├── terrain/
│   ├── testing/
│   ├── twin/
│   ├── uncertainty/
│   └── validation/
├── scripts/
├── tests/
├── package.json
├── tsconfig.base.json
└── tsconfig.json
```

---

## 32. Development

Install workspace links:

```bash
npm install
```

Build every package:

```bash
npm run build
```

Run the full validation suite:

```bash
npm run check
```

The check performs:

```text
clean
TypeScript project-reference build
Node built-in unit tests
```

Inspect the publishable SDK package:

```bash
npm run pack:check
```

---

## 33. Testing philosophy

Tests should eventually be divided into:

```text
unit
reference vectors
schema fixtures
provider contract tests
property tests
fuzz tests
cross-runtime tests
live smoke tests
benchmark tests
simulation regression tests
```

Live tests should never be the default CI suite because upstream provider state and rate limits are not deterministic.

---

## 34. Production hardening roadmap

High-value next steps:

1. JSON-schema validation for all normalized/provider models
2. validated SGP4 adapter package
3. complete CCSDS ODM OPM/OMM/OEM/OCM parsing and serialization
4. CCSDS TDM parsing
5. richer STAC pagination and conformance discovery
6. OGC API Features pagination and CQL2 support
7. OGC API Connected Systems adapter
8. persistent IndexedDB and SQLite edge stores
9. Redis/KV/D1 cache packages
10. durable event-log adapters
11. vector/raster tile cache packages
12. Cloud Optimized GeoTIFF adapter
13. proper CRS transform adapter interface
14. more rigorous terrain viewshed engine
15. atmospheric/refraction-aware RF propagation adapters
16. EKF/UKF/IMM estimator adapters
17. covariance frame transforms
18. track persistence and deterministic ID strategies
19. schema-versioned digital twins
20. OpenTelemetry adapter
21. signing with asymmetric key providers
22. WebAuthn/device-attestation adapters
23. richer CycloneDX/SPDX parsers
24. OSV/NVD-style vulnerability provider adapters
25. WASM/ONNX inference adapters
26. deterministic simulation checkpoints and branching
27. performance benchmarks
28. browser/worker CI matrix
29. documentation generation from TypeScript declarations
30. Python SDK generated from shared schemas

The target is **more verified capability**, not a larger function count for its own sake.

---

## 35. Standards direction

OpenDefence is designed to integrate with standards rather than invent proprietary replacements where mature standards already exist.

Current direction:

- **STAC** for spatiotemporal asset discovery
- **OGC API – Features** for interoperable geospatial features
- **CCSDS Orbit Data Messages** for spacecraft orbit exchange
- **GeoJSON** for portable geometries
- **CycloneDX** for defensive software inventory inputs

Official references:

```text
https://stacspec.org/
https://www.ogc.org/standards/ogcapi-features/
https://ccsds.org/
```

---

## 36. OpenLaunch relationship

OpenDefence should not duplicate a mature spaceflight engineering library unnecessarily.

Recommended long-term split:

```text
OpenLaunch
  spaceflight / mission engineering
  orbital / launch / spacecraft science

OpenDefence
  normalized operational data layer
  edge runtime
  geospatial / EO
  sensors and uncertainty
  communications / PNT
  logistics / fleet / maintenance
  digital twins / simulation
  security / provenance
```

A future integration package can adapt OpenLaunch models into OpenDefence normalized models while keeping both projects independently useful.

---

## 37. Minimal integrated example

```ts
import {
  OpenDefence,
  GridElevationProvider,
} from "@opendefence/sdk";

const defence = new OpenDefence({
  nodeId: "field-node-1",
  elevationProvider: new GridElevationProvider(
    { latDeg: 50, lonDeg: 15 },
    0.01,
    0.01,
    [
      [250, 252, 255],
      [251, 260, 270],
      [252, 262, 280],
    ],
  ),
});

// Asset state
const asset = defence.fleet.registry.upsert({
  id: "platform-01",
  type: "mobile-edge-node",
  status: "available",
  capabilities: ["relay", "sensor-host"],
  energyFraction: 0.84,
  connectivity: "intermittent",
  lastUpdate: new Date(),
});

// Sensor data
const obs = defence.sensors.normalize({
  sensorId: "temperature-01",
  value: { temperatureC: 67.2 },
});

defence.sensors.ingest(obs);

// Edge event
const event = defence.edge.replica.log.append(
  `asset:${asset.id}`,
  "telemetry",
  obs,
);

// Digital twin
const twin = defence.twin.create(asset);

twin.apply({
  id: event.id,
  at: event.at,
  type: "telemetry",
  payload: obs.value,
});

// Terrain profile
const terrain = await defence.terrain?.profile(
  { latDeg: 50.00, lonDeg: 15.00 },
  { latDeg: 50.02, lonDeg: 15.02 },
  64,
);

// Communications estimate
const link = defence.comms.linkBudget({
  frequencyHz: 915e6,
  distanceM: 5_000,
  transmitPowerDbm: 30,
  transmitGainDbi: 3,
  receiveGainDbi: 3,
  receiverSensitivityDbm: -105,
});

console.log({
  readiness: defence.fleet.registry.readiness(),
  sensorHealth: defence.sensors.store.health("temperature-01"),
  twin: twin.state(),
  terrain,
  link,
  edge: defence.edge.status(),
});
```

This is the intended direction of OpenDefence: **one interoperable engineering layer connecting provider data, uncertainty, edge state, geospatial models and resilient application infrastructure without hiding model fidelity or data provenance.**

---

## 38. License

MIT. See `LICENSE`.
