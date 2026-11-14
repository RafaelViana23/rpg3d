import assert from 'node:assert/strict';
import { createServer } from 'vite';

const previousDocument = globalThis.document, previousStorage = globalThis.localStorage;
const previousWindow = globalThis.window, previousRAF = globalThis.requestAnimationFrame;
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { initializeMarineLife } = await server.ssrLoadModule('/src/world/MarineLife.ts');
  const scene = new THREE.Scene(), callbacks = [], requests = [];
  const character = { group: new THREE.Group() };
  let qualityLevel = 'high', ready = false;
  const water = { getBiomeAt: () => 'Mar', getHeightAt: () => -10, getWaterLevelAt: () => 0, isWaterAt: () => true };
  const seaWaterMaterial = new THREE.MeshPhysicalMaterial();
  const marine = initializeMarineLife({
    loadSharedGltf: (url, callback) => { requests.push(url); callbacks.push(callback); },
    scene, seaCenter: new THREE.Vector3(0, 0, -17.5), openWorld: water, character,
    seaWaterMaterial, camera: new THREE.PerspectiveCamera(),
    get qualityLevel() { return qualityLevel; },
    get inventoryState() { assert.ok(ready, 'Inventory must stay lazy during initialization'); return { hp: 100 }; },
    get totalStats() { assert.ok(ready, 'Stats must stay lazy during initialization'); return () => ({ defense: 0 }); },
    playerDodgingHit: () => false, resolveWorldCollisions: () => {},
    gameAudio: { hit: () => {} }, showPlayerDamage: () => {}, refreshHud: () => {}, setPlayStatus: () => {},
  });
  assert.equal(requests.length, 45);
  assert.ok(requests.slice(0, 5).every(url => url.includes('/shark/')));
  assert.ok(requests.slice(5).every(url => url.includes('/trout/')));
  const school = scene.children.find(child => child.isInstancedMesh);
  assert.equal(school.count, 260);
  assert.equal(school.instanceMatrix.usage, THREE.DynamicDrawUsage);
  ready = true;
  for (const callback of callbacks) {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    callback({ scene: model, animations: [] });
  }
  assert.equal(scene.children.filter(child => child.userData.animalModel).length, 45);
  const shark = scene.children.find(child => child.name === 'Tubarão 1');
  character.group.position.copy(shark.position).add(new THREE.Vector3(80, 0, 0));
  qualityLevel = 'low'; marine.updateMarineLife(0, 1);
  assert.equal(shark.visible, false);
  qualityLevel = 'high'; marine.updateMarineLife(0, 1);
  assert.equal(shark.visible, true, 'Quality remains a live reference');
  const version = school.instanceMatrix.version;
  marine.updateSchoolFish(2);
  assert.equal(school.instanceMatrix.version, version + 1);
  assert.ok(Math.abs(seaWaterMaterial.opacity - (.72 + Math.sin(1.4) * .045)) < 1e-12);
  console.log('Marine extraction: initialization order, deferred dependencies, 45 models, 260 instances, live quality and shared water material: OK');
  const { initializePreyAnimals } = await server.ssrLoadModule('/src/world/PreyAnimals.ts');
  const pendingPrey = [], preyHud = [];
  const stored = new Map();
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  globalThis.document = { createElement: () => ({
    className: '', innerHTML: '', querySelector: () => ({ style: {} }), classList: { toggle: () => {} },
  }) };
  const { loadInventory } = await server.ssrLoadModule('/src/inventory/persistence.ts');
  const inventory = loadInventory();
  let attack = 7, hudRefreshes = 0, preyReady = false;
  const land = { getBiomeAt: () => 'Floresta', getHeightAt: () => 0, getWaterLevelAt: () => -10, isWaterAt: () => false };
  const prey = initializePreyAnimals({
    openWorld: land, loadSharedGltf: (url, callback) => pendingPrey.push({ url, callback }),
    scene: new THREE.Scene(), viewport: { append: element => preyHud.push(element) },
    buildState: { worldPreset: 'arena-island-v1' }, LEGACY_CITY_CONTENT_ENABLED: false,
    gltfLoader: { load: () => assert.fail('Legacy cat loading must stay disabled') },
    character, gameAudio: { hit: () => {} }, setPlayStatus: () => {},
    get totalStats() { assert.ok(preyReady); return () => ({ attack }); },
    get inventoryState() { assert.ok(preyReady); return inventory; },
    refreshHud: () => hudRefreshes++,
  });
  assert.equal(prey.preyAnimals.length, 0, 'Loading remains deferred');
  assert.ok(pendingPrey.length > 40);
  preyReady = true;
  const deerRequest = pendingPrey.find(entry => entry.url.includes('/deer/'));
  const deerModel = new THREE.Group();
  deerModel.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  deerRequest.callback({ scene: deerModel, animations: [] });
  const deer = prey.preyAnimals[0], sharedList = prey.preyAnimals;
  assert.equal(preyHud.length, 1);
  assert.equal(deer.root.userData.habitat, 'Mundo selvagem');
  assert.equal(deer.position.distanceTo(deer.root.position), 0);
  character.group.position.copy(deer.position);
  let hp = deer.hp;
  prey.hitNearestPrey(); assert.equal(deer.hp, hp - 7);
  attack = 11; hp = deer.hp;
  prey.hitNearestPrey(); assert.equal(deer.hp, hp - 11, 'Attack uses the live stats callback');
  prey.damagePrey(deer, deer.hp);
  assert.equal(deer.hp, 0); assert.equal(deer.deathElapsed, 0);
  assert.ok(deer.loot.some(item => item.itemId === 'deer-meat'));
  assert.equal(inventory.xp, 20); assert.equal(hudRefreshes, 1);
  assert.ok(stored.has('rpg3d.inventory.v1'));
  assert.equal(prey.preyAnimals, sharedList);
  assert.equal(prey.preyAnimals[0], deer, 'Combat and loot keep the same entity');
  console.log('Prey extraction: deferred loading, original habitats, shared entities, live attack, death, loot, XP and persistence: OK');

  const { initializePlayerEquipment } = await server.ssrLoadModule('/src/inventory/PlayerEquipment.ts');
  const { ITEM_BY_ID, INVENTORY_CATALOG } = await server.ssrLoadModule('/src/inventory/catalog.ts');
  const armor = INVENTORY_CATALOG.find(item => item.slot === 'armor');
  const equipmentInventory = loadInventory(); equipmentInventory.equipped = { torso: armor.id };
  const quickButtons = Array.from({ length: 4 }, (_, index) => {
    const states = new Map(), parts = { span: { style: {} }, b: {}, em: {} };
    return { dataset: { quickSlot: String(index) }, states,
      classList: { toggle: (name, value) => states.set(name, value) }, querySelector: tag => parts[tag] };
  });
  globalThis.document = {
    querySelectorAll: selector => selector === '[data-quick-slot]' ? quickButtons : [],
    querySelector: selector => selector.startsWith('[data-item-id=') ? null : ({ childNodes: [{}], textContent: '' }),
  };
  const calls = [], playerGroup = new THREE.Group(), visual = new THREE.Group();
  const player = new Proxy({ group: playerGroup }, { get: (target, key) => key in target ? target[key] : (...args) => calls.push([key, ...args]) });
  const flight = { flying: false, pitch: .5, fall: 0, mounted: false, active: { state: 'attack' } };
  const keys = new Set(['KeyW']);
  const equipmentContext = {
    inventoryState: equipmentInventory, character: player,
    get broomFlying() { return flight.flying; }, set broomFlying(value) { flight.flying = value; },
    broomMountVisual: visual, controls: {}, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(),
    openWorld: { setFlightOverview: value => calls.push(['flightOverview', value]), setEditorOverview: () => {}, update: () => {} },
    buildMode: false, buildState: { worldPreset: 'arena-island-v1' }, gameAudio: { setFlight: () => {} },
    get broomAimPitch() { return flight.pitch; }, set broomAimPitch(value) { flight.pitch = value; },
    get broomFallVelocity() { return flight.fall; }, set broomFallVelocity(value) { flight.fall = value; },
    playerGroundHeightAt: () => 0, PLAYER_GROUND_OFFSET: -.06, mountDebug: { legSpread: .35 },
    setAnimation: state => calls.push(['animation', state]), setPlayStatus: () => {},
    get mounted() { return flight.mounted; }, toggleMount: () => { flight.mounted = !flight.mounted; return true; },
    broomImpact: { reset: () => calls.push(['impactReset']) },
    get activeAction() { return flight.active; }, set activeAction(value) { flight.active = value; },
    pressed: keys, applyNimbusArmDebug: () => {}, applyBroomRideDebug: () => {},
    equippedDecorations: new THREE.Group(), createHeldNimbusInstance: () => new THREE.Group(), mageHoodRoot: null,
  };
  const equipment = initializePlayerEquipment(equipmentContext), sharedEquipment = equipment.equippedItems;
  assert.equal(sharedEquipment.get('armor'), armor.id); assert.equal(sharedEquipment.has('torso'), false);
  assert.equal(equipment.totalStats().defense, ITEM_BY_ID.get(armor.id).stats.defense ?? 0);
  assert.equal(equipment.toggleBroomFlight(), false, 'Flight requires equipped Nimbus');
  equipment.equipItem(ITEM_BY_ID.get('nimbus-2000'), 'rightHand');
  assert.equal(equipment.equippedItems, sharedEquipment);
  assert.equal(equipmentInventory.equipped.rightHand, 'nimbus-2000');
  assert.equal(equipment.toggleBroomFlight(), true);
  assert.equal(flight.flying, true); assert.equal(flight.active, null); assert.equal(keys.size, 0);
  assert.equal(visual.visible, true); assert.equal(equipmentContext.controls.minDistance, 2);
  assert.equal(equipment.toggleBroomFlight(), true);
  assert.equal(flight.flying, false); assert.equal(flight.pitch, 0); assert.equal(flight.fall, -1);
  assert.equal(visual.visible, false); assert.equal(equipmentContext.controls.minDistance, 3.5);
  assert.deepEqual(calls.filter(call => call[0] === 'animation'), [['animation', 'mounted'], ['animation', 'idle']]);
  equipment.selectedQuickSlot = 2; equipment.refreshQuickSlots();
  assert.equal(quickButtons[2].states.get('selected'), true);
  equipment.draggedItem = { id: armor.id, source: 'inventory' };
  assert.equal(equipment.draggedItem.id, armor.id);
  equipment.unequipSlot('rightHand'); assert.equal(sharedEquipment.has('rightHand'), false);
  console.log('Equipment extraction: shared equipment map, migration, stats, persistence, live flight state, camera, keys and quick-slot accessors: OK');

  globalThis.document = previousDocument;
  const { initializeBuildEditor } = await server.ssrLoadModule('/src/editor/BuildEditor.ts');
  const nodes = new Map(), frames = [], timers = new Set();
  const element = () => {
    const classes = new Set(), listeners = new Map();
    const node = { style: {}, dataset: {}, value: '', textContent: '', children: [], listeners,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
        toggle: (name, force) => { const value = force ?? !classes.has(name); if (value) classes.add(name); else classes.delete(name); return value; } },
      addEventListener: (name, callback) => { const list = listeners.get(name) ?? []; list.push(callback); listeners.set(name, list); },
      removeEventListener: () => {}, setAttribute: () => {}, querySelectorAll: () => [],
      querySelector: () => element(), remove: () => {},
      append: (...children) => node.children.push(...children), prepend: (...children) => node.children.unshift(...children),
      replaceChildren: (...children) => { node.children = children; },
    };
    return node;
  };
  globalThis.document = { body: element(), createElement: element, querySelectorAll: () => [],
    querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); } };
  globalThis.window = { addEventListener: () => {}, setInterval: callback => { timers.add(callback); return callback; }, clearInterval: id => timers.delete(id) };
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  const buildScene = new THREE.Scene(), floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 35), new THREE.MeshStandardMaterial());
  const grid = new THREE.GridHelper(), city = new THREE.Group(), inputState = new Set(['KeyW']);
  const state = { mapWidth: 50.125, mapDepth: 35.25, city: {}, assets: {}, removedAssets: [], forestErasures: [], worldPreset: 'arena-island-v1' };
  const stateBefore = JSON.stringify(state), buildCalls = [];
  let lateReady = false;
  const buildContext = {
    camera: new THREE.PerspectiveCamera(), renderer: { domElement: element() }, scene: buildScene,
    cityBuilder: { root: city, objects: new Map() },
    get character() { assert.ok(lateReady, 'Character must not be read before its original initialization'); return player; },
    cityFloor: {}, get cityResidents() { assert.ok(lateReady); return {}; },
    updateCityFloor: () => {}, buildState: state,
    openWorld: { setEditorOverview: value => buildCalls.push(['overview', value]), getHeightAt: () => 0,
      configureForestEditor: () => {}, getBiomeModels: () => [], getEditableForestAssets: () => [], groundBiomeRock: () => {} },
    worldEditorStore: {}, saveBuildState: () => buildCalls.push(['save']), grid, floor,
    protectedBuildAssets: new Set(['LobbyCharacter', 'Horse']), setPlayStatus: () => {}, controls: { target: new THREE.Vector3() },
    get preySystem() { assert.ok(lateReady); return prey; },
    get setInventoryOpen() { assert.ok(lateReady); return open => buildCalls.push(['inventory', open]); },
    get pressed() { assert.ok(lateReady); return inputState; },
    get playerGroundHeightAt() { assert.ok(lateReady); return () => 4; },
    PLAYER_GROUND_OFFSET: -.06, snapCameraToPlayer: () => buildCalls.push(['snap']), saveRuntimeWorld: () => {},
  };
  const buildEditor = initializeBuildEditor(buildContext);
  assert.equal(JSON.stringify(state), stateBefore, 'Initialization preserves the exact map state');
  assert.equal(buildEditor.buildMode, false); assert.equal(buildEditor.transformControls.space, 'local');
  assert.deepEqual(buildCalls, [['save']], 'Original map-size save occurs during initialization');
  assert.ok(buildScene.getObjectByName('WorldBuilderGizmo'));
  lateReady = true;
  buildEditor.setBuildMode(true);
  assert.equal(buildEditor.buildMode, true); assert.equal(inputState.size, 0); assert.equal(timers.size, 1);
  assert.equal(nodes.get('#buildMode').classList.contains('open'), true);
  buildEditor.setBuildMode(false);
  assert.equal(buildEditor.buildMode, false); assert.equal(timers.size, 0);
  assert.equal(playerGroup.position.y, 3.94); assert.ok(buildCalls.some(call => call[0] === 'snap'));
  const asset = new THREE.Group(); asset.position.set(1.123456789, 2.234567891, 3.345678912); asset.rotation.set(.1, .2, .3); asset.scale.set(2, 3, 4);
  const snapshot = buildEditor.snapshotBuildAsset(asset);
  asset.position.set(9, 9, 9); buildEditor.applySavedBuildAsset(asset, snapshot);
  assert.deepEqual(asset.position.toArray(), snapshot.position); assert.deepEqual(asset.scale.toArray(), snapshot.scale);
  const playerAsset = new THREE.Group(); playerAsset.name = 'LobbyCharacter'; playerAsset.position.set(7, 8, 9);
  buildEditor.applySavedBuildAsset(playerAsset, snapshot);
  assert.deepEqual(playerAsset.position.toArray(), [7, 8, 9], 'Player position remains protected');
  const rendererCallback = () => 'shared-preview'; buildEditor.renderBuildThumbnail = rendererCallback;
  assert.equal(buildEditor.renderBuildThumbnail, rendererCallback);
  const dock = new THREE.Group(); buildEditor.proceduralDockTemplate = dock;
  assert.equal(buildEditor.proceduralDockTemplate, dock);
  buildEditor.transformControls.dispose();
  console.log('Build extraction: deferred dependencies, initialization/save order, exact map state, editor events/state, transform round-trip, player protection and shared preview/dock references: OK');

} finally {
  globalThis.document = previousDocument; globalThis.localStorage = previousStorage;
  globalThis.window = previousWindow; globalThis.requestAnimationFrame = previousRAF;
  await server.close();
}
