export interface InventoryItem{id:string;name?:string;quantity:number;unit:string;reorderPoint?:number;reorderQuantity?:number;}
export interface InventoryTransaction{itemId:string;delta:number;at:Date;reason?:string;}
export class Inventory{
  private readonly items=new Map<string,InventoryItem>();private readonly tx:InventoryTransaction[]=[];
  upsert(item:InventoryItem):this{if(item.quantity<0)throw new Error("quantity cannot be negative");this.items.set(item.id,{...item});return this;}
  transact(itemId:string,delta:number,reason?:string,at=new Date()):InventoryItem{const item=this.items.get(itemId);if(!item)throw new Error(`Unknown inventory item: ${itemId}`);const next=item.quantity+delta;if(next<0)throw new Error("Insufficient inventory");item.quantity=next;this.tx.push({itemId,delta,at,...(reason?{reason}:{})});return{...item};}
  get(id:string):InventoryItem|undefined{const i=this.items.get(id);return i?{...i}:undefined;}
  list():InventoryItem[]{return[...this.items.values()].map(i=>({...i}));}
  lowStock():InventoryItem[]{return this.list().filter(i=>i.reorderPoint!==undefined&&i.quantity<=i.reorderPoint);}
  history(itemId?:string):InventoryTransaction[]{return this.tx.filter(t=>!itemId||t.itemId===itemId).map(t=>({...t}));}
}
export function enduranceHours(available:number,consumptionPerHour:number,reserveFraction=0):number{if(consumptionPerHour<=0)throw new Error("consumptionPerHour must be > 0");return Math.max(0,available*(1-Math.min(1,Math.max(0,reserveFraction)))/consumptionPerHour);}
export function reorderPoint(dailyDemand:number,leadTimeDays:number,safetyStock=0):number{return Math.max(0,dailyDemand*leadTimeDays+safetyStock);}
export function transportCapacity(payloadKg:number,vehicles:number,utilization=.85):number{return Math.max(0,payloadKg*vehicles*Math.min(1,Math.max(0,utilization)));}
export function daysOfSupply(stock:number,dailyDemand:number):number{return dailyDemand<=0?Infinity:Math.max(0,stock/dailyDemand);}
export class LogisticsModule{inventory(){return new Inventory();}enduranceHours=enduranceHours;reorderPoint=reorderPoint;transportCapacity=transportCapacity;daysOfSupply=daysOfSupply;}
