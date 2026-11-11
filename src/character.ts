import { STEEL_ARMOR_COLOR, IRON_ARMOR_COLOR, IRON_METALNESS, IRON_ROUGHNESS, METAL_ENVIRONMENT } from './inventory/armorMaterials';
import * as THREE from "three";
import {
  AnimationController,
  AnimationState,
  type BroomRideTuning,
  type MagicArmTuning,
} from "./animation/AnimationController";
import { GripSolver } from "./hand/GripSolver";
import { HandAnimator } from "./hand/HandAnimator";
import { loadHandBoneTuning } from "./hand/HandBoneTuning";
import { HandMesh } from "./hand/HandMesh";
import { HandRig } from "./hand/HandRig";
import { createBodySkin } from "./body/BodySkin";

export type CharacterConfig = {
  name: string;
  body: "masculino" | "feminino";
  className: "Espadachim" | "Guardião" | "Explorador";
  hairStyle: "curto" | "longo" | "espetado";
  helmetHair?: boolean;
  skin: string;
  hair: string;
  outfit: string;
  eyes: string;
  height: number;
};

export type HeldItem = "espada" | "escudo" | "pocao" | "magico" | "nenhum";

export const DEFAULT_CONFIG: CharacterConfig = {
  name: "",
  body: "masculino",
  className: "Espadachim",
  hairStyle: "curto",
  helmetHair: true,
  skin: "#d8a17b",
  hair: "#0b0d10",
  outfit: "#456b57",
  eyes: "#467c9d",
  height: 1,
};

const SHOULDER_HEIGHT_OFFSET = .06;

const mat = (hex: string, metalness = 0, roughness = metalness ? 0.34 : 0.78) =>
  new THREE.MeshStandardMaterial({
    color: hex,
    envMap: metalness > 0 || hex === IRON_ARMOR_COLOR ? METAL_ENVIRONMENT : null,
    roughness: hex === IRON_ARMOR_COLOR ? IRON_ROUGHNESS : roughness,
    metalness: hex === IRON_ARMOR_COLOR ? IRON_METALNESS : metalness,
    flatShading: true,
    side: THREE.DoubleSide,
  });
const shadow = (mesh: THREE.Mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

function loft(
  parent: THREE.Object3D,
  rings: number[][],
  material: THREE.Material,
  segments = 14,
): THREE.Mesh {
  const vertices: number[] = [],
    indices: number[] = [];
  rings.forEach(([x, y, z, rx, rz], j) => {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      vertices.push(x + Math.cos(a) * rx, y, z + Math.sin(a) * rz);
      if (j < rings.length - 1) {
        const n = j * segments + i,
          next = j * segments + ((i + 1) % segments);
        indices.push(
          n,
          n + segments,
          next,
          next,
          n + segments,
          next + segments,
        );
      }
    }
  });
  // Close both ends. The old open lofts exposed the background around the
  // neck, cuffs, hips and ankles whenever two independently rigged regions
  // moved apart.
  const bottom = vertices.length / 3;
  vertices.push(rings[0][0], rings[0][1], rings[0][2]);
  const top = vertices.length / 3;
  const last = rings.at(-1)!;
  vertices.push(last[0], last[1], last[2]);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments,
      final = (rings.length - 1) * segments;
    indices.push(bottom, next, i, top, final + i, final + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = shadow(new THREE.Mesh(geometry, material));
  parent.add(mesh);
  return mesh;
}

function boxyLoft(
  parent: THREE.Object3D,
  rings: number[][],
  material: THREE.Material,
  segments = 12,
  power = 0.48,
) {
  const vertices: number[] = [],
    indices: number[] = [];
  rings.forEach(([x, y, z, rx, rz], row) => {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2,
        c = Math.cos(angle),
        s = Math.sin(angle);
      vertices.push(
        x + Math.sign(c) * Math.pow(Math.abs(c), power) * rx,
        y,
        z + Math.sign(s) * Math.pow(Math.abs(s), power) * rz,
      );
      if (row < rings.length - 1) {
        const n = row * segments + i,
          next = row * segments + ((i + 1) % segments);
        indices.push(
          n,
          n + segments,
          next,
          next,
          n + segments,
          next + segments,
        );
      }
    }
  });
  const bottom = vertices.length / 3,
    top = bottom + 1,
    last = (rings.length - 1) * segments;
  vertices.push(
    rings[0][0],
    rings[0][1],
    rings[0][2],
    rings.at(-1)![0],
    rings.at(-1)![1],
    rings.at(-1)![2],
  );
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(bottom, next, i, top, last + i, last + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = shadow(new THREE.Mesh(geometry, material));
  parent.add(mesh);
  return mesh;
}

function ell(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  material: THREE.Material,
) {
  const rings: number[][] = [];
  for (let j = 0; j <= 14; j++) {
    const a = -Math.PI / 2 + (j / 14) * Math.PI;
    rings.push([
      x,
      y + Math.sin(a) * ry,
      z,
      Math.max(0.002, Math.cos(a) * rx),
      Math.max(0.002, Math.cos(a) * rz),
    ]);
  }
  return loft(parent, rings, material, 16);
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const mesh = shadow(
    new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  rt: number,
  rb: number,
  height: number,
  material: THREE.Material,
  segments = 10,
) {
  const mesh = shadow(
    new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, height, segments),
      material,
    ),
  );
  parent.add(mesh);
  return mesh;
}

export class ProceduralCharacter {
  readonly group = new THREE.Group();
  private parts = new THREE.Group();
  private hips = new THREE.Bone();
  private spine = new THREE.Bone();
  private chest = new THREE.Bone();
  private neck = new THREE.Bone();
  private head = new THREE.Bone();
  private headVisual = new THREE.Group();
  private leftClavicle = new THREE.Bone();
  private rightClavicle = new THREE.Bone();
  private leftUpperArm = new THREE.Bone();
  private rightUpperArm = new THREE.Bone();
  private leftForearm = new THREE.Bone();
  private rightForearm = new THREE.Bone();
  private leftHand = new THREE.Bone();
  private rightHand = new THREE.Bone();
  private leftThigh = new THREE.Bone();
  private rightThigh = new THREE.Bone();
  private leftShin = new THREE.Bone();
  private rightShin = new THREE.Bone();
  private leftAnkle = new THREE.Bone();
  private rightAnkle = new THREE.Bone();
  private leftFoot = new THREE.Bone();
  private rightFoot = new THREE.Bone();
  private leftGrip = new THREE.Group();
  private rightGrip = new THREE.Group();
  private backEquipment = new THREE.Group();
  private backSwords: Partial<Record<"left" | "right", THREE.Object3D>> = {};
  private scabbards: Partial<Record<"left" | "right", THREE.Object3D>> = {};
  private scabbardBladeOffsets: Partial<Record<"left" | "right", number>> = {};
  private swordsSheathed = false;
  private leftItem: HeldItem = "nenhum";
  private rightItem: HeldItem = "espada";
  private leftHandRig?: HandRig;
  private rightHandRig?: HandRig;
  private gloveMaterials: THREE.MeshStandardMaterial[] = [];
  private armorHandMeshes: THREE.SkinnedMesh[] = [];
  private armorBracelets: THREE.Object3D[] = [];
  private armorBootObjects: THREE.Object3D[] = [];
  private leftHandAnimator?: HandAnimator;
  private rightHandAnimator?: HandAnimator;
  private leftGripSolver?: GripSolver;
  private rightGripSolver?: GripSolver;
  private animation: AnimationState = "idle";
  private animationController?: AnimationController;
  private debugEnabled = false;
  private debugHelper?: THREE.SkeletonHelper;
  private debugAxes: THREE.AxesHelper[] = [];
  private wardrobe?: {
    coat: THREE.MeshStandardMaterial;
    sleeves: THREE.MeshStandardMaterial;
    trousers: THREE.MeshStandardMaterial;
    pantsTop: THREE.MeshStandardMaterial;
    boots: THREE.MeshStandardMaterial;
    skin: string;
    outfit: string;
    feminine: boolean;
    beltObjects: THREE.Object3D[];
    armorObjects: THREE.Object3D[];
    armorHelmet: THREE.Object3D[];
    closedHelmet: THREE.Object3D[];
    steelHelmet: THREE.Object3D[];
    underwear: THREE.Object3D;
    pantsWaist: THREE.Object3D;
    pantsGlute?: THREE.Object3D;
    skirt?: THREE.Object3D;
    nipples: THREE.Object3D[];
  };
  private equippedState = new Map<string, boolean>();
  private hoodCoveredHair?: THREE.Object3D;

  constructor(config: CharacterConfig) {
    this.parts.name = "parts";
    this.group.add(this.parts);
    this.rebuild(config);
  }
  setAnimation(value: AnimationState) {
    this.animation = value;
    this.animationController?.setState(value);
  }
  setMountedLegSpread(value: number) {
    this.animationController?.setMountedLegSpread(value);
  }
  setBroomRiding(active: boolean) {
    this.animationController?.setBroomRiding(active);
  }
  setBroomAimPitch(value: number) {
    this.animationController?.setBroomAimPitch(value);
  }
  setBroomRideTuning(tuning: BroomRideTuning) {
    this.animationController?.setBroomRideTuning(tuning);
  }
  setMagicArmTuning(tuning: MagicArmTuning) {
    this.animationController?.setMagicArmTuning(tuning);
  }

