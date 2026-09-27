export interface MetricPoint{name:string;value:number;at:Date;labels:Record<string,string>;}
export interface TelemetrySink{emit(point:MetricPoint):void|Promise<void>;}
export class InMemoryTelemetrySink implements TelemetrySink{readonly points:MetricPoint[]=[];emit(point:MetricPoint):void{this.points.push(structuredClone(point));}}
export class TelemetryRegistry{
  private readonly counters=new Map<string,number>();private readonly gauges=new Map<string,number>();private readonly sinks:TelemetrySink[]=[];
  addSink(sink:TelemetrySink):this{this.sinks.push(sink);return this;}
  async increment(name:string,delta=1,labels:Record<string,string>={}):Promise<number>{const value=(this.counters.get(name)??0)+delta;this.counters.set(name,value);await this.emit(name,value,labels);return value;}
  async gauge(name:string,value:number,labels:Record<string,string>={}):Promise<number>{this.gauges.set(name,value);await this.emit(name,value,labels);return value;}
  get(name:string):number|undefined{return this.gauges.get(name)??this.counters.get(name);}
  snapshot():Record<string,number>{return Object.fromEntries([...this.counters,...this.gauges]);}
  private async emit(name:string,value:number,labels:Record<string,string>):Promise<void>{const p:MetricPoint={name,value,at:new Date(),labels:{...labels}};await Promise.all(this.sinks.map(s=>s.emit(p)));}
}
export class TelemetryModule{readonly registry=new TelemetryRegistry();}
