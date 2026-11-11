import { PERIMETER_CATALOG } from '../editor/CityPerimeter';
import type * as T from 'three';
const places:Record<string,{name:string;color:string}>= {
 ...Object.fromEntries(PERIMETER_CATALOG.map(item=>[item.kind,{name:item.label,color:'#d2b98c'}])),
 inn:{name:'Pousada',color:'#69baff'},tavern:{name:'Taverna',color:'#f5a454'},
 church:{name:'Igreja',color:'#eee8d9'},guild:{name:'Guilda',color:'#c99aff'},
 weapons:{name:'Armas',color:'#ee7777'},potions:{name:'Poções',color:'#82e7ac'},
 warehouse:{name:'Armazém',color:'#d6ac7c'},shop:{name:'Loja',color:'#91d599'},
 market:{name:'Mercado',color:'#f6d765'},fountain:{name:'Fonte',color:'#5ee2ed'},
 palace:{name:'Palácio',color:'#f0bcf2'},
};
type Point=(x:number,z:number)=>readonly[number,number];
/** Paint the actual edited footprints; gaps between them are the real streets. */
export function drawCityMinimap(ctx:CanvasRenderingContext2D,objects:Iterable<T.Group>,polygon:T.Vector2[]|undefined,point:Point,scale:number,local:boolean){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.save();
 if(polygon?.length){ctx.beginPath();polygon.forEach((p,i)=>{const xy=point(p.x,p.y);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.closePath();ctx.fillStyle='#827b65';ctx.fill();ctx.strokeStyle='#b8ae91';ctx.lineWidth=2;ctx.stroke();}
 const markers:{x:number;y:number;name:string;color:string}[]=[];
 for(const object of objects){
  const kind=object.name.replace('Cidade:',''),b=object.userData.building;
  const [x,y]=point(object.position.x,object.position.z);
  const bw=(b?.width??object.userData.perimeterFootprint?.[0]??(kind==='wall'?12:kind==='gate'?14:kind==='tower'?8:0))*Math.abs(object.scale.x)*scale;
  const bd=(b?.depth??object.userData.perimeterFootprint?.[1]??(kind==='wall'?2.2:kind==='gate'?2.8:kind==='tower'?8:0))*Math.abs(object.scale.z)*scale;
  if(x+bw+bd<0||x-bw-bd>w||y+bw+bd<0||y-bw-bd>h)continue;
  if(bw&&bd){
   ctx.save();ctx.translate(x,y);ctx.rotate(-object.rotation.y);
   ctx.fillStyle=b?'#483b34':'#b8b2a2';ctx.strokeStyle=b?'#c4a783':'#343734';ctx.lineWidth=.7;
   ctx.fillRect(-bw/2,-bd/2,bw,bd);ctx.strokeRect(-bw/2,-bd/2,bw,bd);
   if(b?.enterable&&scale>.4){ctx.fillStyle='#e4d7b4';const door=Math.max(2,b.doorWidth*object.scale.x*scale);ctx.fillRect(-door/2,bd/2-1,door,2);}
   ctx.restore();
  }
  if(places[kind]&&x>=7&&x<=w-7&&y>=7&&y<=h-7)markers.push({x,y,...places[kind]});
 }
 ctx.font=`600 ${local?9:11}px sans-serif`;ctx.textBaseline='middle';
 const occupied:{x:number;y:number;w:number;h:number}[]=[];
 for(const m of markers){
  ctx.fillStyle=m.color;ctx.strokeStyle='#171a20';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(m.x,m.y,local?3.5:4.5,0,Math.PI*2);ctx.fill();ctx.stroke();
  const tw=ctx.measureText(m.name).width+7,th=local?13:16;
  const offsets=[[7,-th/2],[-tw-7,-th/2],[-tw/2,-th-7],[-tw/2,7],[7,10],[-tw-7,10],[7,-th-12],[-tw-7,-th-12]];
  let label:{x:number;y:number;w:number;h:number}|undefined;
  for(const [dx,dy] of offsets){const box={x:Math.max(2,Math.min(w-tw-2,m.x+dx)),y:Math.max(2,Math.min(h-th-2,m.y+dy)),w:tw,h:th};if(!occupied.some(b=>box.x<b.x+b.w+2&&box.x+box.w+2>b.x&&box.y<b.y+b.h+2&&box.y+box.h+2>b.y)){label=box;break;}}
  if(!label)continue;
  occupied.push(label);ctx.strokeStyle=m.color;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(label.x+label.w/2,label.y+label.h/2);ctx.stroke();
  ctx.fillStyle='#16201de8';ctx.fillRect(label.x,label.y,label.w,label.h);ctx.fillStyle=m.color;ctx.fillText(m.name,label.x+3.5,label.y+label.h/2);
 }
 ctx.restore();
}
