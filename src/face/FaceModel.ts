import * as THREE from 'three';

export type FaceExpression='neutral'|'happy'|'angry'|'sad'|'blink';
export type FaceHairStyle='curto'|'longo'|'espetado';
export type FaceOptions={skin:string;hair:string;eyes:string;hairStyle:FaceHairStyle;advanced?:boolean};

const material=(color:string,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true,side:THREE.DoubleSide});
const finish=(mesh:THREE.Mesh)=>{mesh.castShadow=true;mesh.receiveShadow=true;return mesh;};

function loft(rings:number[][],mat:THREE.Material,segments=16){
  const vertices:number[]=[],indices:number[]=[];
  rings.forEach(([x,y,z,rx,rz],ring)=>{for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push(x+Math.cos(a)*rx,y,z+Math.sin(a)*rz);if(ring<rings.length-1){const n=ring*segments+i,next=ring*segments+(i+1)%segments;indices.push(n,n+segments,next,next,n+segments,next+segments);}}});
  const bottom=vertices.length/3,last=rings.at(-1)!;vertices.push(rings[0][0],rings[0][1],rings[0][2]);const top=vertices.length/3;vertices.push(last[0],last[1],last[2]);
  for(let i=0;i<segments;i++){const next=(i+1)%segments,end=(rings.length-1)*segments;indices.push(bottom,next,i,top,end+i,end+next);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return finish(new THREE.Mesh(geometry,mat));
}

function ell(rx:number,ry:number,rz:number,mat:THREE.Material,segments=14,rings=10){
  const profile:number[][]=[];for(let i=0;i<=rings;i++){const a=-Math.PI/2+i/rings*Math.PI;profile.push([0,Math.sin(a)*ry,0,Math.max(.001,Math.cos(a)*rx),Math.max(.001,Math.cos(a)*rz)]);}return loft(profile,mat,segments);
}

