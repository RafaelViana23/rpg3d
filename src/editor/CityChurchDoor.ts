import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_COLOR} from './CityWood';
const material=new T.MeshLambertMaterial({vertexColors:true});
/** Optimized gate: arched leaves with a two-bone hinge rig and wood/iron vertex colours. */
function createArchedDoor(width:number,top:number,name:string){
 const root=new T.Group();root.name=name;const leaves:T.BufferGeometry[]=[];const bones:T.Bone[]=[];const radius=width/2;
 // Normal doors keep the approved semicircular crown. Very wide wall gates
 // use a shallow arch so their requested width does not force a 10 m radius
 // above a 5.8 m opening.
 const archRise=top>=radius*1.25?radius:top*.28,spring=top-archRise;
 for(const side of [-1,1]){
  const hinge=new T.Bone();hinge.name=side<0?'DoorLeft':'DoorRight';hinge.position.set(side*radius,0,-.05);root.add(hinge);bones.push(hinge);
  const parts:T.BufferGeometry[]=[];
  const add=(g:T.BufferGeometry,color:string)=>{
   if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
   const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));g.translate(-side*radius,0,0);parts.push(g);
  };
  const shape=new T.Shape();shape.moveTo(side*.006,0);shape.lineTo(side*radius,0);shape.lineTo(side*radius,spring);
  for(let i=1;i<=6;i++){const angle=i*Math.PI/12;shape.lineTo(side*radius*Math.cos(angle),spring+archRise*Math.sin(angle));}shape.closePath();
  const panel=new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:false,steps:1});panel.translate(0,0,-.045);add(panel,CITY_WOOD_COLOR);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);};
  // Shallow seams keep the planked silhouette without a separate mesh per board.
  for(let i=1;i<5;i++){const x=side*radius*i/5,h=spring+archRise*Math.sqrt(Math.max(0,1-(x/radius)*(x/radius)));box(x,h/2,.046,.009,h,.003,'#58452e');box(x,h/2,-.046,.009,h,.003,'#58452e');}
  for(const y of [.42,1.2,1.98]){box(side*radius/2,y,.063,radius-.1,.075,.035,'#30343a');box(side*radius/2,y,-.063,radius-.1,.075,.035,'#30343a');}
  for(const x of [.25,.58,.91])for(const y of [.76,.98,1.48,1.7]){
   const rivet=new T.PlaneGeometry(.027,.027);rivet.rotateZ(Math.PI/4);rivet.translate(side*x,y,.085);add(rivet,'#202329');
   const backRivet=new T.PlaneGeometry(.027,.027);backRivet.rotateY(Math.PI);backRivet.rotateZ(Math.PI/4);backRivet.translate(side*x,y,-.085);add(backRivet,'#202329');
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.translate(side*radius,0,0);
  const indices=new Uint16Array(geo.attributes.position.count*4),weights=new Float32Array(geo.attributes.position.count*4);
  for(let i=0;i<geo.attributes.position.count;i++){indices[i*4]=bones.length-1;weights[i*4]=1;}
  geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));leaves.push(geo);
 }
 const vertexCounts=leaves.map(geometry=>geometry.attributes.position.count);
 const merged=mergeGeometries(leaves)!;merged.translate(0,0,-.02);leaves.forEach(g=>g.dispose());
 // Keep each leaf attached to its own hinge. Assigning one bone to the merged
 // mesh makes the opposite leaf follow the right hinge when the gate opens.
 const indices=new Uint16Array(merged.attributes.position.count*4),weights=new Float32Array(merged.attributes.position.count*4);
 let vertexOffset=0;for(let leaf=0;leaf<vertexCounts.length;leaf++){for(let vertex=0;vertex<vertexCounts[leaf];vertex++){const offset=(vertexOffset+vertex)*4;indices[offset]=leaf;weights[offset]=1;}vertexOffset+=vertexCounts[leaf];}
 merged.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));merged.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const mesh=new T.SkinnedMesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 const closed=new T.Quaternion();const left=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2),right=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2);
 root.animations=[new T.AnimationClip('open',1.1,[new T.QuaternionKeyframeTrack('DoorLeft.quaternion',[0,1.1],[...closed.toArray(),...left.toArray()]),new T.QuaternionKeyframeTrack('DoorRight.quaternion',[0,1.1],[...closed.toArray(),...right.toArray()])])];
 const template=new T.Group();template.add(root);template.animations=root.animations;return template;
}

/** Monumental arched door used by the church and city gates. */
export function createCityChurchDoor(width=2.391961336,top=3.14298494){
 return createArchedDoor(width,top,'Porta arqueada de madeira');
}

/** Residential door: narrower/taller proportions, sharing the approved house wood. */
export function createCityVillageDoor(){
 const root=new T.Group();root.name='Porta residencial de madeira';
 // Match the tall, narrow residential silhouette of village-door.glb.
 const width=1.4,height=3.4,depth=.12,wood=new T.MeshLambertMaterial({color:CITY_WOOD_COLOR}),iron=new T.MeshLambertMaterial({color:'#30343a'});
 const woodParts:T.BufferGeometry[]=[];const ironParts:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,ironPart=false)=>{(ironPart?ironParts:woodParts).push(g);};
 const plankWidth=width/5;
 for(let i=0;i<5;i++){
  const plank=new T.BoxGeometry(plankWidth-.018,height,depth);plank.translate(-width/2+plankWidth*(i+.5),height/2,0);add(plank);
 }
 for(const y of [.78,2.62]){
  // The reference has short iron braces inset from both jambs.
  const strap=new T.BoxGeometry(width*.56,.085,.045);strap.translate(-.34,y,depth/2+.02);add(strap,true);
 }
 // Pull ring: its circular plane is parallel to the door face.
 const escutcheon=new T.CylinderGeometry(.045,.045,.025,10);escutcheon.rotateX(Math.PI/2);escutcheon.translate(.3,1.7,depth/2+.045);add(escutcheon,true);
 const handle=new T.TorusGeometry(.1,.02,6,14);handle.translate(.3,1.63,depth/2+.085);add(handle,true);
 const mergedWood=mergeGeometries(woodParts)!;const mergedIron=mergeGeometries(ironParts)!;
 const geometry=mergeGeometries([mergedWood,mergedIron],true)!;geometry.clearGroups();
 geometry.addGroup(0,mergedWood.index?.count??mergedWood.attributes.position.count,0);
 geometry.addGroup(mergedWood.index?.count??mergedWood.attributes.position.count,mergedIron.index?.count??mergedIron.attributes.position.count,1);
 const mesh=new T.Mesh(geometry,[wood,iron]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 woodParts.forEach(g=>g.dispose());ironParts.forEach(g=>g.dispose());mergedWood.dispose();mergedIron.dispose();
 root.updateMatrixWorld(true);return root;
}
