import type {Object3D} from 'three';
import {INVENTORY_CATALOG,ITEM_BY_ID} from './catalog';
import type {PersistedInventory} from './types';
import {itemThumbnail,refreshItemThumbnails,watchItemThumbnails} from './ItemThumbnails';

/** Transfer one unit; keep both sides in the same persisted inventory snapshot. */
export function transferChestItem(state:PersistedInventory,key:string,id:string,deposit:boolean){
 if(!ITEM_BY_ID.has(id))return false;
 const contents=state.chestInventories??={};
 const chest=contents[key]??={};
 const source=deposit?state.quantities:chest,target=deposit?chest:state.quantities;
 if(!Number.isSafeInteger(source[id])||source[id]<=0)return false;
 source[id]--;target[id]=(target[id]??0)+1;
 // Keep zero inventory entries so default starter items are not granted again on load.
 if(!source[id]&&!deposit)delete source[id];
 return true;
}
export class ChestInventory{
 readonly element=document.createElement('section');
 private chest:Object3D|null=null;
 private key='';
 get open(){return this.chest!==null;}
 constructor(parent:HTMLElement,private state:PersistedInventory,private changed:()=>void){
  this.element.className='corpse-loot chest-inventory';this.element.setAttribute('role','dialog');
  this.element.setAttribute('aria-label','Inventário do baú');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-hidden','true');
  this.element.innerHTML='<header><div><small>INVESTIGAR</small></div></header><div class="chest-columns"><section><h3>BAÚ</h3><div data-chest-items></div></section><section><h3>MEUS ITENS</h3><div data-player-items></div></section></div><footer><button type="button" data-close-chest>Fechar · E / Esc</button><span>Clique para transferir</span></footer>';
  parent.append(this.element);watchItemThumbnails(this.element);
  this.element.addEventListener('click',event=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
   if(!button)return;
   if(button.hasAttribute('data-close-chest')){this.close();return;}
   const id=button.dataset.chestItem;
   if(!this.chest||!id)return;
   if(transferChestItem(this.state,this.key,id,button.dataset.deposit==='true')){this.changed();this.render();}
  });
 }
 show(chest:Object3D){
  this.close();this.chest=chest;
  const parts:string[]=[];let node:Object3D|null=chest;
  while(node){
   if(node.userData.cityId){parts.push(node.userData.cityId);break;}
   parts.push(`${node.name}:${node.position.toArray().join(',')}`);
   node=node.parent;
  }
  this.key=parts.reverse().join('/');chest.userData.open=true;
  this.element.classList.add('open');this.element.setAttribute('aria-hidden','false');this.render();
 }
 close(){if(this.chest)this.chest.userData.open=false;this.chest=null;this.element.classList.remove('open');this.element.setAttribute('aria-hidden','true');}
 private render(){
  const contents=this.state.chestInventories?.[this.key]??{};
  const renderItems=(quantities:Record<string,number>,deposit:boolean)=>INVENTORY_CATALOG.filter(item=>(quantities[item.id]??0)>0).map(item=>`<button type="button" data-chest-item="${item.id}" data-deposit="${deposit}" aria-label="${deposit?'Guardar':'Retirar'} ${item.name}"><span>${itemThumbnail(item.id)}</span><b>${item.name}</b><em>×${quantities[item.id]}</em></button>`).join('');
  this.element.querySelector('[data-chest-items]')!.innerHTML=renderItems(contents,false);
  this.element.querySelector('[data-player-items]')!.innerHTML=renderItems(this.state.quantities,true);
  refreshItemThumbnails(this.element);
 }
}
