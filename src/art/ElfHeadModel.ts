import * as THREE from 'three';
import spec from './head-spec.json';

export const HEAD_SCULPT_STORAGE_KEY='aincrad-elf-head-sculpt-v1';
export const HEAD_PARAMETERS_STORAGE_KEY='aincrad-elf-head-parameters-v1';
export type HeadSculptData={version:1;vertexCount:number;offsets:number[];updatedAt:string};
export type HeadParameters={
  skullWidth:number;skullHeight:number;skullDepth:number;forehead:number;temples:number;
  jawWidth:number;jawAngle:number;chinHeight:number;chinProjection:number;
  eyeSpacing:number;eyeDepth:number;eyeTilt:number;socketDepth:number;cheekVolume:number;
  noseBridge:number;noseLength:number;noseProjection:number;mouthWidth:number;mouthDepth:number;
  earLength:number;earTilt:number;hairVolume:number;hairSweep:number;
};
export const DEFAULT_HEAD_PARAMETERS:HeadParameters={skullWidth:.94,skullHeight:1.04,skullDepth:.96,forehead:.01,temples:-.008,jawWidth:1.02,jawAngle:.018,chinHeight:.012,chinProjection:.018,eyeSpacing:1,eyeDepth:0,eyeTilt:-.08,socketDepth:.018,cheekVolume:.014,noseBridge:.018,noseLength:.018,noseProjection:.025,mouthWidth:1,mouthDepth:.008,earLength:1.22,earTilt:.12,hairVolume:1.08,hairSweep:.12};
export function loadHeadParameters():HeadParameters{try{return{...DEFAULT_HEAD_PARAMETERS,...JSON.parse(localStorage.getItem(HEAD_PARAMETERS_STORAGE_KEY)||'{}')}}catch{return{...DEFAULT_HEAD_PARAMETERS}}}
export function loadHeadSculptData():HeadSculptData|null{
  try{const value=localStorage.getItem(HEAD_SCULPT_STORAGE_KEY);if(!value)return null;const data=JSON.parse(value) as HeadSculptData;return data.version===1&&Array.isArray(data.offsets)?data:null;}catch{return null;}
}

type Raw={positions:number[];indices:number[]}; type Vec=[number,number,number];
const raw=():Raw=>({positions:[],indices:[]});
const add=(o:Raw,p:Vec)=>{o.positions.push(...p);return o.positions.length/3-1;};
const merge=(o:Raw,i:Raw)=>{const n=o.positions.length/3;o.positions.push(...i.positions);o.indices.push(...i.indices.map(v=>v+n));};
const geometry=(d:Raw)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));g.setIndex(d.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;};
const material=(color:string,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true,side:THREE.DoubleSide});

