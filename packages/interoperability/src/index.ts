import { HttpClient } from "@opendefence/core";
import type { BoundingBox, GeoJsonGeometry } from "@opendefence/geo";

export interface GeoJsonFeature<P=Record<string,unknown>>{type:"Feature";id?:string|number;geometry:GeoJsonGeometry|Record<string,unknown>|null;properties:P;}
export interface GeoJsonFeatureCollection<P=Record<string,unknown>>{type:"FeatureCollection";features:Array<GeoJsonFeature<P>>;numberMatched?:number;numberReturned?:number;links?:Array<{href:string;rel:string;type?:string}>;}
export class OgcFeaturesClient{
  constructor(readonly baseUrl:string,private readonly http=new HttpClient({cacheTtlMs:60_000})){}
  async collections():Promise<unknown[]>{const d=await this.http.json<{collections?:unknown[]}>(new URL("collections",this.baseUrl.endsWith("/")?this.baseUrl:`${this.baseUrl}/`));return d.collections??[];}
  async items<P=Record<string,unknown>>(collectionId:string,options:{bbox?:BoundingBox;limit?:number;datetime?:string;params?:Record<string,string|number|boolean>}={}):Promise<GeoJsonFeatureCollection<P>>{
    const url=new URL(`collections/${encodeURIComponent(collectionId)}/items`,this.baseUrl.endsWith("/")?this.baseUrl:`${this.baseUrl}/`);
    if(options.bbox)url.searchParams.set("bbox",[options.bbox.west,options.bbox.south,options.bbox.east,options.bbox.north].join(","));if(options.limit)url.searchParams.set("limit",String(options.limit));if(options.datetime)url.searchParams.set("datetime",options.datetime);for(const[k,v]of Object.entries(options.params??{}))url.searchParams.set(k,String(v));return this.http.json<GeoJsonFeatureCollection<P>>(url);
  }
}
export interface CcsdsKvnMessage{header:Record<string,string>;metadata:Record<string,string>;data:Record<string,string>|Array<Record<string,string>>;rawLines:string[];}
export function parseKvn(text:string):CcsdsKvnMessage{
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith("COMMENT"));const header:Record<string,string>={},metadata:Record<string,string>={},data:Record<string,string>={};let section:"header"|"metadata"|"data"="header";
  for(const line of lines){if(line==="META_START"){section="metadata";continue;}if(line==="META_STOP"){section="data";continue;}if(line==="DATA_START"){section="data";continue;}if(line==="DATA_STOP")continue;const i=line.indexOf("=");if(i<0)continue;const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();(section==="header"?header:section==="metadata"?metadata:data)[k]=v;}
  return{header,metadata,data,rawLines:lines};
}
export function detectCcsdsOrbitMessageType(message:CcsdsKvnMessage):"OPM"|"OMM"|"OEM"|"OCM"|"unknown"{const versionKey=Object.keys(message.header).find(k=>k.endsWith("_VERS"));if(!versionKey)return"unknown";if(versionKey.startsWith("CCSDS_OPM"))return"OPM";if(versionKey.startsWith("CCSDS_OMM"))return"OMM";if(versionKey.startsWith("CCSDS_OEM"))return"OEM";if(versionKey.startsWith("CCSDS_OCM"))return"OCM";return"unknown";}
export class InteroperabilityModule{ogcFeatures(baseUrl:string){return new OgcFeaturesClient(baseUrl);}parseKvn=parseKvn;detectCcsdsOrbitMessageType=detectCcsdsOrbitMessageType;}
