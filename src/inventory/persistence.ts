import {INVENTORY_CATALOG} from './catalog';
import defaultInventory from './default-inventory.json';
import type {PersistedInventory} from './types';

export const INVENTORY_STORAGE_KEY='rpg3d.inventory.v1';
const initial=():PersistedInventory=>({version:1,swordMaterialsRevision:1,level:1,xp:0,gold:0,hp:100,stamina:50,hunger:100,thirst:100,worldTime:8/24,worldDay:1,weather:'clear',weatherIntensity:.8,quantities:{...Object.fromEntries(INVENTORY_CATALOG.map(item=>[item.id,item.quantity])),...defaultInventory.quantities},equipped:{...defaultInventory.equipped},quickSlots:[...defaultInventory.quickSlots]});
export function loadInventory():PersistedInventory {
  try {
    const raw=localStorage.getItem(INVENTORY_STORAGE_KEY);
    const saved=JSON.parse(raw||'null') as PersistedInventory|null;
    if(saved?.version===1){
      if(saved.swordMaterialsRevision!==1){
        // The old bronze sword was identified by the user as the wooden sword.
        // Keep ownership and equipped hands, and supply the two new metal variants once.
        localStorage.setItem('rpg3d.inventory.before-sword-materials.v1',raw!);
        const oldQuantity=saved.quantities['bronze-sword']??0;
        saved.quantities['wooden-sword']=(saved.quantities['wooden-sword']??0)+oldQuantity;
        saved.quantities['bronze-sword']=1;
        saved.quantities['steel-sword']??=1;
        for(const slot of Object.keys(saved.equipped) as (keyof typeof saved.equipped)[])
          if(saved.equipped[slot]==='bronze-sword')saved.equipped[slot]='wooden-sword';
        if(Array.isArray(saved.quickSlots))saved.quickSlots=saved.quickSlots.map(id=>id==='bronze-sword'?'wooden-sword':id);
        saved.swordMaterialsRevision=1;
        saveInventory(saved);
      }
      return {...initial(),...saved,quantities:{...initial().quantities,...saved.quantities},equipped:{...saved.equipped},quickSlots:Array.isArray(saved.quickSlots)?[...saved.quickSlots].slice(0,4):initial().quickSlots};
    }
  } catch {/* use defaults */}
  return initial();
}
export function saveInventory(state:PersistedInventory){localStorage.setItem(INVENTORY_STORAGE_KEY,JSON.stringify(state));}
