export interface RouteEdge{from:string;to:string;cost:number;bidirectional?:boolean;metadata?:Record<string,unknown>;}
export interface RouteResult{nodes:string[];cost:number;}
export class RouteGraph{
  private readonly edges:RouteEdge[]=[];private readonly nodes=new Set<string>();
  add(edge:RouteEdge):this{if(edge.cost<0||!Number.isFinite(edge.cost))throw new Error("edge cost must be finite and non-negative");this.edges.push({...edge});this.nodes.add(edge.from);this.nodes.add(edge.to);return this;}
  neighbors(id:string):Array<{node:string;cost:number}>{return this.edges.flatMap(e=>e.from===id?[{node:e.to,cost:e.cost}]:(e.bidirectional&&e.to===id)?[{node:e.from,cost:e.cost}]:[]);}
  shortest(from:string,to:string):RouteResult|undefined{const dist=new Map<string,number>([[from,0]]),prev=new Map<string,string>(),open=new Set(this.nodes);while(open.size){let u:string|undefined,best=Infinity;for(const n of open){const d=dist.get(n)??Infinity;if(d<best){best=d;u=n;}}if(!u||best===Infinity)break;open.delete(u);if(u===to)break;for(const n of this.neighbors(u)){const alt=best+n.cost;if(alt<(dist.get(n.node)??Infinity)){dist.set(n.node,alt);prev.set(n.node,u);}}}const cost=dist.get(to);if(cost===undefined)return undefined;const nodes=[to];let cur=to;while(cur!==from){const p=prev.get(cur);if(!p)return undefined;nodes.push(p);cur=p;}return{nodes:nodes.reverse(),cost};}
}
export class RoutingModule{graph(){return new RouteGraph();}}
