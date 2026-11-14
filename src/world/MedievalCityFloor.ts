import {CITY_PLAIN_STONE_MATERIAL} from '../editor/CityStone';
import {cityStairGeometry,cityStoneStairCount} from '../editor/CityStairs';
import {ROYAL_PRECINCT,ROYAL_PALACE_ELEVATION} from '../editor/RoyalPalace';
import { cityPavingMaterial, alignCityPavingUV } from './CityPaving';
import * as THREE from "three";

// A single thick foundation with tiled stone, rather than thousands of meshes.
export class MedievalCityFloor {
  readonly root=new THREE.Group();
  private signature="";
  private readonly stone:THREE.MeshStandardMaterial;
  private readonly stairSurfaces:{group:THREE.Group;x:number;z:number;dx:number;dz:number;width:number;length:number;top:number;bottom:number;count:number}[]=[];
  private readonly stairPoint=new THREE.Vector3();
  private readonly stairTransforms=new WeakMap<THREE.Group,{matrix:THREE.Matrix4;inverse:THREE.Matrix4;bounds:THREE.Box3}>();
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
    // Tower origins are now at the real model ground. The city cap therefore
    // uses that same elevation, with no legacy buried-origin offset.
    const top=.2;
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y)));
    const slabGeometry=new THREE.ExtrudeGeometry(shape,{depth:top,bevelEnabled:false,steps:1});
    slabGeometry.rotateX(-Math.PI/2);slabGeometry.translate(0,0,0);
    // Keep the foundation sealed. Only the upper cap receives paving;
    // the underside uses the same plain masonry as the vertical foundation.
    const normals=slabGeometry.getAttribute('normal');slabGeometry.clearGroups();
    let groupStart=0,materialIndex=normals.getY(0)>.5?0:1;
    for(let i=3;i<=normals.count;i+=3){
      const next=i<normals.count?(normals.getY(i)>.5?0:1):-1;
      if(next!==materialIndex){slabGeometry.addGroup(groupStart,i-groupStart,materialIndex);groupStart=i;materialIndex=next;}
    }
    alignCityPavingUV(slabGeometry);
    const slab=new THREE.Mesh(slabGeometry,[this.stone,new THREE.MeshStandardMaterial({color:0x555b63,roughness:1})]);
    slab.name="Chão elevado da cidade";slab.receiveShadow=true;this.root.add(slab);
    const trimMaterial=new THREE.MeshStandardMaterial({color:0x929aa3,roughness:.92});
    for(let i=0;i<8;i++){
      const a=points[i],b=points[(i+1)%8];
      const length=a.distanceTo(b),direction=b.clone().sub(a).normalize();
      const inward=new THREE.Vector2(center.x-(a.x+b.x)/2,center.z-(a.y+b.y)/2).normalize();
      // The perimeter coping must stop at the gateway jambs, never cross
      // the avenue between its paving and the first stair tread.
      let spans:[number,number][]=[[0,length]];
      for(const gate of gates){
        const offset=new THREE.Vector2(gate.position.x-a.x,gate.position.z-a.y);
        const along=offset.dot(direction),distance=Math.abs(offset.x*direction.y-offset.y*direction.x);
        if(distance>3||along<0||along>length)continue;
        const halfWidth=Math.max(20,6.2*Math.abs(gate.scale.x))/2+.9;
        spans=spans.flatMap(([lo,hi])=>{
          if(along+halfWidth<=lo||along-halfWidth>=hi)return [[lo,hi] as [number,number]];
          const pieces:[number,number][]=[];
          if(along-halfWidth>lo)pieces.push([lo,along-halfWidth]);
          if(along+halfWidth<hi)pieces.push([along+halfWidth,hi]);
          return pieces;
        });
      }
      for(const [lo,hi] of spans){
        const mid=a.clone().addScaledVector(direction,(lo+hi)/2).addScaledVector(inward,.8);
        const edge=new THREE.Mesh(new THREE.BoxGeometry(hi-lo,.16,1.5),trimMaterial);
        edge.position.set(mid.x,top-.055,mid.y);edge.rotation.y=-Math.atan2(direction.y,direction.x);
        edge.receiveShadow=true;this.root.add(edge);
      }
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
    // The city gates no longer generate attached stair flights.
    for(const gate of [] as THREE.Object3D[]){
      // The saved gate origin is buried in the foundation, below city paving.
      // Fit only the door leaf to the paving, preserving the masonry transform.
      gate.updateWorldMatrix(true,false);
      const floorPoint=gate.getWorldPosition(new THREE.Vector3());floorPoint.y=top;
      const floorY=gate.worldToLocal(floorPoint).y;
      gate.userData.wallGateFloorY=floorY;
      gate.userData.setWallGateFloor?.(floorY);
      const outward=new THREE.Vector2(gate.position.x-center.x,gate.position.z-center.z).normalize();
      const inwardPoint=gate.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-outward.x,0,-outward.y));
      const inwardSign=gate.worldToLocal(inwardPoint).z>=0?1:-1;
      gate.userData.wallGateInwardSign=inwardSign;gate.userData.setWallGateInward?.(inwardSign);
      // Begin outside the slab: the old three-metre overlap put the first
      // tread and the paving on exactly the same plane (z-fighting).
      const x=gate.position.x+outward.x*.02,z=gate.position.z+outward.y*.02;
      // Copy the palace entrance flight at full size. Its lower steps are
      // intentionally buried where the natural terrain meets the solid stone.
      const length=19,width=ROYAL_PRECINCT.portalWidth;
      gate.userData.wallGateApproach={x:gate.position.x,z:gate.position.z,dx:outward.x,dz:outward.y,length};
      const bottom=top-(6.08+ROYAL_PALACE_ELEVATION)/2;
      const ground=groundAt?.(x+outward.x*length,z+outward.y*length)??top-4;
      if(ground>=top-.15)continue;
      let base=Math.min(bottom,ground)-.6;
      // Extend the closed foundation below the terrain across the entire flight.
      for(let along=0;along<=length;along+=1)for(const across of [-width/2,0,width/2]){
        const terrain=groundAt?.(x+outward.x*along+outward.y*across,z+outward.y*along-outward.x*across);
        if(terrain!==undefined)base=Math.min(base,terrain-.6);
      }
      const count=cityStoneStairCount(bottom,top);
      const stairs=new THREE.Group();stairs.name="Escadaria de pedra do portão";
      // Stairs belong to the capital foundation. They are regenerated from
      // the gate transforms and must not drift away as independent assets.
      stairs.userData.buildEditable=false;
      stairs.userData.buildId=`city-stairs-${gate.userData.cityId}`;
      stairs.position.set(x,0,z);stairs.rotation.y=Math.atan2(outward.x,outward.y);
      const geometry=cityStairGeometry(length,0,width,bottom,top,count,base);
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
      let cached=this.stairTransforms.get(s.group);
      if(!cached||!cached.matrix.equals(s.group.matrixWorld)){
        const matrix=s.group.matrixWorld.clone();
        cached={matrix,inverse:matrix.clone().invert(),bounds:new THREE.Box3(
          new THREE.Vector3(-s.width/2,s.bottom,0),new THREE.Vector3(s.width/2,s.top,s.length)).applyMatrix4(matrix)};
        this.stairTransforms.set(s.group,cached);
      }
      if(cached.matrix.elements[4]===0&&cached.matrix.elements[6]===0&&(x<cached.bounds.min.x||x>cached.bounds.max.x||z<cached.bounds.min.z||z>cached.bounds.max.z))continue;
      const local=this.stairPoint.set(x,s.group.position.y,z).applyMatrix4(cached.inverse);
      const along=local.z,across=local.x;
      if(along>=0&&along<=s.length&&Math.abs(across)<=s.width/2){
        const step=Math.min(s.count-1,Math.floor(along/s.length*s.count));
        return local.set(across,s.top-(s.top-s.bottom)*step/s.count+.06,along).applyMatrix4(cached.matrix).y;
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
    // The foundation itself now reaches the flat grass datum, so terrain under
    // it stays at zero rather than climbing into a visible ramp at the wall.
    return this.heightAt(x,z)!==null?0:null;
  }
}
