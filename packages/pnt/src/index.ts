import type { GeoPoint } from "@opendefence/geo";
import { combineIndependent, type Matrix } from "@opendefence/uncertainty";

export interface PNTSolution { position:GeoPoint; velocityMps?:{north:number;east:number;down:number}; time:Date; covariance?:Matrix; provider:string; integrity?:{healthy:boolean; reason?:string}; }
function localMeters(reference:GeoPoint,p:GeoPoint):[number,number]{const lat=(p.latDeg-reference.latDeg)*111320;const lon=(p.lonDeg-reference.lonDeg)*111320*Math.cos(reference.latDeg*Math.PI/180);return [lon,lat];}
function fromLocal(reference:GeoPoint,xy:number[]):GeoPoint{const x=xy[0]??0,y=xy[1]??0;return {latDeg:reference.latDeg+y/111320,lonDeg:reference.lonDeg+x/(111320*Math.cos(reference.latDeg*Math.PI/180)),...(reference.altitudeM===undefined?{}:{altitudeM:reference.altitudeM})};}
export function fusePnt(solutions:PNTSolution[]):PNTSolution{
  if(!solutions.length)throw new Error("At least one PNT solution required");const ref=solutions[0]!.position;
  const gaussian=solutions.map(s=>({mean:localMeters(ref,s.position),covariance:s.covariance?.slice(0,2).map(r=>r.slice(0,2))??[[100,0],[0,100]]}));
  const fused=combineIndependent(gaussian); const point=fromLocal(ref,fused.mean);
  const t=new Date(Math.max(...solutions.map(s=>s.time.getTime()))); return {position:point,time:t,covariance:fused.covariance,provider:`fusion:${solutions.map(s=>s.provider).join("+")}`,integrity:{healthy:solutions.every(s=>s.integrity?.healthy!==false)}};
}
export function clockOffsetMs(reference:Date,observed:Date):number{return observed.getTime()-reference.getTime();}
export class PNTModule { fuse=fusePnt; clockOffsetMs=clockOffsetMs; solutionQuality(s:PNTSolution):number{const p=s.covariance; if(!p)return .5;const sigma=Math.sqrt(Math.max(0,(p[0]?.[0]??0)+(p[1]?.[1]??0)));return 1/(1+sigma/10);} }
