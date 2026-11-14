import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { AnimationState } from "../animation/AnimationController";
import type { GameAudio } from "../audio/GameAudio";
import type { ProceduralCharacter } from "../character";
import type { FlightImpactResponse } from '../editor/FlightImpactResponse';
import type { WorldEditorStore } from "../editor/WorldEditorSupport";
import type { PersistedInventory } from "../inventory/types";
import type { OpenWorld } from "../world/OpenWorld";
import { clothingFor } from "./ItemPreviews";
import { armorColor } from './armorMaterials';
import {
ITEM_BY_ID
} from "./catalog";
import { clothPantsColor,clothShirtColor } from './clothColors';
import { saveInventory } from "./persistence";
import { createProceduralItem } from "./proceduralItem";
import type {
EquipmentSlot,
InventoryItem
} from "./types";

export type ScabbardTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: [number, number];
  swordPosition?: [number, number, number];
};

export interface PlayerEquipmentContext {
  inventoryState: PersistedInventory;
  character: ProceduralCharacter;
  broomFlying: boolean;
  broomMountVisual: THREE.Object3D | null;
  controls: OrbitControls;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  openWorld: OpenWorld;
  buildMode: boolean;
  buildState: WorldEditorStore["state"];
  gameAudio: GameAudio;
  broomAimPitch: number;
  playerGroundHeightAt: (x: number, z: number, allowStepUp?: boolean) => number;
  broomFallVelocity: number;
  PLAYER_GROUND_OFFSET: number;
  mountDebug: { riderForward: number; riderHeight: number; legSpread: number; cameraDistance: number; cameraHeight: number; cameraTarget: number; };
  setAnimation: (next: AnimationState) => void;
  setPlayStatus: (text: string) => void;
  mounted: boolean;
  toggleMount: () => boolean;
  broomImpact: FlightImpactResponse;
  activeAction: { state: AnimationState; elapsed: number; duration: number; } | null;
  pressed: Set<string>;
  applyNimbusArmDebug: () => void;
  applyBroomRideDebug: () => void;
  equippedDecorations: THREE.Group;
  createHeldNimbusInstance: () => THREE.Group | null;
  mageHoodRoot: THREE.Group | null;
}

