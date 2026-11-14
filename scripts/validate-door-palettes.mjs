import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const T = await server.ssrLoadModule('three');
  const { applyCityWood, cityWoodMaterial, CITY_WOOD_MATERIAL } = await server.ssrLoadModule('/src/editor/CityWood.ts');
  const atlas = new T.DataTexture(new Uint8Array([107, 74, 47, 255, 255, 0, 255, 255]), 2, 1);
  atlas.colorSpace = T.SRGBColorSpace;
  atlas.minFilter = T.LinearMipmapLinearFilter;
  atlas.magFilter = T.LinearFilter;
  atlas.generateMipmaps = true;
  atlas.flipY = false;
  const original = new T.MeshStandardMaterial({ name: 'mdvl_palette', map: atlas });
  const ordinary = cityWoodMaterial(original);
  let palette;
  for (const pack of ['village-door', 'church-door']) {
    const bytes = await readFile(`public/models/city/props/${pack}.glb`);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.materials[0].name, original.name);
    assert.equal(gltf.samplers[0].minFilter, 9987, 'Original door atlas uses mipmaps');
    const metal = new T.MeshStandardMaterial({ name: 'Metal', color: '#51565b' });
    const root = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(), [original, metal]);
    root.add(mesh);
    applyCityWood(root, pack);
    const painted = mesh.material[0];
    assert.notEqual(painted, ordinary, 'Door filtering must not change other assets');
    assert.equal(mesh.material[1], metal, 'Separate metal material is untouched');
    assert.equal(painted.map.minFilter, T.NearestFilter);
    assert.equal(painted.map.magFilter, T.NearestFilter);
    assert.equal(painted.map.generateMipmaps, false);
    assert.equal(painted.map.source, atlas.source, 'Original wood and iron atlas pixels are retained');
    assert.equal(painted.map.colorSpace, atlas.colorSpace);
    assert.equal(painted.map.flipY, atlas.flipY);
    assert.notEqual(painted.map, atlas);
    if (palette) assert.equal(painted.map, palette, 'Door instances reuse one stabilized texture');
    palette = painted.map;
    const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>' };
    painted.onBeforeCompile(shader);
    assert.equal(shader.uniforms.cityWoodColor.value, CITY_WOOD_MATERIAL.color);
    assert.ok(shader.fragmentShader.includes('if(wooden)diffuseColor.rgb=cityWoodColor;'), 'Iron atlas regions keep their original colors');
  }
  assert.equal(atlas.minFilter, T.LinearMipmapLinearFilter);
  assert.equal(atlas.generateMipmaps, true);
  assert.equal(ordinary.map, atlas);
  assert.equal(cityWoodMaterial(original, true), CITY_WOOD_MATERIAL);
  console.log('Both door palettes: no magenta mipmap bleed, original atlas/metal/colors retained, shared texture cache, other assets unchanged: OK');
} finally {
  await server.close();
}
