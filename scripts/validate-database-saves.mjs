import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const snapshotSource = await readFile(new URL('../src/saves/snapshot.ts', import.meta.url), 'utf8');
const snapshotUrl = moduleUrl(compile(snapshotSource));
const { fingerprint, captureSave } = await import(snapshotUrl);
const clientSource = await readFile(new URL('../src/saves/CloudSaves.ts', import.meta.url), 'utf8');
const { DatabaseSaves } = await import(moduleUrl(compile(clientSource).replace("'./snapshot'", JSON.stringify(snapshotUrl))));
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const storage = new MemoryStorage();
const map = await readFile(new URL('../src/editor/default-map.json', import.meta.url), 'utf8');
storage.setItem('rpg3d.worldBuilder.v1', map);
storage.setItem('rpg3d.inventory.v1', '{"gold":1}');
let remote = { revision: 0, payload: null };
let online = true;
let writes = 0;
const request = async (_url, init) => {
  if (!online) throw new Error('offline');
  if (init.method === 'GET') return Response.json(structuredClone(remote));
  const body = JSON.parse(init.body);
  if (body.expectedRevision !== remote.revision) return Response.json({error:'conflict'}, {status:409});
  writes++;
  remote = { revision: remote.revision + 1, payload: body.payload };
  return Response.json({revision:remote.revision});
};
const options = {storage,origin:'http://localhost:5173',request};
const client = new DatabaseSaves(options);
await client.initialize();
assert.equal(remote.revision, 1, 'Existing save must migrate automatically');
assert.equal(remote.payload.entries['rpg3d.worldBuilder.v1'], map);
const changed = JSON.parse(map);
changed.mapWidth = 987.1234567891234;
const editedMap = JSON.stringify(changed);
storage.setItem('rpg3d.worldBuilder.v1', editedMap);
storage.setItem('rpg3d.inventory.v1', '{"gold":2}');
assert.equal(client.hasMapChanges(), true);
await client.save();
assert.equal(client.hasMapChanges(), true);
assert.equal(remote.payload.entries['rpg3d.worldBuilder.v1'], map, 'Autosave must not publish uncommitted Build changes');
assert.equal(remote.payload.entries['rpg3d.inventory.v1'], '{"gold":2}');
await client.save(true);
assert.equal(client.hasMapChanges(), false);
assert.equal(remote.payload.entries['rpg3d.worldBuilder.v1'], editedMap, 'Build Save must commit the exact map');
const beforeNoop = writes;
await client.save();
assert.equal(writes, beforeNoop, 'No change must not create another revision');
assert.equal(fingerprint({a:'1',b:'2'}), fingerprint({b:'2',a:'1'}));
online = false;
storage.setItem('rpg3d.inventory.v1', '{"gold":3}');
await assert.rejects(client.save(), /offline/);
assert.equal(storage.getItem('rpg3d.inventory.v1'), '{"gold":3}');
online = true;
await client.save();
assert.equal(remote.payload.entries['rpg3d.inventory.v1'], '{"gold":3}');
remote.revision++;
storage.setItem('rpg3d.inventory.v1', '{"gold":4}');
await assert.rejects(client.save(), /conflict/);
assert.equal(storage.getItem('rpg3d.inventory.v1'), '{"gold":4}');
const reopened = new DatabaseSaves(options);
await reopened.initialize();
assert.equal(storage.getItem('rpg3d.inventory.v1'), '{"gold":3}', 'Startup must hydrate from database');
assert.ok([...storage.values.keys()].some(k => k.startsWith('rpg3d.cloud.backup.')), 'Replaced local work must be backed up');
const emptyStorage = new MemoryStorage();
const emptyRemote = new DatabaseSaves({...options,storage:emptyStorage});
await emptyRemote.initialize();
assert.equal(emptyStorage.getItem('rpg3d.worldBuilder.v1'), editedMap, 'Fresh browser must load the DB map');
const savedRemote = remote;
remote = {revision:0,payload:null};
const noDefault = new DatabaseSaves({...options,storage:new MemoryStorage()});
await noDefault.initialize();
await noDefault.save();
assert.equal(remote.revision, 0, 'Empty browser must never seed a default automatically');
remote = savedRemote;
assert.ok(Object.keys(captureSave(storage,'test').entries).every(k=>!k.startsWith('rpg3d.cloud.')));
console.log('Database saves: migration, hydration, manual Build commit, runtime autosave, offline retry, conflict and default protection passed.');