  getCastingHandWorldPosition(target = new THREE.Vector3()) {
    this.rightHand.updateWorldMatrix(true, false);
    // A small local offset places the emitter just beyond the open palm rather
    // than at the wrist joint hidden inside the hand mesh.
    return this.rightHand.localToWorld(target.set(0, 0.12, 0.035));
  }
  attachHeadAccessory(object: THREE.Object3D) {
    this.headVisual.add(object);
  }
  setHoodHairHidden(hidden: boolean) {
    if (this.hoodCoveredHair) this.hoodCoveredHair.visible = !hidden;
  }
  setChibi(enabled: boolean) {
    if (enabled) {
      // Knight reference: the head occupies about one fifth of the full
      // height. This is deliberately a structural silhouette change, not a
      // barely-visible uniform resize.
      this.parts.scale.set(0.84, 0.88, 0.84);
      this.headVisual.scale.setScalar(0.92);
      this.headVisual.position.y = -1.98;
    } else {
      this.parts.scale.setScalar(1);
      this.headVisual.scale.setScalar(1);
      this.headVisual.position.y = -2.17;
    }
  }
  setClothing(
    item:
      | "shirt"
      | "ironShirt"
      | "leatherShirt"
      | "pants"
      | "boots"
      | "belt"
      | "sword"
      | "shield"
      | "skirt"
      | "gloves"
      | "armor"
      | "armorPants"
      | "armorBoots"
      | "armorGloves"
      | "armorHelmet"
      | "closedHelmet"
      | "steelHelmet",
    equipped: boolean,
  ) {
    if (!this.wardrobe) return;
    this.equippedState.set(item, equipped);
    if (item === "shirt" || item === "ironShirt" || item === "leatherShirt") {
      const shirtColor =
        item === "ironShirt"
          ? "#59646b"
          : item === "leatherShirt"
            ? "#4a2818"
            : "#f4f1e8";
      this.wardrobe.coat.color.set(equipped ? shirtColor : this.wardrobe.skin);
      this.wardrobe.sleeves.color.set(
        equipped ? shirtColor : this.wardrobe.skin,
      );
      for (const material of [this.wardrobe.coat, this.wardrobe.sleeves]) {
        material.metalness = equipped && item === 'ironShirt' ? IRON_METALNESS : 0;
        material.roughness = equipped && item === 'ironShirt' ? IRON_ROUGHNESS : .78;
        material.envMap = equipped && item === 'ironShirt' ? METAL_ENVIRONMENT : null;
        material.needsUpdate = true;
      }
      this.wardrobe.nipples.forEach((nipple) => (nipple.visible = !equipped));
    } else if (item === "pants") {
      if (!this.equippedState.get("armorPants")) {
        this.wardrobe.trousers.color.set(
          equipped
            ? "#293344"
            : this.wardrobe.feminine
              ? this.wardrobe.skin
              : "#f4f1e8",
        );
        this.wardrobe.pantsTop.color.set(
          equipped ? "#293344" : this.wardrobe.skin,
        );
      }
      this.wardrobe.underwear.visible = !equipped;
      this.wardrobe.pantsWaist.visible = false;
      if (this.wardrobe.pantsGlute) this.wardrobe.pantsGlute.visible = equipped;
    } else if (item === "boots" && !this.equippedState.get("armorBoots"))
      this.wardrobe.boots.color.set(equipped ? "#4a2818" : this.wardrobe.skin);
    else if (item === "gloves" && !this.equippedState.get("armorGloves"))
      this.gloveMaterials.forEach((material) =>
        material.color.set(equipped ? "#4a2818" : this.wardrobe!.skin),
      );
    else if (item === "armor")
      this.wardrobe.armorObjects.forEach(
        (object) => (object.visible = equipped),
      );
    else if (item === "armorPants") {
      for(const material of [this.wardrobe.trousers,this.wardrobe.pantsTop]){material.metalness=equipped ? .7 : 0;material.roughness=equipped ? .3 : .8;}
      const color = equipped
        ? "#59646b"
        : this.equippedState.get("pants")
          ? "#293344"
          : this.wardrobe.feminine
            ? this.wardrobe.skin
            : "#f4f1e8";
      this.wardrobe.trousers.color.set(color);
      this.wardrobe.pantsTop.color.set(
        equipped
          ? "#59646b"
          : this.equippedState.get("pants")
            ? "#293344"
            : this.wardrobe.skin,
      );
      // Armored trousers replace the underwear as a complete lower-body
      // layer. Keeping both visible created the pale waist band seen between
      // the greaves and breastplate.
      this.wardrobe.underwear.visible =
        !equipped && !this.equippedState.get("pants");
    } else if (item === "armorBoots") {
      this.wardrobe.boots.metalness=equipped?.7:0;this.wardrobe.boots.roughness=equipped?.3:.72;
      this.wardrobe.boots.color.set(
        equipped
          ? "#59646b"
          : this.equippedState.get("boots")
            ? "#4a2818"
            : this.wardrobe.skin,
      );
      this.armorBootObjects.forEach((object) => (object.visible = equipped));
    } else if (item === "armorGloves") {
      this.gloveMaterials.forEach(material=>{material.metalness=equipped?.7:0;material.roughness=equipped?.3:.78;});
      this.gloveMaterials.forEach((material) =>
        material.color.set(
          equipped
            ? "#59646b"
            : this.equippedState.get("gloves")
              ? "#4a2818"
              : this.wardrobe!.skin,
        ),
      );
      this.armorBracelets.forEach((bracelet) => (bracelet.visible = equipped));
      this.armorHandMeshes.forEach((hand) =>
        hand.scale.set(
          equipped ? 1.13 : 1,
          equipped ? 1.08 : 1,
          equipped ? 1.13 : 1,
        ),
      );
    } else if (item === "armorHelmet")
      this.wardrobe.armorHelmet.forEach(
        (object) => (object.visible = equipped),
      );
    else if (item === "closedHelmet")
      this.wardrobe.closedHelmet.forEach(
        (object) => (object.visible = equipped),
      );
    else if (item === "steelHelmet")
      this.wardrobe.steelHelmet.forEach(
        (object) => (object.visible = equipped),
      );
    else if (item === "belt")
      this.wardrobe.beltObjects.forEach(
        (object) => (object.visible = equipped),
      );
    else if (item === "sword")
      this.equipRightHand(equipped ? "espada" : "nenhum");
    else if (item === "shield")
      this.equipLeftHand(equipped ? "escudo" : "nenhum");
    else if (item === "skirt" && this.wardrobe.skirt)
      this.wardrobe.skirt.visible = equipped;
  }
  private restoreRestOutfit?:()=>void;
  /** Temporary visual change; inventory and saved equipment are untouched. */
  setRestUndressed(enabled:boolean){
    if(!enabled){this.restoreRestOutfit?.();this.restoreRestOutfit=undefined;return;}
    if(this.restoreRestOutfit)return;
    const objects:{object:THREE.Object3D;visible:boolean;scale:THREE.Vector3}[]=[],materials=new Map<THREE.MeshStandardMaterial,THREE.MeshStandardMaterial>();
    this.group.traverse(object=>{
      if(object!==this.group)objects.push({object,visible:object.visible,scale:object.scale.clone()});
      if(object instanceof THREE.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])
        if(m instanceof THREE.MeshStandardMaterial&&!materials.has(m))materials.set(m,m.clone());
    });
    const equipped=new Map(this.equippedState);
    this.restoreRestOutfit=()=>{
      for(const {object,visible,scale} of objects){object.visible=visible;object.scale.copy(scale);}
      for(const [material,saved] of materials){material.copy(saved);material.needsUpdate=true;saved.dispose();}
      this.equippedState=new Map(equipped);
    };
    for(const piece of ['shirt','ironShirt','leatherShirt','armor','armorPants','armorBoots','armorGloves','armorHelmet','closedHelmet','steelHelmet','pants','boots','gloves','belt','skirt'] as const)this.setClothing(piece,false);
    this.setCivilianSleevesVisible(false);
    this.group.traverse(object=>{
      if(object.name==='CitizenOutfit'||object.name==='CitizenRoleDecoration'||object.name==='PlayerSmoothCape'||object.name.startsWith('equipment.scabbard'))object.visible=false;
    });
    this.leftGrip.visible=false;this.rightGrip.visible=false;this.backEquipment.visible=false;
    if(this.wardrobe){
      this.setClothPantsColor(this.wardrobe.skin);
      this.wardrobe.underwear.visible=false;
    }
  }
  setCivilianClothingColor(color:string,fullLength=false){
    if(!this.wardrobe)return;
    this.wardrobe.coat.color.set(color);this.wardrobe.sleeves.color.set(color);
    if(fullLength){
      this.wardrobe.pantsTop.color.set(color);
      const torso=this.group.getObjectByName('bodySkin.torso');
      if(torso instanceof THREE.Mesh&&Array.isArray(torso.material)){
        torso.material=[...torso.material];
        torso.material[1]=this.wardrobe.coat;
      }
    }
  }
  setClothPantsColor(color: string) {
    if (!this.wardrobe) return;
    for (const material of [this.wardrobe.trousers, this.wardrobe.pantsTop]) {
      material.color.set(color);material.metalness=0;material.roughness=.8;
    }
  }
  setCivilianSleevesVisible(visible:boolean){
    if(!this.wardrobe)return;
    this.wardrobe.sleeves.color.set(visible?this.wardrobe.coat.color:this.wardrobe.skin);
    for(const side of ['L','R']){
      const arm=this.group.getObjectByName(`bodySkin.arm.${side}`);
      if(arm instanceof THREE.Mesh&&Array.isArray(arm.material)){
        arm.material=[...arm.material];arm.material[0]=visible?this.wardrobe.coat:this.wardrobe.sleeves;
      }
    }
  }
  setArmorPartColor(part: "torso" | "legs" | "boots" | "gloves" | "helmet", color: string) {
    if (!this.wardrobe) return;
    const finish=(material:THREE.MeshStandardMaterial)=>{
      material.color.set(color);
      const steel=color.toLowerCase()===STEEL_ARMOR_COLOR;
      const leather=color.toLowerCase()==='#4a2818';
      const iron=color.toLowerCase()===IRON_ARMOR_COLOR;
      material.metalness=leather?0:steel?.82:iron?IRON_METALNESS:.7;
      material.roughness=leather?.78:steel?.16:iron?IRON_ROUGHNESS:.3;
      material.envMap=leather?null:METAL_ENVIRONMENT;
      material.needsUpdate=true;
    };
    const recolor = (object: THREE.Object3D) =>
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial)
            finish(material);
        });
      });
    if (part === "torso") this.wardrobe.armorObjects.forEach(recolor);
    else if (part === "legs") {
      finish(this.wardrobe.trousers);
      finish(this.wardrobe.pantsTop);
    } else if(part==='gloves'){
      this.gloveMaterials.forEach(finish);
      this.armorBracelets.forEach(recolor);
    } else if(part==='helmet'){
      this.wardrobe.steelHelmet.filter(object=>!object.name.endsWith("eyeSlit")).forEach(recolor);
    } else {
      finish(this.wardrobe.boots);
      this.armorBootObjects.forEach(recolor);
    }
  }
  /** Bake the actual equipped meshes for inventory renders, including skinned clothing. */
  createEquipmentPreview(item: Parameters<ProceduralCharacter['setClothing']>[0], color: string, leatherChest = false) {
    const root = new THREE.Group(), wardrobe = this.wardrobe;
    if (!wardrobe) return root;
    for (const key of ['shirt','ironShirt','leatherShirt','pants','boots','gloves','armor','armorPants','armorBoots','armorGloves','closedHelmet','steelHelmet','belt','shield','sword'] as const)
      this.setClothing(key, false);
    this.setClothing(item, true);
    if (item === 'shirt') this.setCivilianClothingColor(color);
    if (item === 'pants') this.setClothPantsColor(color);
    if (item === 'armor') { this.setArmorPartColor('torso', color); this.setArmorShouldersVisible(!leatherChest); }
    if (item === 'armorPants') this.setArmorPartColor('legs', color);
    if (item === 'armorBoots') this.setArmorPartColor('boots', color);
    if (item === 'armorGloves') this.setArmorPartColor('gloves', color);
    if (item === 'steelHelmet') this.setArmorPartColor('helmet', color);
    const objects = item === 'armor' ? wardrobe.armorObjects : item === 'closedHelmet' ? wardrobe.closedHelmet : item === 'steelHelmet' ? wardrobe.steelHelmet : item === 'belt' ? wardrobe.beltObjects : [];
    const materials = new Set<THREE.Material>(
      item === 'armorBoots' || item === 'boots' ? [wardrobe.boots] :
      item === 'armorPants' || item === 'pants' ? [wardrobe.trousers, wardrobe.pantsTop] :
      item === 'armorGloves' || item === 'gloves' ? this.gloveMaterials :
      item === 'shirt' || item === 'ironShirt' || item === 'leatherShirt' ? [wardrobe.coat, wardrobe.sleeves] : []);
    this.group.updateMatrixWorld(true);
    this.group.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
    this.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      let visible = true;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) visible = false;
      if (!visible) return;
      const explicit = objects.some(parent => parent === object || parent.getObjectById(object.id));
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const geometry = object.geometry, position = geometry.getAttribute('position');
      const groups = Array.isArray(object.material) && geometry.groups.length ? geometry.groups : [{start:0,count:geometry.index?.count ?? position.count,materialIndex:0}];
      for (const group of groups) {
        const material = sourceMaterials[group.materialIndex ?? 0];
        if (!explicit && !materials.has(material)) continue;
        const vertices: number[] = [], point = new THREE.Vector3();
        for (let i = group.start; i < group.start + group.count; i++) {
          object.getVertexPosition(geometry.index ? geometry.index.getX(i) : i, point);
          point.applyMatrix4(object.matrixWorld);
          vertices.push(point.x, point.y, point.z);
        }
        const baked = new THREE.BufferGeometry();
        baked.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
        baked.computeVertexNormals();
        root.add(new THREE.Mesh(baked, material.clone()));
      }
    });
    return root;
  }
  setArmorShouldersVisible(visible: boolean) {
    this.wardrobe?.armorObjects.forEach((object) => {
      if (object.name.includes("pauldron")) object.visible = visible;
    });
  }
  setHandTestPose(
    pose:
      "Open" | "Relaxed" | "Fist" | "SwordGrip" | "ShieldGrip" | "Point" | null,
  ) {
    this.animationController?.setHandTestPose(pose);
  }
  refreshHandCalibration() {
    const tuning = loadHandBoneTuning();
    this.leftHandAnimator?.setBoneTuning(tuning);
    this.rightHandAnimator?.setBoneTuning(tuning);
    this.leftGripSolver?.setGrip(this.leftItem);
    this.rightGripSolver?.setGrip(this.rightItem);
  }
  setDebug(enabled: boolean) {
    this.debugEnabled = enabled;
    if (this.debugHelper) this.debugHelper.visible = enabled;
    for (const axes of this.debugAxes) axes.visible = enabled;
  }
  equipRightHand(item: HeldItem) {
    this.rightItem = item;
    this.rightGripSolver?.setGrip(item);
    this.animationController?.setGripPose("right", this.poseForItem(item));
    this.animationController?.setMagicHand("right", item === "magico");
    this.animationController?.setAttackHands(
      this.leftItem === "espada",
      this.rightItem === "espada",
    );
    this.buildHeldItem(this.rightGrip, item, true);
    this.updateBackSheathVisibility();
  }
  equipLeftHand(item: HeldItem) {
    this.leftItem = item;
    this.leftGripSolver?.setGrip(item);
    this.animationController?.setGripPose("left", this.poseForItem(item));
    this.animationController?.setMagicHand("left", item === "magico");
    this.animationController?.setAttackHands(
      this.leftItem === "espada",
      this.rightItem === "espada",
    );
    this.buildHeldItem(this.leftGrip, item, false);
    this.updateBackSheathVisibility();
  }
  equipProceduralWeapon(model: THREE.Object3D | null) {
    this.equipProceduralHand(model, "right", "weapon");
  }
  setHeldItemVisible(side: "left" | "right", visible: boolean) {
    const grip = side === "right" ? this.rightGrip : this.leftGrip;
    grip.visible = visible;
  }
  setSwordSheathed(sheathed: boolean) {
    this.swordsSheathed =
      sheathed && (this.leftItem === "espada" || this.rightItem === "espada");
    this.leftGrip.visible = this.leftItem !== "espada" || !this.swordsSheathed;
    this.rightGrip.visible =
      this.rightItem !== "espada" || !this.swordsSheathed;
    for (const side of ["left", "right"] as const)
      if (this.backSwords[side])
        this.backSwords[side]!.visible = this.swordsSheathed;
    this.animationController?.setGripPose(
      "left",
      this.swordsSheathed && this.leftItem === "espada"
        ? "Relaxed"
        : this.poseForItem(this.leftItem),
    );
    this.animationController?.setGripPose(
      "right",
      this.swordsSheathed && this.rightItem === "espada"
        ? "Relaxed"
        : this.poseForItem(this.rightItem),
    );
    this.animationController?.setAttackHands(
      !this.swordsSheathed && this.leftItem === "espada",
      !this.swordsSheathed && this.rightItem === "espada",
    );
  }
  getScabbardTransform() {
    const side = this.scabbards.right
      ? "right"
      : this.scabbards.left
        ? "left"
        : null;
    const scabbard = side ? this.scabbards[side] : undefined;
    if (!side || !scabbard) return null;
    return {
      side,
      position: scabbard.position.toArray(),
      width: [scabbard.scale.x, scabbard.scale.z],
      swordPosition: this.backSwords[side]?.position.toArray() ?? [0, 0, 0],
      rotation: [
        THREE.MathUtils.radToDeg(scabbard.rotation.x),
        THREE.MathUtils.radToDeg(scabbard.rotation.y),
        THREE.MathUtils.radToDeg(scabbard.rotation.z),
      ],
    } as const;
  }
  setScabbardWidth(width: [number, number]) {
    const side = this.scabbards.right
      ? "right"
      : this.scabbards.left
        ? "left"
        : null;
    if (!side) return;
    this.scabbards[side]?.scale.set(
      Math.max(0.1, width[0]),
      1,
      Math.max(0.1, width[1]),
    );
  }
  setSheathedSwordPosition(position: [number, number, number]) {
    const side = this.backSwords.right
      ? "right"
      : this.backSwords.left
        ? "left"
        : null;
    if (!side) return;
    this.backSwords[side]?.position.fromArray(position);
  }
  setScabbardTransform(
    position: [number, number, number],
    rotation: [number, number, number],
  ) {
    const side = this.scabbards.right
      ? "right"
      : this.scabbards.left
        ? "left"
        : null;
    if (!side) return;
    const scabbard = this.scabbards[side];
    const sword = this.backSwords[side];
    if (!scabbard) return;
    scabbard.position.fromArray(position);
    scabbard.rotation.set(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
    );
    if (sword) {
      const bladeOffset = this.scabbardBladeOffsets[side] ?? 0.19;
      sword.position
        .copy(scabbard.position)
        .add(
          new THREE.Vector3(0, bladeOffset, 0).applyQuaternion(
            scabbard.quaternion,
          ),
        );
      sword.quaternion
        .copy(scabbard.quaternion)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            -Math.PI / 2,
          ),
        );
    }
  }
  equipProceduralHand(
    model: THREE.Object3D | null,
    side: "left" | "right",
    kind: "weapon" | "shield" | "magic" = "weapon",
  ) {
    const heldItem: HeldItem = model
        ? kind === "shield"
          ? "escudo"
          : kind === "magic"
            ? "magico"
            : "espada"
        : "nenhum",
      solver = side === "right" ? this.rightGripSolver : this.leftGripSolver,
      grip = side === "right" ? this.rightGrip : this.leftGrip;
    if (side === "right") this.rightItem = heldItem;
    else this.leftItem = heldItem;
    solver?.setGrip(heldItem);
    this.animationController?.setGripPose(side, this.poseForItem(heldItem));
    this.animationController?.setMagicHand(side, heldItem === "magico");
    this.animationController?.setAttackHands(
      this.leftItem === "espada",
      this.rightItem === "espada",
    );
    this.clearObject(grip);
    // Keep the grip at the exact scale calibrated in Hand Lab. Scaling the
    // whole weapon here also shrank and displaced the handle relative to the
    // saved finger pose, even though the shared socket itself was correct.
    this.backSwords[side]?.removeFromParent();
    this.scabbards[side]?.removeFromParent();
    delete this.backSwords[side];
    delete this.scabbards[side];
    delete this.scabbardBladeOffsets[side];
    if (model) {
      const held = model.clone(true);
      held.name = `equipment.procedural-${kind}`;
      // Weapons are mirrored between hands because their blade geometry is
      // authored for one side. Magical riding items keep their authored
      // direction so a broom does not point backwards in the opposite hand.
      if (side === "left" && kind === "weapon") held.scale.x *= -1;
      grip.add(held);
      if (kind === "weapon") {
        model.updateMatrixWorld(true);
        let bladeMesh: THREE.Mesh | undefined,
          bladeSpan = 0;
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const size = new THREE.Box3()
            .setFromObject(object)
            .getSize(new THREE.Vector3());
          if (size.x > bladeSpan) {
            bladeSpan = size.x;
            bladeMesh = object;
          }
        });
        const bladeBox = bladeMesh
            ? new THREE.Box3().setFromObject(bladeMesh)
            : new THREE.Box3().setFromObject(model),
          bladeSize = bladeBox.getSize(new THREE.Vector3()),
          bladeStart = bladeBox.min.x,
          wholeBox = new THREE.Box3().setFromObject(model),
          bladeLength = Math.max(0.38, wholeBox.max.x - 0.19),
          bladeWidth = Math.max(0.045, bladeSize.y),
          bladeDepth = Math.max(0.035, bladeSize.z),
          waistSide = side === "left" ? 1 : -1,
          mouthY = 0.23,
          incline = 0,
          sideTurn = (waistSide * Math.PI) / 2,
          sideTilt = waistSide * THREE.MathUtils.degToRad(35),
          scabbard = new THREE.Group();
        scabbard.name = `equipment.scabbard.${side}`;
        scabbard.position.set(waistSide * 0.35, mouthY, 0.14);
        scabbard.rotation.set(incline, sideTurn, sideTilt);
        const leather = mat("#4a2818", 0.02, 0.78),
          silver = mat("#b9c0c2", 0.76, 0.22),
          // The scabbard is turned 90° on Y at the waist: local Z is the
          // visible face width and local X is only its thickness.
          shellWidth = bladeDepth + 0.008,
          shellDepth = bladeWidth + 0.012,
          body = box(
            scabbard,
            shellWidth,
            bladeLength,
            shellDepth,
            0,
            -bladeLength / 2,
            0,
            leather,
          );
        body.name = `equipment.scabbard.body.${side}`;
        const rim = 0.012,
          mouthHeight = 0.035,
          outerWidth = shellWidth + rim * 2,
          outerDepth = shellDepth + rim * 2;
        const mouthLeft = box(
          scabbard,
          rim,
          mouthHeight,
          outerDepth,
          -outerWidth / 2 + rim / 2,
          -mouthHeight / 2,
          0,
          silver,
        );
        const mouthRight = box(
          scabbard,
          rim,
          mouthHeight,
          outerDepth,
          outerWidth / 2 - rim / 2,
          -mouthHeight / 2,
          0,
          silver,
        );
        const mouthFront = box(
          scabbard,
          shellWidth,
          mouthHeight,
          rim,
          0,
          -mouthHeight / 2,
          outerDepth / 2 - rim / 2,
          silver,
        );
        const mouthBack = box(
          scabbard,
          shellWidth,
          mouthHeight,
          rim,
          0,
          -mouthHeight / 2,
          -outerDepth / 2 + rim / 2,
          silver,
        );
        [mouthLeft, mouthRight, mouthFront, mouthBack].forEach(
          (piece, index) => {
            piece.name = `equipment.scabbard.mouth.${side}.${index}`;
          },
        );
        const w = shellWidth / 2,
          d = shellDepth / 2,
          top = -bladeLength,
          bottom = top - Math.max(0.08, shellWidth),
          tipGeometry = new THREE.BufferGeometry(),
          points = [
            -w,
            top,
            -d,
            w,
            top,
            -d,
            0,
            bottom,
            -d,
            -w,
            top,
            d,
            w,
            top,
            d,
            0,
            bottom,
            d,
          ];
        tipGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(points, 3),
        );
        tipGeometry.setIndex([
          0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3,
          0,
        ]);
        tipGeometry.computeVertexNormals();
        const tip = shadow(new THREE.Mesh(tipGeometry, silver));
        tip.name = `equipment.scabbard.tip.${side}`;
        scabbard.add(tip);
        this.backEquipment.add(scabbard);
        this.scabbards[side] = scabbard;
        const mount = new THREE.Group();
        mount.name = `equipment.backSword.${side}`;
        mount.position
          .copy(scabbard.position)
          .add(
            new THREE.Vector3(0, bladeStart, 0).applyQuaternion(
              scabbard.quaternion,
            ),
          );
        mount.quaternion
          .copy(scabbard.quaternion)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 0, 1),
              -Math.PI / 2,
            ),
          );
        const backSword = model.clone(true);
        mount.add(backSword);
        this.backEquipment.add(mount);
        this.backSwords[side] = mount;
        this.scabbardBladeOffsets[side] = bladeStart;
      }
    }
    this.updateBackSheathVisibility();
    this.setSwordSheathed(this.swordsSheathed);
  }
  private updateBackSheathVisibility() {
    this.backEquipment.visible =
      this.leftItem === "espada" || this.rightItem === "espada";
  }
  private poseForItem(item: HeldItem) {
    return item === "espada" || item === "magico"
      ? "SwordGrip"
      : item === "escudo" || item === "pocao"
        ? "ShieldGrip"
        : ("Relaxed" as const);
  }

  private clearObject(root: THREE.Object3D) {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const ms = Array.isArray(obj.material) ? obj.material : [obj.material];
        ms.forEach((m) => m.dispose());
      }
    });
    root.clear();
  }

  private buildHeldItem(grip: THREE.Group, item: HeldItem, right: boolean) {
    this.clearObject(grip);
    const steel = mat("#d9e6ed", 0.82, 0.2),
      gold = mat("#d7aa61", 0.58, 0.28),
      leather = mat("#4a2818", 0, 0.7);
    if (item === "espada") {
      // Anatomical grip: handle crosses the palm on X; the blade exits on the thumb side.
      const thumb = right ? 1 : -1,
        weapon = new THREE.Group();
      weapon.name = "equipment.sword";
      weapon.userData.bladeDirection = thumb;
      grip.add(weapon);
      const handle = cylinder(weapon, 0.031, 0.031, 0.25, leather, 12);
      handle.rotation.z = Math.PI / 2;
      box(weapon, 0.055, 0.28, 0.1, thumb * 0.155, 0, 0, gold);
      box(weapon, 0.72, 0.068, 0.038, thumb * 0.54, 0, 0, steel);
      const bx = thumb * 0.9,
        ax = thumb * 1.04,
        w = 0.034,
        d = 0.019;
      const points = [bx, -w, -d, bx, w, -d, bx, w, d, bx, -w, d, ax, 0, 0];
      const tipGeometry = new THREE.BufferGeometry();
      tipGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      );
      tipGeometry.setIndex([
        0, 2, 1, 0, 3, 2, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4,
      ]);
      tipGeometry.computeVertexNormals();
      weapon.add(shadow(new THREE.Mesh(tipGeometry, steel)));
    } else if (item === "escudo") {
      const shield = new THREE.Group();
      shield.rotation.x = Math.PI / 2;
      shield.position.set(0, 0, 0.16);
      grip.add(shield);
      shield.add(
        shadow(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.31, 0.36, 0.07, 8),
            mat("#425b6d", 0.25, 0.45),
          ),
        ),
      );
      const handle = cylinder(grip, 0.026, 0.026, 0.23, leather, 8);
      handle.rotation.z = Math.PI / 2;
      handle.position.z = 0.055;
      const boss = shadow(
        new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), gold),
      );
      boss.position.y = -0.055;
      shield.add(boss);
      for (let i = 0; i < 8; i++) {
        const stud = shadow(
          new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), gold),
        );
        const a = (i / 8) * Math.PI * 2;
        stud.position.set(Math.cos(a) * 0.265, -0.058, Math.sin(a) * 0.265);
        shield.add(stud);
      }
    } else if (item === "pocao") {
      const bottle = new THREE.Group();
      bottle.position.y = -0.42;
      grip.add(bottle);
      const glass = new THREE.MeshPhysicalMaterial({
        color: "#7ad8ee",
        transparent: true,
        opacity: 0.62,
        roughness: 0.12,
        transmission: 0.25,
      });
      cylinder(bottle, 0.105, 0.14, 0.3, glass, 12).position.y = 0.18;
      cylinder(bottle, 0.055, 0.07, 0.13, glass, 10).position.y = 0.39;
      cylinder(bottle, 0.065, 0.065, 0.055, leather, 8).position.y = 0.48;
      cylinder(
        bottle,
        0.095,
        0.125,
        0.17,
        mat("#e83e76", 0.05, 0.2),
        12,
      ).position.y = 0.105;
    }
  }

  private buildArm(
    side: -1 | 1,
    shoulder: number,
    coat: THREE.Material,
    skin: THREE.Material,
  ) {
    const clavicle = side === -1 ? this.leftClavicle : this.rightClavicle;
    const upper = side === -1 ? this.leftUpperArm : this.rightUpperArm;
    const fore = side === -1 ? this.leftForearm : this.rightForearm;
    const suffix = side === -1 ? "L" : "R";
    clavicle.name = `Clavicle_${suffix}`;
    upper.name = `UpperArm_${suffix}`;
    fore.name = `Forearm_${suffix}`;
    const armHeightOffset = SHOULDER_HEIGHT_OFFSET;
    clavicle.position.set(0, 0.08 + armHeightOffset, 0);
    this.chest.add(clavicle);
    upper.position.set(side * shoulder, 0.09, 0);
    clavicle.add(upper);
    fore.position.set(side * 0.075, -0.38, 0.01);
    upper.add(fore);
    const rig = new HandRig(side === 1 ? "right" : "left");
    rig.root.position.set(side * 0.055, -0.35, 0.025);
    fore.add(rig.root);
    const handMesh = HandMesh.create(rig, "#4a2818");
    this.gloveMaterials.push(handMesh.material as THREE.MeshStandardMaterial);
    this.armorHandMeshes.push(handMesh);
    // Segmented steel vambrace: it is parented to the forearm bone, so the
    // armored glove continues past the wrist and follows every arm animation.
    const vambrace = loft(
      fore,
      [
        [side * 0.048, -0.405, 0.02, 0.078, 0.068],
        [side * 0.044, -0.35, 0.018, 0.082, 0.072],
        [side * 0.03, -0.265, 0.015, 0.09, 0.08],
        [side * 0.016, -0.165, 0.012, 0.1, 0.09],
        [0, -0.055, 0.008, 0.108, 0.098],
      ],
      handMesh.material,
      10,
    );
    vambrace.name = `equipment.armor.vambrace.${suffix}`;
    vambrace.visible = false;
    this.armorBracelets.push(vambrace);
    const sx = side * shoulder,
      ex = side * (shoulder + 0.075),
      wx = side * (shoulder + 0.13);
    createBodySkin(
      this.parts,
      `bodySkin.arm.${suffix}`,
      [clavicle, upper, fore, rig.wrist],
      [
        {
          center: [sx, 1.91 + armHeightOffset, 0],
          rx: 0.098,
          rz: 0.108,
          weights: [
            { bone: 0, weight: 0.35 },
            { bone: 1, weight: 0.65 },
          ],
          material: 0,
        },
        {
          center: [sx + side * 0.018, 1.865 + armHeightOffset, 0],
          rx: 0.126,
          rz: 0.124,
          weights: [
            { bone: 0, weight: 0.18 },
            { bone: 1, weight: 0.82 },
          ],
          material: 0,
        },
        {
          center: [sx + side * 0.038, 1.79 + armHeightOffset, 0.002],
          rx: 0.121,
          rz: 0.116,
          weights: [{ bone: 1, weight: 1 }],
          material: 0,
        },
        {
          center: [sx + side * 0.06, 1.65 + armHeightOffset, 0.007],
          rx: 0.105,
          rz: 0.099,
          weights: [
            { bone: 1, weight: 0.82 },
            { bone: 2, weight: 0.18 },
          ],
          material: 0,
        },
        {
          center: [ex, 1.535 + armHeightOffset, 0.01],
          rx: 0.095,
          rz: 0.089,
          weights: [
            { bone: 1, weight: 0.52 },
            { bone: 2, weight: 0.48 },
          ],
          material: 0,
        },
        {
          center: [ex + side * 0.006, 1.49 + armHeightOffset, 0.013],
          rx: 0.091,
          rz: 0.086,
          weights: [
            { bone: 1, weight: 0.22 },
            { bone: 2, weight: 0.78 },
          ],
          material: 1,
        },
        {
          center: [ex + side * 0.02, 1.4 + armHeightOffset, 0.018],
          rx: 0.084,
          rz: 0.078,
          weights: [{ bone: 2, weight: 1 }],
          material: 1,
        },
        {
          center: [ex + side * 0.038, 1.3 + armHeightOffset, 0.027],
          rx: 0.072,
          rz: 0.066,
          weights: [
            { bone: 2, weight: 0.82 },
            { bone: 3, weight: 0.18 },
          ],
          material: 1,
        },
        {
          center: [wx, 1.18 + armHeightOffset, 0.035],
          rx: 0.06,
          rz: 0.055,
          weights: [
            { bone: 2, weight: 0.62 },
            { bone: 3, weight: 0.38 },
          ],
          material: 1,
        },
      ],
      [coat, skin],
      16,
    );
    const animator = new HandAnimator(rig),
      solver = new GripSolver(rig, animator);
    if (side === -1) {
      this.leftHandRig = rig;
      this.leftHand = rig.wrist;
      this.leftGrip = rig.socket;
      this.leftHandAnimator = animator;
      this.leftGripSolver = solver;
    } else {
      this.rightHandRig = rig;
      this.rightHand = rig.wrist;
      this.rightGrip = rig.socket;
      this.rightHandAnimator = animator;
      this.rightGripSolver = solver;
    }
  }

  private buildLeg(
    side: -1 | 1,
    trousers: THREE.Material,
    boots: THREE.Material,
  ) {
    const thigh = side === -1 ? this.leftThigh : this.rightThigh;
    const shin = side === -1 ? this.leftShin : this.rightShin;
    const ankle = side === -1 ? this.leftAnkle : this.rightAnkle;
    const foot = side === -1 ? this.leftFoot : this.rightFoot;
    const suffix = side === -1 ? "L" : "R";
    thigh.name = `Thigh_${suffix}`;
    shin.name = `Shin_${suffix}`;
    ankle.name = `Ankle_${suffix}`;
    foot.name = `Foot_${suffix}`;
    thigh.position.set(side * 0.18, 0, 0);
    this.hips.add(thigh);
    shin.position.set(side * 0.015, -0.45, 0.015);
    thigh.add(shin);
    ankle.position.set(0, -0.47, 0.02);
    shin.add(ankle);
    foot.position.set(0, -0.03, 0.12);
    ankle.add(foot);
    // The armored boot is a real outer shell rather than a recolor: a broad
    // greave tapers into the ankle and overlaps a reinforced foot piece.
    const greave = loft(
      shin,
      [
        [0, -0.445, 0.005, 0.105, 0.1],
        [0, -0.365, 0.004, 0.112, 0.106],
        [0, -0.245, 0.002, 0.124, 0.116],
        [0, -0.115, 0, 0.136, 0.126],
        [0, -0.025, 0, 0.142, 0.132],
      ],
      boots,
      10,
    );
    greave.name = `equipment.armor.greave.${suffix}`;
    greave.visible = false;
    this.armorBootObjects.push(greave);
    const hx = side * 0.18,
      kx = side * 0.195,
      az = 0.035;
    createBodySkin(
      this.parts,
      `bodySkin.leg.${suffix}`,
      [thigh, shin, ankle, foot],
      [
        // Both body types share the same clean, continuously tapered leg.
        {
          center: [hx, 1.12, 0],
          rx: 0.174,
          rz: 0.158,
          weights: [{ bone: 0, weight: 1 }],
          material: 0,
        },
        {
          center: [hx, 1.05, 0],
          rx: 0.178,
          rz: 0.16,
          weights: [{ bone: 0, weight: 1 }],
          material: 0,
        },
        {
          center: [hx + side * 0.005, 0.96, 0.002],
          rx: 0.184,
          rz: 0.166,
          weights: [{ bone: 0, weight: 1 }],
          material: 0,
        },
        {
          center: [hx + side * 0.009, 0.86, 0.006],
          rx: 0.17,
          rz: 0.153,
          weights: [
            { bone: 0, weight: 0.92 },
            { bone: 1, weight: 0.08 },
          ],
          material: 0,
        },
        {
          center: [hx + side * 0.011, 0.72, 0.009],
          rx: 0.158,
          rz: 0.145,
          weights: [
            { bone: 0, weight: 0.72 },
            { bone: 1, weight: 0.28 },
          ],
          material: 0,
        },
        {
          center: [kx, 0.65, 0.015],
          rx: 0.13,
          rz: 0.124,
          weights: [
            { bone: 0, weight: 0.52 },
            { bone: 1, weight: 0.48 },
          ],
          material: 0,
        },
        {
          center: [kx, 0.59, 0.018],
          rx: 0.105,
          rz: 0.101,
          weights: [
            { bone: 0, weight: 0.22 },
            { bone: 1, weight: 0.78 },
          ],
          material: 1,
        },
        {
          center: [kx, 0.48, 0.023],
          rx: 0.112,
          rz: 0.108,
          weights: [{ bone: 1, weight: 1 }],
          material: 1,
        },
        {
          center: [kx, 0.31, 0.03],
          rx: 0.106,
          rz: 0.102,
          weights: [
            { bone: 1, weight: 0.84 },
            { bone: 2, weight: 0.16 },
          ],
          material: 1,
        },
        {
          center: [kx, 0.18, az],
          rx: 0.091,
          rz: 0.088,
          weights: [
            { bone: 1, weight: 0.35 },
            { bone: 2, weight: 0.65 },
          ],
          material: 1,
        },
      ],
      [trousers, boots],
      16,
    );
    createBodySkin(
      this.parts,
      `bodySkin.foot.${suffix}`,
      [ankle, foot],
      [
        {
          center: [kx, 0.185, 0.035],
          rx: 0.082,
          rz: 0.08,
          weights: [
            { bone: 0, weight: 0.82 },
            { bone: 1, weight: 0.18 },
          ],
          material: 0,
        },
        {
          center: [kx, 0.145, 0.07],
          rx: 0.102,
          rz: 0.112,
          weights: [
            { bone: 0, weight: 0.38 },
            { bone: 1, weight: 0.62 },
          ],
          material: 0,
        },
        {
          center: [kx, 0.105, 0.125],
          rx: 0.118,
          rz: 0.158,
          weights: [{ bone: 1, weight: 1 }],
          material: 0,
        },
        {
          center: [kx, 0.078, 0.155],
          rx: 0.088,
          rz: 0.128,
          weights: [{ bone: 1, weight: 1 }],
          material: 0,
        },
      ],
      [boots],
      16,
    );
  }

  rebuild(config: CharacterConfig) {
    if (this.debugHelper) {
      this.group.remove(this.debugHelper);
      this.debugHelper.geometry.dispose();
      (this.debugHelper.material as THREE.Material).dispose();
      this.debugHelper = undefined;
    }
    for (const axes of this.debugAxes) {
      axes.removeFromParent();
      axes.geometry.dispose();
      (axes.material as THREE.Material).dispose();
    }
    this.debugAxes = [];
    this.leftHandRig?.dispose();
    this.rightHandRig?.dispose();
    this.gloveMaterials = [];
    this.armorHandMeshes = [];
    this.armorBracelets = [];
    this.armorBootObjects = [];
    this.equippedState.clear();
    this.clearObject(this.parts);
    this.leftClavicle = new THREE.Bone();
    this.rightClavicle = new THREE.Bone();
    this.leftUpperArm = new THREE.Bone();
    this.rightUpperArm = new THREE.Bone();
    this.leftForearm = new THREE.Bone();
    this.rightForearm = new THREE.Bone();
    this.leftHand = new THREE.Bone();
    this.rightHand = new THREE.Bone();
    this.leftHandRig = undefined;
    this.rightHandRig = undefined;
    this.leftHandAnimator = undefined;
    this.rightHandAnimator = undefined;
    this.leftGripSolver = undefined;
    this.rightGripSolver = undefined;
    this.hips = new THREE.Bone();
    this.hips.name = "Hips";
    this.spine = new THREE.Bone();
    this.spine.name = "Spine";
    this.chest = new THREE.Bone();
    this.chest.name = "Chest";
    this.leftThigh = new THREE.Bone();
    this.rightThigh = new THREE.Bone();
    this.leftShin = new THREE.Bone();
    this.rightShin = new THREE.Bone();
    this.leftAnkle = new THREE.Bone();
    this.rightAnkle = new THREE.Bone();
    this.leftFoot = new THREE.Bone();
    this.rightFoot = new THREE.Bone();
    this.leftGrip = new THREE.Group();
    this.rightGrip = new THREE.Group();
    this.backEquipment = new THREE.Group();
    this.backEquipment.name = "equipment.waistScabbards";
    this.backSwords = {};
    this.scabbards = {};
    this.scabbardBladeOffsets = {};
    this.neck = new THREE.Bone();
    this.neck.name = "Neck";
    this.head = new THREE.Bone();
    this.head.name = "Head";
    this.headVisual = new THREE.Group();
    const skin = mat(config.skin, 0, 0.62),
      hair = mat(config.hair, 0, 0.72),
      coat = mat("#f4f1e8", 0, 0.78),
      sleeves = mat(config.skin, 0, 0.68);
    const shade = mat(
      new THREE.Color(config.outfit).multiplyScalar(0.62).getStyle(),
      0,
      0.86,
    );
    const trousers = mat("#293344", 0, 0.8),
      pantsTop = mat(config.skin, 0, 0.8),
      underwearMat = mat("#f4f1e8", 0, 0.84),
      boots = mat("#4a2818", 0, 0.72),
      black = mat("#161d22", 0, 0.5);
    const feminine = config.body === "feminino",
      shoulder = feminine ? 0.29 : 0.31,
      waist = feminine ? 0.25 : 0.285,
      hip = feminine ? 0.35 : 0.3;
    this.hips.position.set(0, 1.08, 0);
    this.parts.add(this.hips);
    this.spine.position.set(0, 0.28, 0);
    this.hips.add(this.spine);
    this.chest.position.set(0, 0.38, 0);
    this.spine.add(this.chest);
    this.hips.add(this.backEquipment);
    const beltMaterial = mat("#4a2818", 0.02, 0.78);
    const beltShape = new THREE.Shape();
    beltShape.absellipse(0, 0, 0.395, 0.278, 0, Math.PI * 2, false, 0);
    const beltOpening = new THREE.Path();
    beltOpening.absellipse(0, 0, 0.345, 0.228, 0, Math.PI * 2, true, 0);
    beltShape.holes.push(beltOpening);
    const beltGeometry = new THREE.ExtrudeGeometry(beltShape, {
      depth: 0.135,
      bevelEnabled: false,
      curveSegments: 64,
    });
    beltGeometry.center();
    beltGeometry.rotateX(Math.PI / 2);
    const scabbardBelt = shadow(new THREE.Mesh(beltGeometry, beltMaterial));
    scabbardBelt.name = "equipment.scabbard.belt";
    scabbardBelt.position.set(0, 0.23, 0);
    this.backEquipment.add(scabbardBelt);
    const buckleShape = new THREE.Shape();
    buckleShape.moveTo(-0.09, -0.07);
    buckleShape.lineTo(0.09, -0.07);
    buckleShape.lineTo(0.09, 0.07);
    buckleShape.lineTo(-0.09, 0.07);
    buckleShape.closePath();
    const buckleOpening = new THREE.Path();
    buckleOpening.moveTo(-0.052, -0.033);
    buckleOpening.lineTo(-0.052, 0.033);
    buckleOpening.lineTo(0.052, 0.033);
    buckleOpening.lineTo(0.052, -0.033);
    buckleOpening.closePath();
    buckleShape.holes.push(buckleOpening);
    const buckleGeometry = new THREE.ExtrudeGeometry(buckleShape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.006,
      bevelSegments: 2,
    });
    buckleGeometry.center();
    const beltBuckle = shadow(
      new THREE.Mesh(buckleGeometry, mat("#c7ced1", 0.82, 0.2)),
    );
    beltBuckle.name = "equipment.scabbard.buckle";
    beltBuckle.position.set(0, 0.23, 0.286);
    this.backEquipment.add(beltBuckle);
    this.backEquipment.visible = false;
    // Anatomical torso profile: glute/hip shelf, waist, rib cage, pectoral
    // depth and a tapered shoulder/neck transition. Density is concentrated
    // at the waist and shoulder girdle instead of spread uniformly.
    createBodySkin(
      this.parts,
      "bodySkin.torso",
      [this.hips, this.spine, this.chest],
      [
        {
          center: [0, 1.06, -0.006],
          rx: hip,
          rz: 0.205,
          weights: [{ bone: 0, weight: 1 }],
          material: 2,
        },
        {
          center: [0, 1.12, -0.004],
          rx: hip + 0.025,
          rz: 0.218,
          weights: [{ bone: 0, weight: 1 }],
          material: 2,
        },
        {
          center: [0, 1.22, -0.01],
          rx: feminine ? waist + 0.03 : waist + 0.015,
          rz: 0.178,
          weights: [
            { bone: 0, weight: 0.82 },
            { bone: 1, weight: 0.18 },
          ],
          material: feminine ? 1 : 2,
        },
        {
          center: [0, 1.32, -0.01],
          rx: feminine ? waist + 0.008 : waist + 0.006,
          rz: 0.176,
          weights: [
            { bone: 0, weight: 0.42 },
            { bone: 1, weight: 0.58 },
          ],
          material: 0,
        },
        {
          center: [0, 1.44, -0.009],
          rx: waist,
          rz: 0.176,
          weights: [
            { bone: 1, weight: 0.88 },
            { bone: 2, weight: 0.12 },
          ],
        },
        {
          center: [0, 1.56, -0.006],
          rx: feminine ? waist + 0.018 : waist + 0.012,
          rz: feminine ? 0.172 : 0.18,
          weights: [
            { bone: 1, weight: 0.65 },
            { bone: 2, weight: 0.35 },
          ],
        },
        {
          center: [0, 1.68, 0.014],
          rx: shoulder,
          rz: feminine ? 0.17 : 0.226,
          weights: [
            { bone: 1, weight: 0.28 },
            { bone: 2, weight: 0.72 },
          ],
        },
        {
          center: [0, 1.77, 0.016],
          rx: shoulder,
          rz: feminine ? 0.174 : 0.242,
          weights: [{ bone: 2, weight: 1 }],
        },
        {
          center: [0, 1.84, 0.01],
          rx: shoulder * 1.035,
          rz: feminine ? 0.178 : 0.246,
          weights: [{ bone: 2, weight: 1 }],
        },
        {
          center: [0, 1.91, 0.002],
          rx: shoulder * 0.88,
          rz: feminine ? 0.168 : 0.218,
          weights: [{ bone: 2, weight: 1 }],
        },
        {
          center: [0, 1.97, -0.002],
          rx: 0.245,
          rz: 0.165,
          weights: [{ bone: 2, weight: 1 }],
        },
        {
          center: [0, 2.02, 0],
          rx: 0.145,
          rz: 0.132,
          weights: [{ bone: 2, weight: 1 }],
        },
      ],
      [coat, skin, pantsTop],
      18,
    );
    const armorObjects: THREE.Object3D[] = [];
    if (!feminine) {
      const steel = mat("#8b969d", 0.62, 0.3),
        darkSteel = mat("#4f5960", 0.55, 0.38);
      // Run the plate down to the natural waist so chest armor and armored
      // trousers meet without an exposed belly or side gap.
      const breastplate = boxyLoft(
        this.chest,
        [
          [0, -0.45, 0.002, 0.305, 0.22],
          [0, -0.34, 0.006, 0.318, 0.235],
          [0, -0.17, 0.01, 0.345, 0.268],
          [0, -0.05, 0.025, 0.36, 0.282],
          [0, 0.09, 0.035, 0.37, 0.292],
          [0, 0.22, 0.018, 0.32, 0.252],
        ].map(([x,y,z,rx,rz])=>[x,y+SHOULDER_HEIGHT_OFFSET*THREE.MathUtils.clamp((y+.45)/.4,0,1),z,rx,rz]),
        steel,
        12,
        0.58,
      );
      breastplate.name = "equipment.armor.breastplate";
      armorObjects.push(breastplate);
      for (const side of [-1, 1] as const) {
        const pauldron = ell(
          this.chest,
          side * 0.375,
          0.105 + SHOULDER_HEIGHT_OFFSET,
          -0.005,
          0.175,
          0.105,
          0.215,
          darkSteel,
        );
        pauldron.name = `equipment.armor.pauldron.${side < 0 ? "L" : "R"}`;
        armorObjects.push(pauldron);
      }
      armorObjects.forEach((object) => (object.visible = false));
    }
    const nipples: THREE.Object3D[] = [];
    if (feminine) {
      // Chest volumes are parented to the animated chest bone so they follow
      // breathing, riding and locomotion instead of floating over the torso.
      ell(this.chest, -0.15, 0.015, 0.19, 0.135, 0.145, 0.1, coat);
      ell(this.chest, 0.15, 0.015, 0.19, 0.135, 0.145, 0.1, coat);
      const nipple = mat("#d9828f", 0, 0.68);
      nipples.push(
        ell(this.chest, -0.15, 0.015, 0.291, 0.026, 0.027, 0.014, nipple),
      );
      nipples.push(
        ell(this.chest, 0.15, 0.015, 0.291, 0.026, 0.027, 0.014, nipple),
      );
    }
    const underwear = createBodySkin(
      this.parts,
      "equipment.underwear",
      [this.hips, this.spine],
      feminine
        ? [
            // A compact brief, kept below the natural waist and joined to the hips
            // without the stacked horizontal bands of the previous five-ring shell.
            {
              center: [0, 0.93, -0.006],
              rx: 0.35,
              rz: 0.215,
              weights: [{ bone: 0, weight: 1 }],
              material: 0,
            },
            {
              center: [0, 1.005, -0.008],
              rx: 0.365,
              rz: 0.232,
              weights: [{ bone: 0, weight: 1 }],
              material: 0,
            },
            {
              center: [0, 1.075, -0.004],
              rx: 0.36,
              rz: 0.228,
              weights: [
                { bone: 0, weight: 0.94 },
                { bone: 1, weight: 0.06 },
              ],
              material: 0,
            },
            {
              center: [0, 1.125, 0],
              rx: 0.325,
              rz: 0.205,
              weights: [
                { bone: 0, weight: 0.82 },
                { bone: 1, weight: 0.18 },
              ],
              material: 0,
            },
          ]
        : [
            {
              center: [0, 1.055, 0],
              rx: hip + 0.035,
              rz: 0.226,
              weights: [{ bone: 0, weight: 1 }],
              material: 0,
            },
            {
              center: [0, 1.13, 0],
              rx: hip + 0.04,
              rz: 0.23,
              weights: [{ bone: 0, weight: 1 }],
              material: 0,
            },
            {
              center: [0, 1.22, 0.002],
              rx: waist + 0.055,
              rz: 0.218,
              weights: [
                { bone: 0, weight: 0.82 },
                { bone: 1, weight: 0.18 },
              ],
              material: 0,
            },
            {
              center: [0, 1.3, 0.003],
              rx: waist + 0.03,
              rz: 0.205,
              weights: [
                { bone: 0, weight: 0.55 },
                { bone: 1, weight: 0.45 },
              ],
              material: 0,
            },
          ],
      [underwearMat],
      18,
    );
    // No separate waist shell: it inevitably reads as a skirt. The lower
    // torso rings use pantsTop instead, so the trousers cover the sides while
    // preserving the body's exact silhouette.
    const pantsWaist = new THREE.Group();
    pantsWaist.name = "equipment.pants.waist";
    pantsWaist.visible = false;
    // The pelvis and upper-leg rings already form the seat of the trousers.
    // Do not add a second ellipsoid here: it reads as a swollen thigh from the
    // side and breaks the torso-to-leg taper.
    const pantsGlute: THREE.Object3D | undefined = undefined;
    let skirt: THREE.Object3D | undefined;
    if (feminine) {
      skirt = loft(
        this.hips,
        [
          [0, 0.3, 0, 0.405, 0.265],
          [0, 0.2, 0, 0.41, 0.27],
          [0, 0.06, 0, 0.405, 0.268],
          [0, -0.18, 0, 0.43, 0.282],
          [0, -0.43, 0, 0.465, 0.302],
          [0, -0.7, 0, 0.495, 0.32],
        ],
        mat("#6e3547", 0, 0.82),
        16,
      );
      skirt.name = "equipment.skirt.long";
      skirt.visible = false;
    }
    loft(
      this.parts,
      [
        [0, 1.98, 0, 0.128, 0.126],
        [0, 2.015, 0, 0.118, 0.118],
        [0, 2.055, 0.002, 0.108, 0.108],
        [0, 2.09, 0.005, 0.116, 0.113],
        [0, 2.11, 0.006, 0.124, 0.118],
      ],
      skin,
      16,
    );
    this.neck.position.set(0, 0.2, 0);
    this.chest.add(this.neck);
    this.head.position.set(0, 0.14, 0);
    this.neck.add(this.head);
    this.headVisual.position.y = -2.17;
    this.head.add(this.headVisual);
    boxyLoft(
      this.headVisual,
      [
        [0, 2.145, 0.006, 0.09, 0.08],
        [0, 2.19, 0.014, 0.19, 0.17],
        [0, 2.25, 0.022, 0.235, 0.205],
        [0, 2.36, 0.028, 0.255, 0.222],
        [0, 2.5, 0.018, 0.258, 0.225],
        [0, 2.61, -0.006, 0.245, 0.215],
        [0, 2.69, -0.022, 0.19, 0.165],
        [0, 2.73, -0.026, 0.08, 0.065],
      ],
      skin,
      12,
      0.52,
    );
    // Clean helmet silhouette: the front stays behind the face plane (no
    // fringe), while the rear shifts backward and stretches down over the
    // nape as one continuous mass.
    const helmetRings =
      !feminine || config.helmetHair
        ? [
            [0, 2.12, -0.1, 0.275, 0.205],
            [0, 2.3, -0.09, 0.325, 0.26],
            [0, 2.5, -0.06, 0.334, 0.3],
            [0, 2.69, -0.055, 0.322, 0.29],
            [0, 2.82, -0.06, 0.23, 0.21],
            [0, 2.88, -0.065, 0.08, 0.07],
          ]
        : config.hairStyle === "longo"
        ? [
            [0, 1.3, -0.14, 0.235, 0.075],
            [0, 1.48, -0.148, 0.24, 0.088],
            [0, 1.68, -0.158, 0.242, 0.1],
            [0, 1.88, -0.162, 0.24, 0.11],
            [0, 2.04, -0.162, 0.23, 0.116],
            [0, 2.16, -0.145, 0.255, 0.145],
            [0, 2.28, -0.125, 0.294, 0.18],
            [0, 2.4, -0.095, 0.322, 0.218],
            [0, 2.52, -0.07, 0.329, 0.242],
            [0, 2.68, -0.06, 0.316, 0.235],
            [0, 2.8, -0.065, 0.272, 0.205],
            [0, 2.87, -0.07, 0.18, 0.13],
            [0, 2.9, -0.072, 0.065, 0.045],
          ]
        : [
            [0, 2.08, -0.155, 0.15, 0.1],
            [0, 2.16, -0.145, 0.255, 0.145],
            [0, 2.28, -0.125, 0.294, 0.18],
            [0, 2.4, -0.095, 0.322, 0.218],
            [0, 2.52, -0.07, 0.329, 0.242],
            [0, 2.68, -0.06, 0.316, 0.235],
            [0, 2.8, -0.065, 0.272, 0.205],
            [0, 2.87, -0.07, 0.18, 0.13],
            [0, 2.9, -0.072, 0.065, 0.045],
          ];
    // Masculine hair is a newly modeled, black version of the closed helmet
    // dome: identical faceted silhouette, but without visor or metal parts.
    const helmetHair = hair;
    this.hoodCoveredHair = boxyLoft(
      this.headVisual,
      helmetRings,
      helmetHair,
      12,
      !feminine || config.helmetHair ? 0.58 : 0.66,
    );
    this.hoodCoveredHair.name = "character.hair.hoodCovered";
    // Keep the helmet-shaped hairstyle compact enough to sit naturally under
    // hoods without changing its overall silhouette.
    this.hoodCoveredHair.scale.setScalar(0.92);
    this.hoodCoveredHair.position.y = 0.2;
    const armorHelmet: THREE.Object3D[] = [],
      closedHelmet: THREE.Object3D[] = [],
      steelHelmet: THREE.Object3D[] = [];
    if (!feminine) {
      const helmetMetal = mat("#68737a", 0.68, 0.28);
      const helmet = boxyLoft(
        this.headVisual,
        [
          [0, 2.16, -0.105, 0.255, 0.18],
          [0, 2.34, -0.095, 0.308, 0.24],
          [0, 2.52, -0.065, 0.32, 0.285],
          [0, 2.68, -0.055, 0.31, 0.28],
          [0, 2.8, -0.06, 0.225, 0.205],
          [0, 2.86, -0.065, 0.078, 0.068],
        ],
        helmetMetal,
        12,
        0.6,
      );
      helmet.name = "equipment.armor.helmet";
      helmet.visible = false;
      armorHelmet.push(helmet);
      const closedMetal = mat("#59646b", 0.72, 0.25),
        slit = mat("#101417", 0.15, 0.3);
      const closedDome = boxyLoft(
        this.headVisual,
        [
          [0, 2.12, -0.1, 0.275, 0.205],
          [0, 2.3, -0.09, 0.325, 0.26],
          [0, 2.5, -0.06, 0.334, 0.3],
          [0, 2.69, -0.055, 0.322, 0.29],
          [0, 2.82, -0.06, 0.23, 0.21],
          [0, 2.88, -0.065, 0.08, 0.07],
        ],
        closedMetal,
        12,
        0.58,
      );
      const visor = box(
          this.headVisual,
          0.505,
          0.445,
          0.075,
          0,
          2.405,
          0.25,
          closedMetal,
        ),
        eyeSlit = box(
          this.headVisual,
          0.365,
          0.04,
          0.018,
          0,
          2.515,
          0.294,
          slit,
        ),
        noseGuard = box(
          this.headVisual,
          0.06,
          0.285,
          0.035,
          0,
          2.375,
          0.3,
          closedMetal,
        );
      closedDome.name = "equipment.armor.closedHelmet.dome";
      visor.name = "equipment.armor.closedHelmet.visor";
      eyeSlit.name = "equipment.armor.closedHelmet.eyeSlit";
      noseGuard.name = "equipment.armor.closedHelmet.noseGuard";
      closedHelmet.push(closedDome, visor, eyeSlit, noseGuard);
      closedHelmet.forEach((object) => (object.visible = false));

      // Steel helmet: exact duplicate of the closed iron helmet geometry,
      // changing only the metal finish to bright silver.
      const steelMetal = mat(STEEL_ARMOR_COLOR, 0.82, 0.16),
        steelSlit = mat("#101417", 0.15, 0.3),
        steelDome = boxyLoft(
          this.headVisual,
          [
            [0, 2.12, -0.1, 0.275, 0.205],
            [0, 2.3, -0.09, 0.325, 0.26],
            [0, 2.5, -0.06, 0.334, 0.3],
            [0, 2.69, -0.055, 0.322, 0.29],
            [0, 2.82, -0.06, 0.23, 0.21],
            [0, 2.88, -0.065, 0.08, 0.07],
          ],
          steelMetal,
          12,
          0.58,
        ),
        steelVisor = box(this.headVisual, 0.505, 0.445, 0.075, 0, 2.405, 0.25, steelMetal),
        steelEyeSlit = box(this.headVisual, 0.365, 0.04, 0.018, 0, 2.515, 0.294, steelSlit),
        steelNoseGuard = box(this.headVisual, 0.06, 0.285, 0.035, 0, 2.375, 0.3, steelMetal);
      steelDome.name = "equipment.armor.steelHelmet.dome";
      steelVisor.name = "equipment.armor.steelHelmet.visor";
      steelEyeSlit.name = "equipment.armor.steelHelmet.eyeSlit";
      steelNoseGuard.name = "equipment.armor.steelHelmet.noseGuard";
      steelHelmet.push(steelDome, steelVisor, steelEyeSlit, steelNoseGuard);
      steelHelmet.forEach((object) => (object.visible = false));
    }
    for (const side of [-1, 1] as const) {
      ell(
        this.headVisual,
        side * 0.255,
        2.4,
        -0.005,
        0.052,
        0.084,
        0.054,
        skin,
      );
      box(
        this.headVisual,
        0.07,
        0.078,
        0.012,
        side * 0.102,
        2.43,
        0.246,
        black,
      );
      const brow = box(
        this.headVisual,
        0.11,
        0.016,
        0.008,
        side * 0.102,
        2.515,
        0.224,
        hair,
      );
      brow.rotation.z = side * 0.08;
      this.buildArm(side, shoulder, coat, sleeves);
      this.buildLeg(side, trousers, boots);
      if (feminine && config.hairStyle === "espetado")
        for (let i = 0; i < 4; i++) {
          const spike = shadow(
            new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.25, 5), hair),
          );
          spike.position.set(
            side * (0.04 + i * 0.053),
            2.77 + (i % 2) * 0.035,
            -0.04,
          );
          spike.rotation.z = side * 0.32;
          this.headVisual.add(spike);
        }
    }
    ell(this.headVisual, 0, 2.35, 0.22, 0.042, 0.058, 0.025, skin);
    box(
      this.headVisual,
      0.105,
      0.014,
      0.006,
      0,
      2.285,
      0.216,
      mat("#784540", 0, 0.72),
    );
    this.wardrobe = {
      coat,
      sleeves,
      trousers,
      pantsTop,
      boots,
      skin: config.skin,
      outfit: config.outfit,
      feminine,
      beltObjects: [],
      armorObjects,
      armorHelmet,
      closedHelmet,
      steelHelmet,
      underwear,
      pantsWaist,
      pantsGlute,
      skirt,
      nipples,
    };
    if (config.className === "Explorador")
      loft(
        this.parts,
        [
          [0, 1.93, -0.22, 0.34, 0.04],
          [0, 1.49, -0.26, 0.42, 0.045],
          [0, 0.94, -0.28, 0.51, 0.055],
        ],
        shade,
      );
    this.parts.scale.setScalar(config.height);
    this.equipRightHand("espada");
    this.equipLeftHand(config.className === "Guardião" ? "escudo" : "nenhum");
    if (this.leftHandAnimator && this.rightHandAnimator) {
      this.animationController = new AnimationController({
        root: this.parts,
        hips: this.hips,
        spine: this.spine,
        chest: this.chest,
        neck: this.neck,
        head: this.head,
        left: {
          clavicle: this.leftClavicle,
          upperArm: this.leftUpperArm,
          forearm: this.leftForearm,
          thigh: this.leftThigh,
          shin: this.leftShin,
          ankle: this.leftAnkle,
          foot: this.leftFoot,
          hand: this.leftHand,
          handAnimator: this.leftHandAnimator,
        },
        right: {
          clavicle: this.rightClavicle,
          upperArm: this.rightUpperArm,
          forearm: this.rightForearm,
          thigh: this.rightThigh,
          shin: this.rightShin,
          ankle: this.rightAnkle,
          foot: this.rightFoot,
          hand: this.rightHand,
          handAnimator: this.rightHandAnimator,
        },
      });
      this.animationController.setGripPose(
        "right",
        this.poseForItem(this.rightItem),
      );
      this.animationController.setGripPose(
        "left",
        this.poseForItem(this.leftItem),
      );
      this.animationController.setState(this.animation);
    }
    this.debugHelper = new THREE.SkeletonHelper(this.parts);
    this.debugHelper.name = "debug.skeleton";
    this.debugHelper.visible = this.debugEnabled;
    this.group.add(this.debugHelper);
    for (const anchor of [
      this.leftGrip,
      this.rightGrip,
      this.leftFoot,
      this.rightFoot,
    ]) {
      const axes = new THREE.AxesHelper(0.16);
      axes.name = `debug.axes.${anchor.name || anchor.type}`;
      axes.visible = this.debugEnabled;
      anchor.add(axes);
      this.debugAxes.push(axes);
    }
  }

  update(dt: number) {
    this.animationController?.update(dt);
  }
}
