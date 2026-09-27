export interface GeoPoint { latDeg: number; lonDeg: number; altitudeM?: number; }
export interface Vec3 { x: number; y: number; z: number; }
export interface BoundingBox { west: number; south: number; east: number; north: number; }
export type Ring = GeoPoint[];
export interface Polygon { outer: Ring; holes?: Ring[]; }
export interface LookAngles { azimuthDeg: number; elevationDeg: number; rangeM: number; }

export const WGS84 = {
  a: 6378137,
  f: 1 / 298.257223563,
  b: 6356752.314245179,
} as const;
const E2 = WGS84.f * (2 - WGS84.f);
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function normalizeLongitude(lonDeg: number): number {
  return ((lonDeg + 180) % 360 + 360) % 360 - 180;
}
export function clampLatitude(latDeg: number): number { return Math.min(90, Math.max(-90, latDeg)); }
export function geodeticToEcef(point: GeoPoint): Vec3 {
  const lat = clampLatitude(point.latDeg) * RAD;
  const lon = normalizeLongitude(point.lonDeg) * RAD;
  const h = point.altitudeM ?? 0;
  const sinLat = Math.sin(lat);
  const n = WGS84.a / Math.sqrt(1 - E2 * sinLat * sinLat);
  return {
    x: (n + h) * Math.cos(lat) * Math.cos(lon),
    y: (n + h) * Math.cos(lat) * Math.sin(lon),
    z: (n * (1 - E2) + h) * sinLat,
  };
}
export function ecefToGeodetic(v: Vec3): GeoPoint {
  const p = Math.hypot(v.x, v.y);
  const lon = Math.atan2(v.y, v.x);
  let lat = Math.atan2(v.z, p * (1 - E2));
  let h = 0;
  for (let i = 0; i < 10; i++) {
    const sinLat = Math.sin(lat);
    const n = WGS84.a / Math.sqrt(1 - E2 * sinLat * sinLat);
    h = p / Math.max(1e-15, Math.cos(lat)) - n;
    lat = Math.atan2(v.z, p * (1 - E2 * n / Math.max(1, n + h)));
  }
  return { latDeg: lat * DEG, lonDeg: normalizeLongitude(lon * DEG), altitudeM: h };
}
export function ecefToEnu(target: Vec3, observer: GeoPoint): Vec3 {
  const origin = geodeticToEcef(observer);
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const lat = observer.latDeg * RAD, lon = observer.lonDeg * RAD;
  const sl = Math.sin(lon), cl = Math.cos(lon), sp = Math.sin(lat), cp = Math.cos(lat);
  return {
    x: -sl * dx + cl * dy,
    y: -sp * cl * dx - sp * sl * dy + cp * dz,
    z: cp * cl * dx + cp * sl * dy + sp * dz,
  };
}
export function lookAngles(observer: GeoPoint, targetEcef: Vec3): LookAngles {
  const enu = ecefToEnu(targetEcef, observer);
  const rangeM = Math.hypot(enu.x, enu.y, enu.z);
  const azimuthDeg = ((Math.atan2(enu.x, enu.y) * DEG) % 360 + 360) % 360;
  const elevationDeg = Math.asin(enu.z / Math.max(rangeM, 1e-15)) * DEG;
  return { azimuthDeg, elevationDeg, rangeM };
}
export function haversineDistanceM(a: GeoPoint, b: GeoPoint, radiusM = 6371008.8): number {
  const p1 = a.latDeg * RAD, p2 = b.latDeg * RAD;
  const dp = (b.latDeg - a.latDeg) * RAD, dl = (b.lonDeg - a.lonDeg) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * radiusM * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function initialBearingDeg(a: GeoPoint, b: GeoPoint): number {
  const p1 = a.latDeg * RAD, p2 = b.latDeg * RAD, dl = (b.lonDeg - a.lonDeg) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * DEG) % 360 + 360) % 360;
}
export function destinationPoint(start: GeoPoint, bearingDeg: number, distanceM: number, radiusM = 6371008.8): GeoPoint {
  const p1 = start.latDeg * RAD, l1 = start.lonDeg * RAD, br = bearingDeg * RAD, d = distanceM / radiusM;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br));
  const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { latDeg: p2 * DEG, lonDeg: normalizeLongitude(l2 * DEG), ...(start.altitudeM === undefined ? {} : { altitudeM: start.altitudeM }) };
}
export function bbox(points: GeoPoint[]): BoundingBox {
  if (points.length === 0) throw new Error("bbox requires at least one point");
  return points.reduce<BoundingBox>((b, p) => ({ west: Math.min(b.west, p.lonDeg), south: Math.min(b.south, p.latDeg), east: Math.max(b.east, p.lonDeg), north: Math.max(b.north, p.latDeg) }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity });
}
export function bboxContains(box: BoundingBox, p: GeoPoint): boolean {
  return p.lonDeg >= box.west && p.lonDeg <= box.east && p.latDeg >= box.south && p.latDeg <= box.north;
}
function ringContains(ring: Ring, p: GeoPoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (((a.latDeg > p.latDeg) !== (b.latDeg > p.latDeg)) && p.lonDeg < (b.lonDeg - a.lonDeg) * (p.latDeg - a.latDeg) / ((b.latDeg - a.latDeg) || Number.EPSILON) + a.lonDeg) inside = !inside;
  }
  return inside;
}
export function pointInPolygon(point: GeoPoint, polygon: Polygon): boolean {
  if (!ringContains(polygon.outer, point)) return false;
  return !(polygon.holes ?? []).some(h => ringContains(h, point));
}
export function polygonCentroid(polygon: Polygon): GeoPoint {
  const ring = polygon.outer;
  if (ring.length < 3) throw new Error("Polygon needs at least three points");
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const cross = a.lonDeg * b.latDeg - b.lonDeg * a.latDeg;
    twiceArea += cross; x += (a.lonDeg + b.lonDeg) * cross; y += (a.latDeg + b.latDeg) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const avg = ring.reduce((s, p) => ({ latDeg: s.latDeg + p.latDeg, lonDeg: s.lonDeg + p.lonDeg }), { latDeg: 0, lonDeg: 0 });
    return { latDeg: avg.latDeg / ring.length, lonDeg: avg.lonDeg / ring.length };
  }
  return { lonDeg: x / (3 * twiceArea), latDeg: y / (3 * twiceArea) };
}
export function lineOfSightSpherical(a: GeoPoint, b: GeoPoint, earthRadiusM = 6371008.8): boolean {
  const ha = Math.max(0, a.altitudeM ?? 0), hb = Math.max(0, b.altitudeM ?? 0);
  const horizonA = Math.sqrt(2 * earthRadiusM * ha + ha * ha);
  const horizonB = Math.sqrt(2 * earthRadiusM * hb + hb * hb);
  return haversineDistanceM(a, b, earthRadiusM) <= horizonA + horizonB;
}
export function interpolateGreatCircle(a: GeoPoint, b: GeoPoint, fraction: number): GeoPoint {
  const f = Math.min(1, Math.max(0, fraction));
  const d = haversineDistanceM(a, b);
  if (d === 0) return { ...a };
  return destinationPoint(a, initialBearingDeg(a, b), d * f);
}

