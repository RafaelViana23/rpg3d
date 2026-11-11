import type { PersistedInventory } from '../inventory/types';
import { rideableHorses, type RideableHorse } from './RideableHorses';
export const HORSE_PRICE=100;
export function horseId(horse:RideableHorse):string|undefined{return horse.root.userData.rideableHorseId??horse.root.userData.buildId;}
export function ownsHorse(state:PersistedInventory,horse:RideableHorse){const id=horseId(horse);return !!id&&Array.isArray(state.ownedHorses)&&state.ownedHorses.includes(id);}
export function stableHorses(stableId:string){return [...rideableHorses.values()].filter(h=>h.root.parent&&h.root.userData.stableId===stableId);}
export function buyHorse(state:PersistedInventory,stableId:string,id:string){
  const horse=stableHorses(stableId).find(h=>horseId(h)===id);
  if(!horse)return {ok:false,message:'Este cavalo não está disponível.'};
  if(ownsHorse(state,horse))return {ok:false,message:'Este cavalo já é seu.'};
  if(!Number.isSafeInteger(state.gold)||state.gold<HORSE_PRICE)return {ok:false,message:'Ouro insuficiente.'};
  state.gold-=HORSE_PRICE;state.ownedHorses=[...(Array.isArray(state.ownedHorses)?state.ownedHorses:[]),id];
  return {ok:true,message:'Cavalo comprado! Aproxime-se dele e aperte E para montar.'};
}
