import { HttpClient, ValidationError, type Provenance } from "@opendefence/core";
import { ecefToGeodetic, lookAngles, type GeoPoint, type Vec3 } from "@opendefence/geo";

export interface StateVector { positionM: Vec3; velocityMps: Vec3; epoch: Date; frame: "ECI" | "ECEF"; }
export interface MeanOrbit {
  objectId: string;
  name?: string;
  epoch: Date;
  semiMajorAxisM: number;
  eccentricity: number;
  inclinationRad: number;
  raanRad: number;
  argumentOfPeriapsisRad: number;
  meanAnomalyRad: number;
  meanMotionRadS: number;
  provenance: Provenance;
}
export interface OmmRecord {
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
  NORAD_CAT_ID?: string | number;
  EPOCH: string;
  MEAN_MOTION: string | number;
  ECCENTRICITY: string | number;
  INCLINATION: string | number;
  RA_OF_ASC_NODE: string | number;
  ARG_OF_PERICENTER: string | number;
  MEAN_ANOMALY: string | number;
  [key: string]: unknown;
}
export interface AccessWindow { start: Date; end: Date; maxElevationDeg: number; maxElevationAt: Date; }
export interface OrbitPropagator { propagate(orbit: MeanOrbit, at: Date): Promise<StateVector> | StateVector; }
export interface SatelliteCatalogProvider { readonly id: string; search(query: SatelliteQuery): Promise<OmmRecord[]>; }
export interface SatelliteQuery { name?: string; catalogNumber?: number | string; group?: string; }

const MU_EARTH = 3.986004418e14;
const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;

function num(value: unknown, name: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`Invalid ${name}`);
  return n;
}
function solveKepler(meanAnomaly: number, e: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 20; i++) {
    const delta = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-13) break;
  }
  return E;
}
function rot3(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
}
function rotatePerifocal(v: Vec3, raan: number, inc: number, argp: number): Vec3 {
  const cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inc), si = Math.sin(inc), cw = Math.cos(argp), sw = Math.sin(argp);
  return {
    x: (cO*cw - sO*sw*ci)*v.x + (-cO*sw - sO*cw*ci)*v.y,
    y: (sO*cw + cO*sw*ci)*v.x + (-sO*sw + cO*cw*ci)*v.y,
    z: (sw*si)*v.x + (cw*si)*v.y,
  };
}
export function ommToMeanOrbit(record: OmmRecord, provider = "omm"): MeanOrbit {
  const revPerDay = num(record.MEAN_MOTION, "MEAN_MOTION");
  const n = revPerDay * TAU / 86400;
  const semiMajorAxisM = Math.cbrt(MU_EARTH / (n * n));
  const id = String(record.NORAD_CAT_ID ?? record.OBJECT_ID ?? record.OBJECT_NAME ?? "unknown");
  const receivedAt = new Date();
  return {
    objectId: id,
    ...(record.OBJECT_NAME ? { name: String(record.OBJECT_NAME) } : {}),
    epoch: new Date(record.EPOCH),
    semiMajorAxisM,
    eccentricity: num(record.ECCENTRICITY, "ECCENTRICITY"),
    inclinationRad: num(record.INCLINATION, "INCLINATION") * RAD,
    raanRad: num(record.RA_OF_ASC_NODE, "RA_OF_ASC_NODE") * RAD,
    argumentOfPeriapsisRad: num(record.ARG_OF_PERICENTER, "ARG_OF_PERICENTER") * RAD,
    meanAnomalyRad: num(record.MEAN_ANOMALY, "MEAN_ANOMALY") * RAD,
    meanMotionRadS: n,
    provenance: { provider, sourceId: id, observedAt: new Date(record.EPOCH), receivedAt },
  };
}

export class TwoBodyPropagator implements OrbitPropagator {
  propagate(orbit: MeanOrbit, at: Date): StateVector {
    const dt = (at.getTime() - orbit.epoch.getTime()) / 1000;
    const M = ((orbit.meanAnomalyRad + orbit.meanMotionRadS * dt) % TAU + TAU) % TAU;
    const e = orbit.eccentricity;
    const E = solveKepler(M, e);
    const a = orbit.semiMajorAxisM;
    const r = a * (1 - e * Math.cos(E));
    const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
    const sinNu = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
    const nu = Math.atan2(sinNu, cosNu);
    const p = a * (1 - e * e);
    const h = Math.sqrt(MU_EARTH * p);
    const perifocalPos = { x: r * Math.cos(nu), y: r * Math.sin(nu), z: 0 };
    const perifocalVel = { x: -MU_EARTH / h * Math.sin(nu), y: MU_EARTH / h * (e + Math.cos(nu)), z: 0 };
    return {
      positionM: rotatePerifocal(perifocalPos, orbit.raanRad, orbit.inclinationRad, orbit.argumentOfPeriapsisRad),
      velocityMps: rotatePerifocal(perifocalVel, orbit.raanRad, orbit.inclinationRad, orbit.argumentOfPeriapsisRad),
      epoch: new Date(at), frame: "ECI",
    };
  }
}

