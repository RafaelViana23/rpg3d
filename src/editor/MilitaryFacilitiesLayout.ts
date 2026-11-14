import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import layout from './military-facilities-layout.json';
import type {SavedBuildState,SavedCityObject} from './WorldEditorSupport';
import type {LowPolyCityBuilder} from './LowPolyCityBuilder';

const matrix=(s:{position:number[];rotation:number[];scale:number[]})=>new Matrix4().compose(new Vector3(...s.position),new Quaternion().setFromEuler(new Euler(s.rotation[0],s.rotation[1],s.rotation[2])),new Vector3(...s.scale));
/** Explicit removal requested after the military facilities were arranged. */
export async function removeRetiredCityOutposts(state:SavedBuildState,builder:LowPolyCityBuilder){
  const road=state.city['city-royal-avenue-v1'];
  if(!road||road.outpostRemovalRevision===1)return false;
  const ids=Object.keys(state.city).filter(id=>['guardhouse','tollhouse'].includes(state.city[id].kind));
  if(ids.length&&typeof window!=='undefined'){
    const response=await fetch('/api/game-save/backup-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    if(!response.ok)throw new Error('Não foi possível preservar o mapa antes de remover os postos.');
  }
  for(const id of ids)delete state.city[id];
  road.outpostRemovalRevision=1;
  builder.reconcile(state.city);
  return true;
}
/** Remove only the chapel requested by the user, preserving the current layout first. */
export async function removeTravelersChapel(state:SavedBuildState,builder:LowPolyCityBuilder){
  const id='medieval-perimeter-v1-wall-shrine-sudoeste';
  if(!state.city[id])return false;
  if(typeof window!=='undefined'){
    const backup=await fetch('/api/game-save/backup-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    if(!backup.ok)throw new Error('Não foi possível preservar o mapa antes de remover a capela.');
  }
  delete state.city[id];
  builder.reconcile(state.city);
  return true;
}
/** Apply only to the inspected live layout; preserve the entire current map first. */
export async function applyMilitaryFacilitiesLayout(state:SavedBuildState,builder:LowPolyCityBuilder){
  const stableId='medieval-perimeter-v1-stable-sul';
  if(state.city[stableId]?.militaryFacilitiesRevision===1)return false;
  if(typeof window!=='undefined'){
    const backup=await fetch('/api/game-save/backup-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    const copies:Record<string,string>={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('rpg3d.cloud.backup.'))copies[key]=localStorage.getItem(key)!;}
    if(Object.keys(copies).length)await fetch('/api/game-save/archive-backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(copies)});
    if(!backup.ok)throw new Error('Não foi possível preservar o mapa atual antes da reorganização.');
  }
  for(const [id,expected] of Object.entries(layout.source)){
    const actual=state.city[id];
    if(!actual||(['position','rotation','scale'] as const).some(k=>JSON.stringify(actual[k])!==JSON.stringify(expected[k])))return false;
  }
  // Extra user-placed objects require a fresh collision plan, never a blind migration.
  if(Object.keys(state.city).some(id=>!(id in layout.source)))return false;
  try{localStorage.setItem('rpg3d.militaryFacilities.before.v1',JSON.stringify(state));}
  catch(error){
    if(typeof window==='undefined')throw error;
    const backups:Record<string,string>={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('rpg3d.cloud.backup.'))backups[key]=localStorage.getItem(key)!;}
    const archived=await fetch('/api/game-save/archive-backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(backups)});
    if(!archived.ok)throw new Error('Não foi possível arquivar os backups locais. O mapa foi preservado.');
    // Copies are on disk before freeing the browser quota; current saves stay intact.
    for(const key of Object.keys(backups))localStorage.removeItem(key);
    localStorage.setItem('rpg3d.militaryFacilities.before.v1',JSON.stringify(state));
  }
  const previousStable=structuredClone(state.city[stableId]);
  for(const value of layout.moves){
    const entry={...structuredClone(value),militaryFacilitiesRevision:1} as SavedCityObject;
    state.city[entry.id]=entry;
  }
  const horse=state.assets['cavalo-da-cavalari-a'];
  if(horse){
    const transform=matrix(state.city[stableId]).multiply(matrix(previousStable).invert()).multiply(matrix(horse));
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();transform.decompose(position,rotation,scale);
    const euler=new Euler().setFromQuaternion(rotation);
    horse.position=position.toArray();horse.rotation=[euler.x,euler.y,euler.z];horse.scale=scale.toArray();
  }
  builder.reconcile(state.city);
  return true;
}
