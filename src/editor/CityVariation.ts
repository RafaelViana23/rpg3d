/** Stable variation: layouts keep their identity across reloads. */
export function cityRandom(seed:number){
  let state=(seed^0x9e3779b9)>>>0;
  state=Math.imul(state^(state>>>16),0x21f0aaad);
  state=Math.imul(state^(state>>>15),0x735a2d97);
  state=(state^(state>>>15))>>>0;
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
export function facadeProfile(seed:number){
  const random=cityRandom(seed),roll=random();
  return roll<.3?'empty':roll<.45?'bucket':roll<.6?'crates':roll<.73?'barrels':roll<.83?'plant':roll<.93?'mixed':'full';
}
export function cityAnimalKinds(seed:number){
  const random=cityRandom(seed^0x71a2);
  return {cat:random()<.09,rat:random()<.12};
}

export function cityObjectSeed(id:string){
  let hash=2166136261;
  for(const character of id)hash=Math.imul(hash^character.charCodeAt(0),16777619);
  return hash>>>0;
}
