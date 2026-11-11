import * as T from 'three';
/** Small repeating surfaces; no external image requests or per-building textures. */
export function medievalSurface(kind:'stone'|'roof'|'wood'|'plaster'){
  const n=256,data=new Uint8Array(n*n*4);let seed=73;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296;
    let shade=.86+noise*.14;
    if(kind==='stone'||kind==='roof'){
      const height=kind==='roof'?32:48,width=kind==='roof'?32:80,row=Math.floor(y/height),xx=(x+(row%2)*width/2)%width,yy=y%height;
      const block=Math.sin(Math.floor((x+(row%2)*width/2)/width)*53+row*19)*.07;
      shade=.82+block+noise*.12;
      if(xx<2||yy<3)shade=.38+noise*.1;else if(yy<5)shade=1;
      if(kind==='roof')shade+=Math.sin(xx/width*Math.PI)*.08;
    }else if(kind==='wood'){
      shade=.63+.16*Math.sin(x*.6+Math.sin(y*.025)*2)+noise*.12;
      if(x%64<2)shade=.3;
    }
    const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=Math.min(255,Math.round(shade*255));data[i+3]=255;
  }
  const texture=new T.DataTexture(data,n,n);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
