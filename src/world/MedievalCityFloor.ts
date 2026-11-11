import {CITY_PLAIN_STONE_MATERIAL} from '../editor/CityStone';
import {cityStairGeometry} from '../editor/CityStairs';
import { cityPavingMaterial, alignCityPavingUV } from './CityPaving';
import * as THREE from "three";

// A single thick foundation with tiled stone, rather than thousands of meshes.
export class MedievalCityFloor {
  readonly root=new THREE.Group();
  private signature="";
  private readonly stone:THREE.MeshStandardMaterial;
  private readonly stairSurfaces:{group:THREE.Group;x:number;z:number;dx:number;dz:number;width:number;length:number;top:number;bottom:number;count:number}[]=[];
  getEditableStairs(){return this.stairSurfaces.map(s=>s.group).filter(g=>g.parent);}
  constructor(scene:THREE.Scene){
    this.root.name="Piso medieval da cidade";
    this.root.userData.buildEditable=false;
    scene.add(this.root);
    this.stone=cityPavingMaterial();
  }
  update(towers:THREE.Object3D[],gates:THREE.Object3D[]=[],groundAt?:(x:number,z:number)=>number){
    if(towers.length!==8)return;
    const signature=[...towers,...gates].map(t=>t.position.toArray().join(",")).join(";");
    if(signature===this.signature)return;this.signature=signature;
    this.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.root.clear();
    const center=towers.reduce((v,t)=>v.add(t.position),new THREE.Vector3()).multiplyScalar(1/8);
    const points=towers.map(t=>new THREE.Vector2(t.position.x,t.position.z));
    points.sort((a,b)=>Math.atan2(a.y-center.z,a.x-center.x)-Math.atan2(b.y-center.z,b.x-center.x));
    // Four metres of masonry cover the buried wall bases and exposed grass.
    const top=center.y+4;
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y)));
    const slabGeometry=new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false,steps:1});
    slabGeometry.rotateX(-Math.PI/2);slabGeometry.translate(0,top-4,0);
    alignCityPavingUV(slabGeometry);
    const slab=new THREE.Mesh(slabGeometry,[this.stone,new THREE.MeshStandardMaterial({color:0x555b63,roughness:1})]);
    slab.receiveShadow=true;this.root.add(slab);
    const trimMaterial=new THREE.MeshStandardMaterial({color:0x929aa3,roughness:.92});
    for(let i=0;i<8;i++){
      const a=points[i],b=points[(i+1)%8];
      const length=a.distanceTo(b),edge=new THREE.Mesh(new THREE.BoxGeometry(length, .16,1.5),trimMaterial);
      // Keep the entire coping inside the polygon, flush with the paving.
      // Previously half its width projected outside and made a raised lip.
      const inward=new THREE.Vector2(center.x-(a.x+b.x)/2,center.z-(a.y+b.y)/2).normalize();
      edge.position.set((a.x+b.x)/2+inward.x*.8,top-.055,(a.y+b.y)/2+inward.y*.8);edge.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);edge.receiveShadow=true;this.root.add(edge);
    }
    // Concentric inlays and spokes give the central square a crafted focal point.
    const inlay=new THREE.MeshStandardMaterial({color:0x505963,roughness:.88});
    for(const radius of [10,12,26]){
      const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.45,64),inlay);ring.rotation.x=-Math.PI/2;ring.position.set(center.x,top+.035,center.z);this.root.add(ring);
    }
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,spoke=new THREE.Mesh(new THREE.BoxGeometry(.35,.04,14),inlay);
      spoke.position.set(center.x+Math.sin(angle)*19,top+.035,center.z+Math.cos(angle)*19);spoke.rotation.y=angle;this.root.add(spoke);
    }
    this.root.userData.floorHeight=top;
    this.root.userData.floorPolygon=points;
    this.stairSurfaces.length=0;
    const stairMaterial=CITY_PLAIN_STONE_MATERIAL;
    for(const gate of gates){
      const outward=new THREE.Vector2(gate.position.x-center.x,gate.position.z-center.z).normalize();
      // Begin outside the slab: the old three-metre overlap put the first
      // tread and the paving on exactly the same plane (z-fighting).
      const x=gate.position.x+outward.x*.02,z=gate.position.z+outward.y*.02;
      // Match the full arch opening, with a slight overlap into its jambs.
      const length=24,width=Math.max(5,6.2*gate.scale.x+.4);
      const bottom=groundAt?.(x+outward.x*length,z+outward.y*length)??top-4;
      if(bottom>=top-.15)continue;
      const count=Math.max(8,Math.ceil((top-bottom)/.25));
      const stairs=new THREE.Group();stairs.name="Escadaria de pedra do portão";
      // Stairs belong to the capital foundation. They are regenerated from
      // the gate transforms and must not drift away as independent assets.
      stairs.userData.buildEditable=false;
      stairs.userData.buildId=`city-stairs-${gate.userData.cityId}`;
      stairs.position.set(x,0,z);stairs.rotation.y=Math.atan2(outward.x,outward.y);
      const geometry=cityStairGeometry(length,0,width,bottom,top,count,bottom-.6);
      const block=new THREE.Mesh(geometry,stairMaterial);
      block.receiveShadow=true;stairs.add(block);
      this.root.add(stairs);
      this.stairSurfaces.push({group:stairs,x,z,dx:outward.x,dz:outward.y,width,length,top,bottom,count});
    }
  }
  blocksTreeAt(x:number,z:number,margin=0){
    for(const s of this.stairSurfaces){
      if(!s.group.parent)continue;
      s.group.updateWorldMatrix(true,false);
      const point=s.group.worldToLocal(new THREE.Vector3(x,0,z));
      const scale=s.group.getWorldScale(new THREE.Vector3());
      const pad=margin/Math.max(.001,Math.min(Math.abs(scale.x),Math.abs(scale.z)));
      if(point.z>=-pad&&point.z<=s.length+pad&&Math.abs(point.x)<=s.width/2+pad)return true;
    }
    return false;
  }
  stairHeightAt(x:number,z:number):number|null{
    for(const s of this.stairSurfaces){
      if(!s.group.parent)continue;
      s.group.updateWorldMatrix(true,false);
      const local=s.group.worldToLocal(new THREE.Vector3(x,s.group.position.y,z));
      const along=local.z,across=local.x;
      if(along>=0&&along<=s.length&&Math.abs(across)<=s.width/2){
        const step=Math.min(s.count-1,Math.floor(along/s.length*s.count));
        return s.group.localToWorld(new THREE.Vector3(across,s.top-(s.top-s.bottom)*step/s.count+.06,along)).y;
      }
    }
    return null;
  }
  heightAt(x:number,z:number):number|null{
    const points=this.root.userData.floorPolygon as THREE.Vector2[]|undefined;if(!points)return null;
    let inside=false;for(let i=0,j=7;i<8;j=i++){
      const a=points[i],b=points[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside?this.root.userData.floorHeight:null;
  }
  terrainHeightAt(x:number,z:number):number|null{
    const points=this.root.userData.floorPolygon as THREE.Vector2[]|undefined;
    if(!points)return null;
    // Terrain triangles span several metres. Lower a skirt beyond the slab
    // too, otherwise an outside vertex lifts a green triangle through it.
    let covered=this.heightAt(x,z)!==null;
    for(let i=0;!covered&&i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.y-a.y;
      const lengthSq=dx*dx+dz*dz;
      const t=lengthSq?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.y)*dz)/lengthSq,0,1):0;
      const offsetX=x-a.x-dx*t,offsetZ=z-a.y-dz*t;
      covered=offsetX*offsetX+offsetZ*offsetZ<324;
    }
    return covered?this.root.userData.floorHeight-4:null;
  }
}
