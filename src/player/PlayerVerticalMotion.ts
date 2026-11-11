/** Shared ballistic motion for jumps, dismounts and stepping off unsupported edges. */
export function advancePlayerVertical(height:number,velocity:number,ground:number,delta:number,gravity:number){
  if(velocity===0&&height-ground<=.08)return {height:ground,velocity:0,airborne:false};
  const nextHeight=height+velocity*delta-.5*gravity*delta*delta;
  const nextVelocity=velocity-gravity*delta;
  // Land only on a surface crossed from above, never snap upward during a fall.
  if(nextVelocity<=0&&ground<=height+.08&&nextHeight<=ground)return {height:ground,velocity:0,airborne:false};
  return {height:nextHeight,velocity:nextVelocity,airborne:true};
}