export class SpatialGridIndex<T> {
  private readonly cells = new Map<string, Array<{ point: GeoPoint; value: T }>>();
  constructor(readonly cellSizeDeg = 0.25) {
    if (!(cellSizeDeg > 0 && cellSizeDeg <= 180)) throw new Error("cellSizeDeg must be in (0, 180]");
  }
  private key(p: GeoPoint): string { return `${Math.floor((p.latDeg + 90) / this.cellSizeDeg)}:${Math.floor((normalizeLongitude(p.lonDeg) + 180) / this.cellSizeDeg)}`; }
  insert(point: GeoPoint, value: T): void {
    const key = this.key(point); const list = this.cells.get(key) ?? []; list.push({ point, value }); this.cells.set(key, list);
  }
  withinRadius(center: GeoPoint, radiusM: number): T[] {
    const latDelta = radiusM / 111_320;
    const lonDelta = radiusM / Math.max(1, 111_320 * Math.cos(center.latDeg * RAD));
    const minLatCell = Math.floor((center.latDeg - latDelta + 90) / this.cellSizeDeg);
    const maxLatCell = Math.floor((center.latDeg + latDelta + 90) / this.cellSizeDeg);
    const minLonCell = Math.floor((normalizeLongitude(center.lonDeg - lonDelta) + 180) / this.cellSizeDeg);
    const maxLonCell = Math.floor((normalizeLongitude(center.lonDeg + lonDelta) + 180) / this.cellSizeDeg);
    const out: T[] = [];
    for (let i = minLatCell; i <= maxLatCell; i++) for (let j = minLonCell; j <= maxLonCell; j++) {
      for (const entry of this.cells.get(`${i}:${j}`) ?? []) if (haversineDistanceM(center, entry.point) <= radiusM) out.push(entry.value);
    }
    return out;
  }
}

export type GeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] | [number, number, number] }
  | { type: "LineString"; coordinates: Array<[number, number] | [number, number, number]> }
  | { type: "Polygon"; coordinates: Array<Array<[number, number] | [number, number, number]>> };
export function pointFromGeoJson(geometry: GeoJsonGeometry): GeoPoint {
  if (geometry.type !== "Point") throw new Error("Expected Point geometry");
  const [lon, lat, alt] = geometry.coordinates;
  return { latDeg: lat, lonDeg: lon, ...(alt === undefined ? {} : { altitudeM: alt }) };
}