// Initialize only at the original bootstrap point. Live accessors preserve later state changes.
export function initializePlayerEquipment(context: PlayerEquipmentContext) {
  const { inventoryState, character, controls, camera, scene, openWorld, buildState, gameAudio, playerGroundHeightAt, PLAYER_GROUND_OFFSET, setPlayStatus, toggleMount, broomImpact, applyNimbusArmDebug, applyBroomRideDebug, equippedDecorations, createHeldNimbusInstance } = context;
  const equippedItems = new Map<EquipmentSlot, string>(
    Object.entries(inventoryState.equipped) as [EquipmentSlot, string][],
  );
  for (const [slot, id] of [...equippedItems]) {
    const catalogSlot = ITEM_BY_ID.get(id)?.slot;
    if (slot === "torso" && catalogSlot === "armor") {
      equippedItems.delete(slot);
      equippedItems.set("armor", id);
    }
  }
  const equippedNimbusSlot = () => (["rightHand", "leftHand"] as EquipmentSlot[]).find((slot) => equippedItems.get(slot) === "nimbus-2000");
  const nimbusCharacterSide = () => equippedNimbusSlot() === "rightHand" ? "left" as const : "right" as const;
  const hasEquippedNimbus = () => Boolean(equippedNimbusSlot());
  const syncBroomVisibility = () => {
    character.setHeldItemVisible("left", !(context.broomFlying && nimbusCharacterSide() === "left"));
    character.setHeldItemVisible("right", !(context.broomFlying && nimbusCharacterSide() === "right"));
    if (context.broomMountVisual) context.broomMountVisual.visible = context.broomFlying;
  };
  const setBroomCameraFreedom = (active: boolean) => {
    controls.minPolarAngle = active ? Math.PI * .03 : 0;
    controls.maxPolarAngle = Math.PI * .97;
    controls.minDistance = active ? 2 : 3.5;
    controls.maxDistance = 3200;
    controls.zoomSpeed=active?2.2:1;
    camera.far=5000;
    camera.updateProjectionMatrix();
    if(scene.fog instanceof THREE.Fog){scene.fog.near=active?10000:18;scene.fog.far=active?10001:40;}
  };
  function toggleBroomFlight() {
    if (context.broomFlying) {
      context.broomFlying = false;
      openWorld.setFlightOverview(false);
      openWorld.setEditorOverview(context.buildMode && buildState.worldPreset === "arena-island-v1");
      openWorld.update(character.group.position);
      gameAudio.setFlight(false,false);
      context.broomAimPitch = 0;
      character.setBroomAimPitch(0);
      setBroomCameraFreedom(false);
      const dismountGround=playerGroundHeightAt(character.group.position.x,character.group.position.z);
      if(character.group.position.y>dismountGround+.08)context.broomFallVelocity=-1;
      else {character.group.position.y=dismountGround+PLAYER_GROUND_OFFSET;context.broomFallVelocity=0;}
      character.setMountedLegSpread(context.mountDebug.legSpread);
      character.setBroomRiding(false);
      syncBroomVisibility();
      context.setAnimation("idle");
      setPlayStatus("Vassoura Voadora desmontada");
      return true;
    }
    if (!hasEquippedNimbus()) {
      setPlayStatus("Equipe a Vassoura Voadora em uma das mãos para voar");
      return false;
    }
    if (!context.broomMountVisual) {
      setPlayStatus("A Vassoura Voadora ainda está sendo carregada");
      return false;
    }
    if (context.mounted) toggleMount();
    context.broomFlying = true;
    openWorld.setFlightOverview(buildState.worldPreset === "arena-island-v1");
    openWorld.setEditorOverview(context.buildMode && buildState.worldPreset === "arena-island-v1");
    openWorld.update(character.group.position);
    context.broomFallVelocity=0;
    broomImpact.reset();
    gameAudio.setFlight(false,false);
    setBroomCameraFreedom(true);
    context.activeAction = null;
    context.pressed.clear();
    const ground = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
    character.group.position.y = Math.max(character.group.position.y, ground + 1.15);
    character.setMountedLegSpread(.24);
    character.setBroomRiding(true);
    syncBroomVisibility();
    context.setAnimation("mounted");
    setPlayStatus("Voando na Vassoura Voadora · WASD · Espaço/Ctrl · F desmontar");
    return true;
  }
  let swordsSheathed = false;
  const hasInventoryWeapon = () =>
    [equippedItems.get("rightHand"), equippedItems.get("leftHand")].some((id) =>
      Boolean(
        id &&
        ITEM_BY_ID.get(id)?.category === "weapon" &&
        ITEM_BY_ID.get(id)?.visual !== "shield",
      ),
    );
  const hasEquippedWeapon = () => !swordsSheathed && hasInventoryWeapon();
  let draggedItem: {
    id: string;
    source: "inventory" | "slot";
    slot?: EquipmentSlot;
  } | null = null;
  const itemButton = (id: string) =>
    document.querySelector<HTMLButtonElement>(`[data-item-id="${id}"]`);
  const SCABBARD_TRANSFORM_KEY = "rpg3d.scabbardTransform";

  const loadScabbardTransform = (): ScabbardTransform | null => {
    try {
      return JSON.parse(
        localStorage.getItem(SCABBARD_TRANSFORM_KEY) ?? "null",
      ) as ScabbardTransform | null;
    } catch {
      return null;
    }
  };
  const applySavedScabbardTransform = () => {
    const saved = loadScabbardTransform();
    if (!saved) return;
    character.setScabbardTransform(saved.position, saved.rotation);
    if (saved.width) character.setScabbardWidth(saved.width);
    if (saved.swordPosition)
      character.setSheathedSwordPosition(saved.swordPosition);
  };
  const visualClothing = [
    "shirt",
    "ironShirt",
    "leatherShirt",
    "armor",
    "armorPants",
    "pants",
    "armorBoots",
    "armorGloves",
    "gloves",
    "armorHelmet",
    "closedHelmet",
    "steelHelmet",
    "boots",
    "belt",
    "shield",
  ] as const;
  const syncCharacterEquipment = () => {
    applyNimbusArmDebug();
    applyBroomRideDebug();
    for (const visual of visualClothing) character.setClothing(visual, false);
    equippedDecorations.clear();
    const oldCape=character.group.getObjectByName('PlayerSmoothCape');
    if(oldCape){
      oldCape.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
      oldCape.removeFromParent();
    }
    for (const [slot, id] of equippedItems) {
      const item = ITEM_BY_ID.get(id);
      if (!item) continue;
      const clothing = clothingFor(item);
      if (clothing) character.setClothing(clothing, true);
      const shirtColor = clothShirtColor(item.visual);
      if (shirtColor) character.setCivilianClothingColor(shirtColor);
      const equipmentColor = armorColor(item.visual);
      if (item.slot === "armor") {
        character.setArmorPartColor("torso", equipmentColor);
        character.setArmorShouldersVisible(item.visual !== "leather-chest");
      } else if (item.slot === "legs") {
        const pantsColor = clothPantsColor(item.visual);
        if (pantsColor) character.setClothPantsColor(pantsColor);
        else character.setArmorPartColor("legs", equipmentColor);
      }
      else if (item.slot === "boots" && !item.visual.includes("clothing"))
        character.setArmorPartColor("boots", equipmentColor);
      if(item.slot==='gloves')character.setArmorPartColor('gloves',equipmentColor);
      if(item.visual==='steel-helmet')character.setArmorPartColor('helmet',equipmentColor);
      if (
        (item.category === "accessory" &&
          item.slot !== "boots" &&
          !item.visual.startsWith("belt")) ||
        item.visual === "cape" ||
        item.visual === "pauldrons"
      ) {
        const decoration = createProceduralItem(item);
        if(item.visual==='cape'){
          decoration.name='PlayerSmoothCape';
          decoration.position.set(0,-.48,-.30);
          character.group.getObjectByName('Chest')?.add(decoration);
          continue;
        }
        decoration.scale.setScalar(item.visual === "cape" ? 0.72 : 0.24);
        decoration.position.set(
          0,
          item.visual === "cape" ? 1.35 : 1.5,
          item.visual === "cape" ? -0.24 : 0.28,
        );
        equippedDecorations.add(decoration);
      }
      void slot;
    }
    for (const side of ["right", "left"] as const) {
      const slot: EquipmentSlot = side === "right" ? "leftHand" : "rightHand",
        id = equippedItems.get(slot),
        item = id ? ITEM_BY_ID.get(id) : undefined,
        isHandItem =
          item &&
          (item.category === "weapon" ||
            item.slot === "leftHand" ||
            item.slot === "rightHand");
      character.equipProceduralHand(
        isHandItem
          ? item?.id === "nimbus-2000"
            ? createHeldNimbusInstance()
            : createProceduralItem(item)
          : null,
        side,
        item?.visual === "shield" ? "shield" : item?.id === "nimbus-2000" ? "magic" : "weapon",
      );
    }
    if (context.mageHoodRoot) {
      // Reattach after a character rebuild, which replaces the head group.
      character.attachHeadAccessory(context.mageHoodRoot);
      const hoodEquipped = equippedItems.get("head") === "mage-hood";
      context.mageHoodRoot.visible = hoodEquipped;
      character.setHoodHairHidden(false);
    }
    if (!hasInventoryWeapon()) swordsSheathed = false;
    character.setSwordSheathed(swordsSheathed);
    applySavedScabbardTransform();
    if (context.broomFlying && !hasEquippedNimbus()) toggleBroomFlight();
    else syncBroomVisibility();
    // Equipment is created dynamically after the portrait camera layers are
    // initialized. Keep every newly equipped mesh visible both in the world
    // (layer 0) and in the live inventory avatar (layer 2).
    character.group.traverse((object)=>{
      object.layers.enable(0);
      object.layers.enable(2);
    });
  };
  const totalStats = () => {
    const result = { attack: 10, defense: 0, hp: 100+(Math.max(1,inventoryState.level)-1)*20, stamina: 50 };
    for (const id of equippedItems.values()) {
      const stats = ITEM_BY_ID.get(id)?.stats;
      if (!stats) continue;
      result.attack += stats.attack ?? 0;
      result.defense += stats.defense ?? 0;
      result.hp += stats.hp ?? 0;
      result.stamina += stats.stamina ?? 0;
    }
    return result;
  };
  const persist = () => {
    inventoryState.equipped = Object.fromEntries(equippedItems);
    saveInventory(inventoryState);
  };
  const refreshCharacterStats = () => {
    const stats = totalStats();
    document.querySelector("#armorStat")!.textContent = String(stats.defense);
    document.querySelector("#attackStat")!.textContent = String(stats.attack);
    document.querySelector("#attackLabel")!.childNodes[0].textContent = "Ataque";
    document.querySelector(".inventory-stats div:nth-child(1) b")!.textContent =
      String(stats.hp);
    document.querySelector(".inventory-stats div:nth-child(2) b")!.textContent =
      String(stats.stamina);
  };
  const emptySlotNames: Record<EquipmentSlot, string> = {
    head: "Cabeça",
    torso: "Roupa",
    armor: "Armadura",
    legs: "Pernas",
    gloves: "Luvas",
    boots: "Botas",
    rightHand: "Mão direita",
    leftHand: "Mão esquerda",
    accessory: "Acessório",
  };
  const refreshEquipmentSlots = () => {
    document
      .querySelectorAll<HTMLButtonElement>("[data-equip-slot]")
      .forEach((slot) => {
        const slotName = (
            slot.dataset.equipSlot === "chest" ? "torso" : slot.dataset.equipSlot
          ) as EquipmentSlot,
          id = equippedItems.get(slotName),
          item = id ? ITEM_BY_ID.get(id) : undefined,
          preview = slot.querySelector<HTMLElement>("span")!,
          label = slot.querySelector<HTMLElement>("small")!;
        slot.classList.toggle("occupied", Boolean(item));
        slot.dataset.item = id ?? "";
        if (item) {
          const source = itemButton(item.id);
          preview.style.backgroundImage =
            source?.querySelector<HTMLElement>("span")?.style.backgroundImage ??
            "";
          label.textContent = item.name;
        } else {
          preview.style.backgroundImage = "";
          label.textContent = emptySlotNames[slotName] ?? "Vazio";
        }
      });
    document
      .querySelectorAll<HTMLElement>("[data-item-id]")
      .forEach((card) =>
        card.classList.toggle(
          "equipped",
          [...equippedItems.values()].includes(card.dataset.itemId!),
        ),
      );
    refreshCharacterStats();
  };
  const isHandSlot = (slot: EquipmentSlot) =>
    slot === "rightHand" || slot === "leftHand";
  const canEquip = (item: InventoryItem, slot: EquipmentSlot) =>
    isHandSlot(slot)
      ? item.category === "weapon" || item.category === "magic" ||
        item.slot === "leftHand" ||
        item.slot === "rightHand"
      : item.slot === slot;
  const equipItem = (item: InventoryItem, slot: EquipmentSlot) => {
    if (!canEquip(item, slot)) return;
    for (const [oldSlot, id] of equippedItems)
      if (id === item.id && oldSlot !== slot) equippedItems.delete(oldSlot);
    equippedItems.set(slot, item.id);
    syncCharacterEquipment();
    refreshEquipmentSlots();
    persist();
  };
  const unequipSlot = (slot: EquipmentSlot) => {
    if (!equippedItems.has(slot)) return;
    equippedItems.delete(slot);
    syncCharacterEquipment();
    refreshEquipmentSlots();
    persist();
  };
  let selectedQuickSlot = 0;
  const refreshQuickSlots = () => {
    while (inventoryState.quickSlots.length < 4)
      inventoryState.quickSlots.push(null);
    document
      .querySelectorAll<HTMLButtonElement>("[data-quick-slot]")
      .forEach((button) => {
        const index = Number(button.dataset.quickSlot),
          id = inventoryState.quickSlots[index],
          item = id ? ITEM_BY_ID.get(id) : undefined,
          preview = button.querySelector<HTMLElement>("span")!,
          label = button.querySelector<HTMLElement>("b")!,
          quantity = button.querySelector<HTMLElement>("em")!;
        button.classList.toggle("selected", index === selectedQuickSlot);
        button.classList.toggle("occupied", Boolean(item));
        button.dataset.item = item?.id ?? "";
        if (item) {
          preview.style.backgroundImage =
            itemButton(item.id)?.querySelector<HTMLElement>("span")?.style
              .backgroundImage ?? "";
          label.textContent = item.name;
          quantity.textContent = String(inventoryState.quantities[item.id] ?? 0);
        } else {
          preview.style.backgroundImage = "";
          label.textContent = "Vazio";
          quantity.textContent = "";
        }
      });
  };

    return {
    refreshQuickSlots,
    refreshEquipmentSlots,
    syncCharacterEquipment,
    equippedItems,
    totalStats,
    itemButton,
    get selectedQuickSlot() { return selectedQuickSlot; },
    set selectedQuickSlot(value: typeof selectedQuickSlot) { selectedQuickSlot = value; },
    persist,
    unequipSlot,
    get draggedItem() { return draggedItem; },
    set draggedItem(value: typeof draggedItem) { draggedItem = value; },
    canEquip,
    equipItem,
    refreshCharacterStats,
    SCABBARD_TRANSFORM_KEY,
    hasEquippedWeapon,
    toggleBroomFlight,
    hasInventoryWeapon,
    get swordsSheathed() { return swordsSheathed; },
    set swordsSheathed(value: typeof swordsSheathed) { swordsSheathed = value; },
    hasEquippedNimbus,
  };
}
