import {cityStairGeometry} from './CityStairs';
import { createRoyalAvenue } from './RoyalAvenue';
import { batchStaticSiblings } from './StaticMeshBatch';
import { CITY_MERLON_MATERIAL, CITY_PLAIN_STONE_MATERIAL, CITY_STONE_MATERIAL, CITY_STONE_LIGHT_MATERIAL, CITY_STONE_DARK_MATERIAL } from './CityStone';
import { createCityTower, containsWalkPolygon } from './CityTower';
import { createPerimeterBuilding } from './CityPerimeter';
import { CITY_WOOD_MATERIAL } from './CityWood';
import { cityObjectSeed } from "./CityVariation";
import * as THREE from "three";
import { addCityStreetLanterns } from "./CityStreetLanterns";
import { addCourtyardWells } from "./CityCourtyards";
import { addCityProps, addRoyalPalaceDoor } from "./CityProps";
import { addCityAnimals } from "./CityAnimals";
import { createMedievalBuilding } from "./MedievalBuildings";
import type { CityAssetKind, SavedCityObject } from "./WorldEditorSupport";

export type CityCategory = "buildings" | "defense" | "connections";
export const CITY_CATALOG: { kind: CityAssetKind; label: string; category: CityCategory }[] = [
  { kind: "house", label: "Casa", category: "buildings" }, { kind: "shop", label: "Loja", category: "buildings" },
  { kind: "tavern", label: "Taverna", category: "buildings" }, { kind: "church", label: "Igreja", category: "buildings" },
  { kind: "castle", label: "Castelo", category: "buildings" }, { kind: "wall", label: "Muralha", category: "defense" },
  { kind: "tower", label: "Torre", category: "defense" }, { kind: "gate", label: "Portão", category: "defense" },
  { kind: "road", label: "Estrada", category: "connections" }, { kind: "path", label: "Caminho", category: "connections" },
  { kind: "bridge", label: "Ponte", category: "connections" }, { kind: "stairs", label: "Escadas", category: "connections" },
];

const mats = {
  plaster: new THREE.MeshLambertMaterial({ color: "#d3bd8c", flatShading: true }), wood: CITY_WOOD_MATERIAL,
  roof: new THREE.MeshLambertMaterial({ color: "#8c4937", flatShading: true }), stone: CITY_STONE_MATERIAL,
  stoneLight: CITY_STONE_LIGHT_MATERIAL, stoneDark: CITY_STONE_DARK_MATERIAL,
  iron: new THREE.MeshLambertMaterial({ color: "#282d30", flatShading: true }), dark: new THREE.MeshLambertMaterial({ color: "#302b27", flatShading: true }), road: new THREE.MeshLambertMaterial({ color: "#8e704a", flatShading: true }),
};

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) { const value = new THREE.Mesh(geometry, material); value.position.y = y; value.castShadow = value.receiveShadow = true; return value; }
function box(w: number, h: number, d: number, material: THREE.Material = mats.plaster) { return mesh(new THREE.BoxGeometry(w, h, d), material, h * .5); }
function roof(w: number, h: number, d: number) { const value = mesh(new THREE.ConeGeometry(Math.max(w, d) * .72, h, 4), mats.roof, h * .5); value.rotation.y = Math.PI / 4; return value; }
function addWallCrenels(root:THREE.Group,length:number,floorY:number,z:number,count=Math.max(4,Math.round(length/1.45))){
  const parapetHeight=.26,merlonHeight=.32;
  const parapet=box(length,parapetHeight,.6,mats.stone);parapet.name='Parapeito da muralha';
  parapet.position.set(0,floorY+parapetHeight/2,z);root.add(parapet);
  for(let i=0;i<count;i++){
    const merlon=box(.56,merlonHeight,.6,CITY_MERLON_MATERIAL);merlon.name='Dente da muralha';
    merlon.position.set(-length*.5+(i+.5)*length/count,floorY+parapetHeight+merlonHeight/2,z);root.add(merlon);
  }
}

