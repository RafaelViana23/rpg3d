import * as THREE from "three";
import { clothPantsColor } from "./clothColors";
import type { InventoryItem } from "./types";

const previewMat = (color: string, metalness = 0, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    flatShading: true,
  });
const previewMesh = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
};
export function makeItemPreview(type: string) {
  const group = new THREE.Group(),
    cloth = previewMat("#f4f1e8"),
    leather = previewMat("#4a2818"),
    dark = previewMat("#293344"),
    steel = previewMat("#4f5960", 0.72, 0.24);
  if (type === "shirt" || type === "ironShirt" || type === "leatherShirt") {
    const material =
      type === "ironShirt" ? steel : type === "leatherShirt" ? leather : cloth;
    group.add(
      previewMesh(new THREE.BoxGeometry(1, 0.95, 0.42), material, 0, 0.25, 0),
      previewMesh(
        new THREE.BoxGeometry(0.28, 1.25, 0.34),
        material,
        -0.66,
        0.05,
        0,
      ),
      previewMesh(
        new THREE.BoxGeometry(0.28, 1.25, 0.34),
        material,
        0.66,
        0.05,
        0,
      ),
    );
  } else if (type === "pants" || type === "armorPants") {
    const material = type === "armorPants" ? steel : dark;
    group.add(
      previewMesh(new THREE.BoxGeometry(1, 0.3, 0.48), material, 0, 0.62, 0),
      previewMesh(
        new THREE.BoxGeometry(0.38, 1.05, 0.42),
        material,
        -0.28,
        0,
        0,
      ),
      previewMesh(
        new THREE.BoxGeometry(0.38, 1.05, 0.42),
        material,
        0.28,
        0,
        0,
      ),
    );
  } else if (type === "boots" || type === "armorBoots") {
    const material = type === "armorBoots" ? steel : leather;
    for (const x of [-0.3, 0.3]) {
      group.add(
        previewMesh(
          new THREE.BoxGeometry(0.32, 0.9, 0.36),
          material,
          x,
          0.05,
          0,
        ),
        previewMesh(
          new THREE.BoxGeometry(0.34, 0.24, 0.66),
          material,
          x,
          -0.43,
          0.13,
        ),
      );
    }
  } else if (type === "gloves" || type === "armorGloves") {
    const material = type === "armorGloves" ? steel : leather;
    for (const x of [-0.38, 0.38])
      group.add(
        previewMesh(new THREE.BoxGeometry(0.42, 0.7, 0.25), material, x, 0, 0),
      );
  } else if (type === "armor") {
    group.add(
      previewMesh(new THREE.BoxGeometry(1.12, 1.18, 0.46), steel, 0, 0.12, 0),
      previewMesh(new THREE.SphereGeometry(0.34, 8, 5), steel, -0.7, 0.45, 0),
      previewMesh(new THREE.SphereGeometry(0.34, 8, 5), steel, 0.7, 0.45, 0),
    );
  } else if (type === "armorHelmet") {
    const helmet = previewMesh(
      new THREE.SphereGeometry(0.68, 10, 7),
      steel,
      0,
      0.1,
      0,
    );
    helmet.scale.y = 1.08;
    group.add(
      helmet,
      previewMesh(
        new THREE.BoxGeometry(0.16, 0.85, 0.12),
        steel,
        0,
        -0.18,
        0.62,
      ),
    );
  } else if (type === "closedHelmet") {
    const helmet = previewMesh(
      new THREE.SphereGeometry(0.74, 10, 7),
      steel,
      0,
      0.16,
      0,
    );
    helmet.scale.y = 1.08;
    group.add(
      helmet,
      previewMesh(new THREE.BoxGeometry(1.12, 0.8, 0.2), steel, 0, -0.18, 0.46),
      previewMesh(
        new THREE.BoxGeometry(0.78, 0.08, 0.04),
        previewMat("#101417"),
        0,
        -0.08,
        0.58,
      ),
    );
  } else if (type === "belt") {
    const belt = previewMesh(
      new THREE.TorusGeometry(0.62, 0.1, 6, 18),
      leather,
    );
    belt.rotation.x = Math.PI / 2;
    group.add(belt);
  } else if (type === "sword") {
    group.add(
      previewMesh(new THREE.BoxGeometry(0.16, 1.45, 0.1), steel, 0, 0.18, 0),
      previewMesh(
        new THREE.BoxGeometry(0.8, 0.13, 0.18),
        previewMat("#c7a457", 0.5, 0.3),
        0,
        -0.52,
        0,
      ),
      previewMesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8),
        leather,
        0,
        -0.85,
        0,
      ),
    );
    group.rotation.z = -0.55;
  } else if (type === "shield") {
    const face = previewMesh(
      new THREE.CylinderGeometry(0.72, 0.72, 0.18, 10),
      steel,
    );
    face.rotation.x = Math.PI / 2;
    group.add(
      face,
      previewMesh(
        new THREE.BoxGeometry(0.12, 0.92, 0.22),
        leather,
        0,
        0,
        -0.12,
      ),
    );
  } else if (type === "healthPotion" || type === "staminaPotion") {
    const liquid = previewMat(
      type === "healthPotion" ? "#d84b55" : "#d7b92d",
      0.1,
      0.25,
    );
    group.add(
      previewMesh(new THREE.SphereGeometry(0.52, 10, 7), liquid, 0, -0.05, 0),
      previewMesh(
        new THREE.CylinderGeometry(0.2, 0.28, 0.48, 8),
        previewMat("#86cbd2", 0.15, 0.22),
        0,
        0.45,
        0,
      ),
      previewMesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.18, 8),
        leather,
        0,
        0.78,
        0,
      ),
    );
  } else return group;
  group.rotation.y = -0.45;
  group.rotation.x = 0.1;
  return group;
}
export const clothingFor = (item: InventoryItem) =>
  item.slot === "leftHand" || item.slot === "rightHand"
    ? null
    : item.slot === "head"
      ? item.visual === "mage-hood" ? null : item.visual === "steel-helmet" ? "steelHelmet" : "closedHelmet"
      : item.slot === "gloves"
        ? item.visual === "bracers"
          ? "leatherShirt"
          : item.visual === "leather-gloves"
            ? "gloves"
            : "armorGloves"
        : item.slot === "legs"
          ? clothPantsColor(item.visual) ? "pants" : "armorPants"
          : item.slot === "boots"
            ? item.visual.includes("leather")
              ? "boots"
              : "armorBoots"
            : item.slot === "accessory"
              ? item.visual.startsWith("belt")
                ? "belt"
                : null
              : item.slot === "armor"
                ? "armor"
                : item.slot === "torso"
                  ? item.visual === "iron-shirt"
                    ? "ironShirt"
                    : item.visual === "tunic"
                      ? "shirt"
                      : item.visual === "leather"
                        ? "leatherShirt"
                        : "shirt"
                  : null;
