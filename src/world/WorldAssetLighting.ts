import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function createWorldAssetLoader() {
  return new GLTFLoader().register(() => ({
    name: "WorldAssetLighting",
    async afterRoot(gltf) {
      const converted = new Map<THREE.Material, THREE.Material>();
      const litMaterial = (material: THREE.Material) => {
        if (!(material instanceof THREE.MeshBasicMaterial)) return material;
        let lit = converted.get(material);
        if (!lit) {
          lit = new THREE.MeshStandardMaterial({
            name: material.name, color: material.color, map: material.map,
            alphaMap: material.alphaMap, alphaTest: material.alphaTest,
            opacity: material.opacity, transparent: material.transparent,
            side: material.side, vertexColors: material.vertexColors,
            depthWrite: material.depthWrite, roughness: .9, metalness: 0,
          });
          converted.set(material, lit);
        }
        return lit;
      };
      for (const scene of gltf.scenes) scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = object.receiveShadow = true;
        object.material = Array.isArray(object.material)
          ? object.material.map(litMaterial) : litMaterial(object.material);
      });
    },
  }));
}
