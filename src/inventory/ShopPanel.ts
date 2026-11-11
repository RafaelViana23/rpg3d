import { buyHorse, horseId, HORSE_PRICE, ownsHorse, stableHorses } from '../player/HorseCommerce';
import { itemThumbnail, refreshItemThumbnails, watchItemThumbnails } from './ItemThumbnails';
import { INVENTORY_CATALOG } from './catalog';
import { itemPrice, merchantItems, MERCHANT_TITLES, tradeItem, type MerchantKind } from './commerce';
import type { PersistedInventory } from './types';
export type MerchantSession={id:string;name:string;kind:MerchantKind;workId?:string};
export class ShopPanel{
  readonly element=document.createElement('section');
  merchant:MerchantSession|null=null;
  private tab:'buy'|'sell'='buy';
  private message='';
  get open(){return this.merchant!==null;}
  constructor(parent:HTMLElement,private state:PersistedInventory,private available:(id:string)=>boolean,private changed:()=>void){
    this.element.className='city-shop';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Comprar e vender');parent.append(this.element);watchItemThumbnails(this.element);
    this.element.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||!this.merchant)return;
      if(button.dataset.close!==undefined){this.close();return;}
      if(button.dataset.tab){this.tab=button.dataset.tab as 'buy'|'sell';this.message='';this.render();return;}
      if(button.dataset.horse){
        if(!this.available(this.merchant.id)){this.close();return;}
        const result=buyHorse(this.state,this.merchant.workId??'',button.dataset.horse);this.message=result.message;
        if(result.ok)this.changed();this.render();return;
      }
      if(button.dataset.trade){
        if(!this.available(this.merchant.id)){this.close();return;}
        const result=tradeItem(this.state,this.merchant.kind,button.dataset.trade,this.tab);this.message=result.message;
        if(result.ok)this.changed();this.render();
      }
    });
  }
  show(merchant:MerchantSession){this.merchant=merchant;this.tab='buy';this.message='';this.render();this.element.hidden=false;this.element.querySelector<HTMLButtonElement>('button')?.focus();}
  close(){this.merchant=null;this.element.hidden=true;}
  update(){if(this.merchant&&!this.available(this.merchant.id))this.close();}
  private render(){
    const merchant=this.merchant;if(!merchant)return;
    const scroll=this.element.querySelector<HTMLElement>('.city-shop-items')?.scrollTop??0;
    if(merchant.kind==='stable'){
      const horses=stableHorses(merchant.workId??'');
      this.element.innerHTML=`<header><div><small>Cavalariço</small><h2>${merchant.name}</h2></div><button data-close aria-label="Fechar cavalariça">Fechar · Esc</button></header><div class="city-shop-wallet">Seu ouro: <b>${this.state.gold.toLocaleString('pt-BR')}</b></div><p class="city-shop-notice">Compre um cavalo para liberar a montaria com E.</p><div class="city-shop-items">${horses.map((horse,i)=>`<div class="city-shop-row"><div><b>Cavalo ${i+1}</b><small>${ownsHorse(this.state,horse)?'Seu cavalo · montaria liberada':'Cavalo da cavalariça'}</small></div><strong>${HORSE_PRICE} ouro</strong><button data-horse="${horseId(horse)}" ${ownsHorse(this.state,horse)||this.state.gold<HORSE_PRICE?'disabled':''}>${ownsHorse(this.state,horse)?'Comprado':'Comprar cavalo'}</button></div>`).join('')||'<p>Os cavalos estão sendo preparados. Volte em instantes.</p>'}</div><p class="city-shop-feedback" role="status">${this.message}</p>`;
      return;
    }
    const items=this.tab==='buy'?merchantItems(merchant.kind):INVENTORY_CATALOG.filter(i=>(this.state.quantities[i.id]??0)>0);
    this.element.innerHTML=`<header><div><small>${MERCHANT_TITLES[merchant.kind]}</small><h2>${merchant.name}</h2></div><button data-close aria-label="Fechar loja">Fechar · Esc</button></header><div class="city-shop-wallet">Seu ouro: <b>${this.state.gold.toLocaleString('pt-BR')}</b></div><nav><button data-tab="buy" aria-pressed="${this.tab==='buy'}">Comprar</button><button data-tab="sell" aria-pressed="${this.tab==='sell'}">Vender</button></nav><p class="city-shop-notice">Preço por unidade · compra e venda pelo mesmo valor</p><div class="city-shop-items">${items.map(item=>`<div class="city-shop-row">${itemThumbnail(item.id)}<div><b>${item.name}</b><small>Você tem: ${this.state.quantities[item.id]??0}${Object.values(this.state.equipped).includes(item.id)?' · Equipado':''}</small></div><strong>${itemPrice(item)} ouro</strong><button data-trade="${item.id}" ${this.tab==='buy'&&this.state.gold<itemPrice(item)?'disabled':''}>${this.tab==='buy'?'Comprar':'Vender'} 1</button></div>`).join('')||'<p>Nenhum item para vender.</p>'}</div><p class="city-shop-feedback" role="status">${this.message}</p>`;
    refreshItemThumbnails(this.element);
    const list=this.element.querySelector<HTMLElement>('.city-shop-items');if(list)list.scrollTop=scroll;
  }
}
