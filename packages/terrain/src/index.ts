import { haversineDistanceM, interpolateGreatCircle, type GeoPoint } from "@opendefence/geo";

export interface ElevationProvider { elevationM(point: GeoPoint): Promise<number | undefined>; }
export interface TerrainSample { point: GeoPoint; distanceM: number; elevationM?: number; }
export interface TerrainProfile { samples: TerrainSample[]; distanceM: number; minElevationM?: number; maxElevationM?: number; }

export class GridElevationProvider implements ElevationProvider {
  constructor(
    readonly origin: GeoPoint,
    readonly latStepDeg: number,
    readonly lonStepDeg: number,
    readonly grid: number[][],
  ) {}
  async elevationM(point: GeoPoint): Promise<number | undefined> {
    const y = (point.latDeg - this.origin.latDeg) / this.latStepDeg;
    const x = (point.lonDeg - this.origin.lonDeg) / this.lonStepDeg;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = x0 + 1, y1 = y0 + 1;
    const q00 = this.grid[y0]?.[x0], q10 = this.grid[y0]?.[x1], q01 = this.grid[y1]?.[x0], q11 = this.grid[y1]?.[x1];
    if ([q00, q10, q01, q11].some(v => v === undefined)) return undefined;
    const fx = x - x0, fy = y - y0;
    return q00! * (1 - fx) * (1 - fy) + q10! * fx * (1 - fy) + q01! * (1 - fx) * fy + q11! * fx * fy;
  }
}

export class TerrainEngine {
  constructor(readonly elevation: ElevationProvider) {}
  async profile(from: GeoPoint, to: GeoPoint, samples = 128): Promise<TerrainProfile> {
    if (!Number.isInteger(samples) || samples < 2) throw new Error("samples must be >= 2");
    const distanceM = haversineDistanceM(from, to);
    const out: TerrainSample[] = [];
    for (let i = 0; i < samples; i++) {
      const f = i / (samples - 1);
      const point = interpolateGreatCircle(from, to, f);
      const elevationM = await this.elevation.elevationM(point);
      out.push({ point, distanceM: distanceM * f, ...(elevationM === undefined ? {} : { elevationM }) });
    }
    const valid = out.flatMap(x => x.elevationM === undefined ? [] : [x.elevationM]);
    return { samples: out, distanceM, ...(valid.length ? { minElevationM: Math.min(...valid), maxElevationM: Math.max(...valid) } : {}) };
  }
  async lineOfSight(from: GeoPoint, to: GeoPoint, samples = 128, effectiveEarthRadiusFactor = 4 / 3): Promise<boolean> {
    const profile = await this.profile(from, to, samples);
    const h0 = (from.altitudeM ?? 0) + (profile.samples[0]?.elevationM ?? 0);
    const h1 = (to.altitudeM ?? 0) + (profile.samples.at(-1)?.elevationM ?? 0);
    const re = 6371008.8 * effectiveEarthRadiusFactor;
    for (const s of profile.samples.slice(1, -1)) {
      if (s.elevationM === undefined) continue;
      const f = s.distanceM / Math.max(1, profile.distanceM);
      const direct = h0 + (h1 - h0) * f;
      const bulge = s.distanceM * (profile.distanceM - s.distanceM) / (2 * re);
      if (s.elevationM + bulge > direct) return false;
    }
    return true;
  }
  async slopeDeg(a: GeoPoint, b: GeoPoint): Promise<number | undefined> {
    const ea = await this.elevation.elevationM(a), eb = await this.elevation.elevationM(b);
    if (ea === undefined || eb === undefined) return undefined;
    return Math.atan2(eb - ea, haversineDistanceM(a, b)) * 180 / Math.PI;
  }
}
