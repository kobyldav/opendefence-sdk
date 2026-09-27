export interface ModelReference{id:string;version?:string;task?:string;sizeBytes?:number;metadata?:Record<string,unknown>;}
export interface InferenceContext{offline?:boolean;maxLatencyMs?:number;powerBudgetW?:number;preferredProvider?:string;}
export interface InferenceProvider{readonly id:string;available():Promise<boolean>|boolean;supports(model:ModelReference):Promise<boolean>|boolean;infer<I,O>(model:ModelReference,input:I):Promise<O>;}
export class InferenceRouter{
  private readonly providers:InferenceProvider[]=[];
  register(provider:InferenceProvider):this{this.providers.push(provider);return this;}
  async select(model:ModelReference,context:InferenceContext={}):Promise<InferenceProvider>{if(context.preferredProvider){const p=this.providers.find(x=>x.id===context.preferredProvider);if(p&&await p.available()&&await p.supports(model))return p;}for(const p of this.providers)if(await p.available()&&await p.supports(model))return p;throw new Error(`No inference provider supports ${model.id}`);}
  async infer<I,O>(model:ModelReference,input:I,context:InferenceContext={}):Promise<O>{return(await this.select(model,context)).infer<I,O>(model,input);}
}
export function zScoreAnomalies(values:number[],threshold=3):Array<{index:number;value:number;z:number}>{if(values.length<2)return[];const mean=values.reduce((a,b)=>a+b,0)/values.length;const sd=Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/(values.length-1));if(sd===0)return[];return values.map((value,index)=>({index,value,z:(value-mean)/sd})).filter(x=>Math.abs(x.z)>=threshold);}
export class AIModule{readonly router=new InferenceRouter();detectAnomalies=zScoreAnomalies;}
