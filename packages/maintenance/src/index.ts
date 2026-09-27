export interface MaintenanceRule{id:string;assetType:string;intervalHours?:number;intervalDays?:number;task:string;parts?:Array<{partId:string;quantity:number}>;}
export interface UsageState{operatingHours:number;lastServiceHours?:number;lastServiceAt?:Date;}
export function due(rule:MaintenanceRule,usage:UsageState,now=new Date()):boolean{
  const hoursDue=rule.intervalHours!==undefined&&(usage.operatingHours-(usage.lastServiceHours??0)>=rule.intervalHours);
  const daysDue=rule.intervalDays!==undefined&&(!usage.lastServiceAt||(now.getTime()-usage.lastServiceAt.getTime())/86400000>=rule.intervalDays);
  return hoursDue||daysDue;
}
export function exponentialFailureProbability(hours:number,mtbfHours:number):number{if(mtbfHours<=0)throw new Error("mtbfHours must be > 0");return 1-Math.exp(-Math.max(0,hours)/mtbfHours);}
export function weibullReliability(hours:number,scaleHours:number,shape:number):number{if(scaleHours<=0||shape<=0)throw new Error("scaleHours and shape must be > 0");return Math.exp(-Math.pow(Math.max(0,hours)/scaleHours,shape));}
export function remainingUsefulLifeLinear(current:number,warning:number,critical:number,ratePerHour:number):number|undefined{if(ratePerHour===0)return undefined;const target=ratePerHour>0?critical:warning;const h=(target-current)/ratePerHour;return h>=0?h:0;}
export class MaintenanceModule{due=due;failureProbability=exponentialFailureProbability;weibullReliability=weibullReliability;remainingUsefulLifeLinear=remainingUsefulLifeLinear;}
