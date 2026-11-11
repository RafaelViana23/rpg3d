import * as THREE from 'three';
let material:THREE.MeshStandardMaterial|undefined;
/** One paving material shared by the main city slab and the tower landings. */
export function cityPavingMaterial(){
  if(material)return material;
  if(typeof document==='undefined')return material=new THREE.MeshStandardMaterial({color:'#d4cbb6',roughness:.96});
    const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;
    const ctx=canvas.getContext("2d")!;
    let seed=7319;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    ctx.fillStyle="#303438";ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<16;row++)for(let col=-1;col<8;col++){
      const x=col*128+(row%2)*64,y=row*64;
      const tone=107+Math.floor(random()*36);
      ctx.fillStyle=`rgb(${tone},${tone+2},${tone+5})`;
      ctx.beginPath();ctx.roundRect(x+3,y+3,122,58,5+random()*5);ctx.fill();
      ctx.strokeStyle="rgba(216,223,229,.28)";ctx.lineWidth=2;ctx.stroke();
      for(let i=0;i<110;i++){
        ctx.fillStyle=random()>.5?"rgba(230,235,240,.12)":"rgba(27,30,34,.13)";
        ctx.fillRect(x+7+random()*111,y+7+random()*48,1+random()*3,1+random()*2);
      }
      if(random()>.55){ctx.strokeStyle="rgba(36,36,31,.27)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+25,y+5);ctx.lineTo(x+45,y+22);ctx.lineTo(x+39,y+36);ctx.stroke();}
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
    const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
    material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.16,roughness:.96,color:'#d4cbb6'});
  return material;
}

/** Project paving onto a shared reference grid, such as the avenue axes. */
export function alignCityPavingUV(geometry:THREE.BufferGeometry,matrix=new THREE.Matrix4()){
  const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),point=new THREE.Vector3();
  if(!uv)return;
  for(let i=0;i<uv.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(matrix);
    uv.setXY(i,point.x/12,point.z/12);
  }
  uv.needsUpdate=true;
}
