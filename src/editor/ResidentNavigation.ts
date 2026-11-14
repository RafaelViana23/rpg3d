import { Vector3 } from 'three';

/** Stable priority order matches the former array scan, including equal costs. */
class NavigationOpenSet<T extends {f:number}>{
  private readonly heap:Array<T & {queueOrder:number}>=[];
  private nextOrder=0;
  get length(){return this.heap.length;}
  private before(a:T & {queueOrder:number},b:T & {queueOrder:number}){
    return a.f<b.f||(a.f===b.f&&a.queueOrder<b.queueOrder);
  }
  push(node:T){
    const entry=node as T & {queueOrder:number};entry.queueOrder=this.nextOrder++;
    let index=this.heap.length;this.heap.push(entry);
    while(index>0){
      const parent=(index-1)>>>1;if(!this.before(entry,this.heap[parent]))break;
      this.heap[index]=this.heap[parent];index=parent;
    }
    this.heap[index]=entry;
  }
  pop():T{
    const first=this.heap[0],last=this.heap.pop()!;
    if(this.heap.length){
      let index=0;
      while(index*2+1<this.heap.length){
        let child=index*2+1;
        if(child+1<this.heap.length&&this.before(this.heap[child+1],this.heap[child]))child++;
        if(!this.before(this.heap[child],last))break;
        this.heap[index]=this.heap[child];index=child;
      }
      this.heap[index]=last;
    }
    return first;
  }
}

/** Bounded A* over the city's collision geometry. Shared cells amortize path searches. */
export class ResidentNavigation {
  constructor(private readonly cellSize=2){}
  private cells=new Map<string,boolean>();
  clear(){this.cells.clear();}
  route(start:Vector3,end:Vector3,height:(x:number,z:number,feetY?:number)=>number,collide:(p:Vector3,r:number)=>void):Vector3[]{
    const search=this.routeSteps(start,end,height,collide);
    let result=search.next();while(!result.done)result=search.next();return result.value;
  }
  *routeSteps(start:Vector3,end:Vector3,height:(x:number,z:number,feetY?:number)=>number,collide:(p:Vector3,r:number)=>void):Generator<void,Vector3[],void>{
    if(this.cellSize<2){return yield* this.fineRouteSteps(start,end,height,collide);}
    const step=2,key=(x:number,z:number)=>`${x},${z}`;
    const sx=Math.round(start.x/step),sz=Math.round(start.z/step),ex=Math.round(end.x/step),ez=Math.round(end.z/step);
    const free=(x:number,z:number)=>{
      const k=key(x,z),cached=this.cells.get(k);if(cached!==undefined)return cached;
      const p=new Vector3(x*step,height(x*step,z*step),z*step),before=p.clone();collide(p,.45);
      const valid=p.distanceToSquared(before)<.0025;this.cells.set(k,valid);return valid;
    };
    type Node={x:number;z:number;g:number;f:number;parent?:Node};
    const open=new NavigationOpenSet<Node>(),best=new Map<string,number>([[key(sx,sz),0]]);
    open.push({x:sx,z:sz,g:0,f:0});
    for(let visits=0;open.length&&visits<5000;visits++){
      yield;
      const n=open.pop();
      if(Math.hypot(n.x-ex,n.z-ez)<=1.5){
        const path:Vector3[]=[];let p:Node|undefined=n;
        while(p?.parent){yield;path.push(new Vector3(p.x*step,height(p.x*step,p.z*step),p.z*step));p=p.parent;}return path.reverse();
      }
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=n.x+dx,z=n.z+dz,g=n.g+1,k=key(x,z);
        if(g>350||(best.get(k)??Infinity)<=g||!free(x,z))continue;
        best.set(k,g);open.push({x,z,g,f:g+Math.abs(x-ex)+Math.abs(z-ez),parent:n});
      }
    }
    return [];
  }
  /** Small indoor cells, swept edges and per-node floor heights preserve narrow routes and stairs. */
  private *fineRouteSteps(start:Vector3,end:Vector3,height:(x:number,z:number,feetY?:number)=>number,collide:(p:Vector3,r:number)=>void):Generator<void,Vector3[],void>{
    const step=this.cellSize;
    type Node={p:Vector3;g:number;f:number;parent?:Node};
    const key=(p:Vector3)=>`${Math.round(p.x/step)},${Math.round(p.y*2)},${Math.round(p.z/step)}`;
    const sweep=(a:Vector3,b:Vector3)=>{
      const count=Math.max(1,Math.ceil(a.distanceTo(b)/.18));let feet=a.y;
      for(let i=1;i<=count;i++){
        const p=a.clone().lerp(b,i/count);p.y=height(p.x,p.z,feet+.02);
        if(Math.abs(p.y-feet)>.35)return null;
        feet=p.y;const before=p.clone();collide(p,.32);
        if(Math.hypot(p.x-before.x,p.z-before.z)>.04)return null;
      }
      return new Vector3(b.x,feet,b.z);
    };
    const open=new NavigationOpenSet<Node>(),best=new Map<string,number>([[key(start),0]]);
    open.push({p:start.clone(),g:0,f:start.distanceTo(end)});
    for(let visits=0;open.length&&visits<14000;visits++){
      yield;
      const n=open.pop();if(n.g>(best.get(key(n.p))??Infinity)+.001)continue;
      if(n.p.distanceTo(end)<step*2){
        const finish=sweep(n.p,end);
        if(finish&&Math.abs(finish.y-end.y)<.4){const path=[finish];let p:Node|undefined=n;while(p?.parent){yield;path.push(p.p);p=p.parent;}return path.reverse();}
      }
      for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const p=sweep(n.p,new Vector3(n.p.x+dx*step,n.p.y,n.p.z+dz*step));if(!p)continue;
        const g=n.g+n.p.distanceTo(p),k=key(p);
        if(g>180||(best.get(k)??Infinity)<=g)continue;
        best.set(k,g);open.push({p,g,f:g+p.distanceTo(end),parent:n});
      }
    }
    return [];
  }

}