function subdivide(vertices:number[][],triangles:number[][]):Raw{
  const o:Raw={positions:vertices.flat(),indices:[]},cache=new Map<string,number>();
  const mid=(a:number,b:number)=>{const key=a<b?String(a)+':'+b:String(b)+':'+a,old=cache.get(key);if(old!==undefined)return old;const av=vertices[a],bv=vertices[b],id=o.positions.length/3;o.positions.push((av[0]+bv[0])/2,(av[1]+bv[1])/2,(av[2]+bv[2])/2);cache.set(key,id);return id;};
  for(const [a,b,c] of triangles){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);o.indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}return o;
}
const bell=(value:number,center:number,radius:number)=>Math.exp(-Math.pow((value-center)/radius,2));
function anatomicalCage(parameters:HeadParameters):number[][]{
  return spec.base_cage.vertices.map(source=>{
    let [x,y,z]=source as Vec;const ax=Math.abs(x);
    x*=parameters.skullWidth;y*=parameters.skullHeight;z*=parameters.skullDepth;
    // Adult angular jaw and projected chin remain part of the continuous head surface.
    const lower=THREE.MathUtils.clamp((-y-.035)/.14,0,1),jawBand=bell(y,-.09,.075);
    x*=THREE.MathUtils.lerp(1,parameters.jawWidth,lower);x+=Math.sign(x)*parameters.jawAngle*jawBand*(ax/.16);
    if(y<-.105){y-=parameters.chinHeight*bell(x,0,.08);z+=parameters.chinProjection*bell(x,0,.07);}
    // Temple taper and forehead plane.
    x+=Math.sign(x)*parameters.temples*bell(y,.09,.055)*bell(ax,.13,.07);z+=parameters.forehead*bell(y,.12,.07)*bell(x,0,.16);
    // Real orbital recesses, cheek shelf and infra-orbital transition.
    const socket=bell(ax,.073*parameters.eyeSpacing,.043)*bell(y,.035,.04)*bell(z,.13,.055);z-=parameters.socketDepth*socket;
    z+=parameters.cheekVolume*bell(ax,.105,.055)*bell(y,-.015,.055)*bell(z,.11,.07);
    // Nose bridge/dorsum is raised directly from the facial surface.
    const noseX=bell(x,0,.038),bridge=bell(y,.055,.075),tip=bell(y,-.015,.045);
    z+=noseX*(parameters.noseBridge*bridge+parameters.noseProjection*tip);y-=parameters.noseLength*tip;
    // Philtrum and mouth groove keep the muzzle from reading as a pasted plane.
    const mouth=bell(x,0,.065*parameters.mouthWidth)*bell(y,-.082,.025);z-=parameters.mouthDepth*mouth;
    return [x,y,z];
  });
}
function lens(cx:number,cy:number,cz:number,rx:number,ry:number,depth:number,segments=16):Raw{
  const o=raw(),front=add(o,[cx,cy,cz+depth]),back=add(o,[cx,cy,cz-depth*.2]);for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;add(o,[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,cz]);}for(let i=0;i<segments;i++){const a=2+i,b=2+(i+1)%segments;o.indices.push(front,a,b,back,b,a);}return o;
}
function ribbon(points:Vec[],width:number,depth:number):Raw{
  const o=raw();for(const p of points){add(o,[p[0],p[1]-width,p[2]+depth]);add(o,[p[0],p[1]+width,p[2]+depth]);add(o,[p[0],p[1]-width,p[2]-depth]);add(o,[p[0],p[1]+width,p[2]-depth]);}
  for(let i=0;i<points.length-1;i++){const a=i*4,b=a+4;o.indices.push(a,b,b+1,a,b+1,a+1,a+2,a+3,b+3,a+2,b+3,b+2,a,a+2,b+2,a,b+2,b,a+1,b+1,b+3,a+1,b+3,a+3);}return o;
}
function closedPoly(points:Vec[],frontZ:number,backZ:number):Raw{
  const o=raw(),n=points.length;for(const p of points)add(o,[p[0],p[1],frontZ+p[2]]);for(const p of points)add(o,[p[0],p[1],backZ+p[2]]);for(let i=1;i<n-1;i++)o.indices.push(0,i,i+1,n,n+i+1,n+i);for(let i=0;i<n;i++){const j=(i+1)%n;o.indices.push(i,j,n+j,i,n+j,n+i);}return o;
}
function ear(side:-1|1):Raw{
  const s=side,o=closedPoly([[s*.158,-.015,0],[s*.185,.015,-.006],[s*.265,.105,-.025],[s*.205,.080,-.006],[s*.166,.055,.006]],.006,-.006);merge(o,ribbon([[s*.174,.008,0],[s*.220,.075,0],[s*.187,.052,0],[s*.168,.030,0]],.005,.005));return o;
}
function hairClump(path:Vec[],width:number,depth:number,twist=0):Raw{
  const o=raw(),sides=7,curve=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(...p)),false,'centripetal'),rings=10;
  for(let r=0;r<rings;r++){const t=r/(rings-1),p=curve.getPoint(t),taper=Math.pow(1-t,.65)*.78+.08,w=width*taper,d=depth*taper;for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2+twist*t;add(o,[p.x+Math.cos(a)*w,p.y+Math.sin(a)*w*.22,p.z+Math.sin(a)*d]);}}
  for(let r=0;r<rings-1;r++)for(let k=0;k<sides;k++){const a=r*sides+k,b=r*sides+(k+1)%sides,c=a+sides,d=b+sides;o.indices.push(a,c,b,b,c,d);}const last=(rings-1)*sides;for(let k=1;k<sides-1;k++)o.indices.push(last,last+k,last+k+1);return o;
}
function createHair(parameters:HeadParameters):Raw{
  const o=raw(),v=parameters.hairVolume,s=parameters.hairSweep,paths:Vec[][]=[
    [[-.17,.08,-.10],[-.19,.13,-.01],[-.165,.11,.09],[-.14,.055,.13]],
    [[-.13,.15,-.13],[-.14,.22,-.025],[-.115,.19,.09],[-.09,.11,.145]],
    [[-.075,.19,-.14],[-.065,.265,-.035],[-.045,.225,.09],[-.025,.135,.155]],
    [[-.015,.20,-.145],[.02,.285,-.045],[.055+s*.3,.245,.075],[.055+s*.45,.145,.15]],
    [[.045,.19,-.14],[.095,.27,-.04],[.14+s*.4,.225,.055],[.13+s*.55,.13,.135]],
    [[.105,.15,-.12],[.16,.225,-.02],[.185+s*.35,.17,.055],[.16+s*.45,.075,.115]],
    [[-.16,.10,-.09],[-.20,.08,-.005],[-.18,.04,.075],[-.155,.005,.11]],
    [[.155,.095,-.09],[.20,.075,-.005],[.18,.035,.065],[.15,0,.10]],
    [[-.085,.19,-.13],[-.015,.29,-.055],[.075+s,.285,.015],[.13+s,.205,.085]]];
  paths.forEach((p,i)=>merge(o,hairClump(p,(i===8?.06:.052)*v,.040*v,(i%2?-.16:.14))));return o;
}