export class FaceModel{
  readonly group=new THREE.Group();
  readonly metrics={vertices:0,triangles:0};
  private brows:THREE.Mesh[]=[];private lids:THREE.Mesh[]=[];private eyes:THREE.Group[]=[];private mouth:THREE.Group;
  private mouthCorners:THREE.Mesh[]=[];private mouthCenter:THREE.Mesh;private target:FaceExpression='neutral';private blend=1;
  constructor(options:FaceOptions){
    this.group.name=options.advanced===false?'face.legacy':'face.advanced';
    const skin=material(options.skin,.62),hair=material(options.hair,.76),white=material('#f4efe8',.35),iris=material(options.eyes,.3),pupil=material('#172027',.42),lip=material('#985f5d',.56),inner=material('#4b2830',.66);
    if(options.advanced===false){
      const head=ell(.25,.29,.225,skin,14,10);head.position.y=.30;this.group.add(head);
    }else{
      // Selective loops describe chin, jaw angle, cheek shelf, temples and forehead.
      this.group.add(loft([[0,-.025,.012,.074,.080],[0,.010,.020,.125,.118],[0,.055,.032,.177,.160],[0,.110,.043,.214,.192],[0,.175,.052,.245,.218],[0,.240,.050,.262,.232],[0,.305,.040,.270,.239],[0,.370,.018,.265,.236],[0,.430,-.006,.251,.222],[0,.485,-.020,.222,.194],[0,.530,-.026,.177,.146],[0,.555,-.026,.082,.066]],skin,20));
      // Low cheek volumes soften the front silhouette without losing facets.
      for(const side of [-1,1]){const cheek=ell(.082,.070,.035,skin,12,7);cheek.position.set(side*.155,.205,.205);cheek.scale.z=.65;this.group.add(cheek);}
    }
    for(const side of [-1,1]){
      const ear=ell(.050,.082,.047,skin,12,8);ear.position.set(side*(options.advanced===false?.255:.263),.235,-.006);this.group.add(ear);
      const eye=new THREE.Group();eye.position.set(side*.105,.275,.218);this.group.add(eye);this.eyes.push(eye);
      const sclera=ell(options.advanced===false?.066:.071,options.advanced===false?.058:.052,.025,white,14,8);eye.add(sclera);
      const irisMesh=ell(.033,.038,.012,iris,12,7);irisMesh.position.z=.019;eye.add(irisMesh);const pupilMesh=ell(.014,.024,.007,pupil,10,6);pupilMesh.position.z=.030;eye.add(pupilMesh);
      const lid=ell(.074,.055,.012,skin,14,7);lid.position.set(side*.105,.276,.247);lid.scale.y=.02;this.group.add(lid);this.lids.push(lid);
      const brow=finish(new THREE.Mesh(new THREE.CapsuleGeometry(.010,.094,3,6),hair));brow.position.set(side*.105,.365,.247);brow.rotation.z=Math.PI/2+side*.06;this.group.add(brow);this.brows.push(brow);
    }
    const nose=loft([[0,.235,.216,.030,.026],[0,.205,.247,.043,.038],[0,.177,.256,.052,.045]],skin,10);this.group.add(nose);
    this.mouth=new THREE.Group();this.mouth.position.set(0,.108,.253);this.group.add(this.mouth);
    this.mouthCenter=finish(new THREE.Mesh(new THREE.BoxGeometry(.074,.014,.012),inner));this.mouth.add(this.mouthCenter);
    for(const side of [-1,1]){const corner=finish(new THREE.Mesh(new THREE.CapsuleGeometry(.008,.044,2,5),lip));corner.position.x=side*.052;corner.rotation.z=Math.PI/2;this.mouth.add(corner);this.mouthCorners.push(corner);}
    this.buildHair(options.hairStyle,hair,options.advanced!==false);
    this.group.traverse(object=>{if(object instanceof THREE.Mesh){const p=object.geometry.getAttribute('position');this.metrics.vertices+=p?.count??0;this.metrics.triangles+=object.geometry.index?object.geometry.index.count/3:(p?.count??0)/3;}});
    this.applyExpression('neutral',1);
  }
  private buildHair(style:FaceHairStyle,hair:THREE.Material,advanced:boolean){
    const cap=loft([[0,.395,-.050,.248,.222],[0,.455,-.054,.268,.238],[0,.515,-.056,.250,.215],[0,.565,-.058,.180,.145],[0,.585,-.058,.040,.030]],hair,advanced?18:14);this.group.add(cap);
    if(!advanced){if(style!=='espetado')for(let i=-2;i<=2;i++){const lock=ell(.068,.125,.080,hair,10,7);lock.position.set(i*.086,.455,.170);this.group.add(lock);}return;}
    const addLock=(x:number,y:number,z:number,sx:number,sy:number,rz=0)=>{const lock=loft([[0,0,0,.044,.040],[0,-sy*.52,.010,.052,.044],[0,-sy,.020,.018,.020]],hair,8);lock.position.set(x,y,z);lock.scale.x=sx;lock.rotation.z=rz;this.group.add(lock);};
    if(style==='espetado')for(let i=-4;i<=4;i++){const spike=finish(new THREE.Mesh(new THREE.ConeGeometry(.055+(i%2?0:.012),.23,6),hair));spike.position.set(i*.055,.57+Math.abs(i)*-.006,-.025+Math.abs(i)*.008);spike.rotation.z=-i*.10;this.group.add(spike);}
    else{
      for(let i=-3;i<=3;i++)addLock(i*.071,.525,.168,1,.155,-i*.025);
      addLock(-.218,.455,.080,1.15,style==='longo'?.43:.20,.18);addLock(.218,.455,.080,1.15,style==='longo'?.43:.20,-.18);
      if(style==='longo')for(const side of [-1,1])for(let i=0;i<3;i++)addLock(side*(.205+i*.018),.360-i*.045,-.090-i*.012,1.25,.33,side*.08);
    }
  }
  setExpression(expression:FaceExpression,immediate=false){this.target=expression;if(immediate){this.blend=1;this.applyExpression(expression,1);}else this.blend=0;}
  update(dt:number){if(this.blend<1){this.blend=Math.min(1,this.blend+dt*8);this.applyExpression(this.target,1-Math.exp(-dt*14));}}
  private applyExpression(expression:FaceExpression,t:number){
    const values={neutral:{browY:.365,browRot:.06,lid:.02,mouthY:0,mouthRot:0,mouthScale:1},happy:{browY:.374,browRot:.10,lid:.18,mouthY:.014,mouthRot:.28,mouthScale:1.08},angry:{browY:.345,browRot:-.22,lid:.12,mouthY:-.010,mouthRot:-.18,mouthScale:.92},sad:{browY:.374,browRot:.25,lid:.08,mouthY:-.014,mouthRot:-.30,mouthScale:.95},blink:{browY:.365,browRot:.06,lid:1,mouthY:0,mouthRot:0,mouthScale:1}}[expression];
    this.brows.forEach((brow,i)=>{brow.position.y=THREE.MathUtils.lerp(brow.position.y,values.browY,t);const side=i===0?-1:1;brow.rotation.z=THREE.MathUtils.lerp(brow.rotation.z,Math.PI/2+side*values.browRot,t);});
    this.lids.forEach(lid=>lid.scale.y=THREE.MathUtils.lerp(lid.scale.y,values.lid,t));
    this.eyes.forEach(eye=>eye.scale.y=THREE.MathUtils.lerp(eye.scale.y,expression==='happy'?.88:1,t));
    this.mouth.position.y=THREE.MathUtils.lerp(this.mouth.position.y,.108+values.mouthY,t);this.mouth.scale.x=THREE.MathUtils.lerp(this.mouth.scale.x,values.mouthScale,t);
    this.mouthCorners.forEach((corner,i)=>{const side=i===0?-1:1;corner.rotation.z=THREE.MathUtils.lerp(corner.rotation.z,Math.PI/2-side*values.mouthRot,t);corner.position.y=THREE.MathUtils.lerp(corner.position.y,values.mouthY,t);});
    this.mouthCenter.scale.y=THREE.MathUtils.lerp(this.mouthCenter.scale.y,expression==='happy'?1.5:expression==='sad'?.7:1,t);
  }
  dispose(){this.group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(item=>item.dispose());}});}
}
