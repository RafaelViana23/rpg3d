import { INVENTORY_CATALOG, ITEM_BY_ID } from './catalog';
import type { InventoryItem, PersistedInventory } from './types';

export type MerchantKind='weapons'|'potions'|'tavern'|'inn'|'shop'|'stable';
export const MERCHANT_TITLES:Record<MerchantKind,string>={stable:'Cavalariça',weapons:'Loja de armas',potions:'Loja de poções',tavern:'Taverna',inn:'Pousada',shop:'Loja'};
export const TAVERN_ITEM_IDS=['bread','ragout','grapes','apple','deer-meat','rabbit-meat','water-flask'];
export function merchantItems(kind:MerchantKind):InventoryItem[]{
  if(kind==='stable')return [];
  return INVENTORY_CATALOG.filter(item=>kind==='weapons'?item.category==='weapon'||item.category==='armor'&&!!item.stats.defense:
    kind==='potions'?item.category==='consumable'&&!TAVERN_ITEM_IDS.includes(item.id):
    kind==='tavern'||kind==='inn'?TAVERN_ITEM_IDS.includes(item.id):item.category!=='magic');
}
/** One unit has the same price on both sides of a trade. */
export function itemPrice(item:InventoryItem){
  const rarity={Comum:1,Incomum:2,Raro:4,'Épico':7,'Lendário':12}[item.rarity];
  const base={weapon:18,armor:14,accessory:16,consumable:4,material:3,magic:30}[item.category];
  return Math.max(1,Math.round(base*rarity));
}
export function tradeItem(state:PersistedInventory,kind:MerchantKind,itemId:string,side:'buy'|'sell'):{ok:boolean;message:string}{
  const item=ITEM_BY_ID.get(itemId);
  if(!item)return {ok:false,message:'Item indisponível.'};
  if(side==='buy'&&!merchantItems(kind).some(i=>i.id===itemId))return {ok:false,message:'Este comerciante não vende esse item.'};
  const price=itemPrice(item),quantity=state.quantities[itemId]??0;
  if(!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(state.gold)||state.gold<0)return {ok:false,message:'Saldo inválido.'};
  if(side==='buy'&&state.gold<price)return {ok:false,message:'Ouro insuficiente.'};
  if(side==='sell'&&quantity<1)return {ok:false,message:'Você não tem esse item.'};
  if(!Number.isSafeInteger(state.gold+(side==='sell'?price:-price))||!Number.isSafeInteger(quantity+1))return {ok:false,message:'Limite de saldo atingido.'};
  state.gold+=side==='buy'?-price:price;state.quantities[itemId]=quantity+(side==='buy'?1:-1);
  if(state.quantities[itemId]===0){
    for(const slot of Object.keys(state.equipped) as (keyof typeof state.equipped)[])if(state.equipped[slot]===itemId)delete state.equipped[slot];
    state.quickSlots=state.quickSlots.map(id=>id===itemId?null:id);
  }
  return {ok:true,message:`${side==='buy'?'Comprado':'Vendido'}: ${item.name} · ${price} ouro`};
}
