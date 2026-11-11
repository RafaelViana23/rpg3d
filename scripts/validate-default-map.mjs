import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const expected=JSON.parse(await readFile('src/editor/default-map.json','utf8'));
 const city=JSON.parse(await readFile('src/editor/default-city.json','utf8'));
 assert.deepEqual(city.city,expected.city);
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const {WorldEditorStore}=await server.ssrLoadModule('/src/editor/WorldEditorSupport.ts');
 const fresh=new WorldEditorStore('test');assert.deepEqual(fresh.state,expected,'A new save uses the complete approved snapshot, including assets and terrain');
 const current=structuredClone(expected);const gate=Object.values(current.city).find(o=>o.kind==='gate');gate.position[0]+=1.23456789;
 data.set('existing',JSON.stringify(current));const existing=new WorldEditorStore('existing');assert.deepEqual(existing.state.city,current.city);assert.deepEqual(existing.state.assets,current.assets);
 fresh.state.assets['dock-lake-group'].position[1]+=3;
 assert.deepEqual(new WorldEditorStore('other').state,expected,'Independent saves never mutate the bundled default');
 const main=await readFile('src/main.ts','utf8');assert(!main.includes('saved.position[1]=0'));assert(!main.includes('JSON.stringify(recoveredMap)'));assert(!main.includes('if(clearAvenueHouses('));
 console.log('Default integral aprovado, posições e escala exatas, doca preservada e saves existentes sem substituição validados.');
}finally{await server.close();}
