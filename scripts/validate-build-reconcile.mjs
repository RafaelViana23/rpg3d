import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const builder=new LowPolyCityBuilder(new T.Scene(),()=>0);
 let additions=0;
 builder.add=function(saved){
  additions++;const object=new T.Group();
  const {position,rotation,scale,...shape}=saved;
  object.userData.cityBuildShape=JSON.stringify(shape);
  object.position.fromArray(position);object.rotation.set(...rotation);object.scale.fromArray(scale);
  this.root.add(object);this.objects.set(saved.id,object);return object;
 };
 const saved=Object.fromEntries(Array.from({length:250},(_,i)=>[String(i),{id:String(i),kind:'house',layer:'Cidade',position:[i,0,0],rotation:[0,0,0],scale:[1,1,1]}]));
 builder.reconcile(saved);const original=builder.objects.get('0');const prop=new T.Group();original.add(prop);
 saved['0'].position=[12.123456789,4,5];builder.reconcile(saved);
 assert.equal(additions,250,'Transform undo must not reconstruct any buildings');
 assert.equal(builder.objects.get('0'),original);assert.equal(prop.parent,original);
 assert.deepEqual(original.position.toArray(),saved['0'].position);
 assert.equal(builder.reconcile(saved),false,'Unchanged state does no work');
 saved['1'].kind='tower';builder.reconcile(saved);assert.equal(additions,251);
 const removed=builder.objects.get('2');delete saved['2'];builder.reconcile(saved);assert.equal(removed.parent,null);
 saved['2']={...saved['3'],id:'2'};builder.reconcile(saved);assert.equal(additions,252);
 console.log('Undo reconciliation: 250 buildings retained on transform; exact coordinates, props, structural edits, removal and restoration verified.');
}finally{await server.close();}
