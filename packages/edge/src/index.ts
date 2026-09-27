import { ValidationError } from "@opendefence/core";

export interface EdgeEvent<T=unknown>{id:string;stream:string;sequence:number;at:Date;nodeId:string;type:string;payload:T;}
export interface SyncCursor{stream:string;sequence:number;}
export interface SyncTransport{push(events:EdgeEvent[]):Promise<void>;pull(cursors:SyncCursor[]):Promise<EdgeEvent[]>;}
export class AppendOnlyEventLog{
  private readonly events:EdgeEvent[]=[];private readonly seq=new Map<string,number>();
  constructor(readonly nodeId:string){if(!nodeId)throw new ValidationError("nodeId required");}
  append<T>(stream:string,type:string,payload:T,at=new Date()):EdgeEvent<T>{const sequence=(this.seq.get(stream)??0)+1;this.seq.set(stream,sequence);const event:EdgeEvent<T>={id:`${this.nodeId}:${stream}:${sequence}`,stream,sequence,at,nodeId:this.nodeId,type,payload};this.events.push(event as EdgeEvent);return event;}
  import(events:EdgeEvent[]):number{let added=0;const ids=new Set(this.events.map(e=>e.id));for(const e of events.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.sequence-b.sequence)){if(ids.has(e.id))continue;this.events.push(e);ids.add(e.id);this.seq.set(e.stream,Math.max(this.seq.get(e.stream)??0,e.sequence));added++;}return added;}
  all():EdgeEvent[]{return this.events.map(e=>structuredClone(e));}
  since(cursors:SyncCursor[]):EdgeEvent[]{const map=new Map(cursors.map(c=>[c.stream,c.sequence]));return this.events.filter(e=>e.sequence>(map.get(e.stream)??0)).map(e=>structuredClone(e));}
  cursors():SyncCursor[]{return [...this.seq].map(([stream,sequence])=>({stream,sequence}));}
}
export interface VersionedValue<T>{value:T;updatedAt:Date;nodeId:string;}
export function lastWriteWins<T>(a:VersionedValue<T>,b:VersionedValue<T>):VersionedValue<T>{if(a.updatedAt.getTime()!==b.updatedAt.getTime())return a.updatedAt>b.updatedAt?a:b;return a.nodeId>=b.nodeId?a:b;}
export class EdgeReplica{
  readonly log:AppendOnlyEventLog; private onlineState=true;
  constructor(readonly nodeId:string){this.log=new AppendOnlyEventLog(nodeId);}
  online():boolean{return this.onlineState;} setOnline(value:boolean):void{this.onlineState=value;}
  async sync(transport:SyncTransport):Promise<{pushed:number;pulled:number}>{if(!this.onlineState)return{pushed:0,pulled:0};const local=this.log.all();await transport.push(local);const remote=await transport.pull(this.log.cursors());const pulled=this.log.import(remote);return{pushed:local.length,pulled};}
  snapshot():{nodeId:string;online:boolean;events:EdgeEvent[]}{return{nodeId:this.nodeId,online:this.onlineState,events:this.log.all()};}
}
export class EdgeModule{readonly replica:EdgeReplica;constructor(nodeId="node-local"){this.replica=new EdgeReplica(nodeId);}status(){return{nodeId:this.replica.nodeId,online:this.replica.online(),events:this.replica.log.all().length};}}
