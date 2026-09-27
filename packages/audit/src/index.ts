import { canonicalJson, sha256 } from "@opendefence/security";
export interface AuditEntry<T=unknown>{sequence:number;at:Date;actor:string;action:string;resource?:string;payload?:T;previousHash:string;hash:string;}
export class AuditLog{
  private readonly entries:AuditEntry[]=[];
  async append<T>(input:{actor:string;action:string;resource?:string;payload?:T;at?:Date}):Promise<AuditEntry<T>>{const sequence=this.entries.length+1,at=input.at??new Date(),previousHash=this.entries.at(-1)?.hash??"GENESIS";const unsigned={sequence,at:at.toISOString(),actor:input.actor,action:input.action,resource:input.resource??null,payload:input.payload??null,previousHash};const hash=await sha256(canonicalJson(unsigned));const entry:AuditEntry<T>={sequence,at,actor:input.actor,action:input.action,previousHash,hash,...(input.resource?{resource:input.resource}:{}),...(input.payload===undefined?{}:{payload:input.payload})};this.entries.push(entry as AuditEntry);return structuredClone(entry);}
  list():AuditEntry[]{return this.entries.map(e=>structuredClone(e));}
  async verify():Promise<boolean>{let previousHash="GENESIS";for(const e of this.entries){const unsigned={sequence:e.sequence,at:e.at.toISOString(),actor:e.actor,action:e.action,resource:e.resource??null,payload:e.payload??null,previousHash};const hash=await sha256(canonicalJson(unsigned));if(e.previousHash!==previousHash||e.hash!==hash)return false;previousHash=e.hash;}return true;}
}
export class AuditModule{readonly log=new AuditLog();}