export function createCityAsset(kind: CityAssetKind) {
  if(kind==='tower')return createCityTower();
  const perimeter=createPerimeterBuilding(kind);if(perimeter)return perimeter;
  const medieval=createMedievalBuilding(kind);if(medieval)return medieval;
  const root = new THREE.Group(); root.name = `Cidade:${kind}`; root.userData.cityObject = true;
  if (["house", "shop", "tavern"].includes(kind)) {
    const scale = kind === "tavern" ? 1.35 : kind === "shop" ? 1.1 : 1;
    const body = box(6 * scale, 3.8, 5 * scale), top = roof(6.5 * scale, 2.8, 5.5 * scale); top.position.y = 5.2;
    const door = box(1.25, 2.3, .25, mats.wood); door.position.set(0, 1.15, 2.58 * scale);
    root.add(body, top, door);
    if (kind !== "house") { const sign = box(1.6, .9, .18, mats.wood); sign.position.set(2.4 * scale, 2.8, 2.72 * scale); root.add(sign); }
  } else if (kind === "church") {
    const body = box(6, 6, 10, mats.stone), top = roof(7, 4, 11); top.position.y = 8; const tower = box(3.4, 10, 3.4, mats.stone); tower.position.z = 3.2; const cap = roof(4, 3, 4); cap.position.set(0, 11.5, 3.2); root.add(body, top, tower, cap);
  } else if (kind === "castle") {
    root.add(box(14, 7, 12, mats.stone)); for (const x of [-6.5, 6.5]) for (const z of [-5.5, 5.5]) { const tower = mesh(new THREE.CylinderGeometry(2.4, 2.7, 10, 8), mats.stone, 5); tower.position.set(x, 0, z); root.add(tower); }
  } else if(kind==="wall"){
    const body=box(12,6,2.2,mats.stone);root.add(body);
    const walk=box(12,.35,2.65,mats.stoneLight);walk.position.y=6.05;root.add(walk);addWallCrenels(root,12,6.225,1.05);addWallCrenels(root,12,6.225,-1.05);
  }
  else if(kind==="gate"){
    const shape=new THREE.Shape();shape.moveTo(-7,0);shape.lineTo(7,0);shape.lineTo(7,9);shape.lineTo(-7,9);shape.closePath();
    const opening=new THREE.Path();opening.moveTo(-3.1,0);opening.lineTo(-3.1,4.6);opening.absarc(0,4.6,3.1,Math.PI,0,true);opening.lineTo(3.1,0);opening.closePath();shape.holes.push(opening);
    const gatehouse=mesh(new THREE.ExtrudeGeometry(shape,{depth:2.8,bevelEnabled:false,curveSegments:6}),mats.stone);gatehouse.geometry.translate(0,0,-1.4);root.add(gatehouse);
    const top=box(14.5,.45,3.25,mats.stoneLight);top.position.y=9.15;root.add(top);addWallCrenels(root,14,9.375,1.3,10);addWallCrenels(root,14,9.375,-1.3,10);
    for(const x of [-6.15,6.15]){const shield=mesh(new THREE.CylinderGeometry(.62,.62,.12,8),mats.wood,5.7);shield.rotation.x=Math.PI/2;shield.position.x=x;shield.position.z=1.49;root.add(shield);}
  }
  else if (kind === "bridge") { root.add(box(10, .7, 4, mats.wood)); for (const x of [-4.5, 4.5]) for (const z of [-1.7, 1.7]) { const post = box(.3, 1.7, .3, mats.wood); post.position.set(x, .7, z); root.add(post); } }
  else if (kind === "stairs") { root.add(mesh(cityStairGeometry(-.36,4.68,5,-.2,2.95,7,-.25),CITY_PLAIN_STONE_MATERIAL)); }
  else if (kind !== "road" && kind !== "path") root.add(box(5, 4, 5));
  if(kind==='wall'){
    root.userData.walkSurfaces=[[-6,-1.325,6,1.325,6.225]];
    const colliders:number[][]=[[-6,0,-1.1,6,6,1.1]];
    for(const child of root.children){if(child.position.y>6.3){child.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(child);colliders.push([...b.min.toArray(),...b.max.toArray()]);}}
    root.userData.localColliders=colliders;
    root.userData.localFlightColliders=[[-6,5.875,-1.325,6,6.225,1.325]];
  }
  if(kind==='stairs')root.userData.walkSurfaces=Array.from({length:7},(_,i)=>[-2.5,i*.72-.36,2.5,i*.72+.36,i*.45+.25]);
  if(kind==='bridge')root.userData.walkSurfaces=[[-5,-2,5,2,.7]];
  if(kind==='bridge'||kind==='stairs')root.userData.localColliders=[];
  batchStaticSiblings(root);
  root.traverse((child) => { child.userData.cityObject = true; }); return root;
}

