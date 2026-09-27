export function batteryEnergyWh(voltageV:number,capacityAh:number):number{return voltageV*capacityAh;}
export function runtimeHours(energyWh:number,loadW:number,usableFraction=.8):number{if(loadW<=0)throw new Error("loadW must be > 0");return Math.max(0,energyWh*Math.min(1,Math.max(0,usableFraction))/loadW);}
export function solarPowerW(areaM2:number,irradianceWm2:number,efficiency:number,cosineFactor=1):number{return Math.max(0,areaM2*irradianceWm2*Math.min(1,Math.max(0,efficiency))*Math.min(1,Math.max(0,cosineFactor)));}
export function fuelEnergyKWh(massKg:number,specificEnergyMJkg:number,conversionEfficiency=1):number{return Math.max(0,massKg*specificEnergyMJkg*conversionEfficiency/3.6);}
export interface PowerLoad{name:string;watts:number;dutyCycle:number;}
export function averageLoadW(loads:PowerLoad[]):number{return loads.reduce((s,l)=>s+l.watts*Math.min(1,Math.max(0,l.dutyCycle)),0);}
export class EnergyModule{batteryEnergyWh=batteryEnergyWh;runtimeHours=runtimeHours;solarPowerW=solarPowerW;fuelEnergyKWh=fuelEnergyKWh;averageLoadW=averageLoadW;}
