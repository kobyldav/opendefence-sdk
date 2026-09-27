import type { DataQuality, Provenance } from "@opendefence/core";
import type { GeoPoint } from "@opendefence/geo";
export type AssetStatus="available"|"degraded"|"maintenance"|"offline"|"unknown";
export interface Asset{id:string;type:string;status:AssetStatus;location?:GeoPoint;capabilities:string[];health?:number;fuelFraction?:number;energyFraction?:number;connectivity?:"online"|"intermittent"|"offline";lastUpdate:Date;provenance?:Provenance;quality?:DataQuality;metadata?:Record<string,unknown>;}
export class FleetRegistry{
  private readonly assets=new Map<string,Asset>();
  upsert(asset:Asset):Asset{const normalized={...asset,capabilities:[...asset.capabilities],lastUpdate:new Date(asset.lastUpdate)};this.assets.set(asset.id,normalized);return structuredClone(normalized);}
  get(id:string):Asset|undefined{const a=this.assets.get(id);return a?structuredClone(a):undefined;}
  list(filter:Partial<Pick<Asset,"type"|"status">>={}):Asset[]{return[...this.assets.values()].filter(a=>(!filter.type||a.type===filter.type)&&(!filter.status||a.status===filter.status)).map(a=>structuredClone(a));}
  readiness():{total:number;available:number;degraded:number;maintenance:number;offline:number;readinessFraction:number}{const all=[...this.assets.values()];const count=(s:AssetStatus)=>all.filter(a=>a.status===s).length;const available=count("available"),degraded=count("degraded");return{total:all.length,available,degraded,maintenance:count("maintenance"),offline:count("offline"),readinessFraction:all.length?(available+.5*degraded)/all.length:0};}
}
export class FleetModule{readonly registry=new FleetRegistry();}
