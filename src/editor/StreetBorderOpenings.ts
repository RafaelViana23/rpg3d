import * as T from 'three';

/** Cut street mouths out of avenue curbs, including curved plaza borders. */
export function cutStreetBorderOpenings(source:T.BufferGeometry,openings:number[][][]){
 const geometry=source.index?source.toNonIndexed():source;
 const position=geometry.getAttribute('position'),vertices:number[]=[];
 const cuts=openings.map(points=>{
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  const ring=area>0?points:[...points].reverse();
  return {ring,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};
 });
 for(let i=0;i<position.count;i+=3){
  let pieces=[Array.from({length:3},(_,j)=>new T.Vector3().fromBufferAttribute(position,i+j))];
  for(const cut of cuts){
   const result:T.Vector3[][]=[];
   for(const polygon of pieces){
    if(polygon.every(p=>p.x<cut.minX)||polygon.every(p=>p.x>cut.maxX)||polygon.every(p=>p.z<cut.minZ)||polygon.every(p=>p.z>cut.maxZ)){result.push(polygon);continue;}
    let inside=polygon;
    for(let e=0;e<cut.ring.length&&inside.length>=3;e++){
     const a=cut.ring[e],b=cut.ring[(e+1)%cut.ring.length];
     const sign=(p:T.Vector3)=>(b[0]-a[0])*(p.z-a[1])-(b[1]-a[1])*(p.x-a[0]);
     const yes:T.Vector3[]=[],no:T.Vector3[]=[];
     for(let j=0;j<inside.length;j++){
      const p=inside[j],q=inside[(j+1)%inside.length],sp=sign(p),sq=sign(q);
      (sp>=0?yes:no).push(p);
      if((sp>=0)!==(sq>=0)){const intersection=p.clone().lerp(q,sp/(sp-sq));yes.push(intersection);no.push(intersection);}
     }
     if(no.length>=3)result.push(no);inside=yes;
    }
   }
   pieces=result;
  }
  for(const polygon of pieces)for(let j=1;j+1<polygon.length;j++)for(const p of [polygon[0],polygon[j],polygon[j+1]])vertices.push(p.x,p.y,p.z);
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(vertices,3));result.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));result.computeVertexNormals();
 if(geometry!==source)geometry.dispose();return result;
}
