import type { Provenance } from "@opendefence/core";
import type { Asset } from "@opendefence/fleet";

export interface TwinEvent<T=unknown>{id:string;at:Date;type:string;payload:T;provenance?:Provenance;}
export interface TwinState{asset:Asset;version:number;lastEventAt?:Date;telemetry:Record<string,unknown>;maintenanceEvents:number;}
export class DigitalTwin{
  private readonly events:TwinEvent[]=[];private current:TwinState;
  constructor(asset:Asset){this.current={asset:structuredClone(asset),version:0,telemetry:{},maintenanceEvents:0};}
  apply(event:TwinEvent):TwinState{this.events.push(structuredClone(event));this.current.version++;this.current.lastEventAt=new Date(event.at);
    if(event.type==="asset.update"&&typeof event.payload==="object"&&event.payload)this.current.asset={...this.current.asset,...event.payload as Partial<Asset>,capabilities:[...(event.payload as Partial<Asset>).capabilities??this.current.asset.capabilities]};
    else if(event.type==="telemetry"&&typeof event.payload==="object"&&event.payload)this.current.telemetry={...this.current.telemetry,...event.payload as Record<string,unknown>};
    else if(event.type==="maintenance")this.current.maintenanceEvents++;
    return this.state();}
  state():TwinState{return structuredClone(this.current);}
  history():TwinEvent[]{return this.events.map(e=>structuredClone(e));}
  snapshot():string{return JSON.stringify({current:this.current,events:this.events});}
  static restore(snapshot:string):DigitalTwin{const parsed=JSON.parse(snapshot) as {current:TwinState;events:TwinEvent[]};const twin=new DigitalTwin(parsed.current.asset);twin.current={...parsed.current,lastEventAt:parsed.current.lastEventAt?new Date(parsed.current.lastEventAt):undefined,asset:{...parsed.current.asset,lastUpdate:new Date(parsed.current.asset.lastUpdate)}} as TwinState;twin.events.push(...parsed.events.map(e=>({...e,at:new Date(e.at)})));return twin;}
}
export class TwinModule{create(asset:Asset):DigitalTwin{return new DigitalTwin(asset);}}