export const HEAD_BIND_REFERENCE={parent:'Neck',position:[0,.15,0] as Vec,quaternion:[0,0,0,1] as [number,number,number,number],scale:[1,1,1] as Vec};
export class ElfHeadModel{
  readonly group=new THREE.Group();
  readonly headMesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
  readonly baseHeadPositions:Float32Array;
  readonly metrics={sourceVertices:spec.base_cage.vertices.length,sourceTriangles:spec.base_cage.triangles.length,vertices:0,triangles:0,meshes:0,budgetVertices:spec.budget.vertices,budgetTriangles:spec.budget.triangles};
  readonly parameters:HeadParameters;
  constructor(parameters:HeadParameters=loadHeadParameters()){
    this.parameters={...parameters};
    this.group.name='ElfHead_LocalSpace';this.group.position.set(0,0,0);this.group.quaternion.identity();this.group.scale.set(1,1,1);
    const skin=material(spec.materials.skin),hair=material(spec.materials.hair_base,.6),white=material('#e7eee9',.5),iris=material(spec.materials.iris,.42),dark=material('#5b4030',.78);
    const headMesh=new THREE.Mesh(geometry(subdivide(anatomicalCage(this.parameters),spec.base_cage.triangles)),skin);headMesh.name='HeadBase_410Cage_Subdivided';this.headMesh=headMesh;this.baseHeadPositions=new Float32Array(headMesh.geometry.getAttribute('position').array);this.group.add(headMesh);this.applySculpt(loadHeadSculptData());
    const mouthRaw=ribbon([[-.050,-.086,.153],[-.025,-.083,.157],[0,-.087,.159],[.025,-.083,.157],[.050,-.086,.153]],.003,.002);
    const mouth=new THREE.Mesh(geometry(mouthRaw),dark);mouth.name='MouthCrease_IntegratedSurface';this.group.add(mouth);
    for(const side of [-1,1] as const){
      const e=new THREE.Mesh(geometry(ear(side)),skin);e.name='ElfEar_'+(side<0?'L':'R');e.scale.set(1,this.parameters.earLength,1);e.rotation.z=side*this.parameters.earTilt;this.group.add(e);
      const eyeX=side*.075*this.parameters.eyeSpacing,eyeY=.035+side*this.parameters.eyeTilt*.015,eyeZ=.151-this.parameters.eyeDepth;
      const eye=new THREE.Mesh(geometry(lens(eyeX,eyeY,eyeZ,.047,.024,.012)),white);eye.name='Eye_CustomLens';this.group.add(eye);
      const eyeIris=new THREE.Mesh(geometry(lens(eyeX,eyeY,eyeZ+.013,.017,.017,.004,12)),iris);eyeIris.name='Iris_CustomLens';this.group.add(eyeIris);
      const lidsRaw=ribbon([[side*.119,.038,.159],[side*.098,.058,.166],[side*.075,.062,.169],[side*.052,.058,.166],[side*.031,.038,.159]],.003,.003);merge(lidsRaw,ribbon([[side*.116,.034,.159],[side*.094,.017,.165],[side*.075,.013,.167],[side*.056,.017,.165],[side*.034,.034,.159]],.0025,.0025));const lids=new THREE.Mesh(geometry(lidsRaw),skin);lids.name='Eyelids_CustomLoops';this.group.add(lids);
      const brow=new THREE.Mesh(geometry(ribbon([[side*.122,.073,.159],[side*.080,.088,.166],[side*.038,.078,.159]],.006,.003)),dark);brow.name='Brow_Separate';this.group.add(brow);
    }
    const hairMesh=new THREE.Mesh(geometry(createHair(this.parameters)),hair);hairMesh.name='Hair_CatmullRom_LayeredLocks';this.group.add(hairMesh);
    this.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;this.metrics.meshes++;const p=o.geometry.getAttribute('position');this.metrics.vertices+=p.count;this.metrics.triangles+=o.geometry.index?o.geometry.index.count/3:p.count/3;}});
  }
  applySculpt(data:HeadSculptData|null){
    const position=this.headMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const offsets=data?.vertexCount===position.count&&data.offsets.length===position.count*3?data.offsets:null;
    for(let i=0;i<position.array.length;i++)position.array[i]=this.baseHeadPositions[i]+(offsets?.[i]??0);
    position.needsUpdate=true;this.headMesh.geometry.computeVertexNormals();this.headMesh.geometry.computeBoundingBox();this.headMesh.geometry.computeBoundingSphere();
  }
  dispose(){this.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});}
}