export function julianDate(date: Date): number { return date.getTime() / 86400000 + 2440587.5; }
export function gmstRad(date: Date): number {
  const jd = julianDate(date);
  const t = (jd - 2451545.0) / 36525;
  const deg = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - t * t * t / 38710000;
  return ((deg % 360 + 360) % 360) * RAD;
}
export function eciToEcef(state: StateVector): StateVector {
  if (state.frame !== "ECI") return state;
  const theta = gmstRad(state.epoch);
  const positionM = rot3(state.positionM, theta);
  const omega = 7.2921150e-5;
  const vRot = rot3(state.velocityMps, theta);
  const velocityMps = { x: vRot.x + omega * positionM.y, y: vRot.y - omega * positionM.x, z: vRot.z };
  return { positionM, velocityMps, epoch: new Date(state.epoch), frame: "ECEF" };
}
export function groundPoint(state: StateVector): GeoPoint { return ecefToGeodetic((state.frame === "ECEF" ? state : eciToEcef(state)).positionM); }

export async function groundTrack(orbit: MeanOrbit, propagator: OrbitPropagator, from: Date, to: Date, stepSeconds = 60): Promise<Array<{ at: Date; point: GeoPoint }>> {
  if (to <= from || stepSeconds <= 0) throw new ValidationError("Invalid ground-track interval");
  const out: Array<{ at: Date; point: GeoPoint }> = [];
  for (let t = from.getTime(); t <= to.getTime(); t += stepSeconds * 1000) {
    const at = new Date(t); const state = await propagator.propagate(orbit, at); out.push({ at, point: groundPoint(state) });
  }
  return out;
}

export async function accessWindows(orbit: MeanOrbit, observer: GeoPoint, propagator: OrbitPropagator, from: Date, to: Date, options: { minElevationDeg?: number; stepSeconds?: number } = {}): Promise<AccessWindow[]> {
  const minEl = options.minElevationDeg ?? 10, stepMs = (options.stepSeconds ?? 30) * 1000;
  if (to <= from || stepMs <= 0) throw new ValidationError("Invalid access interval");
  const result: AccessWindow[] = [];
  let active: { start: Date; maxElevationDeg: number; maxElevationAt: Date } | undefined;
  for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
    const at = new Date(t); const ecef = eciToEcef(await propagator.propagate(orbit, at));
    const elevationDeg = lookAngles(observer, ecef.positionM).elevationDeg;
    if (elevationDeg >= minEl) {
      if (!active) active = { start: at, maxElevationDeg: elevationDeg, maxElevationAt: at };
      if (elevationDeg > active.maxElevationDeg) { active.maxElevationDeg = elevationDeg; active.maxElevationAt = at; }
    } else if (active) {
      result.push({ start: active.start, end: at, maxElevationDeg: active.maxElevationDeg, maxElevationAt: active.maxElevationAt }); active = undefined;
    }
  }
  if (active) result.push({ start: active.start, end: new Date(to), maxElevationDeg: active.maxElevationDeg, maxElevationAt: active.maxElevationAt });
  return result;
}

export class CelesTrakProvider implements SatelliteCatalogProvider {
  readonly id = "celestrak";
  constructor(private readonly http = new HttpClient({ cacheTtlMs: 2 * 60 * 60_000, minRequestIntervalMs: 1_000 })) {}
  async search(query: SatelliteQuery): Promise<OmmRecord[]> {
    const url = new URL("https://celestrak.org/NORAD/elements/gp.php");
    url.searchParams.set("FORMAT", "JSON");
    if (query.catalogNumber !== undefined) url.searchParams.set("CATNR", String(query.catalogNumber));
    else if (query.group) url.searchParams.set("GROUP", query.group.toUpperCase());
    else if (query.name) url.searchParams.set("NAME", query.name);
    else throw new ValidationError("Provide name, catalogNumber or group");
    return this.http.json<OmmRecord[]>(url);
  }
}

export class SpaceCatalog {
  constructor(private readonly providers: SatelliteCatalogProvider[] = [new CelesTrakProvider()]) {}
  async search(query: SatelliteQuery, providerId?: string): Promise<MeanOrbit[]> {
    const provider = providerId ? this.providers.find(p => p.id === providerId) : this.providers[0];
    if (!provider) throw new ValidationError(`Satellite provider not found: ${providerId}`);
    return (await provider.search(query)).map(r => ommToMeanOrbit(r, provider.id));
  }
}

export class SpaceModule {
  readonly catalog: SpaceCatalog;
  readonly propagator: OrbitPropagator;
  constructor(options: { providers?: SatelliteCatalogProvider[]; propagator?: OrbitPropagator } = {}) {
    this.catalog = new SpaceCatalog(options.providers);
    this.propagator = options.propagator ?? new TwoBodyPropagator();
  }
  accessWindows(orbit: MeanOrbit, observer: GeoPoint, from: Date, to: Date, options?: { minElevationDeg?: number; stepSeconds?: number }): Promise<AccessWindow[]> {
    return accessWindows(orbit, observer, this.propagator, from, to, options);
  }
  groundTrack(orbit: MeanOrbit, from: Date, to: Date, stepSeconds?: number): Promise<Array<{ at: Date; point: GeoPoint }>> {
    return groundTrack(orbit, this.propagator, from, to, stepSeconds);
  }
}

export interface AuthorizedCommandEnvelope { assetId: string; commandType: string; payloadDigest: string; requestedBy: string; approvedBy: string[]; expiresAt: Date; }
export interface CommandReceipt { id: string; accepted: boolean; receivedAt: Date; reason?: string; }
export interface AuthorizedCommandTransport {
  validate(envelope: AuthorizedCommandEnvelope): Promise<{ valid: boolean; reason?: string }>;
  submitAuthorized(envelope: AuthorizedCommandEnvelope): Promise<CommandReceipt>;
}