function createWall(points: THREE.Vector3[]) {
  const root = new THREE.Group(); root.name = "Cidade:wall"; root.userData.cityObject = true;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = a.distanceTo(b), segment = box(length, 4, 1.2, mats.stone);
    segment.position.copy(a).add(b).multiplyScalar(.5); segment.position.y += 2; segment.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); root.add(segment);
    const count = Math.max(1, Math.floor(length / 1.4)), crenels = new THREE.InstancedMesh(new THREE.BoxGeometry(.75, .7, 1.45), CITY_MERLON_MATERIAL, count), dummy = new THREE.Object3D();
    for (let n = 0; n < count; n++) { dummy.position.copy(a).lerp(b, (n + .5) / count); dummy.position.y += 4.35; dummy.rotation.y = segment.rotation.y; dummy.updateMatrix(); crenels.setMatrixAt(n, dummy.matrix); } crenels.instanceMatrix.needsUpdate = true; root.add(crenels);
  }
  return root;
}

function createRoute(points: THREE.Vector3[], width: number, kind: "road" | "path", getHeight: (x: number, z: number) => number) {
  const root = new THREE.Group(), curve = new THREE.CatmullRomCurve3(points), samples = Math.max(2, points.length * 8), vertices: number[] = [], indices: number[] = [];
  root.name = `Cidade:${kind}`; root.userData.cityObject = true;
  for (let i = 0; i <= samples; i++) { const p = curve.getPoint(i / samples), tangent = curve.getTangent(i / samples), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width * .5); const leftY = getHeight(p.x + normal.x, p.z + normal.z), rightY = getHeight(p.x - normal.x, p.z - normal.z); vertices.push(p.x + normal.x, leftY + .06, p.z + normal.z, p.x - normal.x, rightY + .06, p.z - normal.z); if (i < samples) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); } }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); root.add(mesh(geometry, mats.road)); return root;
}

