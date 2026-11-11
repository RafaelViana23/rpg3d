import * as T from 'three';
export type ReferenceMaterial='plaster'|'wood'|'roof'|'stone'|'iron'|'gold'|'water'|'red'|'green'|'glass'|'canvas'|'blue'|'clay';
export type DetailKit={geo:(g:T.BufferGeometry,m:ReferenceMaterial,x:number,y:number,z:number,rx?:number,ry?:number,rz?:number)=>void;box:(x:number,y:number,z:number,w:number,h:number,d:number,m:ReferenceMaterial,solid?:boolean)=>void;cyl:(x:number,y:number,z:number,r:number,h:number,m:ReferenceMaterial,rt?:number)=>void};
export function referenceBuildingDetails(k:DetailKit,w:number,d:number,h:number,door:number,church:boolean,longRoof=false,doorHeight=3,dormers=true){
  const {geo,box}=k;
  function beam(a:T.Vector3,b:T.Vector3,width=.22,m:ReferenceMaterial='wood'){
    const g=new T.BoxGeometry(width,a.distanceTo(b),width);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));const mid=a.clone().add(b).multiplyScalar(.5);geo(g,m,mid.x,mid.y,mid.z);
  }
  if(!church){
    for(const s of [-1,1]){
      // Two shed dormers on each roof slope, like House3's projecting windows.
      if(!longRoof&&dormers)for(const z of [-d*.23,d*.23]){
        const x=s*w*.28,y=h+w*.19;
        box(x,y,z,1.6,1.6,1.7,'plaster');
        box(x+s*.83,y,z,.12,1.25,1.3,'iron');
        for(const dz of [-.7,.7])box(x+s*.92,y,z+dz,.18,1.6,.16,'wood');
        box(x+s*.92,y,z,.18,1.3,.09,'wood');
        geo(new T.BoxGeometry(2,.18,2),'roof',x,y+.9,z,0,0,-s*.12);
      }
    }
    // Timber verges and ridge silhouette.
    const rise=(longRoof?d:w)*.4;
    if(longRoof){box(0,h+rise+.2,0,w+1.8,.32,.32,'wood');for(const x of [-w/2-.35,w/2+.4])for(const sign of [-1,1])beam(new T.Vector3(x,h+rise,0),new T.Vector3(x,h-.3,sign*(d/2+.4)),.3);}
    else box(0,h+rise+.2,0,.32,.32,d+1.8,'wood');
    if(!longRoof)for(const z of [-d/2-.35,d/2+.4])for(const s of [-1,1])beam(new T.Vector3(0,h+rise,z),new T.Vector3(s*(w/2+.4),h-.3,z),.3);
  }else{
    // Stepped buttresses, pointed lancets and pinnacles follow the gothic reference.
    for(const side of [-1,1])for(let z=-d/2+1.3;z<d/2;z+=5){
      box(side*(w/2+.65),h*.33,z,1.3,h*.66,1,'stone',true);
      box(side*(w/2+.4),h*.74,z,.9,h*.17,.8,'stone');
      geo(new T.ConeGeometry(.65,1.8,4),'stone',side*(w/2+.4),h+.1,z,0,Math.PI/4);
      const shape=new T.Shape();shape.moveTo(-.65,0);shape.lineTo(.65,0);shape.lineTo(.65,3);shape.lineTo(0,4.1);shape.lineTo(-.65,3);shape.closePath();
      geo(new T.ShapeGeometry(shape),'iron',side*(w/2+.25),h*.4,z+2.4,0,side*Math.PI/2);
      box(side*(w/2+.3),h*.4+1.7,z+2.4,.12,3.4,.09,'stone');
    }
    // A round stone surround follows the double door's rounded crown.
    const radius=door/2,rise=doorHeight*.34,spring=doorHeight-rise,thickness=.35,roseY=h*.8;
    for(const sign of [-1,1])box(sign*(radius+thickness/2),spring/2,d/2+.35,thickness,spring,.65,'stone');
    const surround=new T.Shape();surround.absellipse(0,spring,radius+thickness,rise+thickness,0,Math.PI,false,0);
    surround.lineTo(-radius,spring);surround.absellipse(0,spring,radius,rise,Math.PI,0,true,0);surround.closePath();
    geo(new T.ExtrudeGeometry(surround,{depth:.65,bevelEnabled:false,curveSegments:32}),'stone',0,0,d/2+.025);
    geo(new T.TorusGeometry(1.7,.2,6,20),'stone',0,roseY,d/2+.35);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(new T.Vector3(0,roseY,d/2+.4),new T.Vector3(Math.cos(a)*1.6,roseY+Math.sin(a)*1.6,d/2+.4),.12,'stone');}
  }
}
export function referenceMarket(k:DetailKit){
 const {geo,box,cyl}=k;
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,x=Math.sin(angle)*18,z=Math.cos(angle)*18;
  box(x,1,z,5.6,1.8,1.8,'wood',true);
  for(const dx of [-2.8,2.8])for(const dz of [-1.7,1.7])box(x+dx,2.1,z+dz,.2,4.2,.2,'wood');
  for(const zz of [-1.7,1.7])box(x,4.15,z+zz,6,.24,.24,'wood');
  if(i%3===0){
    // Curved cloth canopy with alternating cream / blue stripes and a valance.
    for(let stripe=0;stripe<12;stripe++){
      const verts:number[]=[];
      for(let seg=0;seg<8;seg++){
        const z0=-2.1+seg*.525,z1=z0+.525,y0=4.7-.6*(z0/2.1)**2,y1=4.7-.6*(z1/2.1)**2,xx=-3+stripe*.5;
        verts.push(xx,y0,z0,xx+.5,y0,z0,xx,y1,z1,xx+.5,y0,z0,xx+.5,y1,z1,xx,y1,z1);
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(verts.length/3*2).fill(0),2));g.computeVertexNormals();geo(g,stripe%2?'canvas':'blue',x,0,z);
      box(x-2.75+stripe*.5,3.93,z+2.1,.5,.45,.05,stripe%2?'canvas':'blue');
    }
  }else{for(let slat=0;slat<8;slat++)geo(new T.BoxGeometry(.73,.15,4.3),'roof',x-2.65+slat*.76,4.25,z,.12);}
  for(let n=0;n<4;n++){
    const xx=x-2.05+n*1.36;box(xx,2,z,1.22,.2,1.6,'wood');
    for(const s of [-1,1]){box(xx+s*.6,2.2,z,.1,.45,1.6,'wood');box(xx,2.2,z+s*.76,1.2,.45,.1,'wood');}
    if(i%3===0)for(let a=0;a<3;a++)for(let b=0;b<3;b++)geo(new T.IcosahedronGeometry(.18,0),n%2?'green':'gold',xx-.36+a*.36,2.32,z-.5+b*.45);
    else if(i%3===1){for(let a=0;a<3;a++)box(xx,2.25+a*.18,z,1.05,.16,1.3,a%2?'red':'blue');}
    else {cyl(xx,2.4,z,.26,.55,'clay',.18);cyl(xx,2.76,z,.12,.18,'clay');}
  }
  for(const side of [-1,1]){
    const xx=x+side*3.25;cyl(xx,.6,z,.5,1.2,'wood',.45);for(const y of [.25,.95])geo(new T.TorusGeometry(.49,.055,4,10),'iron',xx,y,z,Math.PI/2);
  }
 }
}
