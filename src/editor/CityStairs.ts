import * as T from 'three';

/** Palace proportions: the same riser count for a given flight height. */
export function cityStoneStairCount(from:number,to:number){
 return Math.max(24,Math.ceil(Math.abs(to-from)/.25));
}

/** A single closed stair profile, without overlapping boxes or internal faces. */
export function cityStairGeometry(front:number,back:number,width:number,from:number,to:number,count:number,base=from-.3){
 const run=(front-back)/count,profile=new T.Shape();
 profile.moveTo(front,base);profile.lineTo(front,from+(to-from)/count);
 for(let i=0;i<count;i++){
  const z=front-(i+1)*run,y=from+(to-from)*(i+1)/count;
  profile.lineTo(z,y);
  if(i<count-1)profile.lineTo(z,from+(to-from)*(i+2)/count);
 }
 profile.lineTo(back,base);profile.closePath();
 const geometry=new T.ExtrudeGeometry(profile,{depth:width,bevelEnabled:false,steps:1});
 geometry.rotateY(-Math.PI/2);geometry.translate(width/2,0,0);
 return geometry;
}
