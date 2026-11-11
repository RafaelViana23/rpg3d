import layout from './secondary-avenues-layout.json';
import type {SavedCityObject} from './WorldEditorSupport';
import type {LowPolyCityBuilder} from './LowPolyCityBuilder';

/** Clear two extra gate approaches once and preserve subsequent Build edits. */
export function applySecondaryAvenuesLayout(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
 const road=saved['city-royal-avenue-v1'];
 if(!road||road.secondaryAvenues?.revision===1)return false;
 for(const [id,value]of Object.entries(layout.moves)){
  if(!saved[id])continue;
  const entry=structuredClone(value) as SavedCityObject;saved[id]=entry;
  const object=builder.objects.get(id);
  if(id===road.id){object?.removeFromParent();builder.objects.delete(id);builder.add(entry);}
  else if(object){object.position.fromArray(entry.position);object.rotation.set(entry.rotation[0],entry.rotation[1],entry.rotation[2]);object.scale.fromArray(entry.scale);}
  else builder.add(entry);
 }
 return true;
}
