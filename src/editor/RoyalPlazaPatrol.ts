import {Vector3,type Group} from 'three';

/** Mirrored circuits keep the two plaza sentries on their respective sides. */
export class RoyalPlazaPatrol{
  private index=0;
  private wait=0;
  private initialized=false;
  private readonly target=new Vector3();
  private readonly previous=new Vector3();
  update(dt:number,palace:Group,post:number,position:Vector3,collide:(p:Vector3,r:number)=>void){
    const route=palace.userData.npcPlazaPatrolRoutes?.[post] as number[][]|undefined;
    if(!route?.length)return {walking:false,angle:0};
    palace.updateWorldMatrix(true,false);
    if(!this.initialized){position.fromArray(route[0]).applyMatrix4(palace.matrixWorld);this.index=1;this.initialized=true;}
    this.target.fromArray(route[this.index]).applyMatrix4(palace.matrixWorld);
    const dx=this.target.x-position.x,dz=this.target.z-position.z,distance=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    if(this.wait>0){this.wait-=dt;return {walking:false,angle};}
    if(distance<.15){this.index=(this.index+1)%route.length;this.wait=1.5;return {walking:false,angle};}
    this.previous.copy(position);
    const step=Math.min(distance,Math.max(0,dt)*1.5);
    position.x+=dx/distance*step;position.z+=dz/distance*step;position.y=this.target.y;
    collide(position,.32);
    return {walking:position.distanceToSquared(this.previous)>.000001,angle};
  }
}
