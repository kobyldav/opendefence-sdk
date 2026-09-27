export interface SoftwareComponent{name:string;version?:string;purl?:string;licenses?:string[];hashes?:Record<string,string>;}
export interface VulnerabilityRecord{id:string;component:string;severity?:"low"|"medium"|"high"|"critical";fixedVersion?:string;publishedAt?:Date;source?:string;}
export interface CyberAsset{id:string;hostname?:string;components:SoftwareComponent[];patchLevel?:string;lastAssessedAt:Date;}
export class CyberInventory{
  private readonly assets=new Map<string,CyberAsset>();private readonly vulns:VulnerabilityRecord[]=[];
  upsertAsset(asset:CyberAsset):this{this.assets.set(asset.id,structuredClone(asset));return this;}
  addVulnerability(v:VulnerabilityRecord):this{this.vulns.push(structuredClone(v));return this;}
  asset(id:string):CyberAsset|undefined{const a=this.assets.get(id);return a?structuredClone(a):undefined;}
  findings(assetId:string):VulnerabilityRecord[]{const a=this.assets.get(assetId);if(!a)return[];const names=new Set(a.components.map(c=>c.name));return this.vulns.filter(v=>names.has(v.component)).map(v=>structuredClone(v));}
  posture(assetId:string):{findings:number;critical:number;high:number;stale:boolean}{const f=this.findings(assetId),a=this.assets.get(assetId);return{findings:f.length,critical:f.filter(v=>v.severity==="critical").length,high:f.filter(v=>v.severity==="high").length,stale:!a||Date.now()-a.lastAssessedAt.getTime()>7*86400000};}
}
export function parseCycloneDx(input:unknown):SoftwareComponent[]{const doc=input as {components?:Array<{name?:string;version?:string;purl?:string;licenses?:Array<{license?:{id?:string;name?:string}}>;hashes?:Array<{alg?:string;content?:string}>}>};return(doc.components??[]).flatMap(c=>c.name?[{name:c.name,...(c.version?{version:c.version}:{}),...(c.purl?{purl:c.purl}:{}),licenses:(c.licenses??[]).flatMap(l=>l.license?.id??l.license?.name??[]),hashes:Object.fromEntries((c.hashes??[]).flatMap(h=>h.alg&&h.content?[[h.alg,h.content]]:[]))}]:[]);}
export class CyberModule{readonly inventory=new CyberInventory();parseCycloneDx=parseCycloneDx;}
