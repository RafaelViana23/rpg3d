import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Captured from main.ts before extraction. Only random Three.js UUIDs are normalized.
const expected = JSON.parse(await readFile(new URL('./fixtures/item-previews.json', import.meta.url), 'utf8'));
export function previewHash(model) {
  const ids = new Map();
  const json = JSON.stringify(model.toJSON(), (_key, value) => {
    if (typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
      if (!ids.has(value)) ids.set(value, `uuid-${ids.size}`);
      return ids.get(value);
    }
    return value;
  });
  return createHash('sha256').update(json).digest('hex');
}
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { makeItemPreview, clothingFor } = await server.ssrLoadModule('/src/inventory/ItemPreviews.ts');
  const { INVENTORY_CATALOG } = await server.ssrLoadModule('/src/inventory/catalog.ts');
  for (const [type, hash] of Object.entries(expected.previews)) {
    assert.equal(previewHash(makeItemPreview(type)), hash, `Original geometry/materials/transforms: ${type}`);
  }
  assert.deepEqual(Object.fromEntries(INVENTORY_CATALOG.map(item => [item.id, clothingFor(item)])), expected.clothing);
  const first = makeItemPreview('shirt'), second = makeItemPreview('shirt');
  assert.notEqual(first, second);
  assert.equal(first.children[0].material, first.children[1].material);
  assert.notEqual(first.children[0].material, second.children[0].material);
  assert.notEqual(first.children[0].geometry, second.children[0].geometry);
  console.log(`Original previews preserved for ${Object.keys(expected.previews).length} inputs; clothing mapping for ${INVENTORY_CATALOG.length} items; material sharing and instance isolation: OK`);
} finally {
  await server.close();
}
