import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createCityAsset}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {clearAvenueHouses,footprintBlocksAvenue,avenueBuildingFootprint}=await server.ssrLoadModule('/src/editor/AvenueClearance.ts');
 const {MedievalCityFloor}=await server.ssrLoadModule('/src/world/MedievalCityFloor.ts');
 const {Scene,Group}=await server.ssrLoadModule('three');
 const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),scene=new Scene(),objects=new Map();
 for(const [id,s]of Object.entries(city)){
  if(['road','path'].includes(s.kind)&&id!=='city-royal-avenue-v1')continue;
  const o=id==='city-royal-avenue-v1'?createRoyalAvenue(s):createCityAsset(s.kind);
  o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);scene.add(o);objects.set(id,o);
 }
 const floor=new MedievalCityFloor(scene);floor.update([...objects].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o));
 const avenue=objects.get('city-royal-avenue-v1');
 const blocked=()=>[...objects].filter(([id,o])=>city[id].kind==='house'&&footprintBlocksAvenue(avenue,avenueBuildingFootprint(o,avenue,.6))).map(([id])=>id);
 const before=blocked();console.log('Casas sobre a avenida no mapa padrão:',JSON.stringify(before));
 const identities=new Map(Object.entries(city).map(([id,s])=>[id,{kind:s.kind,rotation:[...s.rotation],scale:[...s.scale]}]));
 clearAvenueHouses(city,{objects},floor);
 assert.equal(blocked().length,0,'Main avenue, side avenues and central circle remain free of complete house footprints');
 for(const [id,old]of identities){assert.equal(city[id].kind,old.kind);assert.deepEqual(city[id].rotation,old.rotation);assert.deepEqual(city[id].scale,old.scale);}
 assert(!clearAvenueHouses(city,{objects},floor),'Later Build edits are not re-migrated');
 // A roof edge can overlap the road while the centre lies outside it.
 const road=avenue.userData.royalAvenueAreas[0],z=(road[1]+road[3])/2;
 assert(footprintBlocksAvenue(avenue,[{x:road[2]-.2,z:z-2},{x:road[2]+8,z:z-2},{x:road[2]+8,z:z+2},{x:road[2]-.2,z:z+2}]));
 const houseID=Object.keys(city).find(id=>city[id].kind==='house'),house=objects.get(houseID),original=house.position.clone();
 delete city['city-royal-avenue-v1'].avenueClearanceRevision;
 const point=avenue.localToWorld(new (original.constructor)(0,0,z));house.position.x=point.x;house.position.z=point.z;city[houseID].position=house.position.toArray();
 clearAvenueHouses(city,{objects},floor);assert.equal(blocked().length,0,'Saved houses in the road are also repaired');assert(house.position.distanceTo(original)>0);
 console.log('Avenidas livres, limites completos dos telhados, reparo dos saves e preservação das identidades validados.');
}finally{await server.close();}
