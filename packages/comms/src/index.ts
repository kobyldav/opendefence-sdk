import { haversineDistanceM, type GeoPoint } from "@opendefence/geo";

export interface LinkBudgetInput {
  frequencyHz: number;
  distanceM: number;
  transmitPowerDbm: number;
  transmitGainDbi?: number;
  receiveGainDbi?: number;
  systemLossDb?: number;
  receiverSensitivityDbm?: number;
}
export interface LinkBudgetResult { wavelengthM:number; freeSpacePathLossDb:number; receivedPowerDbm:number; marginDb?:number; }
export function wavelengthM(frequencyHz:number):number { if(frequencyHz<=0) throw new Error("frequencyHz must be > 0"); return 299792458/frequencyHz; }
export function freeSpacePathLossDb(distanceM:number, frequencyHz:number):number { if(distanceM<=0) return 0; return 20*Math.log10(4*Math.PI*distanceM/wavelengthM(frequencyHz)); }
export function linkBudget(input:LinkBudgetInput):LinkBudgetResult {
  const loss=freeSpacePathLossDb(input.distanceM,input.frequencyHz), received=input.transmitPowerDbm+(input.transmitGainDbi??0)+(input.receiveGainDbi??0)-loss-(input.systemLossDb??0);
  return { wavelengthM:wavelengthM(input.frequencyHz),freeSpacePathLossDb:loss,receivedPowerDbm:received,...(input.receiverSensitivityDbm===undefined?{}:{marginDb:received-input.receiverSensitivityDbm}) };
}
export function thermalNoiseDbm(bandwidthHz:number, noiseFigureDb=0, temperatureK=290):number { return 10*Math.log10(1.380649e-23*temperatureK*bandwidthHz*1000)+noiseFigureDb; }
export function shannonCapacityBps(bandwidthHz:number,snrDb:number):number { return bandwidthHz*Math.log2(1+10**(snrDb/10)); }
export interface NetworkNode { id:string; location?:GeoPoint; }
export interface NetworkLink { a:string; b:string; availability?:number; latencyMs?:number; capacityBps?:number; }
export class NetworkGraph {
  private readonly nodes=new Map<string,NetworkNode>(); private readonly links:NetworkLink[]=[];
  addNode(node:NetworkNode):this{this.nodes.set(node.id,node);return this;}
  addLink(link:NetworkLink):this{if(!this.nodes.has(link.a)||!this.nodes.has(link.b)) throw new Error("Both link nodes must exist");this.links.push(link);return this;}
  neighbors(id:string):string[]{return this.links.flatMap(l=>l.a===id?[l.b]:l.b===id?[l.a]:[]);}
  connected(a:string,b:string):boolean{const seen=new Set([a]),q=[a];while(q.length){const x=q.shift()!;if(x===b)return true;for(const n of this.neighbors(x))if(!seen.has(n)){seen.add(n);q.push(n);}}return false;}
  shortestLatencyMs(a:string,b:string):number|undefined{const dist=new Map<string,number>([[a,0]]),q=new Set(this.nodes.keys());while(q.size){let u:string|undefined,du=Infinity;for(const id of q){const d=dist.get(id)??Infinity;if(d<du){du=d;u=id;}}if(!u||du===Infinity)break;q.delete(u);if(u===b)return du;for(const l of this.links){const v=l.a===u?l.b:l.b===u?l.a:undefined;if(v&&q.has(v)){const alt=du+(l.latencyMs??0);if(alt<(dist.get(v)??Infinity))dist.set(v,alt);}}}return undefined;}
  linkDistanceM(a:string,b:string):number|undefined{const x=this.nodes.get(a)?.location,y=this.nodes.get(b)?.location;return x&&y?haversineDistanceM(x,y):undefined;}
}
export class CommsModule { linkBudget=linkBudget; freeSpacePathLossDb=freeSpacePathLossDb; thermalNoiseDbm=thermalNoiseDbm; shannonCapacityBps=shannonCapacityBps; network(){return new NetworkGraph();} }
