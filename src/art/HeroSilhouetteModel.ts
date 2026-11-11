import * as THREE from 'three';

type Section={x:number;y:number;z:number;width:number;depth:number};
const clay=new THREE.MeshStandardMaterial({color:'#b9785d',roughness:.78,metalness:0,flatShading:true,side:THREE.DoubleSide});
const cloth=new THREE.MeshStandardMaterial({color:'#555b60',roughness:.9,metalness:0,flatShading:true,side:THREE.DoubleSide});
const skinLight=new THREE.MeshStandardMaterial({color:'#d99a78',roughness:.72,flatShading:true,side:THREE.DoubleSide});
const skinShade=new THREE.MeshStandardMaterial({color:'#a96550',roughness:.8,flatShading:true,side:THREE.DoubleSide});
const leather=new THREE.MeshStandardMaterial({color:'#744331',roughness:.84,flatShading:true,side:THREE.DoubleSide});
const leatherLight=new THREE.MeshStandardMaterial({color:'#925640',roughness:.8,flatShading:true,side:THREE.DoubleSide});
const green=new THREE.MeshStandardMaterial({color:'#3d9348',roughness:.9,flatShading:true,side:THREE.DoubleSide});
const boot=new THREE.MeshStandardMaterial({color:'#653b2d',roughness:.9,flatShading:true,side:THREE.DoubleSide});
const metal=new THREE.MeshStandardMaterial({color:'#c1c8ca',roughness:.34,metalness:.38,flatShading:true,side:THREE.DoubleSide});
const hairMats=[new THREE.MeshStandardMaterial({color:'#d4aa54',roughness:.72,flatShading:true,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#ebc86f',roughness:.68,flatShading:true,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#aa7e38',roughness:.8,flatShading:true,side:THREE.DoubleSide})];

/** Builds one connected mesh exactly like repeated face extrusion from a box. */
function extrudedBox(sections:Section[],material:THREE.Material,name:string){
  const vertices:number[]=[],indices:number[]=[];
  for(const section of sections){const x=section.x,y=section.y,z=section.z,w=section.width/2,d=section.depth/2;vertices.push(x-w,y,z-d,x+w,y,z-d,x+w,y,z+d,x-w,y,z+d);}
  for(let ring=0;ring<sections.length-1;ring++){const a=ring*4,b=a+4;for(let side=0;side<4;side++){const next=(side+1)%4;indices.push(a+side,b+side,a+next,a+next,b+side,b+next);}}
  const last=(sections.length-1)*4;indices.push(0,2,1,0,3,2,last,last+1,last+2,last,last+2,last+3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function poly(vertices:number[],indices:number[],material:THREE.Material|THREE.Material[],name:string){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();if(Array.isArray(material))for(let i=0;i<indices.length/3;i++)geometry.addGroup(i*3,3,i%material.length);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function wedge(x:number,y:number,z:number,w:number,h:number,d:number,tx:number,ty:number,tz:number,material:THREE.Material,name:string){return poly([x-w,y-h,z-d,x+w,y-h,z-d,x+w,y+h,z-d,x-w,y+h,z-d,tx,ty,tz],[0,2,1,0,3,2,0,1,4,1,2,4,2,3,4,3,0,4],material,name);}
function connectedHair(){const v=[-.18,2.53,-.13,0,2.61,-.15,.18,2.54,-.12,-.20,2.59,.01,0,2.69,0,.20,2.60,.015,-.17,2.50,.14,0,2.56,.18,.17,2.51,.14,-.18,2.40,-.10,0,2.43,-.13,.18,2.41,-.09,-.21,2.43,.01,.21,2.44,.02,-.16,2.39,.12,0,2.40,.15,.16,2.40,.12,-.28,2.48,.13,-.13,2.36,.22,.02,2.40,.25,.18,2.38,.21,.29,2.48,.14,-.28,2.57,-.08,-.12,2.63,-.18,.12,2.64,-.17,.28,2.57,-.06,.24,2.57,-.13,-.20,2.58,-.15,0,2.40,0];const t=[[0,3,4],[0,4,1],[1,4,5],[1,5,2],[3,6,7],[3,7,4],[4,7,8],[4,8,5],[0,9,12],[0,12,3],[0,1,10],[0,10,9],[1,2,11],[1,11,10],[2,5,13],[2,13,11],[5,8,16],[5,16,13],[8,7,15],[8,15,16],[7,6,14],[7,14,15],[6,3,12],[6,12,14],[9,10,28],[10,11,28],[11,13,28],[13,16,28],[16,15,28],[15,14,28],[14,12,28],[12,9,28],[6,14,17],[14,15,18],[15,16,19],[16,13,20],[13,11,21],[3,0,22],[0,1,23],[1,2,24],[2,5,25],[11,10,26],[9,0,27]];return poly(v,t.flat(),hairMats,'hair.main.connected');}
function shieldMesh(){const vertices:number[]=[.48,.82,.34,.48,.82,.28];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;vertices.push(.48+Math.cos(a)*.36,.82+Math.sin(a)*.36,.30);}const indices:number[]=[];for(let i=0;i<12;i++){const a=2+i,b=2+(i+1)%12;indices.push(0,a,b,1,b,a);}return poly(vertices,indices,metal,'equipment.shield');}

export class HeroSilhouetteModel{
  readonly group=new THREE.Group();
  readonly metrics={vertices:0,triangles:0,meshes:0,headTriangles:0,hairTriangles:0};
  constructor(){
    this.group.name='art.boxModel.silhouette.v1';
    // Torso: pelvis -> waist -> ribs -> clavicle. Every band shares its four
    // corner vertices with the next extrusion; there are no stacked boxes.
    this.group.add(extrudedBox([
      {x:0,y:.78,z:0,width:.48,depth:.31},{x:0,y:.90,z:0,width:.58,depth:.35},
      {x:0,y:1.07,z:.01,width:.62,depth:.38},{x:0,y:1.22,z:.015,width:.50,depth:.34},
      {x:0,y:1.39,z:.02,width:.54,depth:.36},{x:0,y:1.57,z:.025,width:.70,depth:.40},
      {x:0,y:1.72,z:.015,width:.88,depth:.43},{x:0,y:1.82,z:0,width:.76,depth:.38}
    ],green,'boxModel.torso'));
    // Neutral fitted pelvis covering the anatomical split while the silhouette is evaluated.
    this.group.add(extrudedBox([{x:0,y:.78,z:0,width:.49,depth:.32},{x:0,y:.91,z:0,width:.59,depth:.36},{x:0,y:1.04,z:.01,width:.61,depth:.37}],cloth,'boxModel.pelvisGarment'));
    this.group.add(extrudedBox([{x:0,y:1.04,z:.015,width:.64,depth:.39},{x:0,y:1.25,z:.025,width:.54,depth:.37},{x:0,y:1.48,z:.035,width:.72,depth:.43},{x:0,y:1.69,z:.02,width:.84,depth:.46}],leather,'armor.chest'),wedge(0,1.51,.245,.31,.17,.025,.04,1.25,.285,leatherLight,'armor.chestFacet'),extrudedBox([{x:0,y:1.01,z:.02,width:.64,depth:.40},{x:0,y:1.10,z:.02,width:.66,depth:.41}],skinShade,'armor.belt'));
    for(const side of [-1,1] as const){
      this.group.add(extrudedBox([
        {x:side*.37,y:1.76,z:0,width:.22,depth:.25},{x:side*.46,y:1.69,z:.005,width:.27,depth:.27},
        {x:side*.50,y:1.54,z:.012,width:.23,depth:.23},{x:side*.51,y:1.39,z:.02,width:.19,depth:.19},
        {x:side*.52,y:1.27,z:.028,width:.18,depth:.18},{x:side*.53,y:1.13,z:.038,width:.15,depth:.15}
      ],clay,`boxModel.arm.${side}`));
      this.group.add(extrudedBox([{x:side*.39,y:1.75,z:.005,width:.25,depth:.27},{x:side*.47,y:1.68,z:.01,width:.30,depth:.29},{x:side*.49,y:1.56,z:.015,width:.25,depth:.25}],green,`clothes.sleeve.${side}`),extrudedBox([{x:side*.36,y:1.72,z:0,width:.27,depth:.29},{x:side*.46,y:1.80,z:0,width:.40,depth:.34},{x:side*.54,y:1.69,z:.015,width:.32,depth:.30}],leatherLight,`armor.shoulder.${side}`));
      this.group.add(extrudedBox([
        {x:side*.53,y:1.13,z:.038,width:.15,depth:.15},{x:side*.535,y:1.04,z:.05,width:.17,depth:.14},
        {x:side*.54,y:.95,z:.07,width:.14,depth:.11},{x:side*.54,y:.90,z:.09,width:.10,depth:.08}
      ],clay,`boxModel.hand.${side}`));
      this.group.add(extrudedBox([
        {x:side*.15,y:.91,z:0,width:.27,depth:.30},{x:side*.18,y:.78,z:.005,width:.31,depth:.31},
        {x:side*.19,y:.61,z:.012,width:.27,depth:.27},{x:side*.20,y:.47,z:.02,width:.22,depth:.22},
        {x:side*.205,y:.38,z:.025,width:.20,depth:.20}
      ],cloth,`boxModel.thigh.${side}`));
      this.group.add(extrudedBox([
        {x:side*.205,y:.38,z:.025,width:.20,depth:.20},{x:side*.21,y:.29,z:.032,width:.21,depth:.21},
        {x:side*.215,y:.17,z:.045,width:.18,depth:.18},{x:side*.22,y:.07,z:.075,width:.14,depth:.16},
        {x:side*.22,y:.045,z:.22,width:.18,depth:.34}
      ],boot,`boxModel.leg.${side}`));
    }
    this.group.add(extrudedBox([
      {x:0,y:1.80,z:0,width:.25,depth:.23},{x:0,y:1.91,z:.005,width:.22,depth:.21},{x:0,y:2.02,z:.012,width:.25,depth:.23}
    ],clay,'boxModel.neck'));
    // Head starts from a cuboid cage extruded vertically; jaw, cheek, temple
    // and cranium are shaped only by moving/scaling the shared section loops.
    this.group.add(extrudedBox([
      {x:0,y:2.00,z:.015,width:.25,depth:.21},{x:0,y:2.06,z:.025,width:.30,depth:.25},
      {x:0,y:2.14,z:.04,width:.35,depth:.31},{x:0,y:2.25,z:.05,width:.40,depth:.36},
      {x:0,y:2.36,z:.035,width:.42,depth:.38},{x:0,y:2.47,z:.005,width:.39,depth:.36},
      {x:0,y:2.55,z:-.015,width:.31,depth:.28}
    ],clay,'boxModel.head'));
    // Facial planes and elf ears are custom indexed cages placed on the box-modeled head.
    this.group.add(wedge(0,2.28,.205,.028,.065,.014,0,2.22,.255,skinLight,'face.nose'),poly([-.06,2.16,.215,0,2.15,.222,.06,2.16,.215,0,2.135,.220],[0,1,3,1,2,3],skinShade,'face.mouth'));
    for(const side of [-1,1] as const){this.group.add(poly([side*.13,2.33,.215,side*.07,2.36,.225,side*.025,2.34,.228,side*.07,2.30,.226],[0,1,3,1,2,3],metal,'face.eyeWhite'),poly([side*.082,2.335,.231,side*.07,2.35,.233,side*.057,2.335,.231,side*.07,2.318,.233],[0,1,3,1,2,3],skinShade,'face.iris'),wedge(side*.078,2.39,.218,.058,.012,.010,side*.02,2.37,.23,hairMats[2],'face.brow'),poly([side*.18,2.34,.01,side*.21,2.41,.01,side*.39,2.42,0,side*.22,2.28,.02,side*.19,2.35,.06],[0,1,4,1,2,4,2,3,4,3,0,4],skinLight,`face.ear.${side}`));}
    this.group.add(connectedHair(),shieldMesh());
    const sword=new THREE.Group();sword.name='equipment.sword';sword.add(extrudedBox([{x:0,y:-.20,z:0,width:.055,depth:.055},{x:0,y:.05,z:0,width:.055,depth:.055}],skinShade,'equipment.handle'),extrudedBox([{x:0,y:.04,z:0,width:.07,depth:.035},{x:0,y:.60,z:0,width:.035,depth:.018}],metal,'equipment.blade'));sword.position.set(-.40,1.58,-.03);sword.rotation.z=-.72;this.group.add(sword);
    this.group.traverse(object=>{if(object instanceof THREE.Mesh){this.metrics.meshes++;const position=object.geometry.getAttribute('position'),triangles=(object.geometry.index?.count??position.count)/3;this.metrics.vertices+=position.count;this.metrics.triangles+=triangles;if(object.name==='boxModel.head'||object.name.startsWith('face.'))this.metrics.headTriangles+=triangles;if(object.name.startsWith('hair.'))this.metrics.hairTriangles+=triangles;}});
  }
  dispose(){this.group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());}});}
}
