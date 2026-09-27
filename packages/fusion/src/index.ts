import type { GeoPoint } from "@opendefence/geo";
import type { Observation } from "@opendefence/sensors";
import { identity, inverse, matAdd, matMul, matSub, matVecMul, transpose, mahalanobisDistance, type Matrix, type Vector } from "@opendefence/uncertainty";

export interface KinematicMeasurement { xM: number; yM: number; vxMps?: number; vyMps?: number; }
export interface KinematicState { xM: number; yM: number; vxMps: number; vyMps: number; at: Date; }
export interface Track {
  id: string;
  state: KinematicState;
  covariance: Matrix;
  firstObservedAt: Date;
  lastObservedAt: Date;
  confidence: number;
  sources: string[];
  metadata?: Record<string, unknown>;
}

export class ConstantVelocityKalman2D {
  private x: Vector;
  private p: Matrix;
  private lastAt: Date;
  constructor(initial: KinematicState, covariance: Matrix = identity(4).map((r, i) => r.map(v => v * (i < 2 ? 100 : 25)))) {
    this.x = [initial.xM, initial.yM, initial.vxMps, initial.vyMps];
    this.p = covariance.map(r => [...r]);
    this.lastAt = new Date(initial.at);
  }
  predict(at: Date, accelerationNoiseMps2 = 1): KinematicState {
    const dt = Math.max(0, (at.getTime() - this.lastAt.getTime()) / 1000);
    const f = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]];
    const q = accelerationNoiseMps2 ** 2;
    const dt2 = dt*dt, dt3 = dt2*dt, dt4 = dt2*dt2;
    const Q = [[dt4/4*q,0,dt3/2*q,0],[0,dt4/4*q,0,dt3/2*q],[dt3/2*q,0,dt2*q,0],[0,dt3/2*q,0,dt2*q]];
    this.x = matVecMul(f, this.x); this.p = matAdd(matMul(matMul(f, this.p), transpose(f)), Q); this.lastAt = new Date(at);
    return this.state();
  }
  updatePosition(xM: number, yM: number, varianceM2 = 100): KinematicState {
    const h = [[1,0,0,0],[0,1,0,0]], z = [xM,yM], r = [[varianceM2,0],[0,varianceM2]];
    const y = z.map((v,i) => v - matVecMul(h, this.x)[i]!);
    const s = matAdd(matMul(matMul(h,this.p), transpose(h)), r);
    const k = matMul(matMul(this.p, transpose(h)), inverse(s));
    this.x = this.x.map((v,i) => v + matVecMul(k,y)[i]!);
    this.p = matMul(matSub(identity(4), matMul(k,h)), this.p);
    return this.state();
  }
  covariance(): Matrix { return this.p.map(r => [...r]); }
  state(): KinematicState { return { xM:this.x[0]!, yM:this.x[1]!, vxMps:this.x[2]!, vyMps:this.x[3]!, at:new Date(this.lastAt) }; }
}

export class TrackManager {
  private readonly tracks = new Map<string, { track: Track; filter: ConstantVelocityKalman2D }>();
  constructor(readonly gateMahalanobis = 4, readonly staleAfterMs = 10 * 60_000) {}
  ingest(observation: Observation<KinematicMeasurement>): Track {
    const m = observation.value;
    let best: { id:string; distance:number } | undefined;
    for (const [id, holder] of this.tracks) {
      holder.filter.predict(observation.observedAt);
      const state = holder.filter.state(), p = holder.filter.covariance();
      const d = mahalanobisDistance([m.xM-state.xM,m.yM-state.yM], [[p[0]![0]!,p[0]![1]!],[p[1]![0]!,p[1]![1]!]]);
      if (!best || d < best.distance) best = { id, distance:d };
    }
    if (!best || best.distance > this.gateMahalanobis) return this.create(observation);
    const holder = this.tracks.get(best.id)!;
    const variance = observation.uncertainty?.stddev === undefined ? 100 : Math.max(1, Number(Array.isArray(observation.uncertainty.stddev) ? observation.uncertainty.stddev[0] : observation.uncertainty.stddev) ** 2);
    const state = holder.filter.updatePosition(m.xM,m.yM,variance);
    holder.track.state = state; holder.track.covariance = holder.filter.covariance(); holder.track.lastObservedAt = observation.observedAt;
    holder.track.confidence = Math.min(1, holder.track.confidence + 0.08); holder.track.sources = [...new Set([...holder.track.sources, observation.sensorId])];
    return structuredClone(holder.track);
  }
  private create(observation: Observation<KinematicMeasurement>): Track {
    const m = observation.value, state:KinematicState = { xM:m.xM,yM:m.yM,vxMps:m.vxMps??0,vyMps:m.vyMps??0,at:observation.observedAt };
    const filter = new ConstantVelocityKalman2D(state); const id = `trk_${Math.random().toString(36).slice(2,10)}`;
    const track:Track = { id,state,covariance:filter.covariance(),firstObservedAt:observation.observedAt,lastObservedAt:observation.observedAt,confidence:0.5,sources:[observation.sensorId] };
    this.tracks.set(id,{track,filter}); return structuredClone(track);
  }
  list(now = new Date()): Track[] { this.prune(now); return [...this.tracks.values()].map(x => structuredClone(x.track)); }
  prune(now = new Date()): void { for (const [id,h] of this.tracks) if (now.getTime()-h.track.lastObservedAt.getTime()>this.staleAfterMs) this.tracks.delete(id); }
}

export class FusionModule {
  readonly tracks: TrackManager;
  constructor(options: { gateMahalanobis?:number; staleAfterMs?:number } = {}) { this.tracks = new TrackManager(options.gateMahalanobis, options.staleAfterMs); }
  mergeObservations<T>(observations: Observation<T>[]): Observation<T>[] { return [...observations].sort((a,b)=>a.observedAt.getTime()-b.observedAt.getTime()); }
  correlateByTime<T>(a: Observation<T>[], b: Observation<T>[], toleranceMs = 1000): Array<[Observation<T>,Observation<T>]> {
    const out:Array<[Observation<T>,Observation<T>]> = [];
    for (const x of a) { let best:Observation<T>|undefined, dt=Infinity; for (const y of b) { const d=Math.abs(x.observedAt.getTime()-y.observedAt.getTime()); if(d<dt){dt=d;best=y;} } if(best && dt<=toleranceMs) out.push([x,best]); }
    return out;
  }
}

export interface GeolocatedTrack { point: GeoPoint; at: Date; confidence: number; }
