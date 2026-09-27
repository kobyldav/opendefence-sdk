import type { FleetRegistry } from "@opendefence/fleet";
import type { ObservationStore } from "@opendefence/sensors";
export interface ReadinessReport{generatedAt:Date;fleet:ReturnType<FleetRegistry["readiness"]>;sensorHealth:Array<ReturnType<ObservationStore["health"]>>;}
export function readinessReport(fleet:FleetRegistry,sensors:ObservationStore,sensorIds:string[],now=new Date()):ReadinessReport{return{generatedAt:now,fleet:fleet.readiness(),sensorHealth:sensorIds.map(id=>sensors.health(id,5*60_000,now))};}
function csvEscape(v:unknown):string{const s=v instanceof Date?v.toISOString():typeof v==="object"?JSON.stringify(v):String(v??"");return/[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
export function toCsv(rows:Array<Record<string,unknown>>):string{const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return[keys.join(","),...rows.map(r=>keys.map(k=>csvEscape(r[k])).join(","))].join("\n");}
export class ReportingModule{readinessReport=readinessReport;toCsv=toCsv;}
