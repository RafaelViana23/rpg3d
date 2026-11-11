import { CITY_WOOD_COLOR, CITY_WOOD_MATERIAL } from '../editor/CityWood';
import { STEEL_ARMOR_COLOR, IRON_ARMOR_COLOR, IRON_METALNESS, IRON_ROUGHNESS, METAL_ENVIRONMENT } from './armorMaterials';
import { clothShirtColor, clothPantsColor } from './clothColors';
import { createSmoothClothMaterial } from './clothMaterial';
import { armorColor } from './armorMaterials';
import * as THREE from "three";
import type { InventoryItem } from "./types";

const mat = (color: string, metalness = 0, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({
    color,
    envMap: metalness > 0 || color === IRON_ARMOR_COLOR ? METAL_ENVIRONMENT : null,
    metalness: color === IRON_ARMOR_COLOR ? IRON_METALNESS : metalness,
    roughness: color === IRON_ARMOR_COLOR ? IRON_ROUGHNESS : roughness,
    flatShading: true,
  });
const mesh = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) => {
  const value = new THREE.Mesh(geometry, material);
  value.position.set(x, y, z);
  value.castShadow = true;
  return value;
};
const addBlade = (
  group: THREE.Group,
  length: number,
  width: number,
  color: string,
  wooden = false,
) => {
  const start = 0.19,
    thickness = 0.055,
    end = start + length,
    tipLength = Math.max(0.14, width * 1.15),
    half = width / 2,
    depth = thickness / 2,
    material = wooden ? CITY_WOOD_MATERIAL : mat(color, .65, .25);
  group.add(
    mesh(
      new THREE.BoxGeometry(length, width, thickness),
      material,
      start + length / 2,
      0,
      0,
    ),
  );
  // Flat triangular prism: the point continues the blade silhouette without
  // turning into the four-sided pyramid produced by ConeGeometry.
  const points = [
    end,
    -half,
    -depth,
    end,
    half,
    -depth,
    end,
    -half,
    depth,
    end,
    half,
    depth,
    end + tipLength,
    0,
    -depth,
    end + tipLength,
    0,
    depth,
  ];
  const tipGeometry = new THREE.BufferGeometry();
  tipGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
  tipGeometry.setIndex([
    0, 1, 4, 2, 5, 3, 0, 4, 5, 0, 5, 2, 1, 3, 5, 1, 5, 4, 0, 2, 3, 0, 3, 1,
  ]);
  tipGeometry.computeVertexNormals();
  group.add(mesh(tipGeometry, material));
};
const weapon = (visual: string) => {
  const group = new THREE.Group(),
    steel = visual === "wooden-sword" ? CITY_WOOD_COLOR : visual.includes("steel") ? STEEL_ARMOR_COLOR : visual.includes("bronze")
      ? "#cd8b42"
      : visual.includes("anneal")
        ? "#86b9c8"
        : visual.includes("iron")
          ? IRON_ARMOR_COLOR
          : "#c6d0d4",
    dark = visual === "wooden-sword" ? CITY_WOOD_MATERIAL : mat("#4a2818"),
    gold = mat("#c6a04c", 0.5, 0.28);
  group.add(
    mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.25, 12), dark, 0, 0, 0),
  );
  group.children[0].rotation.z = Math.PI / 2;
  if (visual === "axe") {
    group.add(
      mesh(new THREE.BoxGeometry(1.05, 0.055, 0.055), dark, 0.38, 0, 0),
      mesh(
        new THREE.ConeGeometry(0.24, 0.46, 4),
        mat(steel, 0.72, 0.25),
        0.9,
        0.16,
        0,
      ),
    );
    group.children[2].rotation.z = -0.3;
  } else if (visual === "hammer") {
    group.add(
      mesh(new THREE.BoxGeometry(1.05, 0.06, 0.06), dark, 0.38, 0, 0),
      mesh(
        new THREE.BoxGeometry(0.28, 0.42, 0.28),
        mat(steel, 0.72, 0.28),
        0.9,
        0,
        0,
      ),
    );
  } else if (visual === "spear") {
    group.add(
      mesh(new THREE.BoxGeometry(1.55, 0.045, 0.045), dark, 0.62, 0, 0),
      mesh(
        new THREE.ConeGeometry(0.11, 0.42, 4),
        mat(steel, 0.8, 0.18),
        1.48,
        0,
        0,
      ),
    );
    group.children[2].rotation.z = -Math.PI / 2;
  } else if (visual === "mace") {
    group.add(
      mesh(new THREE.BoxGeometry(0.86, 0.06, 0.06), dark, 0.3, 0, 0),
      mesh(
        new THREE.DodecahedronGeometry(0.2, 0),
        mat(steel, 0.72, 0.3),
        0.82,
        0,
        0,
      ),
    );
  } else {
    const dagger = visual === "dagger",
      great = visual === "greatsword",
      rapier = visual === "rapier";
    const length = dagger
      ? 0.48
      : great
        ? 1.3
        : rapier
          ? 1.05
          : visual === "shortsword"
            ? 0.68
            : visual === "longsword"
              ? 1.05
              : 0.86;
    addBlade(group, length, great ? 0.16 : rapier ? 0.045 : 0.09, steel, visual === "wooden-sword");
    const guard = mesh(
      new THREE.BoxGeometry(0.08, great ? 0.48 : rapier ? 0.35 : 0.3, 0.09),
      visual === "wooden-sword" ? CITY_WOOD_MATERIAL : gold,
      0.155,
      0,
      0,
    );
    group.add(guard);
  }
  return group;
};

