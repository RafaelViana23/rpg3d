import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const previousDocument = globalThis.document;
try {
  const { initializeGameShell } = await server.ssrLoadModule('/src/ui/GameShell.ts');
  const app = { innerHTML: '' };
  const nodes = initializeGameShell(app);
  assert.equal(nodes.length, 10);
  assert.equal(new Set(nodes.map(([key]) => key)).size, 10);
  for (const id of ['viewport', 'itemTooltip', 'inventoryModal', 'buildBadge']) {
    assert.ok(app.innerHTML.includes(`id="${id}"`), `Missing ${id}`);
  }
  const listeners = new Map();
  const target = {
    dataset: { itemId: 'test-item' },
    addEventListener: (event, callback) => listeners.set(event, callback),
    getBoundingClientRect: () => ({ left: 230, right: 250, top: 20, height: 20 }),
  };
  const classes = new Set();
  const attributes = new Map();
  const tooltip = {
    innerHTML: '', style: {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    setAttribute: (key, value) => attributes.set(key, value),
    getBoundingClientRect: () => ({ width: 100, height: 80 }),
  };
  globalThis.document = {
    querySelector: selector => selector === '#itemTooltip' ? tooltip : {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
    },
    querySelectorAll: () => [target],
  };
  const { ITEM_BY_ID } = await server.ssrLoadModule('/src/inventory/catalog.ts');
  const { initializeItemTooltips } = await server.ssrLoadModule('/src/inventory/ItemTooltips.ts');
  const item = { id: 'test-item', name: 'Teste', description: 'Descrição', slot: 'rightHand', stats: { attack: 10 } };
  const other = { ...item, id: 'test-equipped', name: 'Equipado', stats: { attack: 15 } };
  ITEM_BY_ID.set(item.id, item);
  ITEM_BY_ID.set(other.id, other);
  const equipped = new Map();
  const hide = initializeItemTooltips(equipped);
  assert.deepEqual([...listeners.keys()], ['mouseenter', 'mouseleave', 'focus', 'blur']);
  listeners.get('mouseenter')();
  assert.ok(classes.has('visible'));
  assert.equal(attributes.get('aria-hidden'), 'false');
  assert.ok(!tooltip.innerHTML.includes('Comparado'));
  assert.equal(tooltip.style.left, '120px');
  assert.equal(tooltip.style.top, '8px');
  equipped.set('rightHand', other.id);
  listeners.get('focus')();
  assert.ok(tooltip.innerHTML.includes('class="worse">-5'));
  assert.ok(tooltip.innerHTML.includes('Comparado com Equipado'));
  other.stats.attack = 5;
  listeners.get('mouseenter')();
  assert.ok(tooltip.innerHTML.includes('class="better">+5'));
  for (const dismiss of [hide, listeners.get('mouseleave'), listeners.get('blur')]) {
    dismiss();
    assert.ok(!classes.has('visible'));
    assert.equal(attributes.get('aria-hidden'), 'true');
  }
  target.dataset.itemId = 'missing';
  listeners.get('focus')();
  assert.ok(!classes.has('visible'));
  ITEM_BY_ID.delete(item.id);
  ITEM_BY_ID.delete(other.id);
  console.log('Game shell, tooltip events, live equipment comparisons and edge positioning: OK');
} finally {
  globalThis.document = previousDocument;
  await server.close();
}
