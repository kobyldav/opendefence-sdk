export interface Subject{id:string;roles:string[];attributes?:Record<string,string|number|boolean>;}
export interface DeviceIdentity{id:string;trusted:boolean;attributes?:Record<string,string|number|boolean>;}
export interface PolicyContext{subject:Subject;device?:DeviceIdentity;action:string;resource:string;environment?:Record<string,unknown>;}
export interface PolicyDecision{allow:boolean;reasons:string[];}
export interface PolicyRule{id:string;effect:"allow"|"deny";actions:string[];resources:string[];roles?:string[];requireTrustedDevice?:boolean;}
export class PolicyEngine{
  constructor(private readonly rules:PolicyRule[]=[]){ }
  add(rule:PolicyRule):this{this.rules.push(structuredClone(rule));return this;}
  authorize(ctx:PolicyContext):PolicyDecision{const matched=this.rules.filter(r=>(r.actions.includes("*")||r.actions.includes(ctx.action))&&(r.resources.includes("*")||r.resources.includes(ctx.resource))&&(!r.roles||r.roles.some(role=>ctx.subject.roles.includes(role)))&&(!r.requireTrustedDevice||ctx.device?.trusted===true));const denies=matched.filter(r=>r.effect==="deny");if(denies.length)return{allow:false,reasons:denies.map(r=>`denied:${r.id}`)};const allows=matched.filter(r=>r.effect==="allow");return{allow:allows.length>0,reasons:allows.length?allows.map(r=>`allowed:${r.id}`):["no-matching-allow-rule"]};}
}
export function canonicalJson(value:unknown):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonicalJson).join(",")}]`;const o=value as Record<string,unknown>;return`{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;}
function hex(bytes:ArrayBuffer):string{return[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");}
export async function sha256(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(typeof value==="string"?value:canonicalJson(value));return hex(await crypto.subtle.digest("SHA-256",bytes));}
export async function hmacSha256(secret:string,value:unknown):Promise<string>{const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const data=new TextEncoder().encode(typeof value==="string"?value:canonicalJson(value));return hex(await crypto.subtle.sign("HMAC",key,data));}
export async function verifyHmacSha256(secret:string,value:unknown,expectedHex:string):Promise<boolean>{return (await hmacSha256(secret,value)).toLowerCase()===expectedHex.toLowerCase();}
export class SecurityModule{readonly policy=new PolicyEngine();sha256=sha256;hmacSha256=hmacSha256;verifyHmacSha256=verifyHmacSha256;}
