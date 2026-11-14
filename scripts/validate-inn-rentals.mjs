import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createSelenaInn}=await server.ssrLoadModule('/src/editor/SelenaInn.ts');
 const {innRoomOffers,rentInnRoom,innRentalActive}=await server.ssrLoadModule('/src/inventory/InnRooms.ts');
 const {merchantItems,tradeItem}=await server.ssrLoadModule('/src/inventory/commerce.ts');
 const rooms=innRoomOffers(createSelenaInn().userData.innRooms);assert.equal(rooms.length,6);
 assert.equal(rooms.find(r=>r.name.includes('Suíte')).price,100);assert.equal(rooms.find(r=>r.beds===2).price,20);assert.equal(rooms.find(r=>r.beds===1&&r.price!==100).price,50);
 assert(rooms.some(room=>room.name.includes('Suíte')));assert(!rooms.some(room=>room.id==='room-3'));
 const state={gold:100,worldDay:4,worldTime:.5,quantities:{beer:1},equipped:{},quickSlots:[]};
 assert.deepEqual(merchantItems('lodging'),[]);assert(!tradeItem(state,'lodging','beer','buy').ok);assert(!tradeItem(state,'lodging','beer','sell').ok);
 const room=rooms.find(r=>r.price===50);assert(rentInnRoom(state,'inn',rooms,room.id).ok);assert.equal(state.gold,50);assert(innRentalActive(state,'inn'));assert(!rentInnRoom(state,'inn',rooms,room.id).ok);assert.equal(state.gold,50);
 const restored=JSON.parse(JSON.stringify(state));assert(innRentalActive(restored,'inn'));restored.worldDay=5;restored.worldTime=.51;assert(!innRentalActive(restored,'inn'));assert(rentInnRoom(restored,'inn',rooms,room.id).ok);
 state.gold=0;assert(!rentInnRoom(state,'other',rooms,room.id).ok);
 console.log('Six rentable rooms, Selena single reserved, noble suite available; single/double/suite prices, payment, persisted daily rental, expiry and no item trade: OK.');
}finally{await server.close();}