export function createProceduralItem(item: InventoryItem) {
  if (item.visual === "nimbus-2000") {
    const broom = new THREE.Group(), wood = mat("#7b3f19", .05, .48), gold = mat("#d8a83f", .72, .22), straw = mat("#a96b24", 0, .82);
    const shaft = mesh(new THREE.CylinderGeometry(.032, .042, 1.55, 10), wood, .58, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    const collar = mesh(new THREE.TorusGeometry(.095, .027, 7, 14), gold, -.19, 0, 0); collar.rotation.y = Math.PI / 2;
    const brush = mesh(new THREE.ConeGeometry(.2, .58, 10), straw, -.46, 0, 0); brush.rotation.z = -Math.PI / 2;
    broom.add(shaft, collar, brush);
    return broom;
  }
  if (item.visual === "shield") {
    const group = new THREE.Group(),
      steel = mat(IRON_ARMOR_COLOR, IRON_METALNESS, IRON_ROUGHNESS);
    const face = mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.16, 8), steel);
    face.rotation.x = Math.PI / 2;
    group.add(
      face,
      mesh(
        new THREE.SphereGeometry(0.16, 7, 5),
        mat("#c5a04e", 0.55, 0.3),
        0,
        0,
        0.1,
      ),
    );
    group.rotation.set(0.1, -0.45, 0);
    return group;
  }
  if (item.category === "weapon") return weapon(item.visual);
  const equipmentColor = armorColor(item.visual);
  const group = new THREE.Group(),
    steel = clothPantsColor(item.visual) ? mat(clothPantsColor(item.visual), 0, .8) : item.visual === "leather-chest" ? mat(equipmentColor, 0, .78) : mat(equipmentColor, 0.7, 0.26),
    leather = mat("#4a2818"),
    cloth = mat(clothShirtColor(item.visual) ?? (item.visual === "coat" ? "#171b29" : "#f4f1e8")),
    glow = mat(
      item.visual.includes("red")
        ? "#d84b55"
        : item.visual.includes("green")
          ? "#42c47a"
          : "#4da5dd",
      0.2,
      0.2,
    );
  if (item.category === "armor") {
    if (item.slot === "head") {
      if (item.visual === "mage-hood") {
        const hood = mesh(new THREE.ConeGeometry(.56, .92, 8, 1, true), mat("#3f2757", 0, .82), 0, .1, 0);
        hood.rotation.z = Math.PI;
        const collar = mesh(new THREE.TorusGeometry(.48, .13, 6, 12), mat("#54336f", 0, .78), 0, -.38, 0);
        collar.rotation.x = Math.PI / 2;
        group.add(hood, collar);
        group.rotation.set(.1, -.45, -.08);
        return group;
      }
      const dome = mesh(new THREE.SphereGeometry(0.56, 8, 6), steel, 0, 0.05, 0);
      dome.scale.y = 1.08;
      group.add(dome);
      if (item.visual === "iron-helmet")
        group.add(
          mesh(new THREE.BoxGeometry(0.88, 0.42, 0.13), steel, 0, -0.16, .42),
          mesh(new THREE.BoxGeometry(.58, .055, .025), mat("#101417"), 0, -.09, .495),
        );
      else
        group.add(
          mesh(new THREE.TorusGeometry(.47, .055, 5, 12, Math.PI), steel, 0, -.08, .18),
          mesh(new THREE.BoxGeometry(.08, .5, .11), steel, 0, -.14, .48),
        );
    }
    else if (item.slot === "legs") {
      const waist = mesh(new THREE.BoxGeometry(.9, .24, .44), steel, 0, .52, 0);
      group.add(waist);
      for (const x of [-.25, .25]) {
        const thigh = mesh(new THREE.CapsuleGeometry(.18, .62, 3, 6), steel, x, .08, 0);
        const knee = mesh(new THREE.SphereGeometry(.21, 7, 5), steel, x, -.35, .04);
        thigh.scale.z = .78;
        knee.scale.set(1, .72, .8);
        group.add(thigh, knee);
      }
    }
    else if (item.slot === "gloves")
      for (const x of [-0.3, 0.3])
        group.add(
          mesh(
            new THREE.BoxGeometry(0.28, 0.65, 0.25),
            item.visual === "bracers" ? leather : steel,
            x,
            0,
            0,
          ),
        );
    else if (item.visual === "cape") {
      const geometry=new THREE.PlaneGeometry(1,1.3,16,20);
      const positions=geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),drop=(.65-y)/1.3;
        // A single sheet drapes behind the shoulders and widens toward the hem.
        positions.setXYZ(i,x*(.76+drop*.34),y,-.10*drop-.08*(1-4*x*x));
      }
      geometry.computeVertexNormals();
      const cape=mesh(geometry,createSmoothClothMaterial('#254b86'));
      cape.name='Capa de tecido liso';
      group.add(cape);
    } else
      group.add(
        mesh(
          new THREE.BoxGeometry(1, 1.05, 0.42),
          clothShirtColor(item.visual) || item.visual === "coat"
            ? cloth
            : item.visual === "leather"
              ? leather
              : steel,
          0,
          0.15,
          0,
        ),
        mesh(new THREE.SphereGeometry(0.29, 7, 5), steel, -0.62, 0.42, 0),
        mesh(new THREE.SphereGeometry(0.29, 7, 5), steel, 0.62, 0.42, 0),
      );
  } else if (item.category === "accessory") {
    if (item.slot === "boots")
      for (const x of [-0.27, 0.27])
        group.add(
          mesh(new THREE.BoxGeometry(0.3, 0.75, 0.42), leather, x, 0, 0),
        );
    else if (item.visual.startsWith("ring")) {
      const ring = mesh(
        new THREE.TorusGeometry(0.36, 0.09, 6, 16),
        item.visual.includes("red") ? glow : steel,
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    } else if (item.visual.startsWith("belt")) {
      const belt = mesh(new THREE.TorusGeometry(0.56, 0.09, 6, 18), leather);
      belt.rotation.x = Math.PI / 2;
      group.add(
        belt,
        mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), steel, 0, 0, 0.55),
      );
    } else {
      group.add(
        mesh(
          new THREE.TorusGeometry(0.44, 0.035, 6, 18, Math.PI * 1.55),
          steel,
        ),
      );
      group.add(mesh(new THREE.OctahedronGeometry(0.18, 0), glow, 0, -0.42, 0));
    }
  } else if (item.category === "consumable") {
    if (item.visual.includes("crystal"))
      group.add(mesh(new THREE.OctahedronGeometry(0.48, 0), glow));
    else if (item.visual.includes("meat")) {
      const meatMat = mat(
          item.visual === "venison-meat" ? "#8f2d28" : "#c46b62",
          0.05,
          0.7,
        ),
        fat = mat("#e8c6a0");
      group.add(
        mesh(new THREE.BoxGeometry(0.72, 0.28, 0.48), meatMat, 0, 0, 0),
        mesh(new THREE.BoxGeometry(0.18, 0.3, 0.5), fat, -0.28, 0.01, 0),
      );
      group.rotation.z = -0.18;
    } else if (
      item.visual === "bread" ||
      item.visual === "food" ||
      item.visual === "apple"
    )
      group.add(
        mesh(
          item.visual === "apple"
            ? new THREE.SphereGeometry(0.42, 8, 6)
            : new THREE.CapsuleGeometry(0.28, 0.55, 3, 7),
          mat(item.visual === "apple" ? "#bb3932" : "#bc864c"),
        ),
      );
    else
      group.add(
        mesh(new THREE.SphereGeometry(0.4, 8, 6), glow, 0, -0.1, 0),
        mesh(
          new THREE.CylinderGeometry(0.14, 0.2, 0.45, 8),
          mat("#89ccd0", 0.1, 0.2),
          0,
          0.35,
          0,
        ),
        mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.15, 7),
          leather,
          0,
          0.66,
          0,
        ),
      );
  } else {
    if (
      item.visual.includes("ore") ||
      item.visual.includes("crystal") ||
      item.visual === "star"
    )
      group.add(
        mesh(
          new THREE.DodecahedronGeometry(0.48, 0),
          item.visual.includes("red")
            ? glow
            : item.visual.includes("crystal") || item.visual === "star"
              ? mat("#65b6dc", 0.25, 0.2)
              : steel,
        ),
      );
    else if (item.visual === "wood")
      group.add(mesh(new THREE.CylinderGeometry(0.18, 0.24, 1, 7), leather));
    else if (item.visual === "fang" || item.visual === "claw") {
      const tooth = mesh(new THREE.ConeGeometry(0.2, 0.85, 6), mat("#ded8bd"));
      tooth.rotation.z = -0.35;
      group.add(tooth);
    } else
      group.add(
        mesh(
          new THREE.IcosahedronGeometry(0.48, 1),
          item.visual === "material-leather" ? leather : mat("#756457"),
        ),
      );
  }
  group.rotation.set(0.1, -0.45, -0.08);
  return group;
}
