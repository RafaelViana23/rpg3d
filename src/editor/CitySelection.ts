/** A normal click selects one saved object; Shift toggles it in the selection. */
export function selectCityObject(ids:Set<string>,id:string,additive=false){
 if(!additive){ids.clear();ids.add(id);}
 else if(ids.has(id))ids.delete(id);
 else ids.add(id);
}
