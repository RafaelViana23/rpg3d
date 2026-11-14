/** Shared clearances for the fountain island, gardens and circular market. */
export const PLAZA_GARDEN_RADIUS=30;
export const PLAZA_GARDEN_HALF_ANGLE=.14;
export function circularMarketStalls(){
  const variants=['Stand_Vegetables','Stand_Tools','Stand_Meat'];
  return Array.from({length:12},(_,i)=>{
    const angle=(i+.5)*Math.PI/6;
    return {x:Math.sin(angle)*22,z:Math.cos(angle)*22,angle:angle+Math.PI,variant:variants[i%3],height:2.6+(i%3)*.08,radius:4.3};
  });
}
export function plazaGardenAngles(){return Array.from({length:8},(_,i)=>(i+.5)*Math.PI/4);}
export function circularPlazaLanterns(innerRadius:number,outerRadius:number){
  return [innerRadius+.45,outerRadius-.45].flatMap((radius,row)=>Array.from({length:8},(_,i)=>{
    const angle=(i+.5)*Math.PI/4,x=Math.sin(angle),z=Math.cos(angle),direction=row===0?1:-1;
    return {x:x*radius,z:z*radius,fx:x*direction,fz:z*direction};
  }));
}

/** Behind each counter, facing the fountain; kept in market-local coordinates. */
export function marketStallWorkstation(post:number){
  const stall=circularMarketStalls()[post];
  return {x:stall.x-Math.sin(stall.angle)*3.6,y:.08,z:stall.z-Math.cos(stall.angle)*3.6,angle:stall.angle};
}
