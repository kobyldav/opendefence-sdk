import { ValidationError } from "@opendefence/core";
export class XorShift32{private state:number;constructor(seed=0x12345678){this.state=seed|0;if(this.state===0)this.state=1;}nextUint32():number{let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x|0;return x>>>0;}random():number{return this.nextUint32()/0x100000000;}normal(mean=0,stddev=1):number{const u=Math.max(Number.EPSILON,this.random()),v=this.random();return mean+stddev*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}}
export interface SimEvent{atMs:number;type:string;payload?:unknown;}
export interface ScenarioState{timeMs:number;eventsProcessed:number;data:Record<string,unknown>;}
export class Scenario{
  readonly rng:XorShift32;private readonly queue:SimEvent[]=[];private readonly handlers=new Map<string,Array<(event:SimEvent,state:ScenarioState)=>void>>();private readonly stateValue:ScenarioState;
  constructor(readonly seed=1,startTimeMs=0){this.rng=new XorShift32(seed);this.stateValue={timeMs:startTimeMs,eventsProcessed:0,data:{}};}
  on(type:string,handler:(event:SimEvent,state:ScenarioState)=>void):this{const list=this.handlers.get(type)??[];list.push(handler);this.handlers.set(type,list);return this;}
  schedule(event:SimEvent):this{if(event.atMs<this.stateValue.timeMs)throw new ValidationError("Cannot schedule an event in the past");this.queue.push(structuredClone(event));this.queue.sort((a,b)=>a.atMs-b.atMs);return this;}
  step():SimEvent|undefined{const event=this.queue.shift();if(!event)return undefined;this.stateValue.timeMs=event.atMs;for(const h of this.handlers.get(event.type)??[])h(event,this.stateValue);this.stateValue.eventsProcessed++;return structuredClone(event);}
  run(untilMs=Infinity,maxEvents=1_000_000):ScenarioState{let n=0;while(this.queue.length&&this.queue[0]!.atMs<=untilMs&&n++<maxEvents)this.step();if(Number.isFinite(untilMs))this.stateValue.timeMs=Math.max(this.stateValue.timeMs,untilMs);return this.state();}
  state():ScenarioState{return structuredClone(this.stateValue);}
  pending():SimEvent[]{return this.queue.map(e=>structuredClone(e));}
  snapshot():string{return JSON.stringify({seed:this.seed,state:this.stateValue,queue:this.queue});}
}
export class SimulationModule{scenario(options:{seed?:number;startTimeMs?:number}={}):Scenario{return new Scenario(options.seed,options.startTimeMs);}}
