import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/saves/snapshot.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { captureSave, restoreSave, validateSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const storage = new MemoryStorage();
const map = await readFile(new URL('../src/editor/default-map.json', import.meta.url), 'utf8');
storage.setItem('rpg3d.worldBuilder.v1', map);
storage.setItem('rpg3d.inventory.v1', '{"gold":123}');
storage.setItem('sb-project-auth-token', 'secret');
storage.setItem('unrelated', 'keep');
const snapshot = captureSave(storage, 'http://localhost:5173');
validateSnapshot(snapshot);
assert.equal(snapshot.entries['rpg3d.worldBuilder.v1'], map, 'Exact coordinates and JSON must survive capture');
assert.equal(snapshot.entries['sb-project-auth-token'], undefined, 'Auth tokens must not be uploaded');
assert.throws(() => validateSnapshot({ ...snapshot, entries: { ...snapshot.entries, unrelated: 'bad' } }));
assert.throws(() => validateSnapshot({ ...snapshot, entries: {} }));
storage.setItem('rpg3d.inventory.v1', '{"gold":999}');
storage.setItem('rpg3d.new-key', 'remove');
restoreSave(storage, snapshot, 'http://localhost:5173');
assert.equal(storage.getItem('rpg3d.inventory.v1'), '{"gold":123}');
assert.equal(storage.getItem('rpg3d.new-key'), null);
assert.equal(storage.getItem('unrelated'), 'keep');
assert.equal(storage.getItem('sb-project-auth-token'), 'secret');
const backupKey = [...storage.values.keys()].find(key => key.startsWith('rpg3d.cloud.backup.'));
assert.equal(JSON.parse(storage.getItem(backupKey)).entries['rpg3d.inventory.v1'], '{"gold":999}');
assert.equal(captureSave(storage, 'test').entries[backupKey], undefined, 'Backups must not recursively grow');
const before = captureSave(storage, 'test').entries;
const originalSet = storage.setItem.bind(storage);
let failOnce = true;
storage.setItem = (key, value) => { if (key === 'rpg3d.inventory.v1' && failOnce) { failOnce = false; throw new Error('Quota exceeded'); } originalSet(key, value); };
assert.throws(() => restoreSave(storage, snapshot, 'test'), /Quota exceeded/);
assert.deepEqual(captureSave(storage, 'test').entries, before, 'Failed restore must roll back');
console.log('Cloud saves: exact snapshot, token isolation, validation, backup, restore and rollback passed.');
