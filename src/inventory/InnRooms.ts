import type {InnRoom} from '../editor/SelenaInn';
import type {PersistedInventory} from './types';
export type InnRoomOffer={id:string;name:string;floor:number;price:number;beds:number};
export function innRoomOffers(rooms:InnRoom[]):InnRoomOffer[]{
 return rooms.map((room,i)=>({room,i})).filter(({room})=>!room.bath&&!room.owner).map(({room,i})=>({id:`room-${i+1}`,name:`${room.name} ${i+1}`,floor:room.y/5,price:room.vip?100:room.beds===1?50:20,beds:room.beds}));
}
export function innRentalActive(state:PersistedInventory,innId:string){
 const rental=state.innRentals?.[innId];
 return rental&&rental.expiresAt>state.worldDay+(state.worldTime%1)?rental:undefined;
}
export function rentInnRoom(state:PersistedInventory,innId:string,rooms:InnRoomOffer[],id:string){
 const room=rooms.find(room=>room.id===id);if(!innId||!room)return {ok:false,message:'Quarto indisponível.'};
 if(innRentalActive(state,innId))return {ok:false,message:'Você já tem um quarto alugado nesta pousada.'};
 if(!Number.isSafeInteger(state.gold)||state.gold<room.price)return {ok:false,message:'Ouro insuficiente.'};
 state.gold-=room.price;
 (state.innRentals??={})[innId]={roomId:id,expiresAt:state.worldDay+(state.worldTime%1)+1};
 return {ok:true,message:`${room.name} alugado por uma diária.`};
}
