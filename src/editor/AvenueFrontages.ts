import layout from './avenue-frontage-layout.json';
import type {SavedCityObject} from './WorldEditorSupport';
import type {LowPolyCityBuilder} from './LowPolyCityBuilder';

/** Align the existing houses without changing their identities or ownership. */
export function applyAvenueFrontages(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
 const road=saved['city-royal-avenue-v1'];
 if(!road||road.frontageLayoutRevision===1)return false;
 for(const [id,value]of Object.entries(layout.moves)){
  if(!saved[id])continue;
  if(id===road.id){road.frontageLayoutRevision=1;continue;}
  const entry=structuredClone(value) as SavedCityObject;saved[id]=entry;
  const object=builder.objects.get(id);
  if(object){object.position.fromArray(entry.position);object.rotation.set(entry.rotation[0],entry.rotation[1],entry.rotation[2]);object.scale.fromArray(entry.scale);}
  else builder.add(entry);
 }
 return true;
}