type CityWalkGroup={inverse:THREE.Matrix4;matrix:THREE.Matrix4;surfaces:number[][];polygons?:number[][][];stepUp:number};
type CityCollider={inverse:THREE.Matrix4;matrix:THREE.Matrix4;box:THREE.Box3;scale:number;top:number;flightOnly?:boolean};
type CachedCollisionEntry={signature:string;shapes:CityCollider[];collision:[string,CityCollider][];weather:[string,{inverse:THREE.Matrix4;matrix:THREE.Matrix4;box:THREE.Box3}][];walk:[string,CityWalkGroup][]};
export class LowPolyCityBuilder {
  private readonly collisionEntries=new WeakMap<THREE.Object3D,CachedCollisionEntry>();
  private walkGrid=new Map<string,CityWalkGroup[]>();
  private readonly walkPoint=new THREE.Vector3();
  private readonly walkHeightPoint=new THREE.Vector3();
  private courtyardUpdatePending=false;
  private collisionSignature="";
  private collisionCheckAt=-Infinity;
  private collisionShapes:CityCollider[]=[];
  private weatherGrid=new Map<string,{inverse:THREE.Matrix4;matrix:THREE.Matrix4;box:THREE.Box3}[]>();
  prepareWeatherCover(){this.refreshCollisions();}
  roofHeightAt(x:number,z:number){
    let height=-Infinity;
    for(const roof of this.weatherGrid.get(`${Math.floor(x/16)}:${Math.floor(z/16)}`)??[]){
      const p=this.collisionPoint.set(x,0,z).applyMatrix4(roof.inverse);
      if(p.x<roof.box.min.x||p.x>roof.box.max.x||p.z<roof.box.min.z||p.z>roof.box.max.z)continue;
      p.y=roof.box.max.y;height=Math.max(height,p.applyMatrix4(roof.matrix).y);
    }
    return height;
  }
  private collisionGrid=new Map<string,CityCollider[]>();
  private readonly collisionPoint=new THREE.Vector3();
  private nearbyColliders(x:number,z:number,radius:number){
    const result=new Set<CityCollider>();
    for(let gx=Math.floor((x-radius)/16);gx<=Math.floor((x+radius)/16);gx++)for(let gz=Math.floor((z-radius)/16);gz<=Math.floor((z+radius)/16);gz++){
      for(const shape of this.collisionGrid.get(`${gx}:${gz}`)??[])result.add(shape);
    }
    return result;
  }
  private refreshCollisions(){
    const now=performance.now();
    if(now-this.collisionCheckAt<16)return;
    this.collisionCheckAt=now;
    const castle=this.scene.children.find(object=>object.name==="Castelo medieval");
    const structures:THREE.Object3D[]=[...this.objects.values()];
    if(castle&&!structures.includes(castle))structures.push(castle);
    const signature=structures.map(o=>`${o.id}:${o.userData.colliderRevision??0}:${o.position.toArray()}:${o.rotation.toArray()}:${o.scale.toArray()}`).join(";");
    if(signature===this.collisionSignature)return;this.collisionSignature=signature;this.collisionShapes=[];this.collisionGrid.clear();this.weatherGrid.clear();this.walkGrid.clear();
    for(const object of structures){
      if(/Cidade:(road|path)$/.test(object.name))continue;
      object.updateWorldMatrix(true,false);
      const entrySignature=`${object.matrixWorld.elements.join(',')}:${object.userData.colliderRevision??0}`;
      const cached=this.collisionEntries.get(object);
      if(cached?.signature===entrySignature){
        this.collisionShapes.push(...cached.shapes);
        for(const [key,value]of cached.collision){const bucket=this.collisionGrid.get(key)??[];bucket.push(value);this.collisionGrid.set(key,bucket);}
        for(const [key,value]of cached.weather){const bucket=this.weatherGrid.get(key)??[];bucket.push(value);this.weatherGrid.set(key,bucket);}
        for(const [key,value]of cached.walk){const bucket=this.walkGrid.get(key)??[];bucket.push(value);this.walkGrid.set(key,bucket);}
        continue;
      }
      // Only the building receiving a new prop/door needs its physical shapes regenerated.
      const entry:CachedCollisionEntry={signature:entrySignature,shapes:[],collision:[],weather:[],walk:[]};
      this.collisionEntries.set(object,entry);
      const matrix=object.matrixWorld.clone(),inverse=matrix.clone().invert();
      const building=object.userData.building;
      const covers:number[][]=object.userData.palaceComplex?object.userData.weatherRoofs??[]:building?[[-building.width/2-.7,building.height,-building.depth/2-.7,building.width/2+.7,building.height,building.depth/2+.7]]:object.userData.weatherRoofs??[];
      for(const cover of covers){
        const box=new THREE.Box3(new THREE.Vector3(cover[0],cover[1],cover[2]),new THREE.Vector3(cover[3],cover[4],cover[5]));
        const roof={inverse,matrix,box},world=box.clone().applyMatrix4(matrix);
        for(let gx=Math.floor(world.min.x/16);gx<=Math.floor(world.max.x/16);gx++)for(let gz=Math.floor(world.min.z/16);gz<=Math.floor(world.max.z/16);gz++){
          const key=`${gx}:${gz}`,bucket=this.weatherGrid.get(key)??[];bucket.push(roof);this.weatherGrid.set(key,bucket);entry.weather.push([key,roof]);
        }
      }
      if(object.userData.walkSurfaces?.length){
        const group:CityWalkGroup={matrix,inverse,surfaces:object.userData.walkSurfaces,polygons:object.userData.walkSurfacePolygons,
          // Treads scale with the building; include the player's small foot offset.
          stepUp:Math.max(.4,Math.abs(matrix.elements[5])*(object.userData.walkStepHeight??(object.userData.stairPlacement?.height??0)/20)+.08)};
        const cells=new Set<string>();
        for(const [x0,z0,x1,z1,y] of group.surfaces){
          const world=new THREE.Box3(new THREE.Vector3(x0,y,z0),new THREE.Vector3(x1,y,z1)).applyMatrix4(matrix);
          for(let gx=Math.floor(world.min.x/16);gx<=Math.floor(world.max.x/16);gx++)for(let gz=Math.floor(world.min.z/16);gz<=Math.floor(world.max.z/16);gz++)cells.add(`${gx}:${gz}`);
        }
        for(const key of cells){const bucket=this.walkGrid.get(key)??[];bucket.push(group);this.walkGrid.set(key,bucket);entry.walk.push([key,group]);}
      }
      const bounds=new THREE.Box3();
      if(!Array.isArray(object.userData.localColliders)){
        object.updateWorldMatrix(true,true);
        object.traverse(child=>{if(child instanceof THREE.Mesh){if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();if(child.geometry.boundingBox)bounds.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));}});
        if(bounds.isEmpty())continue;
      }
      const boxes=Array.isArray(object.userData.localColliders)?(object.userData.localColliders as number[][]).map(b=>new THREE.Box3(new THREE.Vector3(...b.slice(0,3) as [number,number,number]),new THREE.Vector3(...b.slice(3) as [number,number,number]))):object.name==="Cidade:gate"?[
        new THREE.Box3(new THREE.Vector3(-7,0,-1.6),new THREE.Vector3(-3.1,10,1.6)),
        new THREE.Box3(new THREE.Vector3(3.1,0,-1.6),new THREE.Vector3(7,10,1.6)),
        new THREE.Box3(new THREE.Vector3(-3.1,7.7,-1.6),new THREE.Vector3(3.1,10,1.6)),
      ]:[bounds];
      const walkingBoxes=boxes.length;
      for(const b of object.userData.localFlightColliders??[])boxes.push(new THREE.Box3(new THREE.Vector3(b[0],b[1],b[2]),new THREE.Vector3(b[3],b[4],b[5])));
      if(building&&!object.userData.palaceComplex){
        // Close the ceiling, gables and pitched roof for flight without blocking stairs.
        const across=object.name==='Cidade:inn'?building.depth:building.width;
        const along=object.name==='Cidade:inn'?building.width:building.depth;
        const half=across/2+.7,segments=32,step=half*2/segments;
        for(let i=0;i<segments;i++){
          const lo=-half+i*step,hi=lo+step;
          const nearest=Math.min(Math.abs(lo),Math.abs(hi));
          const top=building.height+Math.max(0,across*.4-nearest*.8)+.35;
          boxes.push(object.name==='Cidade:inn'
            ?new THREE.Box3(new THREE.Vector3(-along/2-.7,building.height-.2,lo),new THREE.Vector3(along/2+.7,top,hi))
            :new THREE.Box3(new THREE.Vector3(lo,building.height-.2,-along/2-.7),new THREE.Vector3(hi,top,along/2+.7)));
        }
      }
      for(const [index,box] of boxes.entries()){
        const world=box.clone().applyMatrix4(matrix);
        const shape={inverse,matrix,box,scale:Math.min(Math.abs(object.scale.x),Math.abs(object.scale.z)),top:world.max.y,flightOnly:index>=walkingBoxes};
        this.collisionShapes.push(shape);entry.shapes.push(shape);
        for(let gx=Math.floor(world.min.x/16);gx<=Math.floor(world.max.x/16);gx++)for(let gz=Math.floor(world.min.z/16);gz<=Math.floor(world.max.z/16);gz++){
          const key=`${gx}:${gz}`,bucket=this.collisionGrid.get(key)??[];bucket.push(shape);this.collisionGrid.set(key,bucket);entry.collision.push([key,shape]);
        }
      }
    }
  }
  walkHeightAt(x:number,z:number,feetY:number,allowStepUp=true){
    this.refreshCollisions();let top=-Infinity;
    for(const group of this.walkGrid.get(`${Math.floor(x/16)}:${Math.floor(z/16)}`)??[]){
      const p=this.walkPoint.set(x,feetY,z).applyMatrix4(group.inverse);
      for(const [index,[x0,z0,x1,z1,y]] of group.surfaces.entries()){
        if(group.polygons?.[index]&&!containsWalkPolygon(group.polygons[index],p.x,p.z))continue;
        if(p.x<x0||p.x>x1||p.z<z0||p.z>z1)continue;
        const height=this.walkHeightPoint.set(p.x,y,p.z).applyMatrix4(group.matrix).y;
        if(height<=feetY+(allowStepUp?group.stepUp:.08)&&height>top)top=height;
      }
    }
    return Number.isFinite(top)?top:null;
  }
  overlapsTree(x:number,z:number,margin=4){
    this.refreshCollisions();
    return [...this.nearbyColliders(x,z,margin)].some(s=>{const p=new THREE.Vector3(x,0,z).applyMatrix4(s.inverse),m=margin/Math.max(.01,s.scale);return p.x>s.box.min.x-m&&p.x<s.box.max.x+m&&p.z>s.box.min.z-m&&p.z<s.box.max.z+m;});
  }
  updatePropVisibility(viewer:THREE.Vector3,showAll=false){
    // Cull small props by building footprint; facades and roofs remain visible.
    for(const building of this.objects.values()){
      const info=building.userData.building;
      if(!info){
        if(building.name==='Cidade:tower')for(const child of building.children)if(child.userData.towerTorch)child.visible=showAll||child.getWorldPosition(this.walkPoint).distanceToSquared(viewer)<65*65;
        continue;
      }
      const extent=Math.hypot(info.width*building.scale.x,info.depth*building.scale.z)/2;
      const near=showAll||Math.hypot(building.position.x-viewer.x,building.position.z-viewer.z)<80+extent;
      for(const child of building.children){
        if(child instanceof THREE.Mesh||(!child.userData.cityObject&&child.name!=='Objetos estáticos agrupados'))continue;
        if(!near&&child.visible){child.visible=false;child.userData.cityDistanceHidden=true;}
        else if(near&&child.userData.cityDistanceHidden){child.visible=true;delete child.userData.cityDistanceHidden;}
      }
    }
  }
  resolveFlightMovement(start:THREE.Vector3,destination:THREE.Vector3,radius:number,impactNormal?:THREE.Vector3){
    this.refreshCollisions();
    impactNormal?.set(0,0,0);
    const distance=Math.max(start.distanceTo(destination),1e-8);
    const candidates=new Set<CityCollider>();
    const samples=Math.max(1,Math.ceil(distance/4));
    for(let i=0;i<=samples;i++){
      const t=i/samples;
      for(const shape of this.nearbyColliders(THREE.MathUtils.lerp(start.x,destination.x,t),THREE.MathUtils.lerp(start.z,destination.z,t),radius+2))candidates.add(shape);
    }
    let fraction=1;
    const origin=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3();
    const box=new THREE.Box3(),scale=new THREE.Vector3(),localNormal=new THREE.Vector3();
    for(const shape of candidates){
      origin.copy(start).applyMatrix4(shape.inverse);end.copy(destination).applyMatrix4(shape.inverse);
      shape.matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);
      box.copy(shape.box);
      box.min.x-=radius/Math.abs(scale.x);box.max.x+=radius/Math.abs(scale.x);
      box.min.z-=radius/Math.abs(scale.z);box.max.z+=radius/Math.abs(scale.z);
      box.min.y-=1.5/Math.abs(scale.y);box.max.y+=.1/Math.abs(scale.y);
      direction.subVectors(end,origin);
      const axes=['x','y','z'] as const;
      const inside=axes.every(axis=>origin[axis]>box.min[axis]+1e-6&&origin[axis]<box.max[axis]-1e-6);
      if(inside){
        // Recover old penetrations instead of leaving the rider trapped in a solid.
        // Roof strips share internal side faces, so recover through their top/bottom.
        let depth=Infinity;localNormal.set(0,0,0);
        for(const axis of shape.flightOnly?['y'] as const:['x','z'] as const){
          for(const sign of [-1,1]){
            const amount=(sign<0?origin[axis]-box.min[axis]:box.max[axis]-origin[axis])*Math.abs(scale[axis]);
            if(amount<depth-1e-6||(Math.abs(amount-depth)<1e-6&&sign*origin[axis]>localNormal.dot(origin))){depth=amount;localNormal.set(0,0,0);localNormal[axis]=sign;}
          }
        }
        localNormal.transformDirection(shape.matrix);
        destination.copy(start).addScaledVector(localNormal,depth+.02);
        impactNormal?.copy(localNormal);return true;
      }
      let enter=-Infinity,exit=Infinity,valid=true;localNormal.set(0,0,0);
      for(const axis of axes){
        const velocity=direction[axis],o=origin[axis],lo=box.min[axis],hi=box.max[axis];
        if(Math.abs(velocity)<1e-10){
          // Parallel motion on a face is sliding, not another head-on collision.
          if(o<=lo+1e-6||o>=hi-1e-6){valid=false;break;}
          continue;
        }
        const near=(velocity>0?lo-o:hi-o)/velocity,far=(velocity>0?hi-o:lo-o)/velocity;
        if(near>enter){enter=near;localNormal.set(0,0,0);localNormal[axis]=velocity>0?-1:1;}
        exit=Math.min(exit,far);if(enter>exit){valid=false;break;}
      }
      if(!valid||enter< -1e-7||enter>1||exit<0||direction.dot(localNormal)>=-1e-10)continue;
      const contact=Math.max(0,enter-.015/distance);
      if(contact<fraction){fraction=contact;impactNormal?.copy(localNormal).transformDirection(shape.matrix);}
    }
    destination.lerpVectors(start,destination,fraction);
    return fraction<1;
  }
  resolveCollisions(position:THREE.Vector3,radius:number,flightY?:number){
    this.refreshCollisions();
    for(const s of this.nearbyColliders(position.x,position.z,radius+1)){
      if(s.flightOnly)continue;
      if(flightY!==undefined&&flightY>s.top+.5)continue;
      const p=this.collisionPoint.copy(position).applyMatrix4(s.inverse),r=radius/Math.max(.01,s.scale);
      const verticalScale=Math.abs(s.matrix.elements[5]);
      if(p.y+1.8/verticalScale<s.box.min.y||p.y>=s.box.max.y-.12/verticalScale)continue;
      const minX=s.box.min.x-r,maxX=s.box.max.x+r,minZ=s.box.min.z-r,maxZ=s.box.max.z+r;
      if(p.x<=minX||p.x>=maxX||p.z<=minZ||p.z>=maxZ)continue;
      const distances=[p.x-minX,maxX-p.x,p.z-minZ,maxZ-p.z],side=distances.indexOf(Math.min(...distances));
      if(side===0)p.x=minX;else if(side===1)p.x=maxX;else if(side===2)p.z=minZ;else p.z=maxZ;
      const resolved=p.applyMatrix4(s.matrix);position.x=resolved.x;position.z=resolved.z;
    }
  }
  readonly root = new THREE.Group(); readonly objects = new Map<string, THREE.Group>();
  constructor(private scene: THREE.Scene, private getHeight: (x: number, z: number) => number) { this.root.name = "Construções da cidade"; this.root.userData.buildEditable = false; scene.add(this.root); }
  rebuild(saved: Record<string, SavedCityObject>) { this.root.clear(); this.objects.clear(); for (const value of Object.values(saved)) this.add(value); }
  add(saved: SavedCityObject) {
    const points = saved.points?.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const existingCastle = saved.kind === "castle" ? this.scene.getObjectByName("Castelo medieval") : null;
    const object = saved.id==='city-royal-avenue-v1'?createRoyalAvenue(saved):existingCastle && !this.root.getObjectById(existingCastle.id) ? existingCastle.clone(true) as THREE.Group : saved.kind === "wall" && points ? createWall(points) : (saved.kind === "road" || saved.kind === "path") && points ? createRoute(points, saved.width ?? 4, saved.kind, this.getHeight) : createCityAsset(saved.kind);
    if(!object.userData.perimeterFootprint&&!object.userData.palaceComplex)addCityProps(object,cityObjectSeed(saved.id));
    if(!object.userData.palaceComplex)addCityAnimals(object,cityObjectSeed(saved.id));
    object.userData.cityId = saved.id; object.userData.cityLayer = saved.layer; object.position.fromArray(saved.position); object.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2]); object.scale.fromArray(saved.scale); this.root.add(object); this.objects.set(saved.id, object);
    if(object.userData.palaceComplex)addRoyalPalaceDoor(object);
    if(!this.courtyardUpdatePending){
      this.courtyardUpdatePending=true;
      queueMicrotask(()=>{this.courtyardUpdatePending=false;addCourtyardWells(this.objects.values());addCityStreetLanterns(this.objects.values());});
    }
    return object;
  }
  alignToTerrain(object: THREE.Object3D) { const box = new THREE.Box3().setFromObject(object); object.position.y += this.getHeight(object.position.x, object.position.z) - box.min.y; }
  overlaps(object: THREE.Object3D, ignore = new Set<string>()) { const box = new THREE.Box3().setFromObject(object); box.expandByScalar(-.15); for (const [id, other] of this.objects) if (!ignore.has(id) && box.intersectsBox(new THREE.Box3().setFromObject(other))) return true; return false; }
  dispose() { this.root.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.sharedCityGeometry && !o.parent?.userData.sharedCityGeometry) o.geometry.dispose(); }); this.root.removeFromParent(); void this.scene; }
}
