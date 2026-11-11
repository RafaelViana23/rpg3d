import {CompanionKiss} from './editor/CompanionKiss';
import {PrincessBedRest} from './editor/PrincessBedRest';
import { clothShirtColor, clothPantsColor } from './inventory/clothColors';
import { CitizenConversations } from './editor/CitizenConversations';
import { applyAvenueFrontages } from './editor/AvenueFrontages';
import { applySecondaryAvenuesLayout } from './editor/SecondaryAvenues';
import { applyRoyalPalaceLayout, alignRoyalAvenueEntrance } from './editor/RoyalPalace';
import { applyRoyalAvenueLayout, updateRoyalAvenueUV } from './editor/RoyalAvenue';
import defaultCityLayout from './editor/default-city.json';
import { ownsHorse } from './player/HorseCommerce';
import { physicalDamage, DODGE_DURATION, DODGE_DISTANCE, DODGE_STAMINA, dodgeInvulnerable, dodgeProgress } from "./player/PlayerCombat";
import { GuildPanel } from './guild/GuildPanel';
import { grantExperience, recordGuildKill } from './guild/quests';
import { setItemThumbnail } from './inventory/ItemThumbnails';
import { cityMapFrame } from './ui/CityMapFrame';
import { ShopPanel } from './inventory/ShopPanel';
import { armorColor } from './inventory/armorMaterials';
import { rideableHorses, registerRideableHorse, nearestRideableHorse, resolveHorseCollision, updateHorseLook, resetHorseLook, updateRideableHorses } from './player/RideableHorses';
import { advancePlayerVertical } from './player/PlayerVerticalMotion';
import { seedCityPerimeter, PERIMETER_CATALOG } from './editor/CityPerimeter';
import { FlightImpactResponse } from './editor/FlightImpactResponse';
import { updateCityPropLoading } from './editor/CityPropLoading';
import { CityResidents } from "./editor/CityResidents";
import { toggleChurchDoor, churchDoorPrompt, updateChurchDoors } from "./editor/ChurchDoors";
import { updateCityFirelights } from "./editor/CityFirelight";
import { loadCityPropTemplate } from "./editor/CityProps";
import { updateCityAnimals, resolveCityAnimalCollisions } from "./editor/CityAnimals";
import { drawCityMinimap } from "./ui/CityMinimap";
import * as THREE from "three";
import { MedievalCityFloor } from "./world/MedievalCityFloor";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createWorldAssetLoader } from "./world/WorldAssetLighting";
import { removeCastleActors } from "./world/CastleAssets";
import { ANIMAL_TERRITORIES, animalPatrolPoints, findAnimalHabitatPoint, isAnimalHabitat } from "./world/AnimalTerritories";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DEFAULT_CONFIG, ProceduralCharacter } from "./character";
import type { AnimationState, MagicArmTuning, BroomRideNode, BroomRideTuning } from "./animation/AnimationController";
import {
  INVENTORY_CATALOG,
  ITEM_BY_ID,
} from "./inventory/catalog";
import { createProceduralItem } from "./inventory/proceduralItem";
import { loadInventory, saveInventory } from "./inventory/persistence";
import type {
  EquipmentSlot,
  InventoryItem,
  ItemCategory,
} from "./inventory/types";
import { DayNightSky } from "./world/DayNightSky";
import { LowPolyClouds } from "./world/LowPolyClouds";
import { ARENA_REGIONS, OpenWorld, type ForestBrushKind, type TerrainBrush, type TerrainBrushMode } from "./world/OpenWorld";
import { WorldEditorStore, type SavedBuildAsset } from "./editor/WorldEditorSupport";
import type { CityAssetKind, SavedCityObject } from "./editor/WorldEditorSupport";
import { MEDIEVAL_CATALOG } from "./editor/MedievalBuildings";
import { seedMedievalCity, seedWallWarehouses, separateWarehouseHouses, upgradeCityArchitecture } from "./editor/MedievalCityLayout";
import { LowPolyCityBuilder, createCityAsset } from "./editor/LowPolyCityBuilder";
import { RuntimeWorldStore, validPosition } from "./player/RuntimeWorldStore";
import { resolveCircleCollision } from "./world/CollisionSystem";
import { normalizeDamage, targetHeight, targetRadius } from "./combat/CombatRules";
import { setBarPercent, setHudStatus } from "./hud/HudUtilities";
import { PerformanceMonitor } from "./debug/PerformanceMonitor";
import { WeatherSystem } from "./world/WeatherSystem";
import { GameAudio } from "./audio/GameAudio";
import { SpellEffects } from "./magic/SpellEffects";
import { HAND_BONE_TUNING_STORAGE_KEY } from "./hand/HandBoneTuning";
import { SWORD_SOCKET_STORAGE_KEY } from "./hand/GripSolver";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
const itemCard = (item: InventoryItem) =>
  `<button data-item-id="${item.id}" data-category="${item.category}" data-slot="${item.slot ?? ""}" data-clothing="${item.slot === "torso" || !!clothPantsColor(item.visual) || item.visual === "mage-hood" || item.visual === "bracers" || item.visual === "leather-gloves" || item.visual === "leather-clothing-boots"}"><span></span><b>${item.name}</b><em>${item.quantity}</em></button>`;
const inventoryCards = INVENTORY_CATALOG.map(itemCard).join("");
const quickSlots = Array.from(
  { length: 4 },
  (_, index) =>
    `<button class="${index === 0 ? "selected" : ""}" data-quick-slot="${index}" title="Selecione o slot e escolha um consumível"><span></span><b>Vazio</b><em>0</em></button>`,
).join("");
const actionConsumables = Array.from(
  { length: 4 },
  (_, index) =>
    `<button class="action-slot consumable" data-quick-slot="${index}" title="Consumível rápido ${index + 1}"><kbd>${index + 1}</kbd><span></span><b>Vazio</b><em></em></button>`,
).join("");
const broomRideNodes: Array<[BroomRideNode,string]> = [
  ["center","Centro do personagem"],["chest","Peito"],["leftLeg","Perna esquerda"],["rightLeg","Perna direita"],
  ["leftShoulder","Braço esquerdo · ombro"],["leftElbow","Braço esquerdo · cotovelo"],["leftWrist","Braço esquerdo · pulso"],
  ["rightShoulder","Braço direito · ombro"],["rightElbow","Braço direito · cotovelo"],["rightWrist","Braço direito · pulso"],
];
const broomRideTransformFields = broomRideNodes.map(([key,label]) => `
  <fieldset><legend>${label} · posição</legend>${["X","Y","Z"].map((axis,index)=>`<label><b>${axis}</b><input data-broom-ride="${key}.position.${index}" type="number" step="0.01"></label>`).join("")}</fieldset>
  <fieldset><legend>${label} · rotação</legend>${["X","Y","Z"].map((axis,index)=>`<label><b>${axis}</b><input data-broom-ride="${key}.rotation.${index}" type="number" step="1"></label>`).join("")}</fieldset>
`).join("");
app.innerHTML = `
  <div class="scene-shell">
    <header>
      <div><p class="eyebrow">GBA · CHARACTER GROUND</p><h1>Personagem do lobby</h1></div>
    </header>
    <main id="viewport" aria-label="Personagem 3D do lobby">
      <div class="underwater-filter" id="underwaterFilter" aria-hidden="true"></div>
      <section class="game-hud" aria-label="Status do jogador">
        <div class="hud-crest"><span>LV</span><b id="hudLevel">1</b></div>
        <div class="hud-xp"><span>XP</span><i><em id="hudXpBar"></em></i><b id="hudXpText">0 / 100</b></div>
        <div class="hud-vitals">
          <div class="hud-bar hp"><label><span>HP</span><b id="hudHpText">100 / 100</b></label><i><em id="hudHpBar"></em></i></div>
        </div>
        <div class="hud-survival"><div><span>Fome</span><i><em id="hudHungerBar"></em></i><b id="hudHungerText">100</b></div><div><span>Sede</span><i><em id="hudThirstBar"></em></i><b id="hudThirstText">100</b></div></div>
      </section>
      <aside class="minimap" id="minimap"><canvas width="220" height="220"></canvas><span><kbd>M</kbd> Mapa</span></aside>
      <aside class="world-clock" aria-label="Dia e horário do mundo"><small>CRONOLOGIA</small><strong id="hudPhase">Dia 1 · 08:00</strong></aside>
      <aside class="time-editor hidden" id="timeEditor" aria-hidden="true">
        <header><strong>Editor de tempo <kbd>T</kbd></strong><output id="timeEditorValue">08:00</output><button type="button" data-time-close aria-label="Fechar editor de tempo">✕</button></header>
        <input id="timeSlider" type="range" min="0" max="24" step="0.05" value="8" aria-label="Hora do dia">
        <div class="time-editor-row"><label>Dia <input id="dayInput" type="number" min="1" max="999" value="1"></label><button type="button" data-time-pause>⏸ Pausar</button></div>
        <div class="time-presets"><button type="button" data-hour="6">Amanhecer</button><button type="button" data-hour="12">Meio-dia</button><button type="button" data-hour="18">Pôr do sol</button><button type="button" data-hour="0">Noite</button></div>
        <div class="time-speeds"><button class="active" type="button" data-time-speed="1">1×</button><button type="button" data-time-speed="10">10×</button><button type="button" data-time-speed="60">60×</button></div>
        <div class="weather-editor"><span>Clima</span><button class="active" type="button" data-weather="clear">Limpo</button><button type="button" data-weather="rain">Chuva</button><button type="button" data-weather="snow">Neve</button></div>
        <label class="weather-intensity">Intensidade <input id="weatherIntensity" type="range" min="0.15" max="1.5" step="0.05" value="0.8"></label>
      </aside>
      <aside class="transform-editor hidden" id="scabbardEditor" aria-hidden="true">
        <header><strong>Transformar bainha</strong><kbd>B</kbd></header>
        <small id="scabbardSide">Objeto</small>
        <fieldset><legend>Posição</legend>
          <label><b>X</b><input data-scabbard-position="0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-scabbard-position="1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-scabbard-position="2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação</legend>
          <label><b>X</b><input data-scabbard-rotation="0" type="number" step="1"></label>
          <label><b>Y</b><input data-scabbard-rotation="1" type="number" step="1"></label>
          <label><b>Z</b><input data-scabbard-rotation="2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Largura da bainha</legend>
          <label><b>X</b><input data-scabbard-width="0" type="number" min="0.1" step="0.05"></label>
          <label><b>Z</b><input data-scabbard-width="1" type="number" min="0.1" step="0.05"></label>
        </fieldset>
        <fieldset><legend>Posição da espada</legend>
          <label><b>X</b><input data-sword-position="0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-sword-position="1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-sword-position="2" type="number" step="0.01"></label>
        </fieldset>
        <footer><button type="button" data-scabbard-reset>Restaurar</button><span>Valores em graus</span></footer>
      </aside>
      <aside class="transform-editor hidden" id="hoodEditor" aria-hidden="true">
        <header><strong>Ajustar capuz</strong><kbd>N</kbd></header>
        <small>Capuz de Mago</small>
        <fieldset><legend>Posição</legend>
          <label><b>X</b><input data-hood-position="0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-hood-position="1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-hood-position="2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação</legend>
          <label><b>X</b><input data-hood-rotation="0" type="number" step="1"></label>
          <label><b>Y</b><input data-hood-rotation="1" type="number" step="1"></label>
          <label><b>Z</b><input data-hood-rotation="2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Tamanho</legend>
          <label><b>×</b><input data-hood-scale type="number" min="0.1" step="0.01"></label>
        </fieldset>
        <footer><button type="button" data-hood-reset>Restaurar</button><span>Salvo automaticamente</span></footer>
      </aside>
      <aside class="transform-editor nimbus-rig-editor hidden" id="nimbusHandEditor" aria-hidden="true">
        <header><strong>Ajustar Nimbus na mão</strong><kbd>V</kbd></header>
        <small>Encaixe no socket da espada</small>
        <fieldset><legend>Posição</legend>
          <label><b>X</b><input data-nimbus-position="0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-nimbus-position="1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-nimbus-position="2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação</legend>
          <label><b>X</b><input data-nimbus-rotation="0" type="number" step="1"></label>
          <label><b>Y</b><input data-nimbus-rotation="1" type="number" step="1"></label>
          <label><b>Z</b><input data-nimbus-rotation="2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Escala total</legend>
          <label><b>×</b><input data-nimbus-scale type="number" min="0.1" step="0.01"></label>
        </fieldset>
        <small>Rig do braço · ajustes sobre a animação normal</small>
        <fieldset><legend>Ombro · posição</legend>
          <label><b>X</b><input data-nimbus-arm="shoulder.position.0" type="number" step="0.01"></label><label><b>Y</b><input data-nimbus-arm="shoulder.position.1" type="number" step="0.01"></label><label><b>Z</b><input data-nimbus-arm="shoulder.position.2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Ombro · rotação</legend>
          <label><b>X</b><input data-nimbus-arm="shoulder.rotation.0" type="number" step="1"></label><label><b>Y</b><input data-nimbus-arm="shoulder.rotation.1" type="number" step="1"></label><label><b>Z</b><input data-nimbus-arm="shoulder.rotation.2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Cotovelo · posição</legend>
          <label><b>X</b><input data-nimbus-arm="elbow.position.0" type="number" step="0.01"></label><label><b>Y</b><input data-nimbus-arm="elbow.position.1" type="number" step="0.01"></label><label><b>Z</b><input data-nimbus-arm="elbow.position.2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Cotovelo · rotação</legend>
          <label><b>X</b><input data-nimbus-arm="elbow.rotation.0" type="number" step="1"></label><label><b>Y</b><input data-nimbus-arm="elbow.rotation.1" type="number" step="1"></label><label><b>Z</b><input data-nimbus-arm="elbow.rotation.2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Pulso · posição</legend>
          <label><b>X</b><input data-nimbus-arm="wrist.position.0" type="number" step="0.01"></label><label><b>Y</b><input data-nimbus-arm="wrist.position.1" type="number" step="0.01"></label><label><b>Z</b><input data-nimbus-arm="wrist.position.2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Pulso · rotação</legend>
          <label><b>X</b><input data-nimbus-arm="wrist.rotation.0" type="number" step="1"></label><label><b>Y</b><input data-nimbus-arm="wrist.rotation.1" type="number" step="1"></label><label><b>Z</b><input data-nimbus-arm="wrist.rotation.2" type="number" step="1"></label>
        </fieldset>
        <footer><button type="button" data-nimbus-reset>Restaurar</button><span>Salvo automaticamente</span></footer>
      </aside>
      <aside class="transform-editor mount-debug hidden" id="mountEditor" aria-hidden="true">
        <header><strong>Debug da montaria</strong><kbd>C</kbd></header>
        <small>Encaixe do cavaleiro e câmera</small>
        <fieldset><legend>Cavaleiro</legend>
          <label><b>Frente</b><input data-mount-debug="riderForward" type="number" step="0.02"></label>
          <label><b>Altura</b><input data-mount-debug="riderHeight" type="number" step="0.02"></label>
          <label><b>Pernas</b><input data-mount-debug="legSpread" type="number" min="0.1" max="1.2" step="0.05"></label>
        </fieldset>
        <fieldset><legend>Câmera</legend>
          <label><b>Dist.</b><input data-mount-debug="cameraDistance" type="number" min="1" step="0.1"></label>
          <label><b>Altura</b><input data-mount-debug="cameraHeight" type="number" min="0.2" step="0.1"></label>
          <label><b>Alvo</b><input data-mount-debug="cameraTarget" type="number" step="0.1"></label>
        </fieldset>
        <small>Nimbus em voo</small>
        <fieldset><legend>Vassoura · posição</legend>
          <label><b>X</b><input data-broom-model="position.0" type="number" step="0.01"></label><label><b>Y</b><input data-broom-model="position.1" type="number" step="0.01"></label><label><b>Z</b><input data-broom-model="position.2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Vassoura · rotação</legend>
          <label><b>X</b><input data-broom-model="rotation.0" type="number" step="1"></label><label><b>Y</b><input data-broom-model="rotation.1" type="number" step="1"></label><label><b>Z</b><input data-broom-model="rotation.2" type="number" step="1"></label>
        </fieldset>
        ${broomRideTransformFields}
        <footer><button type="button" data-mount-debug-reset>Restaurar</button><span>Salvo automaticamente</span></footer>
      </aside>
      <section class="world-map" id="worldMap" aria-hidden="true"><header><strong>Mapa da Cidade</strong><span id="mapPhase">Manhã</span><button type="button" aria-label="Fechar mapa">×</button></header><canvas width="720" height="520"></canvas><small>Você ▲ · Especiais ✦ · Caça ● · Cavalo ◆</small></section>
      <section class="action-bar" aria-label="Atalhos de consumíveis e magias">
        <div class="action-stamina hud-bar stamina contextual-hidden" aria-label="Vigor"><i><em id="hudStaminaBar"></em></i></div>
        <div class="action-group consumable-actions"><small>CONSUMÍVEIS</small>${actionConsumables}</div>
        <div class="action-divider"></div>
        <div class="action-group spell-actions"><small>MAGIAS</small>
          <button class="action-slot spell heal" data-spell="heal" title="Cura"><kbd>5</kbd><span>✚</span><b>Cura</b><em>12</em></button>
          <button class="action-slot spell fire" data-spell="firebolt" title="Bola de Fogo"><kbd>6</kbd><span>🔥</span><b>Bola de Fogo</b><em>10</em></button>
          <button class="action-slot spell lightning" data-spell="lightning" title="Relâmpago"><kbd>7</kbd><span>ϟ</span><b>Relâmpago</b><em>18</em></button>
          <button class="action-slot spell ice" data-ice-spell title="Segure para canalizar"><kbd>8</kbd><span>❄</span><b>Gelo</b><em>9/s</em></button>
        </div>
      </section>
      <div class="interaction-prompt" id="interactionPrompt" aria-live="polite"><span></span><kbd>E</kbd></div>
      <div class="gold-wallet" aria-label="Moedas de ouro"><span>●</span><b id="goldBalance">0</b><small>OURO</small></div>
      <section class="corpse-loot" id="corpseLoot" aria-hidden="true">
        <header><div><small>SAQUE DA CAÇA</small><strong id="corpseLootTitle">Itens encontrados</strong></div><kbd>E</kbd></header>
        <div id="corpseLootItems"></div>
        <footer>Clique em um item para guardar no inventário</footer>
      </section>
      <div class="npc-name" id="npcName">Eleonor</div>
      <div class="npc-name" id="npcNameAlice">Alice</div>
      <div class="npc-name" id="npcNameEmma">Emma</div>
      <section class="npc-dialogue" id="npcDialogue" aria-hidden="true">
        <header><div><small>CONVERSAR COM</small><strong>Eleonor</strong></div><kbd>E</kbd></header>
        <div>
          <button type="button" data-dialogue="welcome">Quem é você?</button>
          <button type="button" data-dialogue="aincrad">Onde estamos?</button>
          <button type="button" data-dialogue="hunt">Tem algum conselho?</button>
          <button type="button" data-dialogue="follow">Me siga</button>
          <button type="button" data-dialogue="wait">Espere aqui</button>
          <button type="button" data-dialogue="goodbye">Até logo.</button>
        </div>
      </section>
      <div class="npc-subtitle" id="npcSubtitle" aria-live="polite"><b>Eleonor</b><span></span></div>
      <div class="inventory-modal" id="inventoryModal" aria-hidden="true">
        <section class="inventory-window" role="dialog" aria-modal="true" aria-labelledby="inventoryTitle">
          <header class="inventory-rpg-header">
            <nav class="inventory-main-nav"><button type="button" data-open-build>Criação</button><button class="active" type="button" id="inventoryTitle" data-inventory-tab="player" data-main-tab="inventory">Inventário</button><span>Habilidades</span><button type="button" data-inventory-tab="map" data-main-tab="map">Mapa</button><span>Missões</span><button type="button" data-inventory-tab="settings" data-main-tab="settings">Configurações</button></nav>
            <div class="inventory-level"><b>1</b><span>NÍVEL</span><i><em></em></i></div>
            <button class="inventory-close" type="button" aria-label="Fechar inventário">×</button>
          </header>
          <nav class="inventory-tabs" aria-label="Personagem do inventário">
            <button class="active" data-inventory-tab="player">Personagem</button>
            <button data-inventory-tab="female">Mulher</button>
          </nav>
          <div class="inventory-content">
            <aside class="inventory-stats" aria-label="Atributos do personagem">
              <div class="stat-hp"><i>✚</i><span>HP<b>100</b></span></div>
              <div class="stat-stamina"><i>ϟ</i><span>VIGOR<b>50</b></span></div>
              <div><i>⬡</i><span>Defesa<b id="armorStat">0</b></span></div>
              <div><i>⚔</i><span id="attackLabel">Ataque<b id="attackStat">10</b></span></div>
            </aside>
            <div class="inventory-character-column">
              <div class="inventory-avatar" id="inventoryAvatar"><canvas aria-label="Avatar 3D ao vivo"></canvas><span>Arraste para girar</span></div>
              <section class="inventory-consumables" aria-label="Consumíveis"><strong>Consumíveis rápidos <small>Selecione um slot e escolha no inventário</small></strong><div class="consumable-grid">${quickSlots}</div></section>
            </div>
            <aside class="equipment-slots" aria-label="Itens equipados"><strong>Equipado</strong>
              <button data-equip-slot="head" draggable="true"><span></span><small>Capacete</small></button><button data-equip-slot="accessory" draggable="true"><span></span><small>Acessório</small></button>
              <button data-equip-slot="torso" draggable="true"><span></span><small>Roupa</small></button><button data-equip-slot="armor" draggable="true"><span></span><small>Armadura</small></button>
              <button data-equip-slot="legs" draggable="true"><span></span><small>Pernas</small></button><button data-equip-slot="gloves" draggable="true"><span></span><small>Luvas</small></button>
              <button data-equip-slot="boots" draggable="true"><span></span><small>Botas</small></button><span class="equipment-slot-spacer" aria-hidden="true"></span>
              <button class="hand-slot" data-equip-slot="leftHand" draggable="true"><span></span><small>Mão esquerda</small></button><button class="hand-slot" data-equip-slot="rightHand" draggable="true"><span></span><small>Mão direita</small></button>
            </aside>
            <div class="inventory-items">
              <div class="inventory-section-title"><span>Inventário de Aincrad</span><small id="inventoryCount">58 itens</small></div>
              <nav class="inventory-filters" aria-label="Filtros do inventário"><button class="active" data-filter="all">Todos</button><button data-filter="magic">Itens mágicos</button><button data-filter="weapon">Armas</button><button data-filter="clothing">Roupas</button><button data-filter="armor">Armaduras</button><button data-filter="accessory">Acessórios</button><button data-filter="consumable">Consumíveis</button><button data-filter="material">Materiais</button></nav>
              <div class="inventory-bulk-actions"><button type="button" id="inventorySelectMode">Selecionar</button><button type="button" id="inventoryDeleteSelected" disabled>Excluir selecionados <b>0</b></button></div>
              <div class="inventory-trash" id="inventoryTrash" aria-label="Excluir item"><span>⌫</span><b>Excluir item</b><small>Arraste aqui</small></div>
          <div class="inventory-grid inventory-panel active" data-inventory-panel="player">${inventoryCards}</div>
          <div class="inventory-grid inventory-panel" data-inventory-panel="female">
            <button class="equipped" data-female-modal-item="shirt"><span>👚</span><b>Camisa de pano</b><small>Manga longa branca</small></button>
            <button data-female-modal-item="ironShirt"><span>👚</span><b>Camisa de ferro</b><small>Manga longa cinza</small></button>
            <button data-female-modal-item="leatherShirt"><span>👚</span><b>Camisa de couro</b><small>Manga longa marrom</small></button>
            <button class="equipped" data-female-modal-item="pants"><span>👖</span><b>Calça</b><small>Calça ajustada</small></button>
            <button data-female-modal-item="skirt"><span>👗</span><b>Saia longa</b><small>Roupa alternativa</small></button>
            <button class="equipped" data-female-modal-item="boots"><span>🥾</span><b>Botas</b><small>Botas de couro</small></button>
            <button class="equipped" data-female-modal-item="gloves"><span>🧤</span><b>Luvas</b><small>Luvas marrons</small></button>
            <button class="equipped" data-female-modal-item="belt"><span>◉</span><b>Cinto</b><small>Acessório de cintura</small></button>
          </div>
          <section class="inventory-panel settings-panel" data-inventory-panel="settings" aria-label="Configurações do jogo">
            <header><small>ÁUDIO E ACESSIBILIDADE</small><h2>Configurações</h2><p>Ajuste cada canal do jogo. As alterações são salvas automaticamente.</p></header>
            <div class="settings-mixer">
              <label><span><b>Volume geral</b><small>Controle principal</small></span><input type="range" min="0" max="100" step="1" data-audio-setting="master"><output>80%</output></label>
              <label><span><b>Música</b><small>Trilha sonora</small></span><input type="range" min="0" max="100" step="1" data-audio-setting="music"><output>30%</output></label>
              <label><span><b>Voz</b><small>Diálogos e personagens</small></span><input type="range" min="0" max="100" step="1" data-audio-setting="voice"><output>80%</output></label>
              <label><span><b>Efeitos</b><small>Combate, magia e ambiente</small></span><input type="range" min="0" max="100" step="1" data-audio-setting="effects"><output>80%</output></label>
            </div>
            <label class="settings-toggle"><span><b>Legendas</b><small>Exibir diálogos na tela</small></span><input id="subtitlesToggle" type="checkbox"><i></i><output>Ligadas</output></label>
          </section>
          <section class="inventory-panel inventory-map-page" data-inventory-panel="map" aria-label="Mapa do mundo">
            <header><small>EXPLORAÇÃO</small><h2>Mapa do Campo</h2><span id="inventoryMapPhase">Manhã</span></header>
            <canvas id="inventoryMapCanvas" width="1100" height="520"></canvas>
            <footer>Você ▲ · Especiais ✦ · Caça ● · Cavalo ◆</footer>
          </section>
            </div>
          </div>
          <footer><span>Arraste um item até o slot para equipar</span><span>Arraste de volta ao inventário para retirar</span><span><kbd>I</kbd> Fechar</span></footer>
          <aside class="item-tooltip" id="itemTooltip" role="tooltip" aria-hidden="true"></aside>
        </section>
      </div>
      <section class="build-mode" id="buildMode" aria-hidden="true">
        <header><div><small>EDITOR DO MUNDO</small><strong>Modo Criação</strong></div><div><button type="button" data-build-collapse title="Ocultar painel">‹</button><button type="button" data-build-close aria-label="Sair do modo criação">×</button></div></header>
        <div class="build-toolbar" role="toolbar"><button class="active" type="button" data-build-tool="translate" title="Mover (W)">↔ <span>Mover</span></button><button type="button" data-build-tool="rotate" title="Girar (E)">⟳ <span>Girar</span></button><button type="button" data-build-tool="scale" title="Escalar (R)">⤢ <span>Escalar</span></button><button type="button" data-build-space>Global</button><button class="active" type="button" data-build-grid title="Mostrar ou ocultar a grade do chão"># Grade</button></div>
        <div class="build-history" role="toolbar" aria-label="Histórico e arquivo"><button type="button" data-build-undo title="Desfazer (Ctrl+Z)">↶ Desfazer</button><button type="button" data-build-redo title="Refazer (Ctrl+Shift+Z)">↷ Refazer</button><button type="button" data-build-duplicate title="Duplicar (Ctrl+D)">⧉ Duplicar</button><button type="button" data-build-export>Exportar JSON</button><button type="button" data-build-import>Importar JSON</button><input type="file" accept="application/json" data-build-import-file hidden></div>
        <nav class="build-tabs" aria-label="Seções do editor"><button class="active" data-build-tab="objects">Objetos</button><button data-build-tab="terrain">Terreno</button><button data-build-tab="world">Mundo</button></nav>
        <div class="build-panel-scroll">
        <div class="build-tab-panel" data-build-panel="terrain">
        <section class="terrain-editor">
          <header><span>Terreno low poly</span><button type="button" data-terrain-toggle>Ativar pincel</button></header>
          <div class="terrain-tools" role="toolbar">
            <button class="active" data-terrain-mode="raise">Elevar</button><button data-terrain-mode="lower">Abaixar</button><button data-terrain-mode="flatten">Achatar</button><button data-terrain-mode="plateau">Platô</button><button data-terrain-mode="hill">Morro</button><button data-terrain-mode="cliff">Penhasco</button><button data-terrain-mode="ramp">Rampa</button><button data-terrain-mode="smooth">Suavizar</button><button data-terrain-mode="paint">Pintar</button><button data-terrain-mode="road">Estrada</button><button data-terrain-mode="forest">Preencher floresta</button>
            <button data-terrain-mode="forestErase">Borracha de floresta</button>
          </div>
          <label>Material <select data-terrain-material><option value="grass">Grama</option><option value="dirt">Terra</option><option value="sand">Areia</option><option value="stone">Pedra</option><option value="snow">Neve</option></select></label>
          <div data-forest-brush-options hidden>
            <label>Assets <select data-forest-brush-kind><option value="mixed">Árvores + grama + pedras</option><option value="trees">Só árvores</option><option value="grass">Só grama</option><option value="rocks">Só pedras</option></select></label>
            <label>Densidade <input data-forest-brush-density type="range" min="0.25" max="3" step="0.25" value="1"><output>1×</output></label>
            <small>Arraste para preencher somente a grama. Sobrepor o mesmo trecho não duplica o preenchimento. Use Desfazer para remover a pincelada.</small>
          </div>
          <label>Raio <input data-terrain-radius type="range" min="4" max="64" step="1" value="16"><output>16</output></label>
          <label>Intensidade <input data-terrain-strength type="range" min="0.25" max="8" step="0.25" value="2"><output>2</output></label>
          <label>Formato <select data-terrain-shape><option value="circle">Circular</option><option value="square">Quadrado</option></select></label>
          <small>Arraste no terreno · Shift inverte elevar/abaixar · rampa: arraste do início ao fim</small>
        </section>
        </div>
        <div class="build-tab-panel active" data-build-panel="objects">
        <div class="asset-folder-tools"><button type="button" data-folder-create>＋ Criar pasta</button><small>Arraste assets entre as pastas</small></div>
        <div hidden aria-hidden="true"><input data-city-layer value="Cidade"><input data-city-width type="range" value="4"><input data-city-grid type="number" value="1"><select data-city-category><option value="all">Todas</option></select><input data-city-search><output data-city-selection></output><button data-city-cancel></button><button data-city-duplicate></button><button data-city-align></button><button data-city-clear></button></div>
        <label class="build-search"><span>Assets da cena</span><input type="search" id="buildSearch" placeholder="Buscar asset..."></label>
        <div class="build-assets" id="buildAssets"></div>
        <section class="build-inspector hidden"><header><span>Transformação</span><b id="buildSelectedName">Nenhum asset</b></header>
          <fieldset><legend>Posição</legend><label><b>X</b><input data-build-transform="position.x" type="number" step="0.1"></label><label><b>Y</b><input data-build-transform="position.y" type="number" step="0.1"></label><label><b>Z</b><input data-build-transform="position.z" type="number" step="0.1"></label></fieldset>
          <fieldset><legend>Rotação</legend><label><b>X</b><input data-build-transform="rotation.x" type="number" step="1"></label><label><b>Y</b><input data-build-transform="rotation.y" type="number" step="1"></label><label><b>Z</b><input data-build-transform="rotation.z" type="number" step="1"></label></fieldset>
          <fieldset class="build-uniform-scale"><legend>Escala geral</legend><label><b>Tamanho</b><input data-build-transform="scale.uniform" aria-label="Escala geral" type="number" min="0.01" step="0.05"></label></fieldset>
          <div class="build-actions"><button type="button" data-build-focus>Focar</button><button type="button" data-build-reset>Restaurar</button></div>
        </section>
        </div>
        <div class="build-tab-panel" data-build-panel="world">
        <section class="build-map-size"><header><span>Mapa · terreno principal</span><output id="buildMapSizeOutput">50 × 35</output></header><label>Largura <input id="buildMapWidth" type="number" min="1" step="1" value="50"></label><label>Profundidade <input id="buildMapDepth" type="number" min="1" step="1" value="35"></label></section>
          <div class="world-editor-actions"><button class="active" type="button" data-editor-camera>◉ Câmera livre · WASD</button></div>
        <section class="world-preset"><header><span>Mundo ativo</span><output data-world-preset-status>Ilha Arenas ativa</output></header><label>Editar região <select data-arena-region><option value="">Selecionar...</option>${ARENA_REGIONS.map((region,index)=>`<option value="${index}">${region[0]}</option>`).join("")}</select></label><small>Este é o único mundo do projeto</small></section>
        </div>
        </div>
        <footer><span>Clique para selecionar · botão direito remove da cena</span> · <kbd>Esc</kbd> sair</footer>
      </section>
      <button class="build-badge" id="buildBadge" type="button" title="Mostrar editor"><b>MODO CRIAÇÃO</b><span>Mostrar painel</span></button>
    </main>
  </div>`;

const viewport = document.querySelector<HTMLDivElement>("#viewport")!;
const damageFlash=document.createElement("div");damageFlash.className="damage-flash";damageFlash.setAttribute("aria-hidden","true");viewport.append(damageFlash);
const showPlayerDamage=()=>{damageFlash.classList.remove("active");void damageFlash.offsetWidth;damageFlash.classList.add("active");};
const interactionPrompt =
  document.querySelector<HTMLElement>("#interactionPrompt")!;
const setInteractionPrompt = (text = "", key = "E") => {
  interactionPrompt.querySelector("span")!.textContent = text;
  interactionPrompt.querySelector("kbd")!.textContent = key;
  interactionPrompt.classList.toggle("visible", Boolean(text));
};
const setPlayStatus = (text: string) => {
  setHudStatus(text);
};
const scene = new THREE.Scene();
const gameAudio = new GameAudio();
window.addEventListener("pointerdown",()=>gameAudio.ensureStarted(),{once:true});
const subtitleStorageKey="rpg3d.subtitles.v1";
const subtitlesToggle=document.querySelector<HTMLInputElement>("#subtitlesToggle")!;
const applySubtitles=(enabled:boolean)=>{
  document.body.classList.toggle("subtitles-disabled",!enabled);
  subtitlesToggle.checked=enabled;
  subtitlesToggle.closest("label")!.querySelector("output")!.textContent=enabled?"Ligadas":"Desligadas";
  localStorage.setItem(subtitleStorageKey,String(enabled));
};
applySubtitles(localStorage.getItem(subtitleStorageKey)!=="false");
subtitlesToggle.addEventListener("change",()=>applySubtitles(subtitlesToggle.checked));
const savedAudioSettings=gameAudio.getSettings();
document.querySelectorAll<HTMLInputElement>("[data-audio-setting]").forEach((input)=>{
  const setting=input.dataset.audioSetting as keyof typeof savedAudioSettings;
  const output=input.closest("label")!.querySelector("output")!;
  input.value=String(Math.round(savedAudioSettings[setting]*100));
  output.textContent=`${input.value}%`;
  input.addEventListener("input",()=>{
    const value=Number(input.value)/100;
    gameAudio.setSettings({[setting]:value});
    output.textContent=`${input.value}%`;
  });
});
const spellEffects = new SpellEffects(scene);
scene.background = null;
scene.fog = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
camera.position.set(3.8, 2.6, 6.5);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
// Retina at DPR 2 renders four physical pixels for every CSS pixel. A 1.25
// ceiling keeps the image crisp while cutting the main framebuffer by 61%.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);
const performanceMonitor = new PerformanceMonitor(renderer);
type QualityLevel = "low" | "medium" | "high";
const QUALITY_PROFILES:Record<QualityLevel,{dpr:number;shadow:number;shadowDistance:number;simulationHz:number}>={
  low:{dpr:.7,shadow:512,shadowDistance:24,simulationHz:5},
  medium:{dpr:1,shadow:768,shadowDistance:20,simulationHz:8},
  high:{dpr:1.25,shadow:1024,shadowDistance:32,simulationHz:10}
};
let qualityLevel=(localStorage.getItem("rpg3d.quality") as QualityLevel)||"medium";
if(!(qualityLevel in QUALITY_PROFILES))qualityLevel="medium";
let quality=QUALITY_PROFILES[qualityLevel],lowFpsSamples=0;
const qualityControl=document.createElement("label");
qualityControl.className="quality-control";
qualityControl.innerHTML=`Qualidade <select aria-label="Qualidade gráfica"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select>`;
viewport.append(qualityControl);
const qualitySelect=qualityControl.querySelector("select")!;qualitySelect.value=qualityLevel;
const applyQuality=(level:QualityLevel,automatic=false)=>{
  qualityLevel=level;quality=QUALITY_PROFILES[level];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality.dpr));
  renderer.shadowMap.enabled=quality.shadow>0;sun.castShadow=quality.shadow>0;renderer.shadowMap.type=level==="high"?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  if(quality.shadow>0)sun.shadow.mapSize.set(quality.shadow,quality.shadow);
  localStorage.setItem("rpg3d.quality",level);qualitySelect.value=level;
  qualityControl.classList.toggle("automatic",automatic);
};
qualitySelect.addEventListener("change",()=>applyQuality(qualitySelect.value as QualityLevel));
performanceMonitor.onSample=(fps)=>{
  lowFpsSamples=fps<45?lowFpsSamples+1:Math.max(0,lowFpsSamples-1);
  if(lowFpsSamples<3)return;
  lowFpsSamples=0;
  if(qualityLevel==="high")applyQuality("medium",true);
  else if(qualityLevel==="medium")applyQuality("low",true);
};

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const PLAYER_CAMERA_HEAD_HEIGHT=2.25;
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PLAYER_CAMERA_HEAD_HEIGHT, 0);
controls.enableDamping = true;
controls.minDistance = 3.5;
controls.maxDistance = 3200;
controls.maxPolarAngle = Math.PI * 0.97;
controls.update();

const ambientLight = new THREE.HemisphereLight("#eaf5ff", "#574a38", 2.1);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight("#fff0d2", 4.1);
sun.position.set(7, 11, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -3;
sun.shadow.bias = -0.0003;
scene.add(sun);
applyQuality(qualityLevel);
const skySystem = new DayNightSky(scene, sun, ambientLight);
const cloudSystem = new LowPolyClouds(scene, { quality: "medium" });
const weatherSystem = new WeatherSystem(scene);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 35),
  new THREE.MeshStandardMaterial({
    color: "#777a7d",
    roughness: 0.92,
    metalness: 0.04,
  }),
);
floor.name = "Terreno principal";
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 7.5);
floor.receiveShadow = true;
const grid = new THREE.GridHelper(50, 50, "#2b2e30", "#55585a");
grid.name = "Grade do mapa";
grid.position.set(0, 0.008, 7.5);
(Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(
  (material) => {
    material.transparent = true;
    material.opacity = 0.62;
  },
);
// In-game world builder. It edits the real scene graph, so changes are
// immediately visible to gameplay and survive reloads through localStorage.
const BUILD_STORAGE_KEY = "rpg3d.worldBuilder.v1";
// Never replace an existing origin/profile save with a bundled recovery snapshot.
const worldEditorStore = new WorldEditorStore(BUILD_STORAGE_KEY);
const buildState = worldEditorStore.state;
const openWorld = new OpenWorld(scene, { worldSize: 2048, chunkSize: 128 }, buildState.terrain, buildState.worldPreset);
const PLAYER_GROUND_OFFSET=-.06;
openWorld.configureForestEditor(buildState.assets, buildState.removedAssets,buildState.forestErasures);
const cityBuilder = new LowPolyCityBuilder(scene, (x, z) => openWorld.getHeightAt(x, z));
// Seed the principal city as one persistent construction group: eight straight
// sides, a tower on every fold and gates on the east, west and south sides.
const CAPITAL_PREFIX="capital-octagon-", CAPITAL_LAYER="Cidade Principal";
const CAPITAL_SCALE_VERSION="3.75-towers-5-level-joints-v3", CAPITAL_SCALE_STORAGE_KEY="rpg3d.capitalScaleVersion";
const hasCapital=Object.keys(buildState.city).some((id)=>id.startsWith(CAPITAL_PREFIX));
const hasDefaultCityLayout=Object.entries(defaultCityLayout.city).every(([id,value])=>JSON.stringify(buildState.city[id])===JSON.stringify(value));
if(hasDefaultCityLayout)localStorage.setItem(CAPITAL_SCALE_STORAGE_KEY,CAPITAL_SCALE_VERSION);
if(!hasCapital||localStorage.getItem(CAPITAL_SCALE_STORAGE_KEY)!==CAPITAL_SCALE_VERSION){
  for(const id of Object.keys(buildState.city))if(id.startsWith(CAPITAL_PREFIX))delete buildState.city[id];
  const center=new THREE.Vector2(0,7.5), sideLength=172.5, radius=sideLength/(2*Math.sin(Math.PI/8));
  // Connected masonry shares one foundation elevation. Sampling each piece
  // independently produced the steps visible at every wall joint.
  const foundationY=openWorld.getHeightAt(center.x,center.y);
  const vertices=Array.from({length:8},(_,i)=>{
    const angle=Math.PI/8+i*Math.PI/4;
    return new THREE.Vector2(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius);
  });
  const addCapitalPart=(id:string,kind:"wall"|"gate"|"tower",x:number,z:number,rotationY=0,scaleX=3.75,scaleY=3.75,scaleZ=3.75)=>{
    buildState.city[id]={id,kind,layer:CAPITAL_LAYER,position:[x,foundationY,z],rotation:[0,rotationY,0],scale:[scaleX,scaleY,scaleZ]};
  };
  vertices.forEach((point,i)=>addCapitalPart(`${CAPITAL_PREFIX}tower-${i+1}`,"tower",point.x,point.y,-(Math.PI/8+i*Math.PI/4),5,5,5));
  const gateSides=new Set([0,4,6]);
  for(let side=0;side<8;side++){
    const a=vertices[side],b=vertices[(side+1)%8],dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz),rotationY=-Math.atan2(dz,dx);
    for(let segment=0;segment<3;segment++){
      const distance=41.25+segment*45,t=distance/length,x=a.x+dx*t,z=a.y+dz*t,isGate=segment===1&&gateSides.has(side),kind=isGate?"gate":"wall";
      addCapitalPart(`${CAPITAL_PREFIX}${kind}-${side+1}-${segment+1}`,kind,x,z,rotationY,isGate?45/14:3.75);
    }
  }
  localStorage.setItem(CAPITAL_SCALE_STORAGE_KEY,CAPITAL_SCALE_VERSION);
  worldEditorStore.save();
}
cityBuilder.rebuild(buildState.city);
const cityFloor=new MedievalCityFloor(scene);
const updateCityFloor=()=>{cityFloor.update(
  [...cityBuilder.objects.entries()].filter(([id])=>id.startsWith(`${CAPITAL_PREFIX}tower-`)).map(([,object])=>object),
  [...cityBuilder.objects.entries()].filter(([id])=>id.startsWith(`${CAPITAL_PREFIX}gate-`)).map(([,object])=>object),
  (x,z)=>openWorld.getHeightAt(x,z),
);
for(const object of cityBuilder.objects.values())if(object.userData.royalAvenue){
  updateRoyalAvenueUV(object,cityFloor.root);
  for(const palace of cityBuilder.objects.values())if(palace.userData.palaceComplex)updateRoyalAvenueUV(object,palace);
}
// Old versions saved each gate stair as a loose Build asset. Remove those
// overrides so the paving and all stairs remain welded to the capital.
for(const id of Object.keys(buildState.assets))if(id.startsWith("city-stairs-"))delete buildState.assets[id];
buildState.removedAssets=buildState.removedAssets.filter(value=>value!=="Escadaria de pedra do portão"&&!value.startsWith("city-stairs-"));
};
updateCityFloor();
if(seedMedievalCity(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
if(upgradeCityArchitecture(buildState.city,cityBuilder)){worldEditorStore.save();}
if(seedWallWarehouses(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
if(seedCityPerimeter(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
if(separateWarehouseHouses(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
if(applyRoyalAvenueLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
if(applyRoyalPalaceLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
if(alignRoyalAvenueEntrance(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
if(applySecondaryAvenuesLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
if(applyAvenueFrontages(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
openWorld.cityFloorHeightAt=(x,z)=>cityFloor.terrainHeightAt(x,z);
openWorld.cityTreeBlockedAt=(x,z,clearance)=>cityFloor.heightAt(x,z)!==null||cityFloor.blocksTreeAt(x,z,clearance+1)||cityBuilder.overlapsTree(x,z,Math.max(4,clearance+1));
const protectedBuildAssets = new Set(["LobbyCharacter", "Horse"]);
buildState.removedAssets = buildState.removedAssets.filter((name) => !protectedBuildAssets.has(name));
const saveBuildState = () => {updateCityFloor();worldEditorStore.save();};
saveBuildState();
const buildPanel = document.querySelector<HTMLElement>("#buildMode")!;
const buildBadge = document.querySelector<HTMLElement>("#buildBadge")!;
const buildAssetsHost = document.querySelector<HTMLElement>("#buildAssets")!;
const buildSelectedName = document.querySelector<HTMLElement>("#buildSelectedName")!;
const buildSearch = document.querySelector<HTMLInputElement>("#buildSearch")!;
const buildWidth = document.querySelector<HTMLInputElement>("#buildMapWidth")!;
const buildDepth = document.querySelector<HTMLInputElement>("#buildMapDepth")!;
const buildMapOutput = document.querySelector<HTMLOutputElement>("#buildMapSizeOutput")!;
const transformControls = new TransformControls(camera, renderer.domElement);
const transformHelper = transformControls.getHelper();
transformHelper.name = "WorldBuilderGizmo";
scene.add(transformHelper);
let buildMode = false;
let editorFreeCamera = true;
let selectedBuildAsset: THREE.Object3D | null = null;
let selectedBuildUniformScale = 1;
let selectedBuildGroundY = 0;
let buildAssetRefreshTimer = 0;
let lastBuildCandidateCount = -1;
let buildSpace: "world" | "local" = "world";
const buildInitialTransforms = new WeakMap<THREE.Object3D, SavedBuildAsset>();
const buildAssetRegistry = new Map<string, THREE.Object3D>();
const openBuildFolders = new Set<string>();
const ANIMAL_ASSET_CATALOG=[
  ["Cavalo","/models/animals/horse/model.glb",2.68],["Galinha","/models/animals/chicken/model.glb",.416],
  ["Gato","/models/animals/cat/model.glb",.72],["Rato","/models/animals/rat/model.glb",.125],
  ["Cervo","/models/animals/deer/model.glb",1.42],["Coelho","/models/animals/rabbit/model.glb",.52],
  ["Guaxinim","/models/animals/raccoon/model.glb",.58],["Urso","/models/animals/bear/model.glb",1.85],
  ["Lobo","/models/animals/dire-wolf/model.glb",1.42],["Leão-da-montanha","/models/animals/mountain-lion/model.glb",1.42],
  ["Tubarão","/models/animals/shark/model.glb",3],["Truta","/models/animals/trout/model.glb",.34],
  ["Gaivota","/models/animals/seagull/model.glb",.46],["Pássaros","/models/animals/sky-birds/model.glb",1]
] as const;
const animalAssetTemplates=new Map<string,THREE.Group>();
const BUILD_FOLDERS_KEY="rpg3d.buildFolders.v1";
type BuildFolderState={folders:string[];assets:Record<string,string>};
const buildFolderState:BuildFolderState=(()=>{try{return{folders:[],assets:{},...JSON.parse(localStorage.getItem(BUILD_FOLDERS_KEY)||"{}")};}catch{return{folders:[],assets:{}};}})();
const saveBuildFolders=()=>localStorage.setItem(BUILD_FOLDERS_KEY,JSON.stringify(buildFolderState));
let renderBuildThumbnail:(object:THREE.Object3D)=>string=()=>"";
const buildThumbnailCache=new WeakMap<THREE.Object3D,string>();
let proceduralDockTemplate:THREE.Group|null=null;
let fitProceduralDockSupports:(dock:THREE.Object3D)=>void=()=>{};
const buildTransformInputs = [...document.querySelectorAll<HTMLInputElement>("[data-build-transform]")];
const buildInspector = document.querySelector<HTMLElement>(".build-inspector")!;
const inspectedBuildObject = () => selectedBuildAsset ?? (selectedCityIds.size === 1 ? cityBuilder.objects.get([...selectedCityIds][0]) ?? null : null);
const terrainToggle = document.querySelector<HTMLButtonElement>("[data-terrain-toggle]")!;
const terrainRadius = document.querySelector<HTMLInputElement>("[data-terrain-radius]")!;
const terrainStrength = document.querySelector<HTMLInputElement>("[data-terrain-strength]")!;
const terrainMaterial = document.querySelector<HTMLSelectElement>("[data-terrain-material]")!;
const terrainShape = document.querySelector<HTMLSelectElement>("[data-terrain-shape]")!;
const forestBrushKind = document.querySelector<HTMLSelectElement>("[data-forest-brush-kind]")!;
const forestBrushDensity = document.querySelector<HTMLInputElement>("[data-forest-brush-density]")!;
let lastForestBrushPoint:THREE.Vector3|undefined;
forestBrushDensity.addEventListener("input",()=>{forestBrushDensity.parentElement!.querySelector("output")!.textContent=`${forestBrushDensity.value}×`;});
let terrainMode: TerrainBrushMode = "raise", terrainBrushEnabled = false, terrainPainting = false, terrainStrokeBefore = "", terrainFlattenHeight = 0;
let terrainRampStart: THREE.Vector3 | undefined;
let lastTerrainBrushAt=0, pendingTerrainBrush:{point:THREE.Vector3;shift:boolean}|undefined;
const terrainPreviewMaterial = new THREE.LineBasicMaterial({ color: "#8affae", transparent: true, opacity: .9, depthTest: false });
const circlePoints = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * Math.PI * 2), 0, Math.sin(i / 48 * Math.PI * 2)));
const squarePoints = [new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,0,-1),new THREE.Vector3(1,0,1),new THREE.Vector3(-1,0,1),new THREE.Vector3(-1,0,-1)];
const terrainCirclePreview = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints), terrainPreviewMaterial);
const terrainSquarePreview = new THREE.Line(new THREE.BufferGeometry().setFromPoints(squarePoints), terrainPreviewMaterial);
const terrainPreview = new THREE.Group(); terrainPreview.name = "Prévia do pincel de terreno"; terrainPreview.userData.buildEditable = false; terrainPreview.visible = false; terrainPreview.renderOrder = 20; terrainPreview.add(terrainCirclePreview, terrainSquarePreview); scene.add(terrainPreview);
const cityLayerInput = document.querySelector<HTMLInputElement>("[data-city-layer]")!, cityWidthInput = document.querySelector<HTMLInputElement>("[data-city-width]")!, cityGridInput = document.querySelector<HTMLInputElement>("[data-city-grid]")!;
const citySelectionOutput = document.querySelector<HTMLOutputElement>("[data-city-selection]")!, cityCategoryInput = document.querySelector<HTMLSelectElement>("[data-city-category]")!;
let cityPlacementKind: CityAssetKind | null = null, cityPreview: THREE.Group | null = null, cityPathPoints: THREE.Vector3[] = [];
const cityPathPreview = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#66ef9b", transparent: true, opacity: .65, depthTest: false })); cityPathPreview.visible = false; cityPathPreview.userData.buildEditable = false; scene.add(cityPathPreview);
const selectedCityIds = new Set<string>(), cityGroupProxy = new THREE.Object3D(); cityGroupProxy.name = "Seleção de cidade"; cityGroupProxy.userData.buildEditable = false; scene.add(cityGroupProxy);
const citySelectionHelpers = new THREE.Group(); citySelectionHelpers.name = "Destaques da seleção"; citySelectionHelpers.userData.buildEditable = false; scene.add(citySelectionHelpers);
let cityGroupStart = new THREE.Vector3(), cityGroupRotationStart = new THREE.Quaternion(), cityGroupScaleStart = new THREE.Vector3(1,1,1);
let cityGroupObjectStarts = new Map<string, {position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>();
const cityAttachedStarts=new Map<THREE.Object3D,THREE.Matrix4>();
const cityAttachedStartMatrix=new THREE.Matrix4(),cityAttachedPreviousDelta=new THREE.Matrix4();
const startAttachedCityTransform=()=>{
  cityAttachedStarts.clear();cityAttachedPreviousDelta.identity();
  if(!isCapitalCitySelection())return;
  cityGroupProxy.updateMatrix();cityAttachedStartMatrix.copy(cityGroupProxy.matrix);
  for(const object of scene.children){
    if(object===character.group||object.userData.cityResidentManaged)continue;
    const horse=rideableHorses.get(object);
    const linkedHorse=!!horse?.root.userData.stableId;
    if(!linkedHorse&&(!object.userData.buildId||object.userData.buildEditable===false||cityFloor.heightAt(object.position.x,object.position.z)===null))continue;
    object.updateMatrix();cityAttachedStarts.set(object,object.matrix.clone());
  }
  if(cityFloor.heightAt(character.group.position.x,character.group.position.z)!==null){character.group.updateMatrix();cityAttachedStarts.set(character.group,character.group.matrix.clone());}
};
const applyAttachedCityTransform=()=>{
  if(!isCapitalCitySelection())return;
  cityGroupProxy.updateMatrix();
  const delta=cityGroupProxy.matrix.clone().multiply(cityAttachedStartMatrix.clone().invert());
  const step=delta.clone().multiply(cityAttachedPreviousDelta.clone().invert());
  cityResidents.transformWithCity(step);cityAttachedPreviousDelta.copy(delta);
  for(const [object,start]of cityAttachedStarts){
    delta.clone().multiply(start).decompose(object.position,object.quaternion,object.scale);
  }
  updateCityFloor();
};
const capitalCityIds=()=>Object.keys(buildState.city);
const isCapitalCitySelection=()=>{const ids=capitalCityIds();return ids.length>0&&ids.length===selectedCityIds.size&&ids.every(id=>selectedCityIds.has(id));};
const selectCapitalCity=()=>{selectedBuildAsset=null;selectedCityIds.clear();capitalCityIds().forEach(id=>selectedCityIds.add(id));updateCitySelection();};
document.querySelector<HTMLButtonElement>("[data-folder-create]")!.addEventListener("click",()=>{
  const name=prompt("Nome da nova pasta:")?.trim();if(!name||buildFolderState.folders.includes(name))return;
  buildFolderState.folders.push(name);openBuildFolders.add(name);saveBuildFolders();refreshBuildAssetList();
});
const updateCitySelection = () => {
  citySelectionOutput.value = isCapitalCitySelection()?"Cidade Principal · grupo":`${selectedCityIds.size} selecionado${selectedCityIds.size === 1 ? "" : "s"}`;
  for (const helper of citySelectionHelpers.children) { if (helper instanceof THREE.LineSegments) { helper.geometry.dispose(); const materials = Array.isArray(helper.material) ? helper.material : [helper.material]; materials.forEach((material) => material.dispose()); } } citySelectionHelpers.clear(); for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id); if (object) citySelectionHelpers.add(new THREE.BoxHelper(object, 0xe9bc69)); }
  if (selectedCityIds.size === 1) transformControls.attach(cityBuilder.objects.get([...selectedCityIds][0])!);
  else if (selectedCityIds.size > 1) { const center = new THREE.Vector3(); for (const id of selectedCityIds) center.add(cityBuilder.objects.get(id)!.position); center.multiplyScalar(1 / selectedCityIds.size); cityGroupProxy.position.copy(center); cityGroupProxy.rotation.set(0,0,0); cityGroupProxy.scale.set(1,1,1); transformControls.attach(cityGroupProxy); }
  else if (!selectedBuildAsset) transformControls.detach(); refreshBuildInspector();
};
const ghostCityObject = (object: THREE.Object3D, invalid = false) => object.traverse((child) => { if (!(child instanceof THREE.Mesh)) return; if (!child.userData.cityGhostMaterial) { const source = Array.isArray(child.material) ? child.material : [child.material]; const cloned = source.map((m) => { const copy = m.clone(); copy.transparent = true; copy.opacity = .42; copy.depthWrite = false; return copy; }); child.material = Array.isArray(child.material) ? cloned : cloned[0]; child.userData.cityGhostMaterial = true; } const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.color.set(invalid ? "#e85b55" : "#63e69a")); });
const clearCityPlacement = () => { cityPlacementKind = null; cityPathPoints = []; cityPreview?.removeFromParent(); cityPreview = null; cityPathPreview.visible = false; cityPathPreview.geometry.dispose(); cityPathPreview.geometry = new THREE.BufferGeometry(); document.querySelectorAll("[data-city-kind]").forEach((b) => b.classList.remove("active")); };
const startCityPlacement = (kind: CityAssetKind) => { clearCityPlacement(); terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; cityPlacementKind = kind; if (!["wall", "road", "path"].includes(kind)) { cityPreview = createCityAsset(kind); ghostCityObject(cityPreview); cityPreview.userData.buildEditable = false; scene.add(cityPreview); } };
const snapCityPoint = (point: THREE.Vector3) => { const gridSize = Math.max(0, Number(cityGridInput.value)); if (gridSize) { point.x = Math.round(point.x / gridSize) * gridSize; point.z = Math.round(point.z / gridSize) * gridSize; } point.y = openWorld.getHeightAt(point.x, point.z); return point; };
const savedCityObject = (kind: CityAssetKind, position: THREE.Vector3, points?: THREE.Vector3[]): SavedCityObject => ({ id: crypto.randomUUID(), kind, layer: cityLayerInput.value.trim() || "Cidade", position: position.toArray(), rotation: [0, 0, 0], scale: [1, 1, 1], points: points?.map((p) => p.toArray()), width: Number(cityWidthInput.value) });
const currentTerrainBrush = (shift = false): TerrainBrush => ({
  mode: shift && terrainMode === "raise" ? "lower" : shift && terrainMode === "lower" ? "raise" : terrainMode,
  radius: Number(terrainRadius.value), strength: Number(terrainStrength.value), shape: terrainShape.value as "circle" | "square", material: terrainMaterial.value as TerrainBrush["material"],
});
const terrainHit = (event: PointerEvent) => {
  const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(openWorld.getTerrainMeshes(), false)[0];
};
const updateTerrainPreview = (event: PointerEvent) => {
  if (!buildMode || !terrainBrushEnabled) { terrainPreview.visible = false; return undefined; }
  const hit = terrainHit(event); terrainPreview.visible = Boolean(hit); if (!hit) return undefined;
  terrainPreview.position.copy(hit.point); terrainPreview.position.y += .12; terrainPreview.scale.setScalar(Number(terrainRadius.value));
  terrainCirclePreview.visible = terrainShape.value === "circle"; terrainSquarePreview.visible = !terrainCirclePreview.visible; return hit;
};
const applyTerrainAt = (point: THREE.Vector3, shift = false) => {
  if(terrainMode==="forestErase"){
    const radius=Number(terrainRadius.value),kind=forestBrushKind.value as ForestBrushKind;
    if(lastForestBrushPoint&&lastForestBrushPoint.distanceTo(point)<Math.max(1,radius*.3))return;
    lastForestBrushPoint=point.clone();
    const modelIds=new Set(openWorld.getBiomeModels().filter(model=>openWorld.isForestModel(model.id,kind)).map(model=>model.id));
    const removed=new Set<string>();
    for(const [id,saved] of Object.entries(buildState.assets))if(saved.forestModel&&modelIds.has(saved.forestModel)&&Math.hypot(saved.position[0]-point.x,saved.position[2]-point.z)<=radius){delete buildState.assets[id];removed.add(id);}
    for(const object of [...scene.children])if(removed.has(object.userData.buildId))object.removeFromParent();
    openWorld.eraseForestBrush(point,radius,kind);return;
  }
  if(terrainMode==="forest"){
    if(lastForestBrushPoint&&lastForestBrushPoint.distanceTo(point)<Math.max(1,Number(terrainRadius.value)*.18))return;
    lastForestBrushPoint=point.clone();
    const objects=openWorld.paintForestBrush(point,Number(terrainRadius.value),Number(forestBrushDensity.value),forestBrushKind.value as ForestBrushKind);
    for(const object of objects){scene.add(object);buildState.assets[object.userData.buildId]=snapshotBuildAsset(object);}
    return;
  }
  openWorld.applyTerrainBrush(point, currentTerrainBrush(shift), terrainFlattenHeight, terrainRampStart);
};
const queueTerrainBrush=(point:THREE.Vector3,shift=false,force=false)=>{
  pendingTerrainBrush={point:point.clone(),shift};
  const now=performance.now();if(!force&&now-lastTerrainBrushAt<60)return;
  const pending=pendingTerrainBrush;pendingTerrainBrush=undefined;lastTerrainBrushAt=now;applyTerrainAt(pending.point,pending.shift);
};
terrainToggle.addEventListener("click", () => { terrainBrushEnabled = !terrainBrushEnabled; terrainToggle.classList.toggle("active", terrainBrushEnabled); terrainToggle.textContent = terrainBrushEnabled ? "Pincel ativo" : "Ativar pincel"; if (terrainBrushEnabled) selectBuildAsset(null); else terrainPreview.visible = false; });
document.querySelectorAll<HTMLButtonElement>("[data-terrain-mode]").forEach((button) => button.addEventListener("click", () => {
  terrainMode = button.dataset.terrainMode as TerrainBrushMode;lastForestBrushPoint=undefined;
  document.querySelectorAll("[data-terrain-mode]").forEach((item) => item.classList.toggle("active", item === button));
  const foliageMode=terrainMode==="forest"||terrainMode==="forestErase";
  document.querySelector<HTMLElement>("[data-forest-brush-options]")!.hidden=!foliageMode;
  forestBrushDensity.parentElement!.hidden=terrainMode==="forestErase";
  document.querySelector<HTMLElement>("[data-forest-brush-options] small")!.textContent=terrainMode==="forestErase"?"Arraste para apagar assets de Floresta dentro do raio. Não afeta Neve, terreno, castelo ou animais. Desfazer restaura a pincelada.":"Arraste para preencher somente a grama. Use Desfazer para remover a pincelada.";
  terrainPreviewMaterial.color.set(terrainMode==="forestErase"?"#ff8b77":"#8affae");
  terrainMaterial.parentElement!.hidden=foliageMode;
  terrainStrength.parentElement!.hidden=foliageMode;
  terrainShape.parentElement!.hidden=foliageMode;
  if(foliageMode){
    clearCityPlacement();terrainBrushEnabled=true;terrainToggle.classList.add("active");terrainToggle.textContent="Pincel ativo";selectBuildAsset(null);
  }
}));
for (const input of [terrainRadius, terrainStrength]) input.addEventListener("input", () => { input.parentElement!.querySelector("output")!.textContent = input.value; });
document.querySelectorAll<HTMLButtonElement>("[data-city-kind]").forEach((button) => button.addEventListener("click", () => { startCityPlacement(button.dataset.cityKind as CityAssetKind); button.classList.add("active"); }));
document.querySelector<HTMLButtonElement>("[data-city-cancel]")!.addEventListener("click", clearCityPlacement);
cityCategoryInput.addEventListener("change", () => document.querySelectorAll<HTMLElement>("[data-city-category-item]").forEach((item) => { item.hidden = cityCategoryInput.value !== "all" && item.dataset.cityCategoryItem !== cityCategoryInput.value; }));
const citySearchInput = document.querySelector<HTMLInputElement>("[data-city-search]")!;
const filterCityCatalog = () => { const query = citySearchInput.value.trim().toLowerCase(), category = cityCategoryInput.value; document.querySelectorAll<HTMLElement>("[data-city-category-item]").forEach((item) => { item.hidden = Boolean((category !== "all" && item.dataset.cityCategoryItem !== category) || (query && !item.dataset.cityLabel?.includes(query))); }); };
cityCategoryInput.addEventListener("change", filterCityCatalog); citySearchInput.addEventListener("input", filterCityCatalog);
document.querySelectorAll<HTMLButtonElement>("[data-build-tab]").forEach((button) => button.addEventListener("click", () => {
  const tab = button.dataset.buildTab!; document.querySelectorAll("[data-build-tab]").forEach((item) => item.classList.toggle("active", item === button)); document.querySelectorAll<HTMLElement>("[data-build-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.buildPanel === tab));
  if (tab !== "terrain") { terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; terrainPreview.visible = false; }
  if (tab !== "construction") clearCityPlacement();
}));
cityWidthInput.addEventListener("input", () => { cityWidthInput.parentElement!.querySelector("output")!.textContent = cityWidthInput.value; });
document.querySelector<HTMLButtonElement>("[data-city-clear]")!.addEventListener("click", () => { selectedCityIds.clear(); updateCitySelection(); });
document.querySelector<HTMLButtonElement>("[data-city-align]")!.addEventListener("click", () => {
  if (!selectedCityIds.size) return; worldEditorStore.checkpoint(); for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id)!; cityBuilder.alignToTerrain(object); buildState.city[id].position = object.position.toArray(); } saveBuildState();
});
document.querySelector<HTMLButtonElement>("[data-city-duplicate]")!.addEventListener("click", () => {
  if (!selectedCityIds.size) return; worldEditorStore.checkpoint(); const next = new Set<string>();
  for (const id of selectedCityIds) { const source = buildState.city[id], copy = structuredClone(source); copy.id = crypto.randomUUID(); copy.position[0] += Math.max(1, Number(cityGridInput.value)); copy.position[2] += Math.max(1, Number(cityGridInput.value)); buildState.city[copy.id] = copy; cityBuilder.add(copy); next.add(copy.id); }
  selectedCityIds.clear(); next.forEach((id) => selectedCityIds.add(id)); saveBuildState(); updateCitySelection();
});

const CASTLE_LOCKED_SCALE = 1.41;
const hasLockedBuildScale = (object: THREE.Object3D | null | undefined) => object?.name === "Castelo medieval";
const enforceLockedBuildScale = (object: THREE.Object3D | null | undefined) => {
  if (hasLockedBuildScale(object)) object!.scale.setScalar(CASTLE_LOCKED_SCALE);
};
const assetLabel = (object: THREE.Object3D, index: number) => object.name || `${object.type} ${index + 1}`;
const buildFolderFor = (object: THREE.Object3D, label: string) => {
  if (typeof object.userData.buildFolder === "string") return object.userData.buildFolder;
  if (typeof object.userData.biome === "string") return object.userData.biome;
  const value = `${object.name} ${label}`.toLowerCase();
  if (/lobbycharacter|npc_|warrior|eleonor|alice|emma|personagem/.test(value)) return "Personagens";
  if (/horse|cavalo|galinha|rato|urso|guaxinim|coelho|cervo|coiote|leão|deer|rabbit|bear|cat|wolf|raccoon|chicken|animal/.test(value)) return "Animais";
  if (/nuvem|céu|passar|bird|gaivota/.test(value)) return "Céu";
  if (/mar|água|tubarão|truta|shark|trout|water|sea/.test(value)) return "Água";
  return "Cenário";
};
const buildCandidates = () => [...scene.children, ...openWorld.getEditableForestAssets()].filter((object, index, all) => all.indexOf(object) === index).filter((object) => {
  if ((object.userData.buildEditable === false && !object.userData.animalModel) || object === transformHelper || object === grid || object === floor || object instanceof THREE.Light || object instanceof THREE.Camera) return false;
  let hasRenderable = false;
  object.traverse((child) => { if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) hasRenderable = true; });
  return hasRenderable;
});
const buildIdFor = (object: THREE.Object3D, index: number) => {
  if (!object.userData.buildId) {
    const slug = assetLabel(object, index).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    // Named game assets use a stable key. The previous index-based key could
    // change with asynchronous GLB loading and make edited scales appear to
    // reset on the next reload.
    const stableId = object.name ? slug : `${slug}-${index}`;
    if (object.name && !buildState.assets[stableId]) {
      const legacyId = Object.keys(buildState.assets).find((id) => id.startsWith(`${slug}-`));
      if (legacyId) buildState.assets[stableId] = buildState.assets[legacyId];
    }
    object.userData.buildId = stableId;
  }
  return object.userData.buildId as string;
};
const buildRemovalKey = (object: THREE.Object3D, index: number) => object.name || buildIdFor(object, index);
const removeBuildAssetFromScene = (object: THREE.Object3D) => {
  if (protectedBuildAssets.has(object.name)) {
    setPlayStatus(object.name === "Horse" ? "A montaria não pode ser removida" : "O jogador não pode ser removido");
    return;
  }
  const assets = buildCandidates(), index = assets.indexOf(object);
  if (index < 0) return;
  worldEditorStore.checkpoint();
  const key = buildRemovalKey(object, index);
  if (!buildState.removedAssets.includes(key)) buildState.removedAssets.push(key);
  if (selectedBuildAsset === object) { selectedBuildAsset = null; transformControls.detach(); refreshBuildInspector(); }
  object.removeFromParent();
  saveBuildState();
  refreshBuildAssetList();
};
const snapshotBuildAsset = (object: THREE.Object3D): SavedBuildAsset => ({
  position: object.position.toArray(), rotation: [object.rotation.x, object.rotation.y, object.rotation.z], scale: object.scale.toArray(), visible: true,
  ...(object.userData.forestModel ? { forestModel: object.userData.forestModel, label: object.name } : {}),
  ...(object.userData.harborModel ? { harborModel: object.userData.harborModel, label: object.name } : {}),
});
const applySavedBuildAsset = (object: THREE.Object3D, saved: SavedBuildAsset) => {
  if (object.name === "LobbyCharacter") {
    // Player position and facing belong to the live gameplay state. Restoring
    // an editor snapshot here could move the player away while the async scene
    // was still loading, making it look as if the character had disappeared.
    object.scale.fromArray(saved.scale);
  } else {
    object.position.fromArray(saved.position);
    object.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2]);
    object.scale.fromArray(saved.scale);
  }
  enforceLockedBuildScale(object);
  object.visible = true;
  openWorld.groundBiomeRock(object);
};
const persistSelectedBuildAsset = () => {
  if (!selectedBuildAsset) return;
  const assets = buildCandidates(), index = assets.indexOf(selectedBuildAsset);
  if (!openWorld.canPlaceBiomeAsset(selectedBuildAsset)) {
    const previous = buildState.assets[buildIdFor(selectedBuildAsset,index)] ?? buildInitialTransforms.get(selectedBuildAsset);
    if (previous) applySavedBuildAsset(selectedBuildAsset,previous);
    setPlayStatus(`Este modelo só pode ficar no bioma ${selectedBuildAsset.userData.biome}`);
    refreshBuildInspector();
    return;
  }
  if (index >= 0) buildState.assets[buildIdFor(selectedBuildAsset, index)] = snapshotBuildAsset(selectedBuildAsset);
  saveBuildState();
};
const refreshBuildInspector = () => {
  const inspected = inspectedBuildObject(); buildInspector.classList.toggle("hidden", !inspected);
  buildSelectedName.textContent = inspected?.name || inspected?.type || "Nenhum asset";
  buildTransformInputs.forEach((input) => {
    const [group, axis] = input.dataset.buildTransform!.split(".") as ["position" | "rotation" | "scale", "x" | "y" | "z" | "uniform"];
    input.disabled = !inspected || (axis === "uniform" && hasLockedBuildScale(inspected));
    if (!inspected) { input.value = ""; return; }
    const raw = axis === "uniform" ? inspected.scale.x : inspected[group][axis];
    input.value = (group === "rotation" ? THREE.MathUtils.radToDeg(raw) : raw).toFixed(2);
  });
};
const anchorSelectedAssetToGround = () => {
  if (!selectedBuildAsset) return;
  selectedBuildAsset.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(selectedBuildAsset);
  if (!box.isEmpty() && Number.isFinite(box.min.y)) {
    selectedBuildAsset.position.y += selectedBuildGroundY - box.min.y;
    selectedBuildAsset.updateMatrixWorld(true);
  }
};
const selectBuildAsset = (object: THREE.Object3D | null) => {
  if (object) selectedCityIds.clear();
  selectedBuildAsset = object;
  if (object) {
    enforceLockedBuildScale(object);
    if (!object.visible) object.visible = true;
    selectedBuildUniformScale = object.scale.x;
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    selectedBuildGroundY = box.isEmpty() ? object.position.y : box.min.y;
    transformControls.attach(object);
  }
  else transformControls.detach();
  refreshBuildInspector(); refreshBuildAssetList();
};
function refreshBuildAssetList() {
  openWorld.configureForestEditor(buildState.assets, buildState.removedAssets,buildState.forestErasures);
  if(openWorld.getBiomeModels().some(model=>model.id==="Vila do deserto")){
    let added=false;
    const placements=[[-790,290,0],[-725,290,Math.PI],[-758,350,Math.PI/2]];
    placements.forEach(([x,z,rotation],index)=>{
      const id=`desert-village-${index+1}`;
      if(buildState.assets[id]||buildState.removedAssets.includes(id))return;
      const model=openWorld.createBiomeModel("Vila do deserto");
      if(!model||!openWorld.canPlaceBiomeAsset(model,x,z))return;
      const ground=openWorld.getHeightAt(x,z);
      openWorld.applyTerrainBrush(new THREE.Vector3(x,ground,z),{mode:"plateau",radius:32,strength:5,shape:"square",material:"sand"},ground);
      model.name=`Vila do deserto · ${index+1}`;
      model.position.set(x,openWorld.getHeightAt(x,z),z);model.rotation.y=rotation;
      buildState.assets[id]=snapshotBuildAsset(model);added=true;
    });
    if(added){
      saveBuildState();
      openWorld.configureForestEditor(buildState.assets,buildState.removedAssets,buildState.forestErasures);
      queueMicrotask(()=>openWorld.refreshBiomeAssets());
    }
  }
  for (const [id, saved] of Object.entries(buildState.assets)) {
    if (!saved.forestModel || scene.children.some((object) => object.userData.buildId === id) || buildState.removedAssets.includes(id) || buildState.removedAssets.includes(saved.label ?? "")) continue;
    const model = openWorld.createBiomeModel(saved.forestModel);
    if (!model) continue;
    model.name = saved.label ?? `${saved.forestModel} · ${id}`;
    model.userData.buildId = id;
    applySavedBuildAsset(model, saved);
    model.visible = openWorld.canPlaceBiomeAsset(model);
    scene.add(model);
  }
  const query = buildSearch.value.trim().toLowerCase();
  let assets = buildCandidates();
  assets.forEach((object, index) => {
    if (!protectedBuildAssets.has(object.name) && buildState.removedAssets.includes(buildRemovalKey(object, index))) object.removeFromParent();
  });
  assets = buildCandidates();
  lastBuildCandidateCount = assets.length + openWorld.getBiomeModels().length;
  const folders = new Map<string, { hidden: boolean; render: () => HTMLElement }[]>();
  const animalModels = new Set<string>();
  assets.forEach((object, index) => {
    const id = buildIdFor(object, index), label = assetLabel(object, index);
    buildAssetRegistry.set(id, object);
    if (!buildInitialTransforms.has(object)) buildInitialTransforms.set(object, snapshotBuildAsset(object));
    const saved = buildState.assets[id];
    if (saved && !object.userData.buildStateApplied) { applySavedBuildAsset(object, saved); object.userData.buildStateApplied = true; }
    if (object.userData.biome) object.visible = openWorld.canPlaceBiomeAsset(object);
    // The library lists source models. Scatter instances remain selectable in the viewport.
    if (object.userData.biome && !object.userData.forestModel) return;
    const folderName = buildFolderFor(object, label);
    const isAnimalModel = Boolean(object.userData.animalModel);
    if (isAnimalModel) {
      if (animalModels.has(object.userData.animalModel)) return;
      animalModels.add(object.userData.animalModel);
    }
    const displayLabel = isAnimalModel ? object.userData.modelLabel as string : label;
    const hidden = Boolean(query && !displayLabel.toLowerCase().includes(query));
    const render = () => {
    const row = document.createElement("div"), button = document.createElement("button"), remove = document.createElement("button");
    row.className = "build-asset-row"; row.hidden = hidden;row.draggable=true;row.dataset.assetId=id;
    row.addEventListener("dragstart",event=>event.dataTransfer?.setData("text/build-asset",id));
    button.type = "button"; button.dataset.buildAsset = id;
    const thumbnail=renderBuildThumbnail(object);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${displayLabel}</span>`;
    if (isAnimalModel) { button.title = "Selecionar um exemplar deste modelo no mapa"; button.dataset.animalModel = object.userData.animalModel; }
    button.classList.toggle("active", object === selectedBuildAsset);
    button.addEventListener("click", () => selectBuildAsset(object));
    if (!isAnimalModel) button.addEventListener("contextmenu", (event) => { event.preventDefault(); removeBuildAssetFromScene(object); });
    remove.type = "button"; remove.className = "build-asset-delete"; remove.title = `Excluir ${label}`; remove.setAttribute("aria-label", `Excluir ${label}`); remove.textContent = "🗑";
    remove.addEventListener("click", () => removeBuildAssetFromScene(object));
    row.append(button);
    if (!isAnimalModel) row.append(remove);
    return row;
    };
    const folder = buildFolderState.assets[id]??(object.userData.forestModel ? "Objetos colocados" : isAnimalModel ? "Animais" : folderName);
    const entries = folders.get(folder) ?? [];
    entries.push({ hidden, render });
    folders.set(folder, entries);
  });
  // The object library is a source catalog, not a dump of every live scene
  // object. Keep only the four authored world-building collections.
  folders.clear();
  folders.set("Animais",[...animalAssetTemplates].map(([url,template])=>({
    hidden:Boolean(query&&!String(template.userData.modelLabel).toLowerCase().includes(query)),
    render:()=>{
      const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
      const thumbnail=renderBuildThumbnail(template);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${template.userData.modelLabel}</span>`;
      button.addEventListener("click",()=>{const object=cloneSkeleton(template) as THREE.Group;object.name=`${template.userData.modelLabel} · ${crypto.randomUUID().slice(0,8)}`;object.userData.animalModel=url;object.userData.modelLabel=template.userData.modelLabel;object.userData.buildEditable=true;object.position.set(controls.target.x,openWorld.getHeightAt(controls.target.x,controls.target.z),controls.target.z);scene.add(object);if(url.includes('/horse/'))registerRideableHorse(object,object.animations);selectBuildAsset(object);});
      row.append(button);return row;
    }
  })));
  const catalogModels=openWorld.getBiomeModels().filter(model=>
    model.biome==="Deserto"||
    (model.biome==="Floresta"&&/^(?:Pinheiro|Pedra)/i.test(model.label))||
    (model.biome==="Neve"&&/^Pinheiro/i.test(model.label))
  );
  const cityFoundation=[...MEDIEVAL_CATALOG,{kind:"wall" as const,label:"Muralha da cidade"},{kind:"gate" as const,label:"Portão da cidade"},{kind:"tower" as const,label:"Torre arredondada"}];
  for (const folder of ["Floresta","Neve","Deserto"]) folders.set(folder, catalogModels.filter((model) => model.biome === folder).map((model) => ({
    hidden: Boolean(query && !model.label.toLowerCase().includes(query)),
    render: () => {
      const row = document.createElement("div"), add = document.createElement("button");
      row.className = "build-asset-row";
      add.type = "button";
      const preview=openWorld.createBiomeModel(model.id),thumbnail=preview?renderBuildThumbnail(preview):"";
      add.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${model.label}</span>`;
      add.title = "Adicionar este modelo ao ponto central da câmera";
      add.dataset.forestModel = model.id;
      add.addEventListener("click", () => {
        const object = openWorld.createBiomeModel(model.id);
        if (!object) return;
        object.position.set(controls.target.x, openWorld.getHeightAt(controls.target.x, controls.target.z), controls.target.z);
        if (!openWorld.canPlaceBiomeAsset(object)) {
          setPlayStatus(`Este modelo só pode ser adicionado no bioma ${model.biome}`);
          return;
        }
        worldEditorStore.checkpoint();
        const id = `biome-placed-${crypto.randomUUID()}`;
        object.userData.buildId = id;
        object.name = `${model.label} · ${id.slice(-8)}`;
        object.position.set(controls.target.x, openWorld.getHeightAt(controls.target.x, controls.target.z), controls.target.z);
        scene.add(object);
        buildState.assets[id] = snapshotBuildAsset(object);
        saveBuildState();
        selectBuildAsset(object);
      });
      row.append(add);
      return row;
    },
  })));
  if(proceduralDockTemplate){
    const dockTemplate=proceduralDockTemplate;
    folders.get("Floresta")!.unshift({hidden:Boolean(query&&!"doca artesanal madeira floresta".includes(query)),render:()=>{
      const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
      const thumbnail=renderBuildThumbnail(dockTemplate);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>Doca artesanal</span>`;
      button.title="Adicionar doca procedural ao centro da câmera";
      button.addEventListener("click",()=>{
        worldEditorStore.checkpoint();const object=dockTemplate.clone(true),id=`dock-procedural-${crypto.randomUUID()}`;
        object.name=`Doca artesanal · ${id.slice(-8)}`;object.userData={...object.userData,buildId:id,harborModel:"procedural-dock",buildFolder:"Floresta",buildEditable:true};
        const x=controls.target.x,z=controls.target.z,y=openWorld.getHeightAt(x,z)+.3;object.position.set(x,y,z);scene.add(object);fitProceduralDockSupports(object);
        buildState.assets[id]=snapshotBuildAsset(object);saveBuildState();selectBuildAsset(object);refreshBuildAssetList();
      });row.append(button);return row;
    }});
  }
  const capitalEntry={hidden:Boolean(query&&!"cidade principal grupo capital".includes(query)),render:()=>{
    const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
    const tower=cityBuilder.objects.get(capitalCityIds().find(id=>id.includes("tower"))??"");const thumbnail=tower?renderBuildThumbnail(tower):"";
    button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>Cidade Principal <small>grupo</small></span>`;
    button.title="Selecionar e transformar a cidade inteira";button.classList.toggle("active",isCapitalCitySelection());button.addEventListener("click",selectCapitalCity);row.append(button);return row;
  }};
  const attachedCityEntry=(label:string,source:()=>THREE.Object3D|undefined)=>({hidden:Boolean(query&&!`${label} cidade vinculado`.toLowerCase().includes(query)),render:()=>{
    const row=document.createElement("div"),button=document.createElement("button"),object=source();row.className="build-asset-row";button.type="button";
    const thumbnail=object?renderBuildThumbnail(object):"";button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${label} <small>vinculado</small></span>`;
    button.title="Parte vinculada à Cidade Principal";button.classList.toggle("active",isCapitalCitySelection());button.addEventListener("click",selectCapitalCity);row.append(button);return row;
  }});
  const cityFloorEntry=attachedCityEntry("Chão da cidade",()=>cityFloor.root);
  const cityStairsEntry=attachedCityEntry("Escadarias da cidade",()=>cityFloor.getEditableStairs()[0]);
  folders.set("Cidade",[capitalEntry,cityFloorEntry,cityStairsEntry,...cityFoundation.map(item=>({hidden:Boolean(query&&!item.label.toLowerCase().includes(query)),render:()=>{
    const row=document.createElement("div"),button=document.createElement("button"),template=createCityAsset(item.kind);row.className="build-asset-row";button.type="button";
    const thumbnail=renderBuildThumbnail(template);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${item.label}</span>`;
    button.addEventListener("click",()=>{worldEditorStore.checkpoint();const position=new THREE.Vector3(controls.target.x,cityFloor.heightAt(controls.target.x,controls.target.z)??openWorld.getHeightAt(controls.target.x,controls.target.z),controls.target.z),saved=savedCityObject(item.kind,position);buildState.city[saved.id]=saved;cityBuilder.add(saved);selectedBuildAsset=null;selectedCityIds.clear();selectedCityIds.add(saved.id);saveBuildState();updateCitySelection();});row.append(button);return row;
  }}))]);
  const establishmentNames:Record<string,string>={...Object.fromEntries(PERIMETER_CATALOG.map(item=>[item.kind,item.label])),tavern:'Taverna',inn:'Pousada',shop:'Loja',weapons:'Loja de armas',potions:'Loja de poções',guild:'Guilda',warehouse:'Armazém',church:'Igreja',palace:'Palácio'};
  folders.set('Estabelecimentos',Object.values(buildState.city).filter(saved=>establishmentNames[saved.kind]).map(saved=>({
    hidden:Boolean(query&&!`${establishmentNames[saved.kind]} ${saved.id}`.toLowerCase().includes(query)),
    render:()=>{
      const row=document.createElement('div'),button=document.createElement('button');row.className='build-asset-row';button.type='button';
      const object=cityBuilder.objects.get(saved.id),thumbnail=object?renderBuildThumbnail(object):'';
      const icon=document.createElement('i');icon.className='asset-real-thumb';if(thumbnail)icon.style.backgroundImage=`url('${thumbnail}')`;
      const label=document.createElement('span');label.textContent=establishmentNames[saved.kind];
      button.append(icon,label);button.title='Selecionar este estabelecimento';button.classList.toggle('active',selectedCityIds.size===1&&selectedCityIds.has(saved.id));
      button.addEventListener('click',()=>{selectBuildAsset(null);selectedCityIds.clear();selectedCityIds.add(saved.id);updateCitySelection();});
      row.append(button);return row;
    },
  })));
  for(const custom of buildFolderState.folders)if(!folders.has(custom))folders.set(custom,[]);
  const order = [...new Set(["Floresta","Neve","Deserto","Animais","Cidade","Estabelecimentos",...buildFolderState.folders])];
  buildAssetsHost.replaceChildren(...order.flatMap((folder) => {
    const buttons = folders.get(folder); if (!buttons||(!buttons.length&&!(["Cidade","Animais"].includes(folder))&&!buildFolderState.folders.includes(folder))) return [];
    const details = document.createElement("details"), summary = document.createElement("summary"), content = document.createElement("div");
    details.className = "build-folder"; details.open = openBuildFolders.has(folder) || Boolean(query && buttons.some((entry) => !entry.hidden));
    const customFolder=buildFolderState.folders.includes(folder);
    summary.innerHTML = `<span>${folder}</span><b>${buttons.filter((button) => !button.hidden).length}</b>${customFolder?'<button type="button" class="folder-delete" title="Excluir pasta">×</button>':''}`;
    summary.querySelector(".folder-delete")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();buildFolderState.folders=buildFolderState.folders.filter(item=>item!==folder);for(const [id,value] of Object.entries(buildFolderState.assets))if(value===folder)delete buildFolderState.assets[id];saveBuildFolders();refreshBuildAssetList();});
    details.addEventListener("dragover",event=>{if(event.dataTransfer?.types.includes("text/build-asset")){event.preventDefault();details.classList.add("drag-over");}});
    details.addEventListener("dragleave",()=>details.classList.remove("drag-over"));
    details.addEventListener("drop",event=>{event.preventDefault();details.classList.remove("drag-over");const id=event.dataTransfer?.getData("text/build-asset");if(!id)return;buildFolderState.assets[id]=folder;saveBuildFolders();openBuildFolders.add(folder);refreshBuildAssetList();});
    const visibleEntries = buttons.filter((entry) => !entry.hidden);
    let renderedCount = 0;
    const more = document.createElement("button");
    more.type = "button";
    const renderNext = () => {
      more.remove();
      const next = visibleEntries.slice(renderedCount, renderedCount + 200);
      content.append(...next.map((entry) => entry.render()));
      renderedCount += next.length;
      if (renderedCount < visibleEntries.length) {
        more.textContent = `Mostrar mais · ${renderedCount} de ${visibleEntries.length}`;
        content.append(more);
      }
    };
    more.addEventListener("click", renderNext);
    const renderContents = () => { if (!content.childElementCount) renderNext(); };
    if (details.open) renderContents();
    details.append(summary, content);
    details.addEventListener("toggle", () => { if (details.open) { for(const sibling of buildAssetsHost.querySelectorAll<HTMLDetailsElement>(".build-folder[open]"))if(sibling!==details)sibling.open=false;openBuildFolders.clear();openBuildFolders.add(folder);renderContents(); } else openBuildFolders.delete(folder); });
    return [details];
  }));
}
openWorld.onBiomeModelsChanged = () => refreshBuildAssetList();
const applyEditorState = () => {
  openWorld.setWorldPreset(buildState.worldPreset);
  const terrainChanged=openWorld.replaceTerrainEdits(buildState.terrain);
  const proceduralAssetsChanged=openWorld.configureForestEditor(buildState.assets,buildState.removedAssets,buildState.forestErasures);
  if(terrainChanged||proceduralAssetsChanged)openWorld.refreshBiomeAssets();
  if (buildState.worldPreset === "arena-island-v1") preyAnimals.forEach(placePreyInArena);
  document.querySelector<HTMLOutputElement>("[data-world-preset-status]")!.value = "Ilha Arenas ativa";
  selectedCityIds.clear(); cityBuilder.rebuild(buildState.city); updateCityFloor(); updateCitySelection();
  for (const [id, object] of buildAssetRegistry) {
    if (object.userData.biome && !object.userData.forestModel) continue;
    if(object.userData.forestModel&&!buildState.assets[id]){object.removeFromParent();continue;}
    const removed = buildState.removedAssets.includes(object.name || id);
    if (removed) object.removeFromParent();
    else {
      if (!object.parent) scene.add(object);
      const saved = buildState.assets[id];
      if (saved) applySavedBuildAsset(object, saved);
      if (object.userData.biome) object.visible = openWorld.canPlaceBiomeAsset(object);
    }
  }
  buildWidth.value = String(buildState.mapWidth);
  buildDepth.value = String(buildState.mapDepth);
  applyBuildMapSize();
  refreshBuildAssetList();
  refreshBuildInspector();
};
const applyBuildMapSize = () => {
  const width = Math.max(1, Number(buildWidth.value) || 1), depth = Math.max(1, Number(buildDepth.value) || 1);
  buildWidth.value = String(width); buildDepth.value = String(depth);
  buildState.mapWidth = width; buildState.mapDepth = depth;
  floor.scale.set(width / 50, depth / 35, 1);
  grid.scale.set(width / 50, 1, depth / 50);
  buildMapOutput.value = `${width} × ${depth}`;
  if (buildMode) controls.maxDistance = 3200;
  camera.far = 5000; camera.updateProjectionMatrix();
  saveBuildState();
};
buildWidth.value = String(buildState.mapWidth); buildDepth.value = String(buildState.mapDepth); applyBuildMapSize();
const setTimeEditorOpen = (open: boolean) => {
  const editor = document.querySelector<HTMLElement>("#timeEditor")!;
  editor.classList.toggle("hidden", !open);
  editor.setAttribute("aria-hidden", String(!open));
  document.querySelector("[data-build-time]")?.setAttribute("aria-expanded", String(open));
};
const toggleTimeEditor = () => setTimeEditorOpen(document.querySelector("#timeEditor")!.classList.contains("hidden"));
document.querySelector("[data-time-close]")!.addEventListener("click", () => setTimeEditorOpen(false));
const buildTimeButton = document.createElement("button");
buildTimeButton.type = "button";
buildTimeButton.textContent = "◷ Tempo (T)";
buildTimeButton.setAttribute("data-build-time", "");
buildTimeButton.setAttribute("aria-controls", "timeEditor");
buildTimeButton.setAttribute("aria-expanded", "false");
buildTimeButton.addEventListener("click", toggleTimeEditor);
document.querySelector(".build-history")!.append(buildTimeButton);
const setBuildMode = (open: boolean) => {
  buildMode = open; buildPanel.classList.toggle("open", open); buildPanel.classList.remove("collapsed"); buildBadge.classList.remove("open"); document.body.classList.toggle("build-active", open);
  buildPanel.setAttribute("aria-hidden", String(!open));
  controls.minDistance = open ? 1 : 3.5;
  controls.maxDistance = 3200;
  camera.far = 5000;
  camera.updateProjectionMatrix();
  // World overview belongs exclusively to the editor. Enabling it for broom
  // flight synchronously builds the whole island and stalls the mount action.
  openWorld.setEditorOverview(open && buildState.worldPreset === "arena-island-v1");
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = open ? 10000 : 18;
    scene.fog.far = open ? 10001 : 40;
  }
  setTimeEditorOpen(open);
  if (open) { setInventoryOpen(false); pressed.clear(); requestAnimationFrame(()=>{if(buildMode)refreshBuildAssetList();}); buildAssetRefreshTimer = window.setInterval(() => { if (buildCandidates().length + openWorld.getBiomeModels().length !== lastBuildCandidateCount) refreshBuildAssetList(); }, 1200); }
  else { window.clearInterval(buildAssetRefreshTimer); selectBuildAsset(null); selectedCityIds.clear(); updateCitySelection(); clearCityPlacement(); terrainBrushEnabled = false; terrainPreview.visible = false; character.group.position.y = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET; snapCameraToPlayer(); }
};
let buildTransformBefore = "";
const snapSelectedCityGroup=()=>{
  if(!selectedCityIds.size||transformControls.getMode()!=="translate")return false;
  const selectedBox=new THREE.Box3().makeEmpty();for(const id of selectedCityIds){const object=cityBuilder.objects.get(id);if(object)selectedBox.union(new THREE.Box3().setFromObject(object));}
  let best:{id:string;axis:"x"|"z";delta:number}|undefined;
  const consider=(id:string,axis:"x"|"z",delta:number,overlap:number)=>{if(overlap<.35||Math.abs(delta)>1.35||best&&Math.abs(best.delta)<=Math.abs(delta))return;best={id,axis,delta};};
  for(const [id,object] of cityBuilder.objects){
    if(selectedCityIds.has(id))continue;const box=new THREE.Box3().setFromObject(object);
    const overlapX=Math.min(selectedBox.max.x,box.max.x)-Math.max(selectedBox.min.x,box.min.x),overlapZ=Math.min(selectedBox.max.z,box.max.z)-Math.max(selectedBox.min.z,box.min.z);
    consider(id,"x",box.min.x-selectedBox.max.x,overlapZ);consider(id,"x",box.max.x-selectedBox.min.x,overlapZ);
    consider(id,"z",box.min.z-selectedBox.max.z,overlapX);consider(id,"z",box.max.z-selectedBox.min.z,overlapX);
  }
  if(!best)return false;
  for(const id of selectedCityIds){const object=cityBuilder.objects.get(id)!;object.position[best.axis]+=best.delta;}
  selectedCityIds.add(best.id);updateCitySelection();setPlayStatus("Peças encaixadas · arraste para mover o grupo");return true;
};
transformControls.addEventListener("mouseDown", () => { buildTransformBefore = worldEditorStore.snapshot(); selectedBuildUniformScale=transformControls.object?.scale.x??1; cityGroupStart.copy(cityGroupProxy.position); cityGroupRotationStart.copy(cityGroupProxy.quaternion); cityGroupScaleStart.copy(cityGroupProxy.scale); cityGroupObjectStarts = new Map([...selectedCityIds].map((id) => {const object=cityBuilder.objects.get(id)!;return [id,{position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}];})); startAttachedCityTransform(); });
transformControls.addEventListener("mouseUp", () => { snapSelectedCityGroup();if(isCapitalCitySelection()){
  for(const [object]of cityAttachedStarts){if(object.userData.buildId)buildState.assets[object.userData.buildId]=snapshotBuildAsset(object);}
  saveRuntimeWorld();
}if (buildTransformBefore) worldEditorStore.checkpoint(buildTransformBefore); buildTransformBefore = ""; for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id)!; const saved = buildState.city[id]; saved.position = object.position.toArray(); saved.rotation = [object.rotation.x, object.rotation.y, object.rotation.z]; saved.scale = object.scale.toArray(); } saveBuildState(); });
transformControls.addEventListener("dragging-changed", (event) => { controls.enabled = !(event as THREE.Event & { value: boolean }).value; });
transformControls.addEventListener("objectChange", () => {
  const scaledObject=transformControls.object;
  if(scaledObject&&transformControls.getMode()==="scale"){
    if(hasLockedBuildScale(scaledObject)) enforceLockedBuildScale(scaledObject);
    else {
      const values=[scaledObject.scale.x,scaledObject.scale.y,scaledObject.scale.z];
      const uniform=values.reduce((chosen,value)=>Math.abs(value-selectedBuildUniformScale)>Math.abs(chosen-selectedBuildUniformScale)?value:chosen,values[0]);
      scaledObject.scale.setScalar(Math.max(.01,uniform));selectedBuildUniformScale=scaledObject.scale.x;
    }
    if(scaledObject===selectedBuildAsset)anchorSelectedAssetToGround();
  }
  if (selectedCityIds.size > 1 && transformControls.object === cityGroupProxy) {
    const mode=transformControls.getMode(),rotationDelta=cityGroupProxy.quaternion.clone().multiply(cityGroupRotationStart.clone().invert());
    const scaleDelta=new THREE.Vector3(cityGroupProxy.scale.x/cityGroupScaleStart.x,cityGroupProxy.scale.y/cityGroupScaleStart.y,cityGroupProxy.scale.z/cityGroupScaleStart.z);
    for(const id of selectedCityIds){const object=cityBuilder.objects.get(id)!,start=cityGroupObjectStarts.get(id)!;
      if(mode==="translate")object.position.copy(start.position).add(cityGroupProxy.position.clone().sub(cityGroupStart));
      else if(mode==="rotate"){object.position.copy(start.position).sub(cityGroupStart).applyQuaternion(rotationDelta).add(cityGroupStart);object.quaternion.copy(rotationDelta).multiply(start.quaternion);}
      else if(mode==="scale"){object.position.copy(start.position).sub(cityGroupStart).multiply(scaleDelta).add(cityGroupStart);object.scale.copy(start.scale).multiply(scaleDelta);}
    }
    applyAttachedCityTransform();
  }
  else if (selectedCityIds.size === 1 && transformControls.object === cityBuilder.objects.get([...selectedCityIds][0])) { const id = [...selectedCityIds][0], object = cityBuilder.objects.get(id)!; const saved = buildState.city[id]; saved.position = object.position.toArray(); saved.rotation = [object.rotation.x, object.rotation.y, object.rotation.z]; saved.scale = object.scale.toArray(); saveBuildState(); }
  refreshBuildInspector(); persistSelectedBuildAsset();
});
buildTransformInputs.forEach((input) => input.addEventListener("input", () => {
  const inspected = inspectedBuildObject(); if (!inspected) return;
  const [group, axis] = input.dataset.buildTransform!.split(".") as ["position" | "rotation" | "scale", "x" | "y" | "z" | "uniform"];
  if (axis === "uniform" && hasLockedBuildScale(inspected)) { enforceLockedBuildScale(inspected); refreshBuildInspector(); return; }
  const value = Number(input.value); if (!Number.isFinite(value)) return;
  if (axis === "uniform") inspected.scale.setScalar(Math.max(.01, value));
  else inspected[group][axis] = group === "rotation" ? THREE.MathUtils.degToRad(value) : value;
  if (selectedBuildAsset) { selectedBuildUniformScale = selectedBuildAsset.scale.x; if (axis === "uniform") anchorSelectedAssetToGround(); persistSelectedBuildAsset(); }
  else { const id = [...selectedCityIds][0], saved = buildState.city[id]; saved.position = inspected.position.toArray(); saved.rotation = [inspected.rotation.x, inspected.rotation.y, inspected.rotation.z]; saved.scale = inspected.scale.toArray(); saveBuildState(); }
}));
buildTransformInputs.forEach((input) => {
  input.addEventListener("focus", () => { buildTransformBefore = worldEditorStore.snapshot(); });
  input.addEventListener("change", () => { if (buildTransformBefore) worldEditorStore.checkpoint(buildTransformBefore); buildTransformBefore = ""; });
});
buildSearch.addEventListener("input", refreshBuildAssetList);
buildWidth.addEventListener("input", applyBuildMapSize); buildDepth.addEventListener("input", applyBuildMapSize);
document.querySelectorAll<HTMLButtonElement>("[data-build-tool]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.buildTool as "translate" | "rotate" | "scale"; transformControls.setMode(mode);
  document.querySelectorAll("[data-build-tool]").forEach((item) => item.classList.toggle("active", item === button));
}));
document.querySelector<HTMLButtonElement>("[data-build-space]")!.addEventListener("click", (event) => {
  buildSpace = buildSpace === "world" ? "local" : "world"; transformControls.setSpace(buildSpace);
  (event.currentTarget as HTMLButtonElement).textContent = buildSpace === "world" ? "Global" : "Local";
});
const buildGridButton = document.querySelector<HTMLButtonElement>("[data-build-grid]")!;
document.querySelector<HTMLElement>(".world-editor-actions")!.prepend(buildGridButton);
const setBuildGridVisible = (visible: boolean) => {
  grid.visible = visible;
  buildGridButton.classList.toggle("active", visible);
  buildGridButton.textContent = visible ? "# Grade" : "# Sem grade";
  localStorage.setItem("rpg3d.buildGridVisible", String(visible));
};
setBuildGridVisible(localStorage.getItem("rpg3d.buildGridVisible") !== "false");
buildGridButton.addEventListener("click", () => setBuildGridVisible(!grid.visible));
const worldPresetStatus = document.querySelector<HTMLOutputElement>("[data-world-preset-status]")!;
const refreshWorldPresetStatus = () => { worldPresetStatus.value = "Ilha Arenas ativa"; };
refreshWorldPresetStatus();
document.querySelector<HTMLSelectElement>("[data-arena-region]")!.addEventListener("change", (event) => { const index=Number((event.currentTarget as HTMLSelectElement).value);if(!Number.isInteger(index)||!ARENA_REGIONS[index])return;const [,x,z,radius]=ARENA_REGIONS[index];const y=openWorld.getHeightAt(x,z);controls.target.set(x,y,z);camera.position.set(x+radius*.7,y+radius*.45,z+radius*.7);controls.update(); });
document.querySelector<HTMLButtonElement>("[data-build-undo]")!.addEventListener("click", () => { if (worldEditorStore.undo()) applyEditorState(); });
document.querySelector<HTMLButtonElement>("[data-build-redo]")!.addEventListener("click", () => { if (worldEditorStore.redo()) applyEditorState(); });
document.querySelector<HTMLButtonElement>("[data-build-duplicate]")!.addEventListener("click", () => {
  if (!selectedBuildAsset || protectedBuildAssets.has(selectedBuildAsset.name)) return;
  worldEditorStore.checkpoint();
  const copy = selectedBuildAsset.clone(true);
  copy.name = `${selectedBuildAsset.name || selectedBuildAsset.type} cópia`;
  const duplicateSize=new THREE.Box3().setFromObject(selectedBuildAsset).getSize(new THREE.Vector3());
  // Place full construction groups beside the source instead of almost on
  // top of it. The old fixed 1.5 m offset stacked complete piers together.
  copy.position.x += Math.max(1.5,duplicateSize.x+1.5);
  copy.userData = { ...copy.userData, buildId: `duplicate-${crypto.randomUUID()}`, buildStateApplied: true };
  if (copy.userData.biome) {
    copy.userData.forestModel ??= copy.userData.assetVariant;
    if (!openWorld.canPlaceBiomeAsset(copy)) { setPlayStatus(`Este modelo só pode ficar no bioma ${copy.userData.biome}`); return; }
  }
  scene.add(copy);
  const id = copy.userData.buildId as string;
  buildAssetRegistry.set(id, copy);
  buildState.assets[id] = snapshotBuildAsset(copy);
  saveBuildState(); selectBuildAsset(copy); refreshBuildAssetList();
});
document.querySelector<HTMLButtonElement>("[data-build-export]")!.addEventListener("click", () => worldEditorStore.exportJson());
const buildImportFile = document.querySelector<HTMLInputElement>("[data-build-import-file]")!;
document.querySelector<HTMLButtonElement>("[data-build-import]")!.addEventListener("click", () => buildImportFile.click());
buildImportFile.addEventListener("change", async () => {
  const file = buildImportFile.files?.[0]; if (!file) return;
  try { await worldEditorStore.importFile(file); applyEditorState(); setPlayStatus("Mapa importado"); }
  catch { setPlayStatus("JSON de mapa inválido"); }
  buildImportFile.value = "";
});
window.addEventListener("keydown", (event) => {
  if (!buildMode || !(event.ctrlKey || event.metaKey)) return;
  if (event.code === "KeyZ") {
    event.preventDefault();
    const changed = event.shiftKey ? worldEditorStore.redo() : worldEditorStore.undo();
    if (changed) applyEditorState();
  } else if (event.code === "KeyD") {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("[data-build-duplicate]")?.click();
  }
});
document.querySelector<HTMLButtonElement>("[data-build-focus]")!.addEventListener("click", () => {
  const box=new THREE.Box3().makeEmpty();
  if(selectedBuildAsset)box.setFromObject(selectedBuildAsset);else for(const id of selectedCityIds){const object=cityBuilder.objects.get(id);if(object)box.union(new THREE.Box3().setFromObject(object));}
  if(box.isEmpty())return;const sphere = box.getBoundingSphere(new THREE.Sphere());
  controls.target.copy(sphere.center); camera.position.copy(sphere.center).add(new THREE.Vector3(Math.max(2, sphere.radius * 2), Math.max(1.5, sphere.radius), Math.max(2, sphere.radius * 2))); controls.update();
});
document.querySelector<HTMLButtonElement>("[data-build-reset]")!.addEventListener("click", () => {
  if (!selectedBuildAsset) return; const initial = buildInitialTransforms.get(selectedBuildAsset); if (initial) applySavedBuildAsset(selectedBuildAsset, initial); persistSelectedBuildAsset(); refreshBuildInspector();
});
document.querySelector<HTMLButtonElement>("[data-build-close]")!.addEventListener("click", () => setBuildMode(false));
document.querySelector<HTMLButtonElement>("[data-build-collapse]")!.addEventListener("click", () => { buildPanel.classList.add("collapsed"); buildBadge.classList.add("open"); });
buildBadge.addEventListener("click", () => { if (!buildMode) return; buildPanel.classList.remove("collapsed"); buildBadge.classList.remove("open"); });
document.querySelector<HTMLButtonElement>("[data-editor-camera]")!.addEventListener("click", (event) => { editorFreeCamera = !editorFreeCamera; const button = event.currentTarget as HTMLButtonElement; button.classList.toggle("active", editorFreeCamera); button.textContent = editorFreeCamera ? "◉ Câmera livre · WASD" : "◎ Câmera do jogador"; if (!editorFreeCamera) { controls.target.copy(character.group.position).add(new THREE.Vector3(0, 1, 0)); camera.position.copy(controls.target).add(new THREE.Vector3(4, 3, 6)); } });
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!buildMode || transformControls.dragging) return;
  if (terrainBrushEnabled && event.button === 0) {
    lastForestBrushPoint=undefined;
    const hit = updateTerrainPreview(event); if (!hit) return;
    event.preventDefault(); terrainPainting = true; terrainStrokeBefore = worldEditorStore.snapshot(); terrainFlattenHeight = hit.point.y; terrainRampStart = terrainMode === "ramp" ? hit.point.clone() : undefined; controls.enabled = false;
    lastTerrainBrushAt=0;pendingTerrainBrush=undefined;if (terrainMode !== "ramp") queueTerrainBrush(hit.point, event.shiftKey,true); return;
  }
  if (cityPlacementKind && event.button === 0) {
    const hit = terrainHit(event); if (!hit) return; const point = snapCityPoint(hit.point.clone()); event.preventDefault();
    if (["wall", "road", "path"].includes(cityPlacementKind)) {
      if (event.detail >= 2 && cityPathPoints.length >= 2) { const saved = savedCityObject(cityPlacementKind, new THREE.Vector3(), cityPathPoints); worldEditorStore.checkpoint(); buildState.city[saved.id] = saved; cityBuilder.add(saved); saveBuildState(); clearCityPlacement(); }
      else cityPathPoints.push(point);
      return;
    }
    if (!cityPreview) return; cityPreview.position.copy(point); cityBuilder.alignToTerrain(cityPreview);
    if (cityBuilder.overlaps(cityPreview)) { setPlayStatus("Posição bloqueada: construção sobreposta"); return; }
    const saved = savedCityObject(cityPlacementKind, cityPreview.position); saved.rotation = [cityPreview.rotation.x, cityPreview.rotation.y, cityPreview.rotation.z]; saved.scale = cityPreview.scale.toArray(); worldEditorStore.checkpoint(); buildState.city[saved.id] = saved; cityBuilder.add(saved); saveBuildState();
    selectedCityIds.clear(); selectedCityIds.add(saved.id); updateCitySelection(); return;
  }
  if (event.button === 0) {
    const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
    const cityHit = ray.intersectObject(cityBuilder.root, true)[0]; if (cityHit) { let object: THREE.Object3D | null = cityHit.object; while (object && !object.userData.cityId) object = object.parent; const id = object?.userData.cityId as string | undefined; if (id) { if(!event.shiftKey){selectedCityIds.clear();capitalCityIds().forEach(partId=>selectedCityIds.add(partId));}else{if (!event.shiftKey) selectedCityIds.clear(); selectedCityIds.has(id) && event.shiftKey ? selectedCityIds.delete(id) : selectedCityIds.add(id);} selectBuildAsset(null); updateCitySelection(); return; } }
  }
  const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
  const candidates = buildCandidates(), hits = raycaster.intersectObjects(candidates, true);
  if (!hits.length) return; let target: THREE.Object3D = hits[0].object;
  while (target.parent && target.parent !== scene&&!candidates.includes(target)) target = target.parent;
  if (candidates.includes(target)) selectBuildAsset(target);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  const hit = updateTerrainPreview(event); if (!terrainPainting || !hit || terrainMode === "ramp") return;
  queueTerrainBrush(hit.point, event.shiftKey);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!buildMode || !cityPlacementKind) return; const hit = terrainHit(event); if (!hit) { if (cityPreview) cityPreview.visible = false; cityPathPreview.visible = false; return; } const point = snapCityPoint(hit.point.clone());
  if (cityPreview) { cityPreview.visible = true; cityPreview.position.copy(point); cityBuilder.alignToTerrain(cityPreview); ghostCityObject(cityPreview, cityBuilder.overlaps(cityPreview)); }
  else if (cityPathPoints.length) { cityPathPreview.geometry.dispose(); cityPathPreview.geometry = new THREE.BufferGeometry().setFromPoints([...cityPathPoints, point]); cityPathPreview.visible = true; }
});
window.addEventListener("pointerup", (event) => {
  if (!terrainPainting) return; const hit = updateTerrainPreview(event);
  if (terrainMode === "ramp" && hit) applyTerrainAt(hit.point, event.shiftKey);
  else if(pendingTerrainBrush)queueTerrainBrush(pendingTerrainBrush.point,pendingTerrainBrush.shift,true);
  terrainPainting = false; controls.enabled = true; if (terrainStrokeBefore) worldEditorStore.checkpoint(terrainStrokeBefore); terrainStrokeBefore = ""; terrainRampStart = undefined;
  saveBuildState();if(terrainMode!=="forest"&&terrainMode!=="forestErase")openWorld.refreshBiomeAssets();
  pendingTerrainBrush=undefined;
  lastForestBrushPoint=undefined;
  refreshBuildAssetList();
});
renderer.domElement.addEventListener("pointerleave", () => { if (!terrainPainting) terrainPreview.visible = false; });
renderer.domElement.addEventListener("contextmenu", (event) => {
  if (!buildMode) return;
  event.preventDefault();
  if (cityPlacementKind) { clearCityPlacement(); return; }
  if (terrainBrushEnabled) { terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; terrainPreview.visible = false; return; }
  const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
  const cityHit = raycaster.intersectObject(cityBuilder.root, true)[0];
  if (cityHit) { let cityObject: THREE.Object3D | null = cityHit.object; while (cityObject && !cityObject.userData.cityId) cityObject = cityObject.parent; const id = cityObject?.userData.cityId as string | undefined; if (id) { worldEditorStore.checkpoint(); delete buildState.city[id]; cityBuilder.objects.get(id)?.removeFromParent(); cityBuilder.objects.delete(id); selectedCityIds.delete(id); saveBuildState(); updateCitySelection(); return; } }
  const candidates = buildCandidates(), hit = raycaster.intersectObjects(candidates, true)[0];
  if (!hit) return;
  let target: THREE.Object3D = hit.object;
  while (target.parent && target.parent !== scene) target = target.parent;
  if (candidates.includes(target)) removeBuildAssetFromScene(target);
});
const character = new ProceduralCharacter({ ...DEFAULT_CONFIG });
const refreshSavedHandCalibration = () => {
  character.refreshHandCalibration();
  setPlayStatus("Ajuste do Hand Editor aplicado");
};
window.addEventListener("storage", (event) => {
  if (
    event.key === HAND_BONE_TUNING_STORAGE_KEY ||
    event.key === SWORD_SOCKET_STORAGE_KEY
  )
    refreshSavedHandCalibration();
});
window.addEventListener("focus", refreshSavedHandCalibration);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshSavedHandCalibration();
});
let handCalibrationFingerprint = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
window.setInterval(() => {
  const next = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
  if (next === handCalibrationFingerprint) return;
  handCalibrationFingerprint = next;
  refreshSavedHandCalibration();
}, 250);
let sharedCalibrationFingerprint = "";
const syncSharedHandCalibration = async () => {
  try {
    let response = await fetch("/api/hand-calibration", { cache: "no-store" });
    if (!response.ok)
      response = await fetch("/hand-calibration.json", { cache: "no-store" });
    if (!response.ok) return;
    const calibration = (await response.json()) as {
        boneTuning?: unknown;
        swordSocket?: unknown;
      },
      fingerprint = JSON.stringify(calibration);
    if (fingerprint === sharedCalibrationFingerprint) return;
    sharedCalibrationFingerprint = fingerprint;
    if (calibration.boneTuning)
      localStorage.setItem(
        HAND_BONE_TUNING_STORAGE_KEY,
        JSON.stringify(calibration.boneTuning),
      );
    if (calibration.swordSocket)
      localStorage.setItem(
        SWORD_SOCKET_STORAGE_KEY,
        JSON.stringify(calibration.swordSocket),
      );
    handCalibrationFingerprint = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
    refreshSavedHandCalibration();
  } catch {
    /* Offline/static mode continues using the browser-local calibration. */
  }
};
void syncSharedHandCalibration();
window.setInterval(syncSharedHandCalibration, 750);
character.group.name = "LobbyCharacter";
character.setChibi(true);
for (const item of [
  "shirt",
  "ironShirt",
  "leatherShirt",
  "pants",
  "boots",
  "gloves",
  "armor",
  "armorPants",
  "pants",
  "armorBoots",
  "armorGloves",
  "armorHelmet",
  "closedHelmet",
  "belt",
  "sword",
  "shield",
] as const)
  character.setClothing(item, false);
scene.add(character.group);
openWorld.update(character.group.position);
const equippedDecorations = new THREE.Group();
equippedDecorations.name = "EquippedProceduralAccessories";
character.group.add(equippedDecorations);

const femaleNpc = new ProceduralCharacter({
  ...DEFAULT_CONFIG,
  name: "Eleonor",
  hair: "#765034",
  body: "feminino",
  hairStyle: "curto",
  helmetHair: true,
});
femaleNpc.group.name = "NPC_Female_01";
femaleNpc.group.position.set(2.15, 0, -2.35);
femaleNpc.group.rotation.y = -0.55;
femaleNpc.setChibi(true);
for (const item of ["shirt", "pants", "boots", "gloves", "belt"] as const)
  femaleNpc.setClothing(item, true);
femaleNpc.setClothing("sword", false);
femaleNpc.setAnimation("idle");
scene.add(femaleNpc.group);
const createWarriorNpc = (
  name: string,
  x: number,
  z: number,
  rotation: number,
  hair: string,
) => {
  const npc = new ProceduralCharacter({
    ...DEFAULT_CONFIG,
    name,
    body: "feminino",
    hairStyle: "curto",
    helmetHair: true,
    hair,
  });
  npc.group.name = `NPC_Warrior_${name}`;
  npc.group.position.set(x, 0, z);
  npc.group.rotation.y = rotation;
  npc.setChibi(true);
  for (const item of ["shirt", "pants", "boots", "gloves", "belt"] as const)
    npc.setClothing(item, true);
  npc.setClothing("sword", false);
  npc.setAnimation("idle");
  scene.add(npc.group);
  return npc;
};
const aliceNpc = createWarriorNpc("Alice", 4.1, -1.1, -1.05, "#765034");
const emmaNpc = createWarriorNpc("Emma", 3.65, -4.25, 0.15, "#111315");
const warriorNpcs = [femaleNpc, aliceNpc, emmaNpc];
for(const npc of warriorNpcs){
  npc.group.userData.mapHidden=true;npc.group.userData.buildEditable=false;
  npc.group.traverse(object=>object.layers.disable(0));
}

const cityResidents = new CityResidents(scene, cityBuilder.objects, warriorNpcs,index=>followingWarriorIndex===index||activeWarriorIndex===index&&npcDialogue.classList.contains("open"));

// Live RPG inventory portrait. The preview renderer uses dedicated layers, so
// it draws only the selected character while sharing the real animated model
// and its currently equipped materials with the world view.
character.group.traverse((object) => object.layers.enable(2));
femaleNpc.group.traverse((object) => object.layers.enable(3));
const avatarCanvas = document.querySelector<HTMLCanvasElement>(
  "#inventoryAvatar canvas",
)!;
const avatarRenderer = new THREE.WebGLRenderer({
  canvas: avatarCanvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
avatarRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
avatarRenderer.outputColorSpace = THREE.SRGBColorSpace;
avatarRenderer.toneMapping = THREE.ACESFilmicToneMapping;
avatarRenderer.toneMappingExposure = 1.18;
const avatarCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
avatarCamera.layers.set(2);
const avatarKey = new THREE.HemisphereLight("#f3f7ff", "#44392e", 2.8);
avatarKey.layers.set(2);
avatarKey.layers.enable(3);
scene.add(avatarKey);
const avatarRim = new THREE.DirectionalLight("#ffe5bb", 3.2);
avatarRim.position.set(2, 4, 3);
avatarRim.layers.set(2);
avatarRim.layers.enable(3);
scene.add(avatarRim);
let avatarTarget: "player" | "female" = "player";
let avatarYaw = 0,
  avatarDragging = false,
  avatarPointerX = 0;
avatarCanvas.addEventListener("pointerdown", (event) => {
  avatarDragging = true;
  avatarPointerX = event.clientX;
  avatarCanvas.setPointerCapture(event.pointerId);
  avatarCanvas.classList.add("dragging");
});
avatarCanvas.addEventListener("pointermove", (event) => {
  if (!avatarDragging) return;
  avatarYaw += (event.clientX - avatarPointerX) * 0.012;
  avatarPointerX = event.clientX;
});
const stopAvatarDrag = (event: PointerEvent) => {
  avatarDragging = false;
  avatarCanvas.classList.remove("dragging");
  if (avatarCanvas.hasPointerCapture(event.pointerId))
    avatarCanvas.releasePointerCapture(event.pointerId);
};
avatarCanvas.addEventListener("pointerup", stopAvatarDrag);
avatarCanvas.addEventListener("pointercancel", stopAvatarDrag);
const resizeAvatar = () => {
  const host = document.querySelector<HTMLElement>("#inventoryAvatar")!,
    width = Math.max(1, host.clientWidth),
    height = Math.max(1, host.clientHeight);
  avatarRenderer.setSize(width, height, false);
  avatarCamera.aspect = width / height;
  avatarCamera.updateProjectionMatrix();
};
new ResizeObserver(resizeAvatar).observe(
  document.querySelector("#inventoryAvatar")!,
);
resizeAvatar();

// Render real miniature 3D objects once and use the resulting images inside
// the square inventory slots. This avoids emoji placeholders while keeping a
// single lightweight WebGL context for every thumbnail.
const previewRenderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
previewRenderer.setSize(160, 160, false);
previewRenderer.setPixelRatio(1);
previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
previewRenderer.toneMappingExposure = 1.25;
const previewScene = new THREE.Scene(),
  previewCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
previewCamera.position.set(2.8, 2.2, 4);
previewCamera.lookAt(0, 0.25, 0);
previewScene.add(new THREE.HemisphereLight("#ffffff", "#252014", 3));
const previewSun = new THREE.DirectionalLight("#ffe7bd", 4);
previewSun.position.set(3, 5, 4);
previewScene.add(previewSun);
renderBuildThumbnail=(source)=>{
  const cached=buildThumbnailCache.get(source);if(cached!==undefined)return cached;
  const root=new THREE.Group(),model=cloneSkeleton(source);root.add(model);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root);if(box.isEmpty()){buildThumbnailCache.set(source,"");return"";}
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),maximum=Math.max(size.x,size.y,size.z,.001);
  model.position.sub(center);root.scale.setScalar(1.75/maximum);root.rotation.set(-.12,.55,0);previewScene.add(root);
  previewRenderer.render(previewScene,previewCamera);const image=previewRenderer.domElement.toDataURL("image/png");root.removeFromParent();buildThumbnailCache.set(source,image);return image;
};
for(const button of document.querySelectorAll<HTMLElement>("[data-city-kind]")){
  const icon=button.querySelector<HTMLElement>("i"),asset=createCityAsset(button.dataset.cityKind as CityAssetKind);
  const image=renderBuildThumbnail(asset);if(icon&&image)icon.style.backgroundImage=`url(${image})`;
}
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
function makeItemPreview(type: string) {
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
const clothingFor = (item: InventoryItem) =>
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
const equipmentPreviewCharacter = new ProceduralCharacter({ ...DEFAULT_CONFIG });
document
  .querySelectorAll<HTMLElement>("[data-item-id],[data-female-modal-item]")
  .forEach((button) => {
    const id = button.dataset.itemId,
      item = id ? ITEM_BY_ID.get(id) : undefined;
    const clothingPreview = item && item.visual !== 'bracers' ? clothingFor(item) : null;
    const type = button.dataset.femaleModalItem;
    const holder = button.querySelector<HTMLElement>("span")!,
      model = item
        ? clothingPreview
          ? equipmentPreviewCharacter.createEquipmentPreview(clothingPreview, clothShirtColor(item.visual) ?? clothPantsColor(item.visual) ?? (clothingPreview === "shirt" ? "#f4f1e8" : armorColor(item.visual)), item.visual === 'leather-chest')
          : createProceduralItem(item)
        : makeItemPreview(type ?? "");
    holder.textContent = "";
    const image=renderBuildThumbnail(model);
    holder.style.backgroundImage = `url(${image})`;
    if(item)setItemThumbnail(item.id,image);
    previewScene.remove(model);
  });

// Use supplied consumable GLBs for inventory and quick-slot images.
for(const id of ['apple','grapes','magic-potion','hp-potion','greater-hp-potion','stamina-potion','greater-stamina-potion']){
  void loadCityPropTemplate(id==='magic-potion'?'magic-potion':id.includes('potion')?'potion':id).then(model=>{
    const image=renderBuildThumbnail(model);
    setItemThumbnail(id,image);
    document.querySelectorAll<HTMLElement>(`[data-item-id="${id}"] span`).forEach(holder=>{holder.style.backgroundImage=`url(${image})`;});
    refreshQuickSlots();
  }).catch(error=>console.error('Não foi possível carregar consumível do inventário',error));
}

const horseMixers: THREE.AnimationMixer[] = [];
const horseActions = new Map<string, THREE.AnimationAction>();
let horseCurrentAction: THREE.AnimationAction | null = null;
let horseCurrentMotion = "idle";
type HorseIdleBone = {
  bone: THREE.Object3D;
  base: THREE.Quaternion;
  phase: number;
  amount: number;
};
const horseIdleBones: HorseIdleBone[] = [];
let horseIdleTime = 0;
let horseRegistryScanElapsed=0;
let horseRoot: THREE.Object3D | null = null;
let horseMountAnchor: THREE.Object3D | null = null;
let mounted = false;
let nimbusSource: THREE.Group | null = null;
let broomMountVisual: THREE.Object3D | null = null;
let broomFlying = false;
let broomAimPitch = 0;
const PLAYER_GRAVITY=22;
const PLAYER_JUMP_HEIGHT=2;
let broomFallVelocity = 0;
const broomImpact=new FlightImpactResponse();
const NIMBUS_SCALE_MULTIPLIER = 1.9435;
type NimbusHandTransform = { position: [number, number, number]; rotation: [number, number, number]; scale: number };
const NIMBUS_HAND_TRANSFORM_KEY = "rpg3d.nimbusHandTransform.v1";
const DEFAULT_NIMBUS_HAND_TRANSFORM: NimbusHandTransform = {
  position: [-.95, -.27, 0],
  rotation: [0, 0, 0],
  scale: NIMBUS_SCALE_MULTIPLIER,
};
const loadNimbusHandTransform = (): NimbusHandTransform => {
  try {
    const saved = JSON.parse(localStorage.getItem(NIMBUS_HAND_TRANSFORM_KEY) ?? "null") as Partial<NimbusHandTransform> | null;
    return {
      position: saved?.position?.length === 3 ? [...saved.position] as [number, number, number] : [...DEFAULT_NIMBUS_HAND_TRANSFORM.position],
      rotation: saved?.rotation?.length === 3 ? [...saved.rotation] as [number, number, number] : [...DEFAULT_NIMBUS_HAND_TRANSFORM.rotation],
      scale: Number.isFinite(saved?.scale) ? Math.max(.1, saved!.scale!) : DEFAULT_NIMBUS_HAND_TRANSFORM.scale,
    };
  } catch { return structuredClone(DEFAULT_NIMBUS_HAND_TRANSFORM); }
};
let nimbusHandTransform = loadNimbusHandTransform();
type NimbusArmDebug = MagicArmTuning;
const NIMBUS_ARM_DEBUG_KEY = "rpg3d.nimbusArmDebug.v1";
const DEFAULT_NIMBUS_ARM_DEBUG: NimbusArmDebug = {
  shoulder:{position:[0,0,0],rotation:[0,7,-6]},
  elbow:{position:[0,0,0],rotation:[0,67,-18]},
  wrist:{position:[0,0,0],rotation:[0,-44,0]},
};
const loadNimbusArmDebug = (): NimbusArmDebug => {
  try {
    const saved=JSON.parse(localStorage.getItem(NIMBUS_ARM_DEBUG_KEY)??"null") as Partial<NimbusArmDebug>|null;
    const result=structuredClone(DEFAULT_NIMBUS_ARM_DEBUG);
    for(const bone of ['shoulder','elbow','wrist'] as const)for(const group of ['position','rotation'] as const)
      if(saved?.[bone]?.[group]?.length===3)result[bone][group]=[...saved[bone]![group]!] as [number,number,number];
    return result;
  } catch { return structuredClone(DEFAULT_NIMBUS_ARM_DEBUG); }
};
let nimbusArmDebug=loadNimbusArmDebug();
const applyNimbusArmDebug = () => character.setMagicArmTuning({
  shoulder:{position:[...nimbusArmDebug.shoulder.position],rotation:nimbusArmDebug.shoulder.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
  elbow:{position:[...nimbusArmDebug.elbow.position],rotation:nimbusArmDebug.elbow.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
  wrist:{position:[...nimbusArmDebug.wrist.position],rotation:nimbusArmDebug.wrist.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
});
const gltfLoader = createWorldAssetLoader();
// Parse each repeated GLB once. Population instances clone the transform and
// skeleton hierarchy but share immutable geometry, materials and textures.
const sharedGltfCache=new Map<string,Promise<GLTF>>();
const loadSharedGltf=(url:string,onLoad:(gltf:GLTF)=>void,_progress?:unknown,onError?:(error:unknown)=>void)=>{
  let request=sharedGltfCache.get(url);
  if(!request){request=new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject));sharedGltfCache.set(url,request);}
  request.then(source=>onLoad({...source,scene:cloneSkeleton(source.scene) as THREE.Group})).catch(error=>onError?.(error));
};
for(const [label,url,targetHeight] of ANIMAL_ASSET_CATALOG)loadSharedGltf(url,gltf=>{
  const root=new THREE.Group(),model=gltf.scene;root.add(model);root.updateMatrixWorld(true);
  const initial=new THREE.Box3().setFromObject(root),size=initial.getSize(new THREE.Vector3());model.scale.setScalar(targetHeight/Math.max(size.y,.001));root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);
  if(url.includes('/horse/')){root.animations=gltf.animations;root.traverse(o=>{if(o.name==='Object_21')o.visible=false;});}
  root.name=label;root.userData.modelLabel=label;root.userData.animalModel=url;root.userData.buildEditable=true;animalAssetTemplates.set(url,root);
  if(buildMode)refreshBuildAssetList();
},undefined,error=>console.warn(`Não foi possível carregar o asset ${label}`,error));
const mergeStaticModel=(root:THREE.Object3D)=>{
  root.updateMatrixWorld(true);
  type StaticBatch={material:THREE.Material;geometries:THREE.BufferGeometry[];sources:THREE.Mesh[]};
  const inverseRoot=root.matrixWorld.clone().invert(),batches=new Map<string,StaticBatch>();
  const materialKey=(material:THREE.Material)=>{
    const value=material as THREE.MeshStandardMaterial;
    return [material.type,value.color?.getHexString(),value.map?.uuid,value.normalMap?.uuid,value.alphaMap?.uuid,value.roughness,value.metalness,material.side,material.transparent,material.opacity,material.alphaTest,material.vertexColors].join(":");
  };
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.SkinnedMesh||Array.isArray(object.material)||!object.visible)return;
    const geometry=object.geometry.clone();geometry.applyMatrix4(inverseRoot.clone().multiply(object.matrixWorld));
    const key=materialKey(object.material),batch:StaticBatch=batches.get(key)??{material:object.material,geometries:[],sources:[]};
    batch.geometries.push(geometry);batch.sources.push(object);batches.set(key,batch);
  });
  const merged:THREE.Mesh[]=[];
  for(const {material,geometries,sources} of batches.values()){
    if(geometries.length<2){geometries.forEach(geometry=>geometry.dispose());continue;}
    const geometry=mergeGeometries(geometries,false);geometries.forEach(item=>item.dispose());if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,material);mesh.name="Lote estático";mesh.castShadow=false;mesh.receiveShadow=true;merged.push(mesh);
    sources.forEach(source=>source.removeFromParent());
  }
  root.add(...merged);root.updateMatrixWorld(true);
};

// Fishing docks: two platforms reach into the inland lake and three form the
// coastal pier by the port. The ship stays moored beside the seaward end.
const prepareHarborModel=(model:THREE.Object3D)=>{
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
  model.position.x-=center.x;model.position.z-=center.z;
  model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return model;
};
const createProceduralDockPlatform=()=>{
  const root=new THREE.Group();root.name="Módulo de doca artesanal";
  const wood=new THREE.MeshStandardMaterial({color:"#8b6038",roughness:.92,flatShading:true});
  const woodDark=new THREE.MeshStandardMaterial({color:"#4d321f",roughness:1,flatShading:true});
  const metal=new THREE.MeshStandardMaterial({color:"#34383a",roughness:.75,metalness:.28,flatShading:true});
  const part=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{const value=new THREE.Mesh(geometry,material);value.position.set(x,y,z);value.castShadow=value.receiveShadow=true;root.add(value);return value;};
  // Local Z is the pier's long axis, matching the placement/rotation used by
  // the former imported module.
  for(let i=0;i<17;i++)part(new THREE.BoxGeometry(3.8,.22,.88),i%2?wood:woodDark,0,.05,-8+i+.5);
  for(const x of [-1.55,1.55]){
    part(new THREE.BoxGeometry(.22,.35,17),woodDark,x,-.2,0);
    for(const z of [-7.5,-3.75,0,3.75,7.5]){
      const support=part(new THREE.CylinderGeometry(.16,.22,5.2,6),woodDark,x,-2.45,z);
      support.userData.dockSupport=true;support.userData.baseHeight=5.2;
      const post=part(new THREE.CylinderGeometry(.11,.14,1.35,6),woodDark,x,.78,z);
      post.userData.dockRailPost=true;
    }
    const rail=part(new THREE.CylinderGeometry(.075,.075,16,6),wood,x,1.35,0);rail.rotation.x=Math.PI/2;
  }
  for(const z of [-7.5,7.5])part(new THREE.BoxGeometry(3.7,.12,.12),metal,0,.28,z);
  root.userData.walkableDock=true;return root;
};
proceduralDockTemplate=createProceduralDockPlatform();
fitProceduralDockSupports=(dock)=>{
  const embedDepth=3;
  dock.updateWorldMatrix(true,true);
  const worldScale=new THREE.Vector3();dock.getWorldScale(worldScale);
  dock.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.userData.dockSupport)return;
    const top=dock.localToWorld(new THREE.Vector3(object.position.x,-.3,object.position.z));
    const ground=openWorld.getHeightAt(top.x,top.z)-embedDepth,height=Math.max(.5,top.y-ground),baseHeight=object.userData.baseHeight as number;
    const midpoint=dock.worldToLocal(new THREE.Vector3(top.x,(ground+top.y)*.5,top.z));
    object.scale.y=height/Math.max(.001,baseHeight*Math.abs(worldScale.y));object.position.y=midpoint.y;
  });
};
{
  const template=proceduralDockTemplate;
  const lakeDocks=new THREE.Group(),seaDocks=new THREE.Group();
  lakeDocks.name="Doca de pesca do lago · 3 peças";lakeDocks.userData.harborModel="dock-group";lakeDocks.userData.buildFolder="Construção";lakeDocks.userData.buildId="dock-lake-group";
  seaDocks.name="Doca marítima · 3 peças";seaDocks.userData.harborModel="dock-group";seaDocks.userData.buildFolder="Construção";seaDocks.userData.buildId="dock-sea-group";
  const addDock=(parent:THREE.Group,name:string,x:number,y:number,z:number,rotationY:number)=>{
    const dock=template.clone(true);dock.name=name;dock.position.set(x,y,z);dock.rotation.y=rotationY;
    dock.userData.walkableDock=true;
    parent.add(dock);
    // Stretch each piling to the actual terrain/riverbed below it. The dock
    // may be rotated, so sample using the support's world X/Z position.
    fitProceduralDockSupports(dock);
  };
  // Inland lake west bank: the first platform meets the raised bank and the
  // other two continue straight out over the water.
  const inlandDockY=15;
  addDock(lakeDocks,"Doca de pesca do lago 1",277,inlandDockY,150,Math.PI*.5);
  addDock(lakeDocks,"Doca de pesca do lago 2",294,inlandDockY,150,Math.PI*.5);
  addDock(lakeDocks,"Doca de pesca do lago 3",311,inlandDockY,150,Math.PI*.5);
  // Port coast: the shoreline is near radius 950 in this direction. Start at
  // its edge and keep the remaining platforms beyond the terrain in open sea.
  const coastHeading=Math.atan2(750,550),coastDirection=new THREE.Vector3(Math.sin(coastHeading),0,Math.cos(coastHeading));
  for(let index=0;index<3;index++){
    const distance=950+index*17;
    addDock(seaDocks,`Doca marítima ${index+1}`,coastDirection.x*distance,0,coastDirection.z*distance,coastHeading);
  }
  const centerDockGroup=(group:THREE.Group)=>{
    group.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
    // Keep Y independent from the support length. Centering on the complete
    // bounding box made longer pilings move the group's pivot vertically and
    // old Build transforms then lifted the whole pier off the shore.
    const horizontalCenter=new THREE.Vector3(center.x,0,center.z);
    group.children.forEach(child=>child.position.sub(horizontalCenter));group.position.copy(horizontalCenter);
  };
  centerDockGroup(lakeDocks);centerDockGroup(seaDocks);
  scene.add(lakeDocks,seaDocks);
  const dockPivotVersionKey="rpg3d.dockPivotVersion",dockPivotVersion="horizontal-v2";
  if(localStorage.getItem(dockPivotVersionKey)!==dockPivotVersion){
    // Preserve the exact dock transform from the approved save, including its elevation.
    localStorage.setItem(dockPivotVersionKey,dockPivotVersion);
  }
  // Recreate dock copies saved by the Build editor on previous sessions.
  for(const [id,saved] of Object.entries(buildState.assets)){
    if(saved.harborModel!=="dock-group"||scene.children.some(object=>object.userData.buildId===id)||buildState.removedAssets.includes(id)||buildState.removedAssets.includes(saved.label??""))continue;
    const source=/marítima/i.test(saved.label??"")?seaDocks:lakeDocks,group=source.clone(true);
    group.name=saved.label??`Doca · ${id.slice(-8)}`;group.userData={...source.userData,buildId:id,buildStateApplied:true};
    applySavedBuildAsset(group,saved);scene.add(group);
  }
  refreshBuildAssetList();
}
gltfLoader.load("/models/environment/harbor/pirate-ship.glb",({scene:shipScene})=>{
  const ship=prepareHarborModel(shipScene),coastHeading=Math.atan2(750,550);
  const outward=new THREE.Vector3(Math.sin(coastHeading),0,Math.cos(coastHeading));
  const side=new THREE.Vector3(-outward.z,0,outward.x);
  ship.name="Navio pirata atracado";
  // Keep the complete hull beyond the coastline instead of burying its stern
  // in the forest terrain. The lateral offset leaves it beside the pier.
  ship.position.copy(outward.multiplyScalar(995).add(side.multiplyScalar(24)));
  // The ship's long axis is local X; turn it parallel to the pier.
  ship.rotation.y=coastHeading-Math.PI*.5;
  ship.userData.harborModel="ship";ship.userData.buildFolder="Construção";ship.userData.buildId="harbor-pirate-ship";ship.userData.solidHarbor=true;ship.userData.collisionHalfSize=[17,7.5];
  scene.add(ship);
  for(const [id,saved] of Object.entries(buildState.assets)){
    if(saved.harborModel!=="ship"||scene.children.some(object=>object.userData.buildId===id)||buildState.removedAssets.includes(id)||buildState.removedAssets.includes(saved.label??""))continue;
    const copy=ship.clone(true);copy.name=saved.label??`Navio pirata · ${id.slice(-8)}`;
    copy.userData={...ship.userData,buildId:id,buildStateApplied:true};applySavedBuildAsset(copy,saved);scene.add(copy);
  }
  refreshBuildAssetList();
},undefined,error=>console.error("Não foi possível carregar o navio pirata",error));
const harborGroundHeightAt=(x:number,z:number,terrainHeight:number)=>{
  let surface=terrainHeight;
  const point=new THREE.Vector3(x,0,z),local=new THREE.Vector3(),top=new THREE.Vector3();
  // Only harbor roots can contain decks; walking the terrain, skeletons and
  // vegetation for every ground query was unrelated work in the flight loop.
  for(const root of scene.children){
    if(!root.userData.harborModel||!root.visible)continue;
    root.traverse(object=>{
    if(!object.userData.walkableDock||!object.visible)return;
    object.updateWorldMatrix(true,false);local.copy(point);object.worldToLocal(local);
    if(Math.abs(local.x)>3.15||Math.abs(local.z)>8.9)return;
    top.set(0,1.92,0);object.localToWorld(top);
    // Only catch the dock from nearby; flying beneath or far above it should
    // not snap the player onto the deck.
    if(character.group.position.y<=top.y+1.25)surface=Math.max(surface,top.y);
    });
  }
  return surface;
};
const playerGroundHeightAt=(x:number,z:number,allowStepUp=true)=>Math.max(harborGroundHeightAt(x,z,openWorld.getHeightAt(x,z)),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity,cityBuilder.walkHeightAt(x,z,character.group.position.y,allowStepUp)??-Infinity);
const createNimbusInstance = () => {
  if (!nimbusSource) return null;
  const clone = nimbusSource.clone(true);
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry = child.geometry.clone();
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
};
const createHeldNimbusInstance = () => {
  const broom = createNimbusInstance();
  if (!broom) return null;
  // Keep the calibrated grip offset inside the rotated pivot. Rotating the
  // model and leaving this offset in parent space made the broom orbit away
  // from the fist instead of rotating around it.
  broom.position.fromArray(nimbusHandTransform.position);
  const pivot = new THREE.Group();
  pivot.name = "Nimbus2000HandPivot";
  pivot.rotation.set(
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[0]),
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[1]),
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[2]),
  );
  pivot.scale.setScalar(nimbusHandTransform.scale / NIMBUS_SCALE_MULTIPLIER);
  pivot.add(broom);
  return pivot;
};
gltfLoader.load("/models/equipment/nimbus-2000/model.glb", (gltf) => {
  const content = gltf.scene;
  content.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(content), size = initial.getSize(new THREE.Vector3());
  const oriented = new THREE.Group();
  if (size.y >= size.x && size.y >= size.z) content.rotation.z = -Math.PI / 2;
  else if (size.z >= size.x && size.z >= size.y) content.rotation.y = Math.PI / 2;
  oriented.add(content);
  oriented.updateMatrixWorld(true);
  const orientedBox = new THREE.Box3().setFromObject(oriented), orientedSize = orientedBox.getSize(new THREE.Vector3());
  oriented.scale.setScalar((1.72 * NIMBUS_SCALE_MULTIPLIER) / Math.max(orientedSize.x, .001));
  oriented.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(oriented), fittedCenter = fitted.getCenter(new THREE.Vector3());
  oriented.position.set(-fitted.min.x - .16, -fittedCenter.y, -fittedCenter.z);
  nimbusSource = new THREE.Group();
  nimbusSource.name = "Nimbus2000";
  nimbusSource.add(oriented);
  const image = renderBuildThumbnail(nimbusSource);
  setItemThumbnail('nimbus-2000', image);
  document.querySelectorAll<HTMLElement>('[data-item-id="nimbus-2000"] span').forEach(holder => { holder.style.backgroundImage = `url(${image})`; });
  refreshEquipmentSlots();
  const mountedModel = createNimbusInstance();
  if (mountedModel) {
    mountedModel.updateMatrixWorld(true);
    const mountedCenter = new THREE.Box3().setFromObject(mountedModel).getCenter(new THREE.Vector3());
    mountedModel.position.sub(mountedCenter);
    broomMountVisual = new THREE.Group();
    broomMountVisual.name = "Nimbus2000Mounted";
    broomMountVisual.position.set(0, .72, .02);
    broomMountVisual.rotation.y = Math.PI / 2;
    broomMountVisual.visible = false;
    broomMountVisual.add(mountedModel);
    character.group.add(broomMountVisual);
    applyBroomRideDebug();
  }
  syncCharacterEquipment();
}, undefined, (error) => console.error("Não foi possível carregar a Nimbus 2000", error));
const LEGACY_HUB_ENABLED = false;
const LEGACY_CITY_CONTENT_ENABLED = false;
let castleStableAnchor: THREE.Object3D | null = null;
let skyBirdFlock: { root: THREE.Group; mixer: THREE.AnimationMixer } | null = null;
const skyBirdMapHalf=openWorld.config.worldSize*.5;
const resetSkyBirdCrossing=(root:THREE.Object3D)=>{
  root.position.set(
    -skyBirdMapHalf-90,
    82+Math.random()*42,
    -skyBirdMapHalf+120+Math.random()*(openWorld.config.worldSize-240),
  );
};
let castleSkyFloorY = 18;
const raiseSkyAboveCastle = (castle: THREE.Object3D) => {
  castle.updateMatrixWorld(true);
  const castleTop = new THREE.Box3().setFromObject(castle).max.y;
  castleSkyFloorY = Math.max(18, castleTop + 5);
  if (skyBirdFlock && skyBirdFlock.root.position.y < castleSkyFloorY)
    skyBirdFlock.root.position.y = castleSkyFloorY + 1.2;
};
const placeHorseAtCastleStable = () => {
  if (!horseRoot || !castleStableAnchor) return false;
  const placementKey = "rpg3d.horsePlacedInCastleStable.v1";
  if (localStorage.getItem(placementKey)) return false;
  const stablePosition = castleStableAnchor.getWorldPosition(new THREE.Vector3());
  horseRoot.position.set(stablePosition.x, 0, stablePosition.z);
  let castleParent: THREE.Object3D | null = castleStableAnchor.parent;
  while (castleParent?.parent && castleParent.parent !== scene) castleParent = castleParent.parent;
  horseRoot.rotation.y = (castleParent?.rotation.y ?? 0) + Math.PI / 2;
  horseRoot.userData.buildId = "horse";
  horseRoot.userData.buildStateApplied = true;
  buildState.assets.horse = snapshotBuildAsset(horseRoot);
  saveBuildState();
  localStorage.setItem(placementKey, "true");
  return true;
};
if (LEGACY_HUB_ENABLED) gltfLoader.load(
  "/models/environment/medieval-castle/model.glb",
  (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    openWorld.registerForestRocks(model);
    removeCastleActors(model);
    model.traverse((child) => {
      if (/^Floor_0$/i.test(child.name)) child.visible = false;
      // The castle pack includes baked decorative inhabitants. Gameplay owns
      // its people and horses, so remove those meshes while keeping buildings,
      // props and the chickens from the original castle scene.
      if (/^(?:Horse(?:man)?|Character|Soldier|Girl|Bucketgirl)(?:_\d+)?(?:_0)?$/i.test(child.name))
        child.visible = false;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    model.updateMatrixWorld(true);
    const castleBox = new THREE.Box3();
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible)
        castleBox.union(new THREE.Box3().setFromObject(child));
    });
    const center = castleBox.getCenter(new THREE.Vector3());
    const size = castleBox.getSize(new THREE.Vector3());
    mergeStaticModel(model);
    // Floor_0 had its walkable surface about 0.35 m above the GLB origin.
    // Rebase that surface to the editor's Y=0 while allowing foundations to
    // remain underground. The root can now stay at Y=0 at every scale.
    model.position.set(-center.x, -0.35, -center.z);
    const root = new THREE.Group();
    root.name = "Castelo medieval";
    root.position.set(0, 0, 7.5);
    root.scale.setScalar(CASTLE_LOCKED_SCALE);
    if(buildState.worldPreset==="arena-island-v1")root.position.y=openWorld.getHeightAt(0,7.5);
    root.add(model);
    castleStableAnchor = new THREE.Object3D();
    castleStableAnchor.name = "Ponto do estábulo";
    // Authored center of Stable_0. Y=.35 compensates the removed Floor_0 and
    // lands on the rebased walkable plane.
    castleStableAnchor.position.set(17.86, .35, 15.71);
    model.add(castleStableAnchor);
    scene.add(root);

    // Match the editable world map to the castle footprint, excluding its
    // oversized embedded Floor_0 mesh.
    buildWidth.value = String(Math.ceil(size.x));
    buildDepth.value = String(Math.ceil(size.z));
    applyBuildMapSize();
    refreshBuildAssetList();
    // The castle is taller than the original scene. Keep the moving sky layer
    // above its highest visible point, including an edited castle scale.
    raiseSkyAboveCastle(root);
    placeHorseAtCastleStable();
  },
  undefined,
  (error) => console.error("Não foi possível carregar o castelo medieval", error),
);

gltfLoader.load("/models/animals/sky-birds/model.glb", (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const root = new THREE.Group();
  root.name = "Bando de pássaros";
  root.userData.animalModel = "/models/animals/sky-birds/model.glb";
  root.userData.modelLabel = "Pássaros";
  root.userData.buildEditable = false;
  root.add(model); root.scale.setScalar(4.2 / Math.max(size.x, size.z, .001));
  // The authored flock faces -Z. It travels toward +X, so -90° aligns its
  // beaks with movement; +90° made every bird fly backwards.
  resetSkyBirdCrossing(root); root.rotation.y = -Math.PI / 2;
  model.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true; });
  scene.add(root);
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  skyBirdFlock = { root, mixer };
}, undefined, (error) => console.error("Não foi possível carregar o bando de pássaros", error));
function updateSkyBirds(delta: number) {
  if (!skyBirdFlock) return;
  skyBirdFlock.mixer.update(delta);
  skyBirdFlock.root.position.x += 42 * delta;
  skyBirdFlock.root.position.y += Math.sin(performance.now() * .0018) * delta*.22;
  if (skyBirdFlock.root.position.x > skyBirdMapHalf+90) resetSkyBirdCrossing(skyBirdFlock.root);
}

const HOOD_TRANSFORM_KEY = "rpg3d.mageHoodTransform";
type HoodTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};
const DEFAULT_HOOD_TRANSFORM: HoodTransform = {
  position: [0, 2.32, -0.185],
  rotation: [0, 0, 0],
  scale: 1.4355,
};
const loadHoodTransform = (): HoodTransform => {
  try {
    const saved = JSON.parse(localStorage.getItem(HOOD_TRANSFORM_KEY) ?? "null") as HoodTransform | null;
    return saved?.position?.length === 3 && Number.isFinite(saved.scale)
      ? {
          ...saved,
          position: [...saved.position],
          rotation: saved.rotation?.length === 3 ? [...saved.rotation] : [0, 0, 0],
        }
      : { ...DEFAULT_HOOD_TRANSFORM, position: [...DEFAULT_HOOD_TRANSFORM.position], rotation: [...DEFAULT_HOOD_TRANSFORM.rotation] };
  } catch {
    return { ...DEFAULT_HOOD_TRANSFORM, position: [...DEFAULT_HOOD_TRANSFORM.position], rotation: [...DEFAULT_HOOD_TRANSFORM.rotation] };
  }
};
let mageHoodTransform = loadHoodTransform();
let mageHoodRoot: THREE.Group | null = null;
let mageHoodAssetSize = 1;
const applyMageHoodTransform = () => {
  if (!mageHoodRoot) return;
  mageHoodRoot.position.fromArray(mageHoodTransform.position);
  mageHoodRoot.rotation.set(
    ...mageHoodTransform.rotation.map(THREE.MathUtils.degToRad) as [number, number, number],
  );
  mageHoodRoot.scale.setScalar(mageHoodTransform.scale / mageHoodAssetSize);
};
gltfLoader.load("/models/equipment/mage-hood/model.glb", (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const root = new THREE.Group(); root.add(model);
  mageHoodAssetSize = Math.max(size.x, size.y, size.z, .001);
  root.visible = false;
  root.name = "equipment.mageHood";
  root.traverse((child) => {
    // Layer 2 is used by the player's inventory-avatar camera. The hood is
    // loaded after the character, so it must opt into that layer explicitly.
    child.layers.enable(2);
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  character.attachHeadAccessory(root);
  mageHoodRoot = root;
  applyMageHoodTransform();
  const hoodEquipped = equippedItems.get("head") === "mage-hood";
  root.visible = hoodEquipped;
  character.setHoodHairHidden(false);

  // The inventory thumbnail is rendered from the supplied asset itself, not
  // from the procedural placeholder used by the other equipment.
  const iconRoot = new THREE.Group(), iconModel = model.clone(true);
  iconRoot.add(iconModel);
  iconRoot.scale.setScalar(1.45 / Math.max(size.x, size.y, size.z, .001));
  iconRoot.rotation.set(.08, -.38, 0);
  previewScene.add(iconRoot);
  previewRenderer.render(previewScene, previewCamera);
  setItemThumbnail("mage-hood",previewRenderer.domElement.toDataURL("image/png"));
  document.querySelectorAll<HTMLElement>('[data-item-id="mage-hood"] span').forEach((holder) => {
    holder.textContent = "";
    holder.style.backgroundImage = `url(${previewRenderer.domElement.toDataURL("image/png")})`;
  });
  previewScene.remove(iconRoot);
}, undefined, (error) => console.error("Não foi possível carregar o capuz de mago", error));

const seaCenter = new THREE.Vector3(0, 0, -17.5);
const seaWaterMaterial = new THREE.MeshPhysicalMaterial({
  color: "#167da0", roughness: .18, metalness: .04, transparent: true,
  opacity: .78, clearcoat: .65, clearcoatRoughness: .22, depthWrite: false,
});

type MarineLife = {
  kind: "shark" | "trout" | "seagull";
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  angle: number;
  radius: number;
  speed: number;
  altitude: number;
  attackCooldown: number;
  attackElapsed?: number;
  attackDidDamage: boolean;
  attackBase: THREE.Vector3;
  velocity: THREE.Vector3;
  home: THREE.Vector3;
};
const marineLife: MarineLife[] = [];
const SHARK_MODEL_FORWARD_OFFSET = Math.PI * .5;
const turnMarineHeading = (heading: THREE.Vector3, target: THREE.Vector3, maxTurn: number) => {
  if (target.lengthSq() < .0001) return;
  const currentAngle = Math.atan2(heading.x, heading.z);
  const targetAngle = Math.atan2(target.x, target.z);
  const difference = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  const angle = currentAngle + THREE.MathUtils.clamp(difference, -maxTurn, maxTurn);
  heading.set(Math.sin(angle), 0, Math.cos(angle));
};
const faceMarineHeading = (life: MarineLife) => {
  life.root.rotation.y = Math.atan2(life.velocity.x, life.velocity.z) +
    (life.kind === "shark" ? SHARK_MODEL_FORWARD_OFFSET : 0);
};
function loadMarineLife(kind: MarineLife["kind"], url: string, count: number) {
  for (let index = 0; index < count; index++) loadSharedGltf(url, (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(model);
    const targetHeight = kind === "shark" ? 3 : kind === "trout" ? .34 : .46;
    model.scale.setScalar(targetHeight / Math.max(initial.getSize(new THREE.Vector3()).y, .001));
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) { child.castShadow = child.receiveShadow = true; }
    });
    const root = new THREE.Group();
    root.name = `${kind === "shark" ? "Tubarão" : kind === "trout" ? "Truta" : "Gaivota"} ${index + 1}`;
    root.userData.animalModel = url;
    root.userData.modelLabel = kind === "shark" ? "Tubarão" : kind === "trout" ? "Truta" : "Gaivota";
    root.add(model);
    scene.add(root);
    let mixer: THREE.AnimationMixer | undefined;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const preferred = kind === "trout" ? "Trout_Swim" : kind === "seagull" ? "Take 001" : "ArmatureAction";
      (THREE.AnimationClip.findByName(gltf.animations, preferred) ?? gltf.animations[0]) &&
        mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, preferred) ?? gltf.animations[0]).play();
    }
    const angle = index / count * Math.PI * 2 + (kind === "shark" ? 1.2 : .35);
    const life: MarineLife = {
      kind, root, mixer, angle,
      radius: kind === "shark" ? 5.4 : kind === "trout" ? 2.7 + index * .65 : 4.5 + index * .7,
      speed: kind === "shark" ? 3.8+index*.22 : kind === "trout" ? .55 + index * .08 : .28 + index * .025,
      altitude: kind === "seagull" ? 3.4 + index * .55 : kind === "shark" ? -.72 : -1.05 - index * .08,
      attackCooldown: 0, attackDidDamage: false, attackBase: new THREE.Vector3(),
      velocity: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize(),
      home: new THREE.Vector3(),
    };
    root.position.set(seaCenter.x + Math.cos(angle) * life.radius, life.altitude, seaCenter.z + Math.sin(angle) * life.radius);
    if (kind !== "seagull") {
      const point=findAnimalHabitatPoint(openWorld,kind,index);
      if(!point){root.visible=false;return;}
      root.position.set(point[0],openWorld.getWaterLevelAt(point[0],point[2])+life.altitude,point[2]);
      life.home.copy(root.position);
      root.userData.habitat="Mar";
    }
    faceMarineHeading(life);
    marineLife.push(life);
  }, undefined, (error) => console.error(`Não foi possível carregar ${kind}`, error));
}
loadMarineLife("shark","/models/animals/shark/model.glb",5);
loadMarineLife("trout","/models/animals/trout/model.glb",40);

// 40 animated trout above plus 260 lightweight school fish: 300 fish across
// the map without creating 300 animation mixers and hundreds of draw calls.
const schoolFishCount=260;
const schoolFishGeometry=new THREE.IcosahedronGeometry(.18,0);
schoolFishGeometry.scale(1.9,.72,.58);
const schoolFishMaterial=new THREE.MeshLambertMaterial({color:"#70a9b5",flatShading:true});
const schoolFish=new THREE.InstancedMesh(schoolFishGeometry,schoolFishMaterial,schoolFishCount);
schoolFish.name="Cardume do mapa · 260 peixes";schoolFish.frustumCulled=false;schoolFish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const schoolFishHomes:Array<THREE.Vector3>=[];
const schoolFishTransform=new THREE.Object3D();
const schoolFishRegionCenter=new THREE.Vector3(Number.POSITIVE_INFINITY,0,Number.POSITIVE_INFINITY);
for(let index=0;index<schoolFishCount;index++){
  const point=findAnimalHabitatPoint(openWorld,"trout",index+40);
  const home=point
    ? new THREE.Vector3(point[0],openWorld.getWaterLevelAt(point[0],point[2])-1.15-(index%5)*.16,point[2])
    : new THREE.Vector3(900,-1.2,-650);
  schoolFishHomes.push(home);schoolFishTransform.position.copy(home);schoolFishTransform.scale.setScalar(.7+(index%7)*.045);schoolFishTransform.updateMatrix();schoolFish.setMatrixAt(index,schoolFishTransform.matrix);
}
schoolFish.instanceMatrix.needsUpdate=true;scene.add(schoolFish);
const localWaterPoint=(species:"shark"|"trout",index:number,radius=42,minDistance=5)=>{
  for(let attempt=0;attempt<96;attempt++){
    const angle=index*2.399963+attempt*1.618034,distance=minDistance+((index*.754877+attempt*.56984)%1)*Math.max(1,radius-minDistance);
    const x=character.group.position.x+Math.cos(angle)*distance,z=character.group.position.z+Math.sin(angle)*distance;
    if(isAnimalHabitat(openWorld,species,x,z))return new THREE.Vector3(x,openWorld.getWaterLevelAt(x,z),z);
  }
  return null;
};
const updateSchoolFish=(elapsed:number)=>{
  if(openWorld.isWaterAt(character.group.position.x,character.group.position.z)&&schoolFishRegionCenter.distanceToSquared(character.group.position)>1600){
    schoolFishRegionCenter.copy(character.group.position);
    for(let index=0;index<Math.min(200,schoolFishCount);index++){
      const point=localWaterPoint("trout",index,48);
      if(point)schoolFishHomes[index].set(point.x,point.y-1.05-(index%6)*.14,point.z);
    }
  }
  for(let index=0;index<schoolFishCount;index++){
    const home=schoolFishHomes[index],phase=elapsed*(.32+(index%9)*.025)+index*2.399;
    const x=home.x+Math.cos(phase)*(1.2+(index%6)*.3),z=home.z+Math.sin(phase)*(1.2+(index%6)*.3);
    const bottom=openWorld.getHeightAt(x,z)+.28,top=openWorld.getWaterLevelAt(x,z)-.3;
    const dive=.5+Math.sin(elapsed*(.16+(index%13)*.009)+index*1.731)*.46;
    const y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):home.y;
    schoolFishTransform.position.set(x,y,z);
    schoolFishTransform.rotation.set(0,-phase+Math.PI*.5,0);schoolFishTransform.scale.setScalar(.7+(index%7)*.045);schoolFishTransform.updateMatrix();schoolFish.setMatrixAt(index,schoolFishTransform.matrix);
  }
  schoolFish.instanceMatrix.needsUpdate=true;
};

function updateMarineLife(delta: number, elapsed: number) {
  seaWaterMaterial.opacity = .72 + Math.sin(elapsed * 1.4) * .045;
  for (const [lifeIndex,life] of marineLife.entries()) {
    const marineRange=qualityLevel==="low"?42:qualityLevel==="medium"?65:95;
    if(life.root.position.distanceToSquared(character.group.position)>marineRange*marineRange){life.root.visible=false;continue;}
    life.root.visible=true;
    const playerInWater=openWorld.isWaterAt(character.group.position.x,character.group.position.z);
    const shouldBeLocal=life.kind!=="seagull"&&playerInWater&&life.root.position.distanceToSquared(character.group.position)>(life.kind==="shark"?55*55:38*38);
    if(shouldBeLocal&&life.kind!=="seagull"){
      const point=localWaterPoint(life.kind,lifeIndex,life.kind==="shark"?55:30,life.kind==="shark"?20:5);
      if(point){life.root.position.set(point.x,point.y+life.altitude,point.z);life.home.copy(life.root.position);life.root.visible=true;}
    }
    if(life.kind!=="seagull"&&!isAnimalHabitat(openWorld,life.kind,life.root.position.x,life.root.position.z)){
      const point=findAnimalHabitatPoint(openWorld,life.kind,marineLife.indexOf(life));
      if(!point){life.root.visible=false;continue;}
      life.root.position.set(point[0],openWorld.getWaterLevelAt(point[0],point[2])+life.altitude,point[2]);life.home.copy(life.root.position);life.root.visible=true;
    }
    const previousPosition=life.root.position.clone();
    life.mixer?.update(delta);
    life.attackCooldown = Math.max(0, life.attackCooldown - delta);
    if (life.kind === "shark") {
      const playerInSea = isAnimalHabitat(openWorld,"shark",character.group.position.x,character.group.position.z);
      const playerDistance = character.group.position.distanceTo(life.root.position);
      if (life.attackElapsed !== undefined) {
        life.attackElapsed += delta;
        const phase = Math.min(1, life.attackElapsed / .72), lunge = Math.sin(phase * Math.PI);
        const direction = character.group.position.clone().sub(life.attackBase).setY(0).normalize();
        life.root.position.copy(life.attackBase).addScaledVector(direction, lunge * .7);
        life.root.rotation.x = -lunge * .18;
        if (!life.attackDidDamage && phase >= .4) {
          life.attackDidDamage = true;
          if (character.group.position.distanceTo(life.root.position) <= 1.6 && !playerDodgingHit()) {
            const damage=physicalDamage(50,totalStats().defense);
            inventoryState.hp = Math.max(0, inventoryState.hp - damage);
            character.group.position.addScaledVector(direction,1.4);resolveWorldCollisions(character.group.position,.32,character.group);
            gameAudio.hit();showPlayerDamage();refreshHud();saveInventory(inventoryState);
            setPlayStatus(`Tubarão atacou: -${damage} HP`);
          }
        }
        if (phase >= 1) {
          life.root.position.copy(life.attackBase); life.root.rotation.x = 0;
          life.attackElapsed = undefined; life.attackCooldown = 4;
          life.velocity.copy(life.root.position).sub(character.group.position).setY(0);
          if(life.velocity.lengthSq()<.001)life.velocity.set(Math.cos(lifeIndex),0,Math.sin(lifeIndex));
          life.velocity.normalize();
        }
      } else if (playerInSea && playerDistance < 7.5 && life.attackCooldown===0) {
        const direction = character.group.position.clone().sub(life.root.position).setY(0);
        if (direction.lengthSq() > .001) {
          direction.normalize();
          turnMarineHeading(life.velocity, direction, delta * 1.35);
          life.root.position.addScaledVector(life.velocity, 2.9 * delta);
          faceMarineHeading(life);
        }
        if (playerDistance <= 1.45 && life.attackCooldown === 0) {
          life.attackElapsed = 0; life.attackDidDamage = false; life.attackBase.copy(life.root.position);
        }
      } else {
        const turn=Math.sin(elapsed*.17+lifeIndex*2.31)*delta*.34;
        life.velocity.applyAxisAngle(camera.up,turn).normalize();
        life.root.position.addScaledVector(life.velocity, life.speed * delta);
        const bottom=openWorld.getHeightAt(life.root.position.x,life.root.position.z)+.55;
        const top=openWorld.getWaterLevelAt(life.root.position.x,life.root.position.z)-.65;
        const dive=.5+Math.sin(elapsed*(.19+(lifeIndex%5)*.027)+lifeIndex*2.173)*.45;
        life.root.position.y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):top;
        faceMarineHeading(life);
      }
    } else if (life.kind === "trout") {
      life.root.position.addScaledVector(life.velocity, life.speed * delta);
      const bottom=openWorld.getHeightAt(life.root.position.x,life.root.position.z)+.24;
      const top=openWorld.getWaterLevelAt(life.root.position.x,life.root.position.z)-.28;
      const dive=.5+Math.sin(elapsed*(.22+(lifeIndex%11)*.013)+lifeIndex*1.917)*.46;
      life.root.position.y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):top;
      life.root.rotation.y = Math.atan2(life.velocity.x, life.velocity.z);
    } else {
      life.angle += delta * life.speed;
      life.root.position.set(
        seaCenter.x + Math.cos(life.angle) * life.radius,
        life.altitude + Math.sin(elapsed * (life.kind === "seagull" ? 1.4 : 2.2) + life.angle) * (life.kind === "seagull" ? .28 : .06),
        seaCenter.z + Math.sin(life.angle) * life.radius,
      );
      life.root.rotation.y = -life.angle;
      life.root.rotation.z = Math.sin(elapsed + life.angle) * .08;
    }
    const outsideHabitat=life.kind!=="seagull"&&!isAnimalHabitat(openWorld,life.kind,life.root.position.x,life.root.position.z);
    const outsidePatrol=life.kind!=="seagull"&&life.kind!=="shark"&&Math.hypot(life.root.position.x-life.home.x,life.root.position.z-life.home.z)>ANIMAL_TERRITORIES[life.kind].patrol;
    if(life.kind!=="seagull"&&(outsideHabitat||outsidePatrol)){
      life.root.position.copy(previousPosition);
      if(life.kind==="shark")life.velocity.applyAxisAngle(camera.up,.32+(lifeIndex%3)*.08).normalize();
      else life.velocity.copy(life.home).sub(previousPosition).setY(0).normalize();
      life.attackElapsed=undefined;
    }
  }
}
if(LEGACY_CITY_CONTENT_ENABLED)gltfLoader.load(
  "/models/animals/horse/model.glb",
  (gltf) => {
    const horse = gltf.scene;
    horse.name = "Horse";
    horse.userData.animalModel = "/models/animals/horse/model.glb";
    horse.userData.modelLabel = "Cavalo";
    horse.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(horse);
    const height = initialBox.getSize(new THREE.Vector3()).y;
    // Full-size riding horse: the previous 1.72 m total bounding-box height
    // made this stylized model read as a pony beside the player.
    horse.scale.setScalar(2.68 / Math.max(height, 0.001));
    horse.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(horse),
      center = box.getCenter(new THREE.Vector3());
    horse.position.set(-2.35 - center.x, -box.min.y, 0.25 - center.z);
    horse.rotation.y = Math.PI / 2;
    horse.traverse((child) => {
      // Mesh.003 is the exported hand-held rein. Without a rider it stretches
      // rigidly into empty space, so keep the fitted bridle and hide this loose
      // rein until the mounting system has hand targets.
      if (child.name === "Object_21") child.visible = false;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(horse);
    horseRoot = horse;
    const saddle = horse.getObjectByName("Object_16");
    if (saddle) {
      horse.updateMatrixWorld(true);
      const saddleBox = new THREE.Box3().setFromObject(saddle),
        saddleTop = saddleBox.getCenter(new THREE.Vector3());
      saddleTop.y = saddleBox.max.y + 0.03;
      horseMountAnchor = new THREE.Object3D();
      horseMountAnchor.name = "MountAnchor";
      horseMountAnchor.position.copy(horse.worldToLocal(saddleTop));
      horse.add(horseMountAnchor);
    }
    refreshBuildAssetList();
    const placedAtStable = placeHorseAtCastleStable();
    if (!placedAtStable) restoreHorseRuntimePosition();
    ensurePlayerClearOfHorse();
    if (gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(horse);
      const clips: { key: string; name: string }[] = [
        { key: "idle", name: "Armature|ArmatureAction" },
        { key: "walk", name: "Armature|Walk" },
        { key: "walk-left", name: "Armature|Walk_Left" },
        { key: "walk-right", name: "Armature|Walk_Right" },
        { key: "run", name: "Armature|Run" },
        { key: "run-left", name: "Armature|Run_Left" },
        { key: "run-right", name: "Armature|Run_Right" },
      ];
      for (const entry of clips) {
        const clip = THREE.AnimationClip.findByName(
          gltf.animations,
          entry.name,
        );
        if (clip) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          horseActions.set(entry.key, action);
        }
      }
      horseCurrentAction =
        horseActions.get("idle") ?? mixer.clipAction(gltf.animations[0]);
      horseCurrentAction.play();
      horseMixers.push(mixer);
    }
    const idleParts: [string, number, number][] = [
      ["Neck001_023", 0, 0.035],
      ["Head_024", 0.55, 0.055],
      ["EarL_025", 1.2, 0.09],
      ["EarR_026", 2.5, -0.09],
    ];
    for (const [name, phase, amount] of idleParts) {
      const bone = horse.getObjectByName(name);
      if (bone)
        horseIdleBones.push({
          bone,
          base: bone.quaternion.clone(),
          phase,
          amount,
        });
    }
  },
  undefined,
  (error) => console.error("Não foi possível carregar o cavalo", error),
);

type LootEntry = { itemId: string; quantity: number };
type Prey = {
  id: "deer" | "rabbit" | "chicken" | "rat" | "raccoon" | "bear" | "wolf" | "puma";
  label: string;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  dieClip: string;
  headAnchor: THREE.Object3D;
  hud: HTMLDivElement;
  hudUntil: number;
  loot: LootEntry[];
  deathElapsed?: number;
  hitElapsed?: number;
  hitStartPosition: THREE.Vector3;
  hitDirection: THREE.Vector3;
  hitBaseRotationX: number;
  hitBaseRotationZ: number;
  fleeTime: number;
  routine: "stationary" | "patrol";
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  routinePause: number;
  moveSpeed: number;
  idleClip: string;
  currentMotion: "idle" | "walk";
  home: THREE.Vector3;
  territoryRadius: number;
  hostileState: "calm" | "chase" | "attack" | "return";
  attackCooldown: number;
  attackElapsed?: number;
  attackDidDamage: boolean;
  attackBasePosition: THREE.Vector3;
  attackDamage: number;
  predatorPosition?: THREE.Vector3;
  frozenUntil: number;
  avoidanceSign:-1|1;
  avoidanceUntil:number;
  howlCooldown:number;
  howlElapsed?:number;
  jaw?:THREE.Object3D;
  jawRest?:THREE.Quaternion;
};
const preyAnimals: Prey[] = [];
const WOLF_MOUNTAIN_PACKS=[[-550,-700],[350,-700]] as const;
const FOREST_ANIMAL_IDS=new Set<Prey["id"]>(["bear","raccoon","deer","rabbit"]);
const animalRoutinePause=(id:Prey["id"])=>
  FOREST_ANIMAL_IDS.has(id) ? .65+Math.random()*1.85 : 1.5+Math.random()*4;
function placePreyInArena(prey: Prey) {
  const sameSpecies = preyAnimals.filter((item) => item.id === prey.id), index = Math.max(0, sameSpecies.indexOf(prey));
  const wolfPack=prey.id==="wolf"?WOLF_MOUNTAIN_PACKS[Math.min(WOLF_MOUNTAIN_PACKS.length-1,Math.floor(index/3))]:undefined;
  const point=wolfPack?findAnimalHabitatPoint(openWorld,prey.id,index,wolfPack,150):findAnimalHabitatPoint(openWorld,prey.id,index);
  if(!point){prey.root.visible=false;return;}
  const [x,,z]=point;
  const position = new THREE.Vector3(x, openWorld.getHeightAt(x, z), z); prey.position.copy(position); prey.home.copy(position); prey.root.position.copy(position); prey.hitStartPosition.copy(position); prey.attackBasePosition.copy(position);
  prey.waypoints = animalPatrolPoints(openWorld,prey.id,index,[x,z]).map((p)=>new THREE.Vector3(...p));
  prey.routine="patrol";prey.waypointIndex=0;prey.root.visible=true;
  prey.root.userData.habitat=ANIMAL_TERRITORIES[prey.id].label;
}
function constrainPreyToHabitat(prey: Prey, previous: THREE.Vector3) {
  if(prey.hp<=0)return;
  if(!isAnimalHabitat(openWorld,prey.id,prey.position.x,prey.position.z)){
    const recovery=isAnimalHabitat(openWorld,prey.id,previous.x,previous.z)
      ? previous.toArray() : findAnimalHabitatPoint(openWorld,prey.id,preyAnimals.indexOf(prey));
    if(!recovery){prey.root.visible=false;return;}
    prey.position.set(recovery[0],openWorld.getHeightAt(recovery[0],recovery[2]),recovery[2]);
    prey.root.position.copy(prey.position);
    prey.fleeTime=0;prey.attackElapsed=undefined;prey.hitElapsed=undefined;prey.hostileState="calm";
    prey.waypointIndex=(prey.waypointIndex+1)%Math.max(1,prey.waypoints.length);
    if(!isAnimalHabitat(openWorld,prey.id,prey.home.x,prey.home.z)){
      prey.home.copy(prey.position);
      prey.waypoints=animalPatrolPoints(openWorld,prey.id,preyAnimals.indexOf(prey),[prey.home.x,prey.home.z]).map(p=>new THREE.Vector3(...p));
    }
  }
  const verticalOffset=prey.root.position.y-prey.position.y;
  prey.position.y=openWorld.getHeightAt(prey.position.x,prey.position.z);
  prey.root.position.y=prey.position.y+verticalOffset;
}
const preyRadius = (prey: Prey) => prey.id === "bear" ? .82 : prey.id === "wolf" || prey.id === "puma" ? .52 : prey.id === "deer" ? .62 : prey.id === "chicken" ? .16 : prey.id === "rat" ? .065 : .24;
const playerDamage = () => totalStats().attack;
function updatePreyHud(prey: Prey) {
  (prey.hud.querySelector("b") as HTMLElement).style.width =
    `${Math.max(0, prey.hp / prey.maxHp) * 100}%`;
  prey.hud.classList.toggle("dead", prey.hp <= 0);
}
function loadPrey(config: {
  count?: number;
  id: "deer" | "rabbit" | "chicken" | "rat" | "raccoon" | "bear" | "wolf" | "puma";
  label: string;
  url: string;
  position: THREE.Vector3;
  height: number;
  idleClip: string;
  dieClip: string;
  hp: number;
  rotation: number;
  routine?: "stationary" | "patrol";
  waypoints?: THREE.Vector3[];
  moveSpeed?: number;
  territoryRadius?: number;
  attackDamage?: number;
}) {
  if((config.count??1)>1){for(let i=0;i<config.count!;i++)loadPrey({...config,count:1,label:`${config.label} ${i+1}`});return;}
  loadSharedGltf(
    config.url,
    (gltf) => {
      const model = gltf.scene, root = new THREE.Group();
      root.add(model);
      root.name = config.label;
      root.userData.animalModel = config.url;
      root.userData.modelLabel = ({ deer: "Cervo", rabbit: "Coelho", chicken: "Galinha", rat: "Rato", raccoon: "Guaxinim", bear: "Urso", wolf: "Lobo", puma: "Leão-da-montanha" })[config.id];
      root.updateMatrixWorld(true);
      const initial = new THREE.Box3().setFromObject(root),
        height = initial.getSize(new THREE.Vector3()).y;
      model.scale.setScalar(config.height / Math.max(height, 0.001));
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root),
        center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x,-box.min.y,-center.z);
      root.position.copy(config.position);
      root.rotation.y = config.rotation;
      const raccoonMeshes: THREE.Mesh[] = [];
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (config.id === "bear") {
            const tintMaterial = (material: THREE.Material) => {
              const tinted = material.clone();
              if (tinted instanceof THREE.MeshStandardMaterial || tinted instanceof THREE.MeshLambertMaterial || tinted instanceof THREE.MeshPhongMaterial) {
                if (child.name === "Object_8" || material.name === ".002")
                  tinted.color.set("#050505");
                else tinted.color.multiply(new THREE.Color("#70452d"));
                if (tinted.color.getHSL({ h: 0, s: 0, l: 0 }).l < .08)
                  tinted.color.set(child.name === "Object_8" ? "#050505" : "#38251d");
                tinted.needsUpdate = true;
              }
              return tinted;
            };
            child.material = Array.isArray(child.material)
              ? child.material.map(tintMaterial)
              : tintMaterial(child.material);
          } else if (config.id === "raccoon") {
            raccoonMeshes.push(child);
            child.material = new THREE.MeshStandardMaterial({
              color: "#767b78",
              roughness: .86,
              metalness: 0,
            });
          }
        }
      });
      const jaw=root.getObjectByName("Jaw_M_032")??root.getObjectByName("Jaw_M_039")??[...root.children].find(child=>/jaw/i.test(child.name));
      if (config.id === "raccoon") {
        // This asset uses the retired specular/glossiness glTF extension.
        // Load its embedded diffuse texture explicitly so modern Three.js
        // renders the authored gray, black and cream markings.
        void gltf.parser.getDependency("texture", 0).then((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          raccoonMeshes.forEach((mesh) => {
            mesh.material = new THREE.MeshStandardMaterial({
              map: texture,
              color: "#ffffff",
              roughness: .86,
              metalness: 0,
            });
          });
        }).catch((error) => console.error("Não foi possível carregar as cores do guaxinim", error));
      }
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root),
        idle =
          THREE.AnimationClip.findByName(gltf.animations, config.idleClip) ??
          gltf.animations[0];
      if (idle) mixer.clipAction(idle).play();
      root.updateMatrixWorld(true);
      const placedBox = new THREE.Box3().setFromObject(root),
        headWorld = new THREE.Vector3(
          config.position.x,
          placedBox.max.y + 0.16,
          config.position.z,
        );
      const headAnchor = new THREE.Object3D();
      headAnchor.position.copy(root.worldToLocal(headWorld));
      root.add(headAnchor);
      const hud = document.createElement("div");
      hud.className = "animal-health";
      hud.innerHTML = `<i><b></b></i>`;
      viewport.append(hud);
      const prey: Prey = {
        id: config.id,
        label: config.label,
        root,
        mixer,
        position: config.position.clone(),
        hp: config.hp,
        maxHp: config.hp,
        dieClip: config.dieClip,
        headAnchor,
        hud,
        hudUntil: 0,
        loot: [],
        hitStartPosition: root.position.clone(),
        hitDirection: new THREE.Vector3(),
        hitBaseRotationX: root.rotation.x,
        hitBaseRotationZ: root.rotation.z,
        fleeTime: 0,
        routine: config.routine ?? "stationary",
        waypoints: config.waypoints?.map((point) => point.clone()) ?? [],
        waypointIndex: 0,
        routinePause: animalRoutinePause(config.id),
        moveSpeed: config.moveSpeed ?? (config.id === "deer" ? 0.5 : 0.34),
        idleClip: config.idleClip,
        currentMotion: "idle",
        home: config.position.clone(),
        territoryRadius: config.territoryRadius ?? 0,
        hostileState: "calm",
        attackCooldown: 0,
        attackDidDamage: false,
        attackBasePosition: root.position.clone(),
        attackDamage: config.attackDamage ?? 0,
        frozenUntil: 0,
        avoidanceSign:Math.random()<.5?-1:1,
        avoidanceUntil:0,
        howlCooldown:120,
        jaw,
        jawRest:jaw?.quaternion.clone(),
      };
      root.userData.clips = gltf.animations;
      preyAnimals.push(prey);
      if (buildState.worldPreset === "arena-island-v1") placePreyInArena(prey);
      updatePreyHud(prey);
    },
    undefined,
    (error) =>
      console.error(`Não foi possível carregar ${config.label}`, error),
  );
}
const deerSpawns = [
  { position: [2.8, -0.6], routine: "stationary", route: [] },
  {
    position: [-5.5, -3.5],
    routine: "patrol",
    route: [
      [-5.5, -3.5],
      [-1.5, -5.8],
      [2, -4.7],
    ],
  },
  {
    position: [7.5, 4.5],
    routine: "patrol",
    route: [
      [7.5, 4.5],
      [10, 1],
      [6, -1.5],
    ],
  },
  { position: [-9, 6], routine: "stationary", route: [] },
  {
    position: [11, -8],
    routine: "patrol",
    route: [
      [11, -8],
      [6, -9],
      [4, -6],
    ],
  },
  {
    position: [-12, -9],
    routine: "patrol",
    route: [
      [-12, -9],
      [-8, -5],
      [-13, -2],
    ],
  },
] as const;
deerSpawns.forEach((spawn, index) =>
  loadPrey({
    count: 2,
    id: "deer",
    label: `Cervo ${index + 1}`,
    url: "/models/animals/deer/model.glb",
    position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
    height: 1.42,
    idleClip: "Armature|Eat",
    dieClip: "Armature|Die",
    hp: 80,
    rotation: -0.65,
    routine: spawn.routine,
    waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    moveSpeed: 1.35,
  }),
);
const rabbitSpawns = [
  { position: [1.9, 1.6], routine: "stationary", route: [] },
  {
    position: [-3, 3.5],
    routine: "patrol",
    route: [
      [-3, 3.5],
      [0.5, 5],
      [3, 3],
    ],
  },
  {
    position: [5.5, -4],
    routine: "patrol",
    route: [
      [5.5, -4],
      [8, -2],
      [7.5, 1],
    ],
  },
  { position: [-7, -7], routine: "stationary", route: [] },
  {
    position: [12, 7],
    routine: "patrol",
    route: [
      [12, 7],
      [9, 9],
      [6.5, 7],
    ],
  },
  {
    position: [-13, 4],
    routine: "patrol",
    route: [
      [-13, 4],
      [-10, 1],
      [-7, 3],
    ],
  },
  { position: [3, 10], routine: "stationary", route: [] },
  {
    position: [-2, -11],
    routine: "patrol",
    route: [
      [-2, -11],
      [2, -12],
      [4, -9],
    ],
  },
] as const;
rabbitSpawns.forEach((spawn, index) =>
  loadPrey({
    count: 3,
    id: "rabbit",
    label: `Coelho ${index + 1}`,
    url: "/models/animals/rabbit/model.glb",
    position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
    height: 0.52,
    idleClip: "Armature.001|Idle",
    dieClip: "Armature.001|Die",
    hp: 30,
    rotation: -1.1,
    routine: spawn.routine,
    waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    moveSpeed: 2.1,
  }),
);

if(LEGACY_CITY_CONTENT_ENABLED)[
  { position: [-3, 3], route: [[-3, 3], [-1, 4], [-2, 6]] },
  { position: [-1.5, 2], route: [[-1.5, 2], [1, 3], [.5, 5]] },
  { position: [2, 4], route: [[2, 4], [4, 3], [3.5, 6]] },
  { position: [4, 5.5], route: [[4, 5.5], [2.5, 7], [5, 7.5]] },
].forEach((spawn, index) => loadPrey({
  id: "chicken",
  label: `Galinha ${index + 1}`,
  url: "/models/animals/chicken/model.glb",
  position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
  height: .416,
  idleClip: "chicken-rig|idle",
  dieClip: "__none__",
  hp: 20,
  rotation: index * 1.3,
  routine: "patrol",
  waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  moveSpeed: .48,
}));

if(LEGACY_CITY_CONTENT_ENABLED)[
  { position: [-11, -3], route: [[-11, -3], [-8, -2], [-5, -4], [-9, -5]] },
  { position: [-4, -1], route: [[-4, -1], [-7, -3], [-10, -1], [-6, 0]] },
  { position: [-9, 1], route: [[-9, 1], [-6, -1], [-5, -4], [-11, -2]] },
].forEach((spawn, index) => loadPrey({
  id: "rat",
  label: `Rato ${index + 1}`,
  url: "/models/animals/rat/model.glb",
  position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
  height: .125,
  idleClip: "__none__",
  dieClip: "__none__",
  hp: 8,
  rotation: index * 2,
  routine: "patrol",
  waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  moveSpeed: .72,
}));

loadPrey({
  id: "raccoon",
  count: 12,
  label: "Guaxinim",
  url: "/models/animals/raccoon/model.glb",
  position: new THREE.Vector3(-5.5, 0, 5.5),
  height: .58,
  idleClip: "Racoon_Idle",
  dieClip: "__none__",
  hp: 38,
  rotation: .7,
  routine: "patrol",
  waypoints: [
    new THREE.Vector3(-5.5, 0, 5.5),
    new THREE.Vector3(-2.5, 0, 7),
    new THREE.Vector3(-4, 0, 9),
    new THREE.Vector3(-7, 0, 7.5),
  ],
  moveSpeed: 1.2,
});

loadPrey({
  id: "bear",
  count: 6,
  label: "Urso territorial",
  url: "/models/animals/bear/model.glb",
  position: new THREE.Vector3(-7, 0, 7),
  height: 1.85,
  idleClip: "metarigAction",
  dieClip: "__none__",
  hp: 180,
  rotation: Math.PI * .7,
  routine: "stationary",
  moveSpeed: 3.6,
  territoryRadius: 14,
  attackDamage: 20,
});

loadPrey({
  id: "wolf",
  count: 6,
  label: "Lobo",
  url: "/models/animals/dire-wolf/model.glb",
  position: new THREE.Vector3(8, 0, -7),
  height: 1.42,
  idleClip: "Coyote_Idle",
  dieClip: "__none__",
  hp: 105,
  rotation: -.8,
  routine: "stationary",
  moveSpeed: 3.35,
  territoryRadius: 16,
  attackDamage: 15,
});

loadPrey({
  id: "puma",
  count: 8,
  label: "Leão-da-montanha",
  url: "/models/animals/mountain-lion/model.glb",
  position: new THREE.Vector3(9, 0, 8),
  height: 1.42,
  idleClip: "Mountain-puma_Idle_Standing",
  dieClip: "__none__",
  hp: 125,
  rotation: -2.2,
  routine: "stationary",
  moveSpeed: 3.75,
  territoryRadius: 18,
  attackDamage: 18,
});

const catHome = new THREE.Vector3(-7, 0, -3);
catHome.y=openWorld.getHeightAt(catHome.x,catHome.z);
let catHunter: { root: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; motion: string } | null = null;
if(LEGACY_CITY_CONTENT_ENABLED)gltfLoader.load("/models/animals/cat/model.glb", (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(.72 / Math.max(initial.getSize(new THREE.Vector3()).y, .001));
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
  model.position.sub(center); model.position.y += box.getSize(new THREE.Vector3()).y * .5;
  model.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
  const root = new THREE.Group(); root.name = "Gato caçador"; root.userData.buildEditable = false; root.userData.animalModel = "/models/animals/cat/model.glb"; root.userData.modelLabel = "Gato"; root.userData.habitat="Cidade"; root.add(model); root.position.copy(catHome); scene.add(root);
  const mixer = new THREE.AnimationMixer(model), actions = new Map<string, THREE.AnimationAction>();
  for (const name of ["idle", "walk", "run"]) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (clip) actions.set(name, mixer.clipAction(clip));
  }
  (actions.get("idle") ?? mixer.clipAction(gltf.animations[0])).play();
  catHunter = { root, mixer, actions, motion: "idle" };
}, undefined, (error) => console.error("Não foi possível carregar o gato", error));

function setCatMotion(motion: "idle" | "walk" | "run") {
  if (!catHunter || catHunter.motion === motion) return;
  const next = catHunter.actions.get(motion); if (!next) return;
  catHunter.actions.get(catHunter.motion)?.fadeOut(.15);
  next.reset().fadeIn(.15).play(); catHunter.motion = motion;
}
function updateCatAndRats(delta: number) {
  if (!catHunter) return;
  const previousPosition=catHunter.root.position.clone();
  catHunter.mixer.update(delta);
  let target: Prey | undefined, closest = Infinity;
  for (const prey of preyAnimals) {
    if (prey.id !== "rat" || prey.hp <= 0 || prey.position.distanceTo(catHome) > 18) continue;
    const distance = prey.position.distanceTo(catHunter.root.position);
    if (distance < closest) { closest = distance; target = prey; }
  }
  if (target) {
    target.predatorPosition = catHunter.root.position;
    target.fleeTime = .45;
    const direction = target.position.clone().sub(catHunter.root.position).setY(0);
    if (direction.lengthSq() > .001) {
      direction.normalize(); catHunter.root.position.addScaledVector(direction, 2.45 * delta);
      catHunter.root.rotation.y = Math.atan2(direction.x, direction.z); setCatMotion("run");
    }
  } else {
    const homeDirection = catHome.clone().sub(catHunter.root.position).setY(0), distance = homeDirection.length();
    if (distance > .12) {
      homeDirection.normalize(); catHunter.root.position.addScaledVector(homeDirection, Math.min(distance, 1.35 * delta));
      catHunter.root.rotation.y = Math.atan2(homeDirection.x, homeDirection.z); setCatMotion("walk");
    } else setCatMotion("idle");
  }
  if(!isAnimalHabitat(openWorld,"cat",catHunter.root.position.x,catHunter.root.position.z))catHunter.root.position.copy(previousPosition);
  catHunter.root.position.y=openWorld.getHeightAt(catHunter.root.position.x,catHunter.root.position.z);
}

function nearestLivingPrey(maxDistance = Infinity) {
  let target: Prey | undefined,
    distance = Infinity;
  for (const prey of preyAnimals) {
    if (prey.hp <= 0) continue;
    const current = character.group.position.distanceTo(prey.position);
    if (current < distance) {
      target = prey;
      distance = current;
    }
  }
  return target && distance <= maxDistance ? target : undefined;
}

const spellForward = new THREE.Vector3();
const spellTargetOffset = new THREE.Vector3();
function forwardSpellTarget(origin: THREE.Vector3, maxDistance: number, hitRadius: number) {
  spellForward.set(Math.sin(character.group.rotation.y), 0, Math.cos(character.group.rotation.y)).normalize();
  let target: Prey | undefined, closest = maxDistance;
  for (const prey of preyAnimals) {
    if (prey.hp <= 0 || !prey.root.visible) continue;
    spellTargetOffset.copy(prey.position).sub(origin).setY(0);
    const forwardDistance = spellTargetOffset.dot(spellForward);
    if (forwardDistance <= 0 || forwardDistance > maxDistance) continue;
    const sidewaysDistance = spellTargetOffset.addScaledVector(spellForward, -forwardDistance).length();
    const radius = targetRadius(prey.id);
    if (sidewaysDistance <= hitRadius + radius && forwardDistance < closest) {
      closest = forwardDistance;
      target = prey;
    }
  }
  const distance = target ? closest : maxDistance;
  const point = origin.clone().addScaledVector(spellForward, distance);
  point.y = target ? target.position.y + targetHeight(target.id) : origin.y;
  return { target, point };
}

function damagePrey(target: Prey, damage: number) {
  if (target.hp <= 0) return;
  damage = normalizeDamage(damage);
  target.hp = Math.max(0, target.hp - damage);
  updatePreyHud(target);
  gameAudio.hit();
  target.hudUntil = performance.now() + 1800;
  setPlayStatus(`${target.label}: -${damage} HP`);
  if (target.hp === 0) {
    if (target.hitElapsed !== undefined) {
      target.root.position.copy(target.hitStartPosition);
      target.root.rotation.x = target.hitBaseRotationX;
      target.root.rotation.z = target.hitBaseRotationZ;
      target.hitElapsed = undefined;
    }
    target.mixer.stopAllAction();
    const clips = target.root.userData.clips as THREE.AnimationClip[];
    const die = THREE.AnimationClip.findByName(clips, target.dieClip);
    if (die) {
      const action = target.mixer.clipAction(die);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
    target.deathElapsed = 0;
    target.loot = target.id === "deer"
      ? [{ itemId: "deer-meat", quantity: 3 }, { itemId: "leather", quantity: 1 }]
      : target.territoryRadius > 0
        ? [{ itemId: "leather", quantity: target.id === "bear" ? 4 : 2 }]
        : target.id === "chicken" || target.id === "rat" || target.id === "raccoon" ? [] : [{ itemId: "rabbit-meat", quantity: 1 }];
    const xpReward:Record<Prey["id"],number>={rat:5,chicken:8,rabbit:10,raccoon:15,deer:20,wolf:35,puma:40,bear:50};
    const earned=xpReward[target.id],levelsGained=grantExperience(inventoryState,earned);
    recordGuildKill(inventoryState,target.id);
    if(levelsGained)setPlayStatus(`Nível ${inventoryState.level}! +${levelsGained*20} HP máximo · +${earned} XP`);
    else setPlayStatus(`${target.label} abatido · +${earned} XP · aperte E para saquear`);
    saveInventory(inventoryState);
    refreshHud();
  } else {
    target.hitElapsed = 0;
    target.hitStartPosition.copy(target.root.position);
    target.hitBaseRotationX = target.root.rotation.x;
    target.hitBaseRotationZ = target.root.rotation.z;
    target.hitDirection.copy(target.position).sub(character.group.position).setY(0);
    if (target.hitDirection.lengthSq() < 0.0001) target.hitDirection.set(0, 0, 1);
    else target.hitDirection.normalize();
    if (target.territoryRadius > 0) {
      target.hostileState = "chase";
      target.fleeTime = 0;
    } else target.fleeTime = target.id === "deer" ? 4.5 : 3.2;
  }
}

function hitNearestPrey() {
  const target = nearestLivingPrey(2.45);
  if (!target) {
    setPlayStatus("Nenhuma caça no alcance");
    return;
  }
  damagePrey(target, playerDamage());
}

const mountPosition = new THREE.Vector3();
const RUNTIME_WORLD_KEY = "rpg3d.runtimeWorld.v1";
const runtimeWorldStore = new RuntimeWorldStore(RUNTIME_WORLD_KEY);
const runtimeWorld = runtimeWorldStore.state;
const snapCameraToPlayer = () => {
  const target = character.group.position.clone().add(new THREE.Vector3(0, PLAYER_CAMERA_HEAD_HEIGHT, 0));
  const offset = validPosition(runtimeWorld.cameraOffset)
    ? new THREE.Vector3().fromArray(runtimeWorld.cameraOffset)
    : new THREE.Vector3(3.8, 1.55, 6.5);
  controls.target.copy(target);
  camera.position.copy(target).add(offset);
  controls.update();
};
if (runtimeWorld.player && validPosition(runtimeWorld.player.position)) {
  character.group.position.fromArray(runtimeWorld.player.position);
  if (Number.isFinite(runtimeWorld.player.rotationY)) character.group.rotation.y = runtimeWorld.player.rotationY;
}
// Recover the player onto the rebuilt plaza instead of restoring inside its raised foundation.
const palaceGroundRecoveryKey='rpg3d.palace-plaza-ground.v4';
for(const palace of cityBuilder.objects.values()){
 if(!palace.userData.palaceComplex)continue;
 palace.updateWorldMatrix(true,false);
 const local=palace.worldToLocal(character.group.position.clone());
 const floor=palace.userData.plazaFloorElevation;
 if(typeof floor!=='number'||Math.abs(local.x)>90||local.z< -60||local.z>100)continue;
 const buried=Math.abs(local.x)<65&&local.z>=23&&local.z<=57&&local.y<floor-.2;
 if(localStorage.getItem(palaceGroundRecoveryKey)!=='1'||buried){
  character.group.position.copy(palace.localToWorld(new THREE.Vector3(0,floor+PLAYER_GROUND_OFFSET,45)));
  localStorage.setItem(palaceGroundRecoveryKey,'1');
 }
}
// Both new games and restored games start on the current terrain surface.
character.group.position.y = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
snapCameraToPlayer();
const restoreHorseRuntimePosition = () => {
  if (!horseRoot || !runtimeWorld.horse || !validPosition(runtimeWorld.horse.position)) return;
  horseRoot.position.fromArray(runtimeWorld.horse.position);
  horseRoot.position.y = openWorld.getHeightAt(horseRoot.position.x, horseRoot.position.z);
  if (Number.isFinite(runtimeWorld.horse.rotationY)) horseRoot.rotation.y = runtimeWorld.horse.rotationY;
};
const ensurePlayerClearOfHorse = () => {
  if (!horseRoot) return;
  horseRoot.getWorldScale(horseWorldScale);
  const sideDistance = Math.max(1.8, 1.45 * horseWorldScale.x);
  const dx = character.group.position.x - horseRoot.position.x,
    dz = character.group.position.z - horseRoot.position.z;
  if (Math.hypot(dx, dz) >= sideDistance) return;
  character.group.position.set(
    horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance,
    openWorld.getHeightAt(horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance, horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance),
    horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance,
  );
  character.group.rotation.y = horseRoot.rotation.y;
  character.group.visible = true;
  snapCameraToPlayer();
};
const saveRuntimeWorld = () => {
  const savedPlayerPosition = character.group.position.clone();
  if (mounted && horseRoot) {
    horseRoot.getWorldScale(horseWorldScale);
    const sideDistance = Math.max(1.8, 1.45 * horseWorldScale.x);
    savedPlayerPosition.set(
      horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance,
      0,
      horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance,
    );
  }
  runtimeWorld.player = {
    position: savedPlayerPosition.toArray() as [number, number, number],
    rotationY: character.group.rotation.y,
  };
  runtimeWorld.horses??={};
  for(const state of rideableHorses.values()){
    const key=state.root.userData.rideableHorseId??state.root.userData.buildId;if(!key||!state.root.userData.horseRuntimeApplied)continue;
    const position=state.root.getWorldPosition(new THREE.Vector3()),q=state.root.getWorldQuaternion(new THREE.Quaternion());
    runtimeWorld.horses[key]={position:position.toArray() as [number,number,number],rotationY:new THREE.Euler().setFromQuaternion(q,'YXZ').y};
  }
  if (horseRoot) runtimeWorld.horse = {
    position: horseRoot.position.toArray() as [number, number, number],
    rotationY: horseRoot.rotation.y,
  };
  runtimeWorld.cameraOffset = mounted
    ? [3.8, 1.55, 6.5]
    : camera.position.clone().sub(controls.target).toArray() as [number, number, number];
  runtimeWorldStore.save();
};
window.setInterval(saveRuntimeWorld, 1500);
window.addEventListener("pagehide", saveRuntimeWorld);
type MountDebugConfig = {
  riderForward: number;
  riderHeight: number;
  legSpread: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraTarget: number;
};
const MOUNT_DEBUG_KEY = "rpg3d.mountDebug.v1";
const DEFAULT_MOUNT_DEBUG: MountDebugConfig = {
  riderForward: .12,
  riderHeight: -.94,
  legSpread: .72,
  cameraDistance: 6,
  cameraHeight: 2.8,
  cameraTarget: 1.65,
};
const loadMountDebug = (): MountDebugConfig => {
  try { return { ...DEFAULT_MOUNT_DEBUG, ...JSON.parse(localStorage.getItem(MOUNT_DEBUG_KEY) ?? "null") }; }
  catch { return { ...DEFAULT_MOUNT_DEBUG }; }
};
let mountDebug = loadMountDebug();
character.setMountedLegSpread(mountDebug.legSpread);
type BroomModelDebug={position:[number,number,number];rotation:[number,number,number]};
const BROOM_RIDE_DEBUG_KEY="rpg3d.broomRideDebug.v1";
const DEFAULT_BROOM_MODEL_DEBUG:BroomModelDebug={position:[0,.72,.02],rotation:[0,90,0]};
const emptyRideTuning=()=>Object.fromEntries(broomRideNodes.map(([key])=>[key,{position:[0,0,0],rotation:[0,0,0]}])) as BroomRideTuning;
const RECOVERED_BROOM_RIDE_DEBUG:{model:BroomModelDebug;rig:BroomRideTuning}={
  model:{position:[0,.13,.87],rotation:[0,90,0]},
  rig:{
    center:{position:[0,0,.05],rotation:[60,0,0]},chest:{position:[0,0,0],rotation:[-40,0,0]},
    leftLeg:{position:[0,0,0],rotation:[0,0,10]},rightLeg:{position:[0,0,0],rotation:[0,0,-10]},
    leftShoulder:{position:[0,0,0],rotation:[-57,0,24]},leftElbow:{position:[0,0,0],rotation:[0,0,0]},leftWrist:{position:[0,0,0],rotation:[0,0,0]},
    rightShoulder:{position:[0,0,0],rotation:[-67,0,-27]},rightElbow:{position:[0,0,0],rotation:[0,0,0]},rightWrist:{position:[0,0,0],rotation:[0,0,0]},
  },
};
const broomRideWasZeroed=(rig:BroomRideTuning)=>broomRideNodes.every(([key])=>[...rig[key].position,...rig[key].rotation].every((value)=>value===0));
const loadBroomRideDebug=()=>{
  try{
    const saved=JSON.parse(localStorage.getItem(BROOM_RIDE_DEBUG_KEY)??"null") as {model?:BroomModelDebug;rig?:BroomRideTuning}|null;
    if(!saved?.rig||broomRideWasZeroed(saved.rig))return structuredClone(RECOVERED_BROOM_RIDE_DEBUG);
    return {model:saved?.model??structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:saved?.rig??emptyRideTuning()};
  }catch{return {model:structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:emptyRideTuning()};}
};
let broomRideDebug=loadBroomRideDebug();
localStorage.setItem(BROOM_RIDE_DEBUG_KEY,JSON.stringify(broomRideDebug));
const applyBroomRideDebug=()=>{
  if(broomMountVisual){
    broomMountVisual.position.fromArray(broomRideDebug.model.position);
    broomMountVisual.rotation.set(...broomRideDebug.model.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
  }
  const radians=structuredClone(broomRideDebug.rig);
  for(const [key] of broomRideNodes)radians[key].rotation=radians[key].rotation.map(THREE.MathUtils.degToRad) as [number,number,number];
  character.setBroomRideTuning(radians);
};
applyBroomRideDebug();
const mountEditor = document.querySelector<HTMLElement>("#mountEditor")!;
const refreshMountDebugInputs = () => {
  document.querySelectorAll<HTMLInputElement>("[data-mount-debug]").forEach((input) => input.value = String(mountDebug[input.dataset.mountDebug as keyof MountDebugConfig]));
  document.querySelectorAll<HTMLInputElement>("[data-broom-model]").forEach((input)=>{const [group,index]=input.dataset.broomModel!.split('.') as ['position'|'rotation',string];input.value=String(broomRideDebug.model[group][Number(index)]);});
  document.querySelectorAll<HTMLInputElement>("[data-broom-ride]").forEach((input)=>{const [node,group,index]=input.dataset.broomRide!.split('.') as [BroomRideNode,'position'|'rotation',string];input.value=String(broomRideDebug.rig[node][group][Number(index)]);});
};
const setMountEditorOpen = (open: boolean) => {
  mountEditor.classList.toggle("hidden", !open);
  mountEditor.setAttribute("aria-hidden", String(!open));
  if (open) refreshMountDebugInputs();
};
document.querySelectorAll<HTMLInputElement>("[data-mount-debug]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.mountDebug as keyof MountDebugConfig, value = Number(input.value);
    if (!Number.isFinite(value)) return;
    mountDebug[key] = value;
    if (key === "legSpread") character.setMountedLegSpread(value);
    localStorage.setItem(MOUNT_DEBUG_KEY, JSON.stringify(mountDebug));
  });
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document.querySelectorAll<HTMLInputElement>("[data-broom-model],[data-broom-ride]").forEach((input)=>{
  input.addEventListener("input",()=>{
    const value=Number(input.value);if(!Number.isFinite(value))return;
    if(input.dataset.broomModel){const [group,index]=input.dataset.broomModel.split('.') as ['position'|'rotation',string];broomRideDebug.model[group][Number(index)]=value;}
    else {const [node,group,index]=input.dataset.broomRide!.split('.') as [BroomRideNode,'position'|'rotation',string];broomRideDebug.rig[node][group][Number(index)]=value;}
    localStorage.setItem(BROOM_RIDE_DEBUG_KEY,JSON.stringify(broomRideDebug));applyBroomRideDebug();
  });
  input.addEventListener("keydown",event=>event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-mount-debug-reset]")!.addEventListener("click", () => {
  mountDebug = { ...DEFAULT_MOUNT_DEBUG };
  character.setMountedLegSpread(mountDebug.legSpread);
  localStorage.setItem(MOUNT_DEBUG_KEY, JSON.stringify(mountDebug));
  localStorage.removeItem(BROOM_RIDE_DEBUG_KEY);
  broomRideDebug={model:structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:emptyRideTuning()};
  applyBroomRideDebug();
  refreshMountDebugInputs();
});
function setHorseMotion(motion: string, direction = 1) {
  const next =
    horseActions.get(motion) ??
    horseActions.get(motion.split("-")[0]) ??
    horseActions.get("idle");
  if (!next) return;
  if (next !== horseCurrentAction) {
    horseCurrentAction?.fadeOut(0.18);
    next.reset();
    if (direction < 0) next.time = next.getClip().duration;
    next.fadeIn(0.18).play();
    horseCurrentAction = next;
  }
  next.timeScale = direction;
  horseCurrentMotion = motion;
  const state=horseRoot?rideableHorses.get(horseRoot):undefined;if(state){state.current=horseCurrentAction;state.motion=motion;}
}
function toggleMount() {
  const interactionDistance=mounted?0:horseInteractionDistance();
  if (!horseRoot || !horseMountAnchor) return false;
  character.group.visible = true;
  if (!character.group.parent) scene.add(character.group);
  if (mounted) {
    mounted = false;
    const horseState=rideableHorses.get(horseRoot);if(horseState)resetHorseLook(horseState);
    activeAction = null;
    horseRoot.getWorldPosition(mountPosition);
    character.group.position.set(mountPosition.x+1.8,playerGroundHeightAt(mountPosition.x+1.8,mountPosition.z)+PLAYER_GROUND_OFFSET,mountPosition.z);
    resolveWorldCollisions(character.group.position,.32,character.group);
    character.group.position.y=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
    horseRoot.getWorldQuaternion(frameQuaternionScratch);
    character.group.rotation.set(0,frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y,0);
    setHorseMotion("idle");
    setAnimation("idle");
    character.setBroomRiding(false);
    setPlayStatus("Desmontou do cavalo");
    return true;
  }
  horseMountAnchor.getWorldPosition(mountPosition);
  if (interactionDistance > 2.35) return false;
  const ownedState=rideableHorses.get(horseRoot);
  if(!ownedState||!ownsHorse(inventoryState,ownedState))return false;
  if(horseRoot.parent!==scene){scene.attach(horseRoot);horseRoot.updateWorldMatrix(true,true);}
  // attach() can encode a 180° yaw as X/Z half-turns. Keep steering upright.
  horseRoot.getWorldQuaternion(frameQuaternionScratch);
  const heading=frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y;
  horseRoot.rotation.set(0,heading,0);
  mounted = true;
  character.setBroomRiding(false);
  activeAction = null;
  pressed.clear();
  setAnimation("mounted");
  setPlayStatus("Montado · E desmontar");
  return true;
}
function horseInteractionDistance() {
  if (mounted) return 0;
  const nearest=nearestRideableHorse(character.group.position,horse=>ownsHorse(inventoryState,horse));
  if(!nearest.state)return Infinity;
  if(horseRoot!==nearest.state.root){
    horseRoot=nearest.state.root;horseMountAnchor=nearest.state.anchor;horseActions.clear();
    nearest.state.actions.forEach((action,key)=>horseActions.set(key,action));
    horseCurrentAction=nearest.state.current;horseCurrentMotion=nearest.state.motion;
  }
  return nearest.distance;
}

const inventoryState = loadInventory();
// Remove the requested cape once, preserving subsequent equipment choices.
if(localStorage.getItem('rpg3d.remove-smooth-cape.v1')!=='1'){
  if(inventoryState.equipped.accessory==='cape')delete inventoryState.equipped.accessory;
  saveInventory(inventoryState);
  localStorage.setItem('rpg3d.remove-smooth-cape.v1','1');
}
const goldBalance=document.querySelector<HTMLElement>("#goldBalance")!;
const refreshGoldBalance=()=>{goldBalance.textContent=inventoryState.gold.toLocaleString("pt-BR");};
refreshGoldBalance();

type TreasureKind="gold"|"silver"|"wood";
type TreasureChest={id:string;kind:TreasureKind;root:THREE.Group;mixer:THREE.AnimationMixer;openClip:THREE.AnimationClip;closeClip:THREE.AnimationClip;isOpen:boolean;animating:boolean;coin?:THREE.Object3D};
const treasureChests:TreasureChest[]=[];
const CHEST_STORAGE_KEY="rpg3d.opened-chests.v1";
const openedChestIds=new Set<string>(JSON.parse(localStorage.getItem(CHEST_STORAGE_KEY)??"[]") as string[]);
const chestNode:Record<TreasureKind,string>={gold:"GoldenChest",silver:"SilverChest[",wood:"WoodenChest"};
const chestLabel:Record<TreasureKind,string>={gold:"dourado",silver:"de prata",wood:"de madeira"};
let goldCoinTemplate:THREE.Object3D|undefined;
const attachGoldCoin=(chest:TreasureChest)=>{
  if(chest.kind!=="gold"||!goldCoinTemplate||chest.coin)return;
  const coin=goldCoinTemplate.clone(true);coin.position.set(0,1.35,0);coin.scale.setScalar(.28);chest.root.add(coin);chest.coin=coin;
};
gltfLoader.load("/models/chests/gold-coin.glb",({scene:coin})=>{
  coin.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(coin),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  coin.position.sub(center);coin.scale.setScalar(1/Math.max(size.y,.001));coin.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  goldCoinTemplate=coin;treasureChests.forEach(attachGoldCoin);
});
const chestPosition=(index:number)=>{
  const wantsWater=index%4===0;
  for(let attempt=0;attempt<600;attempt++){
    const sample=index*17.31+attempt*29.73;
    const x=-970+((((sample*.61803398875)%1)+1)%1)*1940;
    const z=-970+((((sample*.41421356237)%1)+1)%1)*1940;
    if(openWorld.isWaterAt(x,z)!==wantsWater)continue;
    return new THREE.Vector3(x,openWorld.getHeightAt(x,z),z);
  }
  return new THREE.Vector3(index-48,openWorld.getHeightAt(index-48,90),90);
};
const playChestAnimation=(chest:TreasureChest,open:boolean,instant=false)=>{
  chest.mixer.stopAllAction();
  const action=chest.mixer.clipAction(open?chest.openClip:chest.closeClip);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  chest.isOpen=open;chest.animating=!instant;
  if(instant){chest.mixer.update(action.getClip().duration+1);chest.animating=false;}
};
gltfLoader.load("/models/chests/chest-kit.glb",gltf=>{
  const kinds:TreasureKind[]=["gold","silver","wood"];
  for(let index=0;index<96;index++){
    const kind=kinds[index%kinds.length],source=gltf.scene.getObjectByName(chestNode[kind]);if(!source)continue;
    const model=cloneSkeleton(source),root=new THREE.Group();root.add(model);root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    model.position.set(-center.x,-box.min.y,-center.z);model.scale.setScalar(1.35/Math.max(size.y,.001));
    root.position.copy(chestPosition(index));root.rotation.y=(index*.754877666%1)*Math.PI*2;root.name=`Baú ${chestLabel[kind]} ${index+1}`;
    root.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});scene.add(root);
    const openClip=gltf.animations.find(clip=>clip.name===`${chestNode[kind]}|OpenChest`),closeClip=gltf.animations.find(clip=>clip.name===`${chestNode[kind]}|CloseChest`);if(!openClip||!closeClip){root.removeFromParent();continue;}
    const chest:TreasureChest={id:`chest-${index}`,kind,root,mixer:new THREE.AnimationMixer(root),openClip,closeClip,isOpen:false,animating:false};
    treasureChests.push(chest);attachGoldCoin(chest);if(openedChestIds.has(chest.id))playChestAnimation(chest,true,true);
  }
},undefined,error=>console.error("Não foi possível carregar os baús",error));
const nearestTreasureChest=()=>{
  let nearest:TreasureChest|undefined,distance=Infinity;
  for(const chest of treasureChests){const next=Math.hypot(character.group.position.x-chest.root.position.x,character.group.position.z-chest.root.position.z,character.group.position.y-chest.root.position.y);if(next<distance){nearest=chest;distance=next;}}
  return distance<=3.2?nearest:undefined;
};
const grantChestItem=(id:string)=>{
  const item=ITEM_BY_ID.get(id);if(!item)return;
  inventoryState.quantities[id]=(inventoryState.quantities[id]??0)+1;
  itemButton(id)?.removeAttribute("hidden");itemButton(id)?.querySelector<HTMLElement>("em")?.replaceChildren(String(inventoryState.quantities[id]));
  setPlayStatus(`Encontrado: ${item.name}`);
};
const toggleNearestChest=()=>{
  const chest=nearestTreasureChest();if(!chest||chest.animating)return false;
  const opening=!chest.isOpen;playChestAnimation(chest,opening);
  if(opening&&!openedChestIds.has(chest.id)){
    openedChestIds.add(chest.id);localStorage.setItem(CHEST_STORAGE_KEY,JSON.stringify([...openedChestIds]));
    if(chest.kind==="gold"){inventoryState.gold+=100;refreshGoldBalance();setPlayStatus("Baú dourado: +100 moedas de ouro");}
    else if(chest.kind==="silver"){const pool=["silver-sword","silver-ore"];grantChestItem(pool[Math.floor(Math.random()*pool.length)]);}
    else {const pool=["wooden-sword","leather","leather-vest","leather-chest","leather-gloves","leather-armor-boots"];grantChestItem(pool[Math.floor(Math.random()*pool.length)]);}
    saveInventory(inventoryState);refreshQuickSlots();
  }
  return true;
};
const progressionMigrationKey = "rpg3d.progression.level-one.v1";
if (!localStorage.getItem(progressionMigrationKey)) {
  inventoryState.level = 1;
  inventoryState.xp = 0;
  inventoryState.worldDay = 1;
  inventoryState.worldTime = 8 / 24;
  localStorage.setItem(progressionMigrationKey, "done");
  saveInventory(inventoryState);
}
const hpProgressionMigrationKey="rpg3d.progression.hp-levels.v2";
if(!localStorage.getItem(hpProgressionMigrationKey)){
  // Start the requested progression cleanly even for an existing save that
  // had the previous 110 HP base or was left at zero HP.
  inventoryState.level=1;inventoryState.xp=0;inventoryState.hp=100;
  localStorage.setItem(hpProgressionMigrationKey,"done");saveInventory(inventoryState);
}
let timePaused = false,
  timeSpeed = 1;
const timeSlider = document.querySelector<HTMLInputElement>("#timeSlider")!,
  dayInput = document.querySelector<HTMLInputElement>("#dayInput")!,
  timeEditorValue =
    document.querySelector<HTMLOutputElement>("#timeEditorValue")!;
timeSlider.value = String(inventoryState.worldTime * 24);
dayInput.value = String(inventoryState.worldDay);
const saveEditedTime = () => {
  companionKiss.cancel();
  cityResidents.synchronizeTime(inventoryState.worldTime);
  saveInventory(inventoryState);
};
timeSlider.addEventListener("input", () => {
  inventoryState.worldTime = Number(timeSlider.value) / 24;
  saveEditedTime();
});
dayInput.addEventListener("change", () => {
  inventoryState.worldDay = Math.max(
    1,
    Math.round(Number(dayInput.value) || 1),
  );
  dayInput.value = String(inventoryState.worldDay);
  saveEditedTime();
});
document.querySelectorAll<HTMLButtonElement>("[data-hour]").forEach((button) =>
  button.addEventListener("click", () => {
    inventoryState.worldTime = Number(button.dataset.hour) / 24;
    timeSlider.value = String(Number(button.dataset.hour));
    saveEditedTime();
  }),
);
document
  .querySelector<HTMLButtonElement>("[data-time-pause]")!
  .addEventListener("click", (event) => {
    timePaused = !timePaused;
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.toggle("active", timePaused);
    button.textContent = timePaused ? "▶ Continuar" : "⏸ Pausar";
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-time-speed]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      timeSpeed = Number(button.dataset.timeSpeed);
      document
        .querySelectorAll("[data-time-speed]")
        .forEach((value) => value.classList.toggle("active", value === button));
    }),
  );
const weatherIntensity =
  document.querySelector<HTMLInputElement>("#weatherIntensity")!;
weatherIntensity.value = String(inventoryState.weatherIntensity);
weatherSystem.setWeather("clear");
weatherSystem.setIntensity(inventoryState.weatherIntensity);
type ActiveWeather="clear"|"rain"|"snow";
const biomeWeatherAt=(x:number,z:number):ActiveWeather=>{
  if(openWorld.isWaterAt(x,z))return "clear";
  const biome=openWorld.getBiomeAt(x,z);
  if(biome==="Neve")return "snow";
  if(biome!=="Floresta")return "clear";
  // Forest weather changes in deterministic three-hour windows. Roughly one
  // third of those windows receive rain; desert, water and other biomes never do.
  const window=Math.floor((inventoryState.worldDay-1)*8+inventoryState.worldTime*8);
  const chance=Math.abs(Math.sin(window*12.9898+78.233))*43758.5453%1;
  return chance<.34?"rain":"clear";
};
let activeWeather:ActiveWeather|null=null;
const syncBiomeWeather=():ActiveWeather=>{
  const next=biomeWeatherAt(character.group.position.x,character.group.position.z);
  if(next===activeWeather)return next;
  activeWeather=next;weatherSystem.setWeather(next);
  document.querySelectorAll<HTMLElement>("[data-weather]").forEach((button)=>button.classList.toggle("active",button.dataset.weather===next));
  return activeWeather;
};
document
  .querySelectorAll<HTMLButtonElement>("[data-weather]")
  .forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.weather === inventoryState.weather,
    );
    button.addEventListener("click", () => {
      inventoryState.weather = button.dataset.weather as
        "clear" | "rain" | "snow";
      activeWeather=null;
      syncBiomeWeather();
      document
        .querySelectorAll("[data-weather]")
        .forEach((value) => value.classList.toggle("active", value === button));
      saveInventory(inventoryState);
    });
  });
weatherIntensity.addEventListener("input", () => {
  inventoryState.weatherIntensity = Number(weatherIntensity.value);
  weatherSystem.setIntensity(inventoryState.weatherIntensity);
  saveInventory(inventoryState);
});
const hudLevel = document.querySelector<HTMLElement>("#hudLevel")!,
  hudPhase = document.querySelector<HTMLElement>("#hudPhase")!;
const mapPanel = document.querySelector<HTMLElement>("#worldMap")!,
  miniCanvas = document.querySelector<HTMLCanvasElement>("#minimap canvas")!,
  worldMapCanvas =
    document.querySelector<HTMLCanvasElement>("#worldMap canvas")!;
const inventoryMapCanvas=document.querySelector<HTMLCanvasElement>("#inventoryMapCanvas")!;
const bar = setBarPercent;
function updateStaminaHud(active = false) {
  const maximum = totalStats().stamina;
  bar("#hudStaminaBar", (inventoryState.stamina / maximum) * 100);
  document
    .querySelector(".action-stamina")!
    .classList.toggle("contextual-hidden", !active);
}
function refreshHud() {
  const stats = totalStats(),
    xpNeeded = inventoryState.level * 100;
  inventoryState.hp = Math.min(inventoryState.hp, stats.hp);
  inventoryState.stamina = Math.min(inventoryState.stamina, stats.stamina);
  hudLevel.textContent = String(inventoryState.level);
  document.querySelector("#hudXpText")!.textContent =
    `${inventoryState.xp} / ${xpNeeded}`;
  document.querySelector<HTMLElement>(".inventory-level>b")!.textContent =
    String(inventoryState.level);
  document.querySelector<HTMLElement>(".inventory-level em")!.style.width =
    `${(inventoryState.xp / xpNeeded) * 100}%`;
  document.querySelector("#hudHpText")!.textContent =
    `${Math.round(inventoryState.hp)} / ${stats.hp}`;
  document.querySelector("#hudHungerText")!.textContent = String(
    Math.round(inventoryState.hunger),
  );
  document.querySelector("#hudThirstText")!.textContent = String(
    Math.round(inventoryState.thirst),
  );
  bar("#hudXpBar", (inventoryState.xp / xpNeeded) * 100);
  bar("#hudHpBar", (inventoryState.hp / stats.hp) * 100);
  updateStaminaHud();
  bar("#hudHungerBar", inventoryState.hunger);
  bar("#hudThirstBar", inventoryState.thirst);
}
const setMapOpen = (open: boolean) => {
  mapPanel.classList.toggle("open", open);
  mapPanel.setAttribute("aria-hidden", String(!open));
  if (open) pressed?.clear();
};
document
  .querySelectorAll<HTMLElement>("[data-open-map]")
  .forEach((button) =>
    button.addEventListener("click", () => setMapOpen(true)),
  );
document
  .querySelector<HTMLButtonElement>("#worldMap button")!
  .addEventListener("click", () => setMapOpen(false));
function drawMap(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height,
    local = canvas === miniCanvas,
    frame=local?null:cityMapFrame(cityBuilder.objects.values(),cityFloor.root.userData.floorPolygon,w,h),
    visibleSize = local ? 256 : frame!.visibleSize,
    centerX = local ? character.group.position.x : frame!.centerX,
    centerZ = local ? character.group.position.z : frame!.centerZ,
    scale = Math.min(w, h) / visibleSize,
    point = (x: number, z: number) =>
      [w / 2 + (x - centerX) * scale, h / 2 + (z - centerZ) * scale] as const;
  context.clearRect(0, 0, w, h);
  context.fillStyle = "#172018";
  context.fillRect(0, 0, w, h);
  context.strokeStyle = "#78805b33";
  context.lineWidth = 1;
  const gridStartX = Math.floor((centerX - visibleSize / 2) / 128) * 128,
    gridEndX = centerX + visibleSize / 2,
    gridStartZ = Math.floor((centerZ - visibleSize / 2) / 128) * 128,
    gridEndZ = centerZ + visibleSize / 2;
  for (let n = gridStartX; n <= gridEndX; n += 128) {
    context.beginPath();
    context.moveTo(...point(n, centerZ - visibleSize / 2));
    context.lineTo(...point(n, centerZ + visibleSize / 2));
    context.stroke();
  }
  for (let n = gridStartZ; n <= gridEndZ; n += 128) {
    context.beginPath();
    context.moveTo(...point(centerX - visibleSize / 2, n));
    context.lineTo(...point(centerX + visibleSize / 2, n));
    context.stroke();
  }
  drawCityMinimap(context,cityBuilder.objects.values(),cityFloor.root.userData.floorPolygon,point,scale,local);
  for(const resident of cityResidents.residents){
    if(resident.citizen.role==='morador'||resident.routine==='sleep')continue;
    const [x,y]=point(resident.position.x,resident.position.z);
    if(x<4||x>w-4||y<4||y>h-4)continue;
    context.fillStyle=resident.citizen.role.startsWith('guarda-')?'#91c9f2':'#ffe29a';
    context.beginPath();context.moveTo(x,y-4);context.lineTo(x+4,y);context.lineTo(x,y+4);context.lineTo(x-4,y);context.closePath();context.fill();
  }
  for (const prey of preyAnimals) {
    if (!prey.root.visible) continue;
    const [x, y] = point(prey.position.x, prey.position.z);
    context.fillStyle = "#d16d50";
    context.beginPath();
    context.arc(x, y, Math.max(2, scale * 1.8), 0, Math.PI * 2);
    context.fill();
  }
  if (horseRoot) {
    const [x, y] = point(horseRoot.position.x, horseRoot.position.z);
    context.fillStyle = "#b98a55";
    context.fillRect(x - 4, y - 4, 8, 8);
  }
  const [px, py] = point(
    character.group.position.x,
    character.group.position.z,
  );
  context.save();
  context.translate(px, py);
  // The triangle is drawn pointing toward canvas -Y, while yaw 0 in the
  // world faces +Z (canvas +Y). Flip its base direction before applying yaw.
  context.rotate(Math.PI-character.group.rotation.y);
  context.fillStyle = "#f4e39b";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 7);
  context.lineTo(-6, 7);
  context.closePath();
  context.fill();
  context.restore();
}
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
  character.setHeldItemVisible("left", !(broomFlying && nimbusCharacterSide() === "left"));
  character.setHeldItemVisible("right", !(broomFlying && nimbusCharacterSide() === "right"));
  if (broomMountVisual) broomMountVisual.visible = broomFlying;
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
  if (broomFlying) {
    broomFlying = false;
    openWorld.setFlightOverview(false);
    openWorld.setEditorOverview(buildMode && buildState.worldPreset === "arena-island-v1");
    openWorld.update(character.group.position);
    gameAudio.setFlight(false,false);
    broomAimPitch = 0;
    character.setBroomAimPitch(0);
    setBroomCameraFreedom(false);
    const dismountGround=playerGroundHeightAt(character.group.position.x,character.group.position.z);
    if(character.group.position.y>dismountGround+.08)broomFallVelocity=-1;
    else {character.group.position.y=dismountGround+PLAYER_GROUND_OFFSET;broomFallVelocity=0;}
    character.setMountedLegSpread(mountDebug.legSpread);
    character.setBroomRiding(false);
    syncBroomVisibility();
    setAnimation("idle");
    setPlayStatus("Nimbus 2000 desmontada");
    return true;
  }
  if (!hasEquippedNimbus()) {
    setPlayStatus("Equipe a Nimbus 2000 em uma das mãos para voar");
    return false;
  }
  if (!broomMountVisual) {
    setPlayStatus("A Nimbus 2000 ainda está sendo carregada");
    return false;
  }
  if (mounted) toggleMount();
  broomFlying = true;
  openWorld.setFlightOverview(buildState.worldPreset === "arena-island-v1");
  openWorld.setEditorOverview(buildMode && buildState.worldPreset === "arena-island-v1");
  openWorld.update(character.group.position);
  broomFallVelocity=0;
  broomImpact.reset();
  gameAudio.setFlight(false,false);
  setBroomCameraFreedom(true);
  activeAction = null;
  pressed.clear();
  const ground = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
  character.group.position.y = Math.max(character.group.position.y, ground + 1.15);
  character.setMountedLegSpread(.24);
  character.setBroomRiding(true);
  syncBroomVisibility();
  setAnimation("mounted");
  setPlayStatus("Voando na Nimbus 2000 · WASD · Espaço/Ctrl · F desmontar");
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
type ScabbardTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: [number, number];
  swordPosition?: [number, number, number];
};
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
  if (mageHoodRoot) {
    // Reattach after a character rebuild, which replaces the head group.
    character.attachHeadAccessory(mageHoodRoot);
    const hoodEquipped = equippedItems.get("head") === "mage-hood";
    mageHoodRoot.visible = hoodEquipped;
    character.setHoodHairHidden(false);
  }
  if (!hasInventoryWeapon()) swordsSheathed = false;
  character.setSwordSheathed(swordsSheathed);
  applySavedScabbardTransform();
  if (broomFlying && !hasEquippedNimbus()) toggleBroomFlight();
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
const corpseLoot = document.querySelector<HTMLElement>("#corpseLoot")!,
  corpseLootTitle = document.querySelector<HTMLElement>("#corpseLootTitle")!,
  corpseLootItems = document.querySelector<HTMLElement>("#corpseLootItems")!;
let activeLootPrey: Prey | undefined;
function nearestLootablePrey() {
  let result: Prey | undefined,
    distance = Infinity;
  for (const prey of preyAnimals) {
    if (prey.hp > 0 || !prey.loot.length) continue;
    const current = character.group.position.distanceTo(prey.position);
    if (current < distance) {
      result = prey;
      distance = current;
    }
  }
  return distance <= 2.7 ? result : undefined;
}
function renderCorpseLoot() {
  if (!activeLootPrey) return;
  corpseLootTitle.textContent = activeLootPrey.label;
  corpseLootItems.innerHTML = activeLootPrey.loot
    .map((loot, index) => {
      const item = ITEM_BY_ID.get(loot.itemId);
      if (!item) return "";
      return `<button type="button" data-loot-index="${index}"><span></span><b>${item.name}</b><em>×${loot.quantity}</em></button>`;
    })
    .join("");
  corpseLootItems
    .querySelectorAll<HTMLButtonElement>("[data-loot-index]")
    .forEach((button) => {
      const loot = activeLootPrey?.loot[Number(button.dataset.lootIndex)],
        source = loot
          ? itemButton(loot.itemId)?.querySelector<HTMLElement>("span")
          : undefined;
      button.querySelector<HTMLElement>("span")!.style.backgroundImage =
        source?.style.backgroundImage ?? "";
    });
}
function setCorpseLootOpen(prey?: Prey) {
  activeLootPrey = prey;
  const open = Boolean(prey);
  corpseLoot.classList.toggle("open", open);
  corpseLoot.setAttribute("aria-hidden", String(!open));
  if (prey) {
    pressed.clear();
    renderCorpseLoot();
    setPlayStatus(`Saqueando ${prey.label} · E para fechar`);
  } else corpseLootItems.replaceChildren();
}
function toggleCorpseLoot() {
  if (corpseLoot.classList.contains("open")) {
    setCorpseLootOpen();
    setPlayStatus("Saque fechado");
    return true;
  }
  const prey = nearestLootablePrey();
  if (!prey) return false;
  setCorpseLootOpen(prey);
  return true;
}
corpseLootItems.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-loot-index]",
  );
  if (!button || !activeLootPrey) return;
  const loot = activeLootPrey.loot[Number(button.dataset.lootIndex)],
    item = loot && ITEM_BY_ID.get(loot.itemId);
  if (!loot || !item) return;
  inventoryState.quantities[item.id] =
    (inventoryState.quantities[item.id] ?? 0) + loot.quantity;
  activeLootPrey.loot.splice(Number(button.dataset.lootIndex), 1);
  saveInventory(inventoryState);
  const lootedButton = itemButton(item.id);
  lootedButton?.removeAttribute("hidden");
  lootedButton
    ?.querySelector<HTMLElement>("em")
    ?.replaceChildren(String(inventoryState.quantities[item.id]));
  refreshQuickSlots();
  setPlayStatus(`Guardado: ${loot.quantity}× ${item.name}`);
  if (activeLootPrey.loot.length) renderCorpseLoot();
  else {
    const label = activeLootPrey.label;
    activeLootPrey.root.visible = false;
    setCorpseLootOpen();
    setPlayStatus(`${label} saqueado`);
  }
});
const npcDialogue = document.querySelector<HTMLElement>("#npcDialogue")!,
  npcName = document.querySelector<HTMLElement>("#npcName")!,
  npcSubtitle = document.querySelector<HTMLElement>("#npcSubtitle")!,
  npcSubtitleText = npcSubtitle.querySelector<HTMLElement>("span")!;
const npcNameLabels = [
  npcName,
  document.querySelector<HTMLElement>("#npcNameAlice")!,
  document.querySelector<HTMLElement>("#npcNameEmma")!,
];
const warriorNames = ["Eleonor", "Alice", "Emma"] as const;
let npcSubtitleUntil = 0;
const dialogueLines: Record<
  (typeof warriorNames)[number],
  Record<string, string>
> = {
  Eleonor: {
    welcome:
      "Sou Eleonor, guerreira de Tolbana. Protejo os viajantes que cruzam este campo.",
    aincrad:
      "Este campo pertence a Aincrad. A cidade segura fica além das colinas.",
    hunt: "Controle seu vigor e nunca ataque sem observar uma rota de fuga.",
    goodbye: "Mantenha a lâmina pronta. Nos veremos novamente.",
  },
  Alice: {
    welcome:
      "Meu nome é Alice. Vim aperfeiçoar minha espada longe das muralhas.",
    aincrad:
      "Aincrad muda a cada andar. Aqui ainda há espaço para treinar e respirar.",
    hunt: "Não desperdice movimentos. Um golpe preciso vale mais que três apressados.",
    goodbye: "Boa sorte no caminho. Não baixe a guarda.",
  },
  Emma: {
    welcome:
      "Sou Emma, batedora deste grupo. Eu vigio as trilhas e os animais.",
    aincrad: "Há caminhos seguros, mas eles mudam quando o clima fecha.",
    hunt: "Observe o terreno antes da luta. Posicionamento também é uma arma.",
    goodbye: "Até logo. Avisarei se encontrar perigo.",
  },
};
let activeWarriorIndex = 0;
let followingWarriorIndex: number | null = null;
const nearestWarrior = () => {
  let index = -1,
    distance = Infinity;
  warriorNpcs.forEach((npc, candidate) => {
    if(npc.group.userData.mapHidden)return;
    const value = character.group.position.distanceTo(npc.group.position);
    if (value < distance) {
      distance = value;
      index = candidate;
    }
  });
  return { index, distance };
};
const isNpcNearby = () => !mounted && nearestWarrior().distance <= 2.7;
function setNpcDialogueOpen(open: boolean) {
  npcDialogue.classList.toggle("open", open);
  npcDialogue.setAttribute("aria-hidden", String(!open));
  if (open) {
    const nearest = nearestWarrior();
    activeWarriorIndex = nearest.index;
    const npc = warriorNpcs[activeWarriorIndex],
      name = warriorNames[activeWarriorIndex];
    pressed.clear();
    npc.setAnimation("idle");
    npc.group.lookAt(
      character.group.position.x,
      npc.group.position.y,
      character.group.position.z,
    );
    npcDialogue.querySelector("header strong")!.textContent = name;
    npcSubtitle.querySelector("b")!.textContent = name;
    setPlayStatus(`Conversando com ${name} · E para fechar`);
  }
}
function toggleNpcDialogue() {
  if (npcDialogue.classList.contains("open")) {
    setNpcDialogueOpen(false);
    setPlayStatus("Conversa encerrada");
    return true;
  }
  if (!isNpcNearby()) return false;
  setNpcDialogueOpen(true);
  return true;
}
npcDialogue.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-dialogue]",
  );
  if (!button) return;
  const command = button.dataset.dialogue;
  if (command === "follow") {
    if (
      followingWarriorIndex !== null &&
      followingWarriorIndex !== activeWarriorIndex
    )
      warriorNpcs[followingWarriorIndex].setAnimation("idle");
    followingWarriorIndex = activeWarriorIndex;
    const name = warriorNames[activeWarriorIndex];
    npcSubtitle.querySelector("b")!.textContent = name;
    npcSubtitleText.textContent = "Vou com você.";
    npcSubtitle.classList.add("visible");
    npcSubtitleUntil = performance.now() + 3200;
    setNpcDialogueOpen(false);
    setPlayStatus(`${name} está seguindo você`);
    return;
  }
  if (command === "wait") {
    const name = warriorNames[activeWarriorIndex];
    if (followingWarriorIndex === activeWarriorIndex)
      followingWarriorIndex = null;
    warriorNpcs[activeWarriorIndex].setAnimation("idle");
    npcSubtitle.querySelector("b")!.textContent = name;
    npcSubtitleText.textContent = "Vou esperar aqui.";
    npcSubtitle.classList.add("visible");
    npcSubtitleUntil = performance.now() + 3200;
    setNpcDialogueOpen(false);
    setPlayStatus(`${name} ficou esperando`);
    return;
  }
  const line =
    dialogueLines[warriorNames[activeWarriorIndex]][
      button.dataset.dialogue ?? ""
    ];
  if (!line) return;
  npcSubtitleText.textContent = line;
  npcSubtitle.classList.add("visible");
  npcSubtitleUntil = performance.now() + 5200;
  if (button.dataset.dialogue === "goodbye") setNpcDialogueOpen(false);
});
const assignQuickSlot = (item: InventoryItem) => {
  if (item.category !== "consumable") return;
  inventoryState.quickSlots[selectedQuickSlot] = item.id;
  saveInventory(inventoryState);
  refreshQuickSlots();
  setPlayStatus(`${item.name} adicionado ao atalho ${selectedQuickSlot + 1}`);
};
let inventorySelectionMode = false;
const selectedInventoryItems = new Set<string>();
const selectModeButton = document.querySelector<HTMLButtonElement>(
    "#inventorySelectMode",
  )!,
  deleteSelectedButton = document.querySelector<HTMLButtonElement>(
    "#inventoryDeleteSelected",
  )!;
const refreshInventorySelection = () => {
  document
    .querySelectorAll<HTMLElement>("[data-item-id]")
    .forEach((card) =>
      card.classList.toggle(
        "bulk-selected",
        selectedInventoryItems.has(card.dataset.itemId!),
      ),
    );
  selectModeButton.classList.toggle("active", inventorySelectionMode);
  selectModeButton.textContent = inventorySelectionMode
    ? "Cancelar seleção"
    : "Selecionar";
  deleteSelectedButton.disabled = selectedInventoryItems.size === 0;
  deleteSelectedButton.querySelector("b")!.textContent = String(
    selectedInventoryItems.size,
  );
};
const deleteInventoryItems = (ids: Iterable<string>) => {
  const removed = [...ids];
  for (const id of removed) {
    inventoryState.quantities[id] = 0;
    for (const [slot, equippedId] of [...equippedItems])
      if (equippedId === id) equippedItems.delete(slot);
    inventoryState.quickSlots = inventoryState.quickSlots.map((quickId) =>
      quickId === id ? null : quickId,
    );
    itemButton(id)?.setAttribute("hidden", "");
    selectedInventoryItems.delete(id);
  }
  syncCharacterEquipment();
  refreshEquipmentSlots();
  refreshQuickSlots();
  persist();
  refreshInventorySelection();
  setPlayStatus(
    `${removed.length} ${removed.length === 1 ? "item excluído" : "itens excluídos"}`,
  );
};
selectModeButton.addEventListener("click", () => {
  inventorySelectionMode = !inventorySelectionMode;
  if (!inventorySelectionMode) selectedInventoryItems.clear();
  refreshInventorySelection();
});
deleteSelectedButton.addEventListener("click", () => {
  deleteInventoryItems(selectedInventoryItems);
  inventorySelectionMode = false;
  refreshInventorySelection();
});
document
  .querySelectorAll<HTMLButtonElement>("[data-item-id]")
  .forEach((button) => {
    button.draggable = true;
    const item = ITEM_BY_ID.get(button.dataset.itemId!)!;
    button.addEventListener("click", () => {
      if (inventorySelectionMode) {
        if (selectedInventoryItems.has(item.id))
          selectedInventoryItems.delete(item.id);
        else selectedInventoryItems.add(item.id);
        refreshInventorySelection();
        return;
      }
      if (item.category === "consumable") assignQuickSlot(item);
    });
    button.addEventListener("contextmenu", (event) => {
      const equippedSlot = [...equippedItems].find(([, id]) => id === item.id)?.[0];
      if (!equippedSlot) return;
      event.preventDefault();
      unequipSlot(equippedSlot);
      setPlayStatus(`${item.name} desequipado`);
    });
    button.addEventListener("dragstart", (event) => {
      hideItemTooltip();
      draggedItem = { id: item.id, source: "inventory" };
      event.dataTransfer?.setData("text/plain", item.id);
      button.classList.add("dragging");
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("dragging");
      hideItemTooltip();
      draggedItem = null;
      document
        .querySelectorAll(".drop-target")
        .forEach((node) => node.classList.remove("drop-target"));
    });
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-equip-slot]")
  .forEach((slot) => {
    const slotName = (
      slot.dataset.equipSlot === "chest" ? "torso" : slot.dataset.equipSlot
    ) as EquipmentSlot;
    slot.addEventListener("dragover", (event) => {
      const item = draggedItem ? ITEM_BY_ID.get(draggedItem.id) : undefined;
      if (item && canEquip(item, slotName)) {
        event.preventDefault();
        slot.classList.add("drop-target");
      }
    });
    slot.addEventListener("dragleave", () =>
      slot.classList.remove("drop-target"),
    );
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drop-target");
      const item = draggedItem ? ITEM_BY_ID.get(draggedItem.id) : undefined;
      if (item) equipItem(item, slotName);
    });
    slot.addEventListener("contextmenu", (event) => {
      const id = equippedItems.get(slotName);
      if (!id) return;
      event.preventDefault();
      const name = ITEM_BY_ID.get(id)?.name ?? "Item";
      unequipSlot(slotName);
      setPlayStatus(`${name} desequipado`);
    });
    slot.addEventListener("dragstart", (event) => {
      const id = slot.dataset.item;
      if (!id) {
        event.preventDefault();
        return;
      }
      hideItemTooltip();
      draggedItem = { id, source: "slot", slot: slotName };
      event.dataTransfer?.setData("text/plain", id);
    });
    slot.addEventListener("dragend", () => {
      hideItemTooltip();
      draggedItem = null;
    });
  });
const inventoryDrop = document.querySelector<HTMLElement>(".inventory-items")!;
inventoryDrop.addEventListener("dragover", (event) => {
  if (draggedItem?.source === "slot") {
    event.preventDefault();
    inventoryDrop.classList.add("drop-target");
  }
});
inventoryDrop.addEventListener("dragleave", (event) => {
  if (!inventoryDrop.contains(event.relatedTarget as Node))
    inventoryDrop.classList.remove("drop-target");
});
inventoryDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  inventoryDrop.classList.remove("drop-target");
  if (draggedItem?.slot) unequipSlot(draggedItem.slot);
});
const inventoryTrash = document.querySelector<HTMLElement>("#inventoryTrash")!;
inventoryTrash.addEventListener("dragover", (event) => {
  if (!draggedItem) return;
  event.preventDefault();
  event.stopPropagation();
  inventoryTrash.classList.add("drop-target");
});
inventoryTrash.addEventListener("dragleave", () =>
  inventoryTrash.classList.remove("drop-target"),
);
inventoryTrash.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  inventoryTrash.classList.remove("drop-target");
  if (!draggedItem) return;
  deleteInventoryItems([draggedItem.id]);
});
function useConsumable(item: InventoryItem) {
  const quantity = inventoryState.quantities[item.id] ?? 0;
  if (quantity <= 0) return;
  inventoryState.quantities[item.id] = quantity - 1;
  inventoryState.hp = Math.min(
    totalStats().hp,
    inventoryState.hp + (item.stats.hp ?? 0),
  );
  inventoryState.stamina = Math.min(
    totalStats().stamina,
    inventoryState.stamina + (item.stats.stamina ?? 0),
  );
  inventoryState.hunger = Math.min(
    100,
    inventoryState.hunger + (item.stats.hunger ?? 0),
  );
  inventoryState.thirst = Math.min(
    100,
    inventoryState.thirst + (item.stats.thirst ?? 0),
  );
  saveInventory(inventoryState);
  itemButton(item.id)
    ?.querySelector<HTMLElement>("em")
    ?.replaceChildren(String(quantity - 1));
  refreshQuickSlots();
  refreshHud();
  setPlayStatus(`${item.name} utilizado`);
}
type SpellName = "heal" | "firebolt" | "lightning";
const spellCost: Record<SpellName, number> = {
  heal: 12,
  firebolt: 10,
  lightning: 18,
};
function castSpell(name: SpellName) {
  if (buildMode) return;
  if (mounted || activeAction) {
    setPlayStatus(mounted ? "Desmonte para conjurar" : "Aguarde a ação terminar");
    return;
  }
  const cost = spellCost[name];
  if (inventoryState.stamina < cost) {
    setPlayStatus("Vigor insuficiente para conjurar");
    return;
  }
  inventoryState.stamina -= cost;
  activeAction = { state: "cast", elapsed: 0, duration: .9 };
  setAnimation("cast");
  setPlayStatus("Conjurando...");
  saveInventory(inventoryState);
  refreshHud();
  const button = document.querySelector<HTMLElement>(`[data-spell="${name}"]`);
  setTimeout(() => {
    const origin = character.getCastingHandWorldPosition();
    if (name === "heal") {
      inventoryState.hp = Math.min(totalStats().hp, inventoryState.hp + 30);
      spellEffects.heal(origin.clone().add(new THREE.Vector3(0, -.25, 0)));
      setPlayStatus("Cura restaurou 30 HP");
      saveInventory(inventoryState);
      refreshHud();
    } else if (name === "firebolt") {
      const aim = forwardSpellTarget(origin, 14, .22);
      spellEffects.firebolt(origin, aim.point, () => {
        if (aim.target) damagePrey(aim.target, 26);
        else setPlayStatus("Bola de Fogo errou o alvo");
      });
      setPlayStatus(aim.target ? `Bola de Fogo em ${aim.target.label}` : "Bola de Fogo disparada");
    } else {
      const aim = forwardSpellTarget(origin, 12, .42);
      spellEffects.lightning(origin, aim.point, () => {
        if (aim.target) damagePrey(aim.target, 38);
        else setPlayStatus("Relâmpago errou o alvo");
      });
    }
    gameAudio.spell(name);
    button?.classList.remove("casting");
    requestAnimationFrame(() => button?.classList.add("casting"));
    setTimeout(() => button?.classList.remove("casting"), 300);
  }, 340);
}
let iceCasting = false;
let iceDamageCooldown = 0;
function startIceSpell() {
  if (buildMode) return;
  if (iceCasting || mounted || activeAction || inventoryState.stamina < 2) return;
  iceCasting = true;
  iceDamageCooldown = 0;
  activeAction = { state: "cast", elapsed: 0, duration: Infinity };
  setAnimation("cast");
  gameAudio.spell("ice");
  document.querySelector<HTMLElement>("[data-ice-spell]")?.classList.add("casting");
  setPlayStatus("Canalizando gelo...");
}
function stopIceSpell() {
  if (!iceCasting) return;
  iceCasting = false;
  spellEffects.stopIceStream();
  if (activeAction?.state === "cast" && activeAction.duration === Infinity) activeAction = null;
  document.querySelector<HTMLElement>("[data-ice-spell]")?.classList.remove("casting");
  saveInventory(inventoryState);
}
function updateIceSpell(delta: number) {
  if (!iceCasting) return;
  inventoryState.stamina = Math.max(0, inventoryState.stamina - 9 * delta);
  if (inventoryState.stamina <= 0) { stopIceSpell(); setPlayStatus("Vigor esgotado"); return; }
  const origin = character.getCastingHandWorldPosition();
  const aim = forwardSpellTarget(origin, 10, .32);
  spellEffects.iceStream(origin, aim.point);
  updateStaminaHud(true);
  iceDamageCooldown -= delta;
  if (aim.target) {
    aim.target.frozenUntil = performance.now() + 180;
    aim.target.hudUntil = performance.now() + 500;
    if (iceDamageCooldown <= 0) {
      damagePrey(aim.target, 3);
      aim.target.frozenUntil = performance.now() + 180;
      iceDamageCooldown = .35;
      setPlayStatus(`${aim.target.label} congelado`);
    }
  }
}
const iceButton = document.querySelector<HTMLButtonElement>("[data-ice-spell]")!;
iceButton.addEventListener("pointerdown", (event) => { event.preventDefault(); startIceSpell(); });
iceButton.addEventListener("pointerup", stopIceSpell);
iceButton.addEventListener("pointerleave", stopIceSpell);
iceButton.addEventListener("pointercancel", stopIceSpell);
document
  .querySelectorAll<HTMLButtonElement>("[data-quick-slot]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      selectedQuickSlot = Number(button.dataset.quickSlot);
      refreshQuickSlots();
    });
    button.addEventListener("dblclick", () => {
      const id = inventoryState.quickSlots[Number(button.dataset.quickSlot)],
        item = id ? ITEM_BY_ID.get(id) : undefined;
      if (item) useConsumable(item);
    });
    button.addEventListener("dragover", (event) => {
      const item = draggedItem ? ITEM_BY_ID.get(draggedItem.id) : undefined;
      if (item?.category === "consumable") {
        event.preventDefault();
        button.classList.add("drop-target");
      }
    });
    button.addEventListener("dragleave", () =>
      button.classList.remove("drop-target"),
    );
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drop-target");
      const item = draggedItem ? ITEM_BY_ID.get(draggedItem.id) : undefined;
      if (item) {
        selectedQuickSlot = Number(button.dataset.quickSlot);
        assignQuickSlot(item);
      }
    });
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-spell]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      castSpell(button.dataset.spell as SpellName),
    ),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-filter]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      const filter = button.dataset.filter as ItemCategory | "clothing" | "all";
      document
        .querySelectorAll("[data-filter]")
        .forEach((value) => value.classList.toggle("active", value === button));
      let visible = 0;
      document
        .querySelectorAll<HTMLElement>("[data-item-id]")
        .forEach((card) => {
          const available =
              (inventoryState.quantities[card.dataset.itemId!] ?? 0) > 0,
            categoryMatch =
              filter === "all" ||
              (filter === "clothing"
                ? card.dataset.clothing === "true"
                : filter === "armor"
                  ? card.dataset.category === "armor" &&
                    card.dataset.clothing !== "true"
                  : card.dataset.category === filter),
            show = available && categoryMatch;
          card.hidden = !show;
          if (show) visible++;
        });
      document.querySelector("#inventoryCount")!.textContent =
        `${visible} itens`;
    }),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      const tab = button.dataset.inventoryTab;
      avatarTarget = tab === "female" ? "female" : "player";
      avatarCamera.layers.set(avatarTarget === "female" ? 3 : 2);
      document.querySelector(".inventory-content")?.classList.toggle("page-open",tab==="settings"||tab==="map");
      document.querySelector(".inventory-window")?.classList.toggle("page-open",tab==="settings"||tab==="map");
      document
        .querySelectorAll("[data-inventory-tab]")
        .forEach((value) => value.classList.toggle("active", value === button));
      document.querySelectorAll<HTMLElement>("[data-main-tab]").forEach((value)=>{
        const page=tab==="map"?"map":tab==="settings"?"settings":"inventory";
        value.classList.toggle("active",value.dataset.mainTab===page);
      });
      document
        .querySelectorAll<HTMLElement>("[data-inventory-panel]")
        .forEach((panel) =>
          panel.classList.toggle(
            "active",
            panel.dataset.inventoryPanel === tab,
          ),
        );
    }),
  );

const itemTooltip = document.querySelector<HTMLElement>("#itemTooltip")!;
const statLabels = {
  attack: "Ataque",
  defense: "Defesa",
  hp: "HP",
  stamina: "Vigor",
  hunger: "Fome",
  thirst: "Sede",
};
const showItemTooltip = (target: HTMLElement, item: InventoryItem) => {
  const equippedId = item.slot ? equippedItems.get(item.slot) : undefined,
    equipped = equippedId ? ITEM_BY_ID.get(equippedId) : undefined;
  const attributes = Object.entries(item.stats).map(([key, value]) => {
    const old = equipped?.stats[key as keyof typeof item.stats] ?? 0,
      delta = Number(value) - old,
      comparison =
        equipped && equipped.id !== item.id
          ? ` <small class="${delta >= 0 ? "better" : "worse"}">${delta >= 0 ? "+" : ""}${delta}</small>`
          : "";
    return `<li><span>${statLabels[key as keyof typeof statLabels]}</span><b>${Number(value) > 0 ? "+" : ""}${value}${comparison}</b></li>`;
  });
  itemTooltip.innerHTML = `<strong>${item.name}</strong><p>${item.description}</p><ul>${attributes.join("") || "<li><span>Item de fabricação</span></li>"}</ul>${equipped && equipped.id !== item.id ? `<footer>Comparado com ${equipped.name}</footer>` : ""}`;
  itemTooltip.classList.add("visible");
  itemTooltip.setAttribute("aria-hidden", "false");
  const targetRect = target.getBoundingClientRect(),
    windowRect = document
      .querySelector<HTMLElement>(".inventory-window")!
      .getBoundingClientRect(),
    tooltipRect = itemTooltip.getBoundingClientRect();
  let left = targetRect.right - windowRect.left + 10,
    top =
      targetRect.top -
      windowRect.top +
      (targetRect.height - tooltipRect.height) / 2;
  if (left + tooltipRect.width > windowRect.width - 8)
    left = targetRect.left - windowRect.left - tooltipRect.width - 10;
  top = Math.max(8, Math.min(top, windowRect.height - tooltipRect.height - 8));
  itemTooltip.style.left = `${left}px`;
  itemTooltip.style.top = `${top}px`;
};
const hideItemTooltip = () => {
  itemTooltip.classList.remove("visible");
  itemTooltip.setAttribute("aria-hidden", "true");
};
document
  .querySelectorAll<HTMLElement>(
    "[data-item-id],[data-equip-slot],[data-quick-slot]",
  )
  .forEach((target) => {
    const getItem = () =>
      ITEM_BY_ID.get(target.dataset.itemId ?? target.dataset.item ?? "");
    const show = () => {
      const item = getItem();
      if (item) showItemTooltip(target, item);
    };
    target.addEventListener("mouseenter", show);
    target.addEventListener("mouseleave", hideItemTooltip);
    target.addEventListener("focus", show);
    target.addEventListener("blur", hideItemTooltip);
  });
for (const item of INVENTORY_CATALOG) {
  const quantity = inventoryState.quantities[item.id] ?? 0,
    button = itemButton(item.id);
  button?.querySelector<HTMLElement>("em")?.replaceChildren(String(quantity));
  if (quantity <= 0) button?.setAttribute("hidden", "");
}
syncCharacterEquipment();
refreshEquipmentSlots();
refreshQuickSlots();
refreshHud();

const refreshCityInventory=()=>{
  // Transactions update the persisted inventory first, then refresh all derived views.
  for(const [slot,id] of [...equippedItems])if((inventoryState.quantities[id]??0)===0)equippedItems.delete(slot);
  for(const item of INVENTORY_CATALOG){
    const button=itemButton(item.id),quantity=inventoryState.quantities[item.id]??0;
    button?.toggleAttribute('hidden',quantity<=0);button?.querySelector('em')?.replaceChildren(String(quantity));
  }
  refreshGoldBalance();syncCharacterEquipment();refreshEquipmentSlots();refreshQuickSlots();refreshCharacterStats();refreshHud();persist();
};
const cityShop=new ShopPanel(viewport,inventoryState,id=>cityResidents.canTrade(id,character.group.position),refreshCityInventory);
const guildPanel=new GuildPanel(viewport,inventoryState,id=>cityResidents.guildContact(character.group.position)?.id===id,refreshCityInventory);
const openGuild=()=>{
  if(mounted||broomFlying)return false;
  const contact=cityResidents.guildContact(character.group.position);if(!contact)return false;
  cityShop.close();setNpcDialogueOpen(false);setInventoryOpen(false);pressed.clear();activeAction=null;
  character.setAnimation("idle");guildPanel.show(contact);return true;
};
const openCityShop=()=>{
  if(mounted||broomFlying)return false;
  const merchant=cityResidents.nearestMerchant(character.group.position);if(!merchant)return false;
  setNpcDialogueOpen(false);setInventoryOpen(false);pressed.clear();activeAction=null;
  guildPanel.close();character.setAnimation('idle');cityShop.show(merchant);return true;
};

const companionKiss=new CompanionKiss();
const requestCompanionKiss=(id:string)=>{
  const companion=cityResidents.residents.find(r=>r.citizen.id===id);
  if(!companion?.actor||inventoryState.companion?.id!==id||mounted||broomFlying||princessBedRest.active||companion.routine==='sleep'||inventoryState.hp<=0)return false;
  restoreBedOutfits();pressed.clear();activeAction=null;
  return companionKiss.start(character,companion.actor,companion.position);
};
const citizenConversations=new CitizenConversations(
  viewport,scene,cityBuilder.objects,inventoryState,character.group.position,
  ()=>cityResidents.residents,playerGroundHeightAt,refreshCityInventory,openCityShop,openGuild,()=>cityResidents.setCompanion(inventoryState.companion),requestCompanionKiss,
);
cityResidents.setCompanion(inventoryState.companion);
const openCitizenConversation=()=>{
  if(mounted||broomFlying||!citizenConversations.nearest())return false;
  cityShop.close();guildPanel.close();setNpcDialogueOpen(false);setInventoryOpen(false);
  pressed.clear();activeAction=null;character.setAnimation('idle');
  return citizenConversations.show();
};

const scabbardEditor = document.querySelector<HTMLElement>("#scabbardEditor")!;
const scabbardPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-position]"),
];
const scabbardRotationInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-rotation]"),
];
const scabbardWidthInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-width]"),
];
const swordPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-sword-position]"),
];
const syncScabbardEditor = () => {
  const transform = character.getScabbardTransform();
  if (!transform) return;
  document.querySelector("#scabbardSide")!.textContent =
    `Bainha · lado ${transform.side === "right" ? "direito" : "esquerdo"}`;
  transform.position.forEach(
    (value, index) => (scabbardPositionInputs[index].value = value.toFixed(2)),
  );
  transform.rotation.forEach(
    (value, index) => (scabbardRotationInputs[index].value = value.toFixed(1)),
  );
  transform.width.forEach(
    (value, index) => (scabbardWidthInputs[index].value = value.toFixed(2)),
  );
  transform.swordPosition.forEach(
    (value, index) => (swordPositionInputs[index].value = value.toFixed(2)),
  );
};
const updateScabbardFromEditor = () => {
  const position = scabbardPositionInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number],
    rotation = scabbardRotationInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number],
    width = scabbardWidthInputs.map((input) =>
      Math.max(0.1, Number(input.value) || 1),
    ) as [number, number],
    swordPosition = swordPositionInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number];
  character.setScabbardTransform(position, rotation);
  character.setScabbardWidth(width);
  character.setSheathedSwordPosition(swordPosition);
  localStorage.setItem(
    SCABBARD_TRANSFORM_KEY,
    JSON.stringify({
      position,
      rotation,
      width,
      swordPosition,
    } satisfies ScabbardTransform),
  );
};
[
  ...scabbardPositionInputs,
  ...scabbardRotationInputs,
  ...scabbardWidthInputs,
  ...swordPositionInputs,
].forEach((input) => {
  input.addEventListener("input", updateScabbardFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document
  .querySelector<HTMLButtonElement>("[data-scabbard-reset]")!
  .addEventListener("click", () => {
    localStorage.removeItem(SCABBARD_TRANSFORM_KEY);
    syncCharacterEquipment();
    syncScabbardEditor();
  });
const setScabbardEditorOpen = (open: boolean) => {
  scabbardEditor.classList.toggle("hidden", !open);
  scabbardEditor.setAttribute("aria-hidden", String(!open));
  if (open) {
    pressed?.clear();
    syncScabbardEditor();
  }
};

const hoodEditor = document.querySelector<HTMLElement>("#hoodEditor")!;
const hoodPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-hood-position]"),
];
const hoodRotationInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-hood-rotation]"),
];
const hoodScaleInput = document.querySelector<HTMLInputElement>("[data-hood-scale]")!;
const syncHoodEditor = () => {
  mageHoodTransform.position.forEach(
    (value, index) => (hoodPositionInputs[index].value = value.toFixed(3)),
  );
  mageHoodTransform.rotation.forEach(
    (value, index) => (hoodRotationInputs[index].value = value.toFixed(1)),
  );
  hoodScaleInput.value = mageHoodTransform.scale.toFixed(4);
};
const updateHoodFromEditor = () => {
  mageHoodTransform = {
    position: hoodPositionInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    rotation: hoodRotationInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    scale: Math.max(.1, Number(hoodScaleInput.value) || .1),
  };
  applyMageHoodTransform();
  localStorage.setItem(HOOD_TRANSFORM_KEY, JSON.stringify(mageHoodTransform));
};
[...hoodPositionInputs, ...hoodRotationInputs, hoodScaleInput].forEach((input) => {
  input.addEventListener("input", updateHoodFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-hood-reset]")!.addEventListener("click", () => {
  localStorage.removeItem(HOOD_TRANSFORM_KEY);
  mageHoodTransform = {
    ...DEFAULT_HOOD_TRANSFORM,
    position: [...DEFAULT_HOOD_TRANSFORM.position],
    rotation: [...DEFAULT_HOOD_TRANSFORM.rotation],
  };
  applyMageHoodTransform();
  syncHoodEditor();
});
const setHoodEditorOpen = (open: boolean) => {
  hoodEditor.classList.toggle("hidden", !open);
  hoodEditor.setAttribute("aria-hidden", String(!open));
  if (open) {
    pressed?.clear();
    syncHoodEditor();
  }
};

const nimbusHandEditor = document.querySelector<HTMLElement>("#nimbusHandEditor")!;
const nimbusPositionInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-position]")];
const nimbusRotationInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-rotation]")];
const nimbusScaleInput = document.querySelector<HTMLInputElement>("[data-nimbus-scale]")!;
const nimbusArmInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-arm]")];
const syncNimbusHandEditor = () => {
  nimbusHandTransform.position.forEach((value, index) => nimbusPositionInputs[index].value = value.toFixed(3));
  nimbusHandTransform.rotation.forEach((value, index) => nimbusRotationInputs[index].value = value.toFixed(1));
  nimbusScaleInput.value = nimbusHandTransform.scale.toFixed(4);
  nimbusArmInputs.forEach((input) => {
    const [bone, group, index] = input.dataset.nimbusArm!.split(".") as ["shoulder"|"elbow"|"wrist","position"|"rotation",string];
    input.value = nimbusArmDebug[bone][group][Number(index)].toFixed(group === "rotation" ? 1 : 3);
  });
};
const updateNimbusHandFromEditor = () => {
  nimbusHandTransform = {
    position: nimbusPositionInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    rotation: nimbusRotationInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    scale: Math.max(.1, Number(nimbusScaleInput.value) || .1),
  };
  localStorage.setItem(NIMBUS_HAND_TRANSFORM_KEY, JSON.stringify(nimbusHandTransform));
  syncCharacterEquipment();
};
[...nimbusPositionInputs, ...nimbusRotationInputs, nimbusScaleInput].forEach((input) => {
  input.addEventListener("input", updateNimbusHandFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
nimbusArmInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const [bone, group, index] = input.dataset.nimbusArm!.split(".") as ["shoulder"|"elbow"|"wrist","position"|"rotation",string];
    const value=Number(input.value);if(!Number.isFinite(value))return;
    nimbusArmDebug[bone][group][Number(index)]=value;
    localStorage.setItem(NIMBUS_ARM_DEBUG_KEY,JSON.stringify(nimbusArmDebug));
    applyNimbusArmDebug();
  });
  input.addEventListener("keydown",(event)=>event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-nimbus-reset]")!.addEventListener("click", () => {
  localStorage.removeItem(NIMBUS_HAND_TRANSFORM_KEY);
  localStorage.removeItem(NIMBUS_ARM_DEBUG_KEY);
  nimbusHandTransform = structuredClone(DEFAULT_NIMBUS_HAND_TRANSFORM);
  nimbusArmDebug = structuredClone(DEFAULT_NIMBUS_ARM_DEBUG);
  syncCharacterEquipment();
  syncNimbusHandEditor();
});
const setNimbusHandEditorOpen = (open: boolean) => {
  nimbusHandEditor.classList.toggle("hidden", !open);
  nimbusHandEditor.setAttribute("aria-hidden", String(!open));
  if (open) { pressed?.clear(); syncNimbusHandEditor(); }
};

const pressed = new Set<string>();
const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyP",
  "KeyO",
  "KeyE",
  "KeyQ",
  "KeyI",
  "KeyM",
  "KeyT",
  "KeyB",
  "KeyC",
  "KeyV",
  "KeyF",
  "ControlLeft",
  "ControlRight",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
]);
const inventoryModal =
  document.querySelector<HTMLDivElement>("#inventoryModal")!;
const setInventoryOpen = (open: boolean) => {
  inventoryModal.classList.toggle("open", open);
  inventoryModal.setAttribute("aria-hidden", String(!open));
  if (open) pressed.clear();
};
document
  .querySelector<HTMLButtonElement>(".inventory-close")!
  .addEventListener("click", () => setInventoryOpen(false));
document
  .querySelectorAll<HTMLButtonElement>("[data-open-build]")
  .forEach((button) => button.addEventListener("click", () => setBuildMode(true)));
inventoryModal.addEventListener("click", (event) => {
  if (event.target === inventoryModal) setInventoryOpen(false);
});
const dodgeDirection = new THREE.Vector3();
const playerDodgingHit = () => activeAction?.state === "dodge" && dodgeInvulnerable(activeAction.elapsed);
const princessBedRest = new PrincessBedRest();
let restOutfitsRemoved=false;
const restoreBedOutfits=()=>{
  if(!restOutfitsRemoved)return;
  character.setRestUndressed(false);cityResidents.setPrincessRestUndressed(false);
  restOutfitsRemoved=false;
  if(princessBedRest.active)princessBedRest.refreshFit(character.group);
};
const toggleBedOutfits=()=>{
  if(!princessBedRest.active)return;
  if(restOutfitsRemoved)restoreBedOutfits();
  else {
    if(!cityResidents.setPrincessRestUndressed(true)){setPlayStatus('Alice precisa estar deitada ao seu lado');return;}
    character.setRestUndressed(true);restOutfitsRemoved=true;
    princessBedRest.refreshFit(character.group);
  }
  setPlayStatus('F para trocar as roupas dos dois · E para levantar');
};
const togglePrincessBedRest = () => {
  if(mounted||broomFlying||inventoryState.hp<=0)return false;
  const wasResting=princessBedRest.active;
  if(wasResting){restoreBedOutfits();cityResidents.setCompanionBed(null);}
  if(!wasResting&&!princessBedRest.nearest(character.group.position,cityBuilder.objects.values()))return false;
  activeAction=null;pressed.clear();setAnimation('idle');character.update(0);
  if(!princessBedRest.toggle(character.group,cityBuilder.objects.values()))return false;
  if(princessBedRest.active&&inventoryState.companion){restoreBedOutfits();character.setRestUndressed(false);cityResidents.setCompanionBed(princessBedRest.home);}
  setPlayStatus(princessBedRest.active?(cityResidents.companionSharingBed?'Alice vem descansar ao seu lado · F para tirar/vestir roupas · E para levantar':'Deitado ao lado de Alice · F para tirar/vestir roupas · E para levantar'):'Você se levantou da cama');
  return true;
};
let activeAction: {
  state: AnimationState;
  elapsed: number;
  duration: number;
} | null = null;
function startAction(state: AnimationState, duration: number) {
  if (princessBedRest.active||companionKiss.active) return;
  if (buildMode) return;
  if (activeAction) return;
  if(state==='jump'){
    if(mounted||broomFlying||broomFallVelocity!==0)return;
    broomFallVelocity=Math.sqrt(2*PLAYER_GRAVITY*PLAYER_JUMP_HEIGHT);
    setAnimation('jump');return;
  }
  if (state === "dodge") {
    if(mounted||broomFlying||broomFallVelocity!==0||inventoryState.stamina<DODGE_STAMINA)return;
    if(playerWaterDepth()>.08&&character.group.position.y<=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z)-.12)return;
    const v=Number(pressed.has("KeyW")||pressed.has("ArrowUp"))-Number(pressed.has("KeyS")||pressed.has("ArrowDown"));
    const h=Number(pressed.has("KeyD")||pressed.has("ArrowRight"))-Number(pressed.has("KeyA")||pressed.has("ArrowLeft"));
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    right.crossVectors(forward,camera.up).normalize();
    if(v||h)dodgeDirection.copy(forward).multiplyScalar(v).addScaledVector(right,h).normalize();
    else dodgeDirection.set(Math.sin(character.group.rotation.y),0,Math.cos(character.group.rotation.y));
    character.group.rotation.set(0,Math.atan2(dodgeDirection.x,dodgeDirection.z),0);
    inventoryState.stamina-=DODGE_STAMINA;updateStaminaHud(true);duration=DODGE_DURATION;
  }
  if (state === "attack") {
    if (inventoryState.stamina < 8) return;
    inventoryState.stamina -= 8;
    updateStaminaHud(true);
  }
  activeAction = { state, elapsed: 0, duration };
  setAnimation(state);
  if (state === "attack") {
    gameAudio.attack(hasEquippedWeapon());
    hitNearestPrey();
  }
}
window.addEventListener("keydown", (event) => {
  gameAudio.ensureStarted();
  const editingText = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
  if(citizenConversations.open){
    if(!event.repeat&&(event.code==='Escape'||event.code==='KeyE')){citizenConversations.close();event.preventDefault();}
    else if(event.code==='Tab'){
      const buttons=[...citizenConversations.element.querySelectorAll<HTMLButtonElement>('button')];
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(buttons.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===buttons.length-1)){buttons[event.shiftKey?buttons.length-1:0].focus();event.preventDefault();}
    }
    return;
  }
  if(cityShop.open||guildPanel.open){
    if(!event.repeat&&(event.code==='Escape'||event.code==='KeyE')){cityShop.close();guildPanel.close();event.preventDefault();}
    else if(event.code==='Tab'){
      const panel=guildPanel.open?guildPanel.element:cityShop.element;
      const buttons=[...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(buttons.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===buttons.length-1)){
        buttons[event.shiftKey?buttons.length-1:0].focus();event.preventDefault();
      }
    }
    return;
  }
  if(companionKiss.active&&!editingText){if(event.code==='Escape')companionKiss.cancel();event.preventDefault();return;}
  if(princessBedRest.active&&!editingText){
    if(!event.repeat&&(event.code==='KeyE'||event.code==='Escape'))togglePrincessBedRest();
    else if(!event.repeat&&event.code==='KeyF')toggleBedOutfits();
    event.preventDefault();return;
  }
  if (!editingText && !event.repeat && event.code === "KeyT") {
    event.preventDefault();
    toggleTimeEditor();
    return;
  }
  if (buildMode && !editingText) {
    if (event.code === "Escape") { if (cityPlacementKind) clearCityPlacement(); else if (terrainBrushEnabled) { terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainPreview.visible = false; } else setBuildMode(false); }
    else if (["KeyW","KeyA","KeyS","KeyD"].includes(event.code)) {
      // WASD is reserved for editor-camera travel. Automatically returning to
      // free camera makes movement work even after viewing from the player.
      if(!editorFreeCamera)document.querySelector<HTMLButtonElement>("[data-editor-camera]")?.click();
      pressed.add(event.code);
    }
    else if (event.code === "KeyE") document.querySelector<HTMLButtonElement>('[data-build-tool="rotate"]')?.click();
    else if (event.code === "KeyR") document.querySelector<HTMLButtonElement>('[data-build-tool="scale"]')?.click();
    else if (["ShiftLeft", "ShiftRight", "Space", "ControlLeft", "ControlRight"].includes(event.code)) pressed.add(event.code);
    event.preventDefault();
    return;
  }
  if (movementKeys.has(event.code)) event.preventDefault();
  pressed.add(event.code);
  if (!event.repeat && event.code === "KeyI") {
    setInventoryOpen(!inventoryModal.classList.contains("open"));
    return;
  }
  if (!event.repeat && event.code === "KeyM") {
    setMapOpen(!mapPanel.classList.contains("open"));
    return;
  }
  if (!event.repeat && event.code === "KeyB") {
    setScabbardEditorOpen(scabbardEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyC") {
    setMountEditorOpen(mountEditor.classList.contains("hidden"));
    pressed.clear();
    return;
  }
  if (!event.repeat && event.code === "KeyN") {
    setHoodEditorOpen(hoodEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyV") {
    setNimbusHandEditorOpen(nimbusHandEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyF") {
    toggleBroomFlight();
    return;
  }
  if (!event.repeat && event.code === "KeyO" && hasInventoryWeapon()) {
    swordsSheathed = true;
    character.setSwordSheathed(true);
    return;
  }
  if (!event.repeat && event.code.startsWith("Digit")) {
    const number = Number(event.code.slice(-1));
    if (number <= 4) {
      const id = inventoryState.quickSlots[number - 1],
        item = id ? ITEM_BY_ID.get(id) : undefined;
      if (item) useConsumable(item);
    } else if (number === 5) castSpell("heal");
    else if (number === 6) castSpell("firebolt");
    else if (number === 7) castSpell("lightning");
    else if (number === 8) startIceSpell();
    return;
  }
  if (!event.repeat && event.code === "Space" && !broomFlying) startAction("jump", 0);
  if (!event.repeat && event.code === "KeyP" && swordsSheathed) {
    swordsSheathed = false;
    character.setSwordSheathed(false);
    return;
  }
  if (!event.repeat && event.code === "KeyP")
    startAction("attack", hasEquippedWeapon() ? 1.05 : 0.52);
  if (!event.repeat && event.code === "KeyE") {
    if (togglePrincessBedRest()) return;
    if (toggleChurchDoor(character.group.position)) return;
    if(!broomFlying&&horseInteractionDistance()<=2.35){toggleMount();return;}
    if (openCitizenConversation()) return;
    if (openGuild()) return;
    if (openCityShop()) return;
    if (toggleNearestChest()) return;
    if (toggleCorpseLoot()) return;
    if (npcDialogue.classList.contains("open")) {
      toggleNpcDialogue();
      return;
    }
    if (mounted) {
      toggleMount();
      return;
    }
    const npcDistance = nearestWarrior().distance,
      horseDistance = horseInteractionDistance();
    if (horseDistance <= 2.35 && horseDistance <= npcDistance) toggleMount();
    else if (npcDistance <= 2.7) toggleNpcDialogue();
    else if (horseDistance <= 2.35) toggleMount();
    return;
  }
  if (!event.repeat && event.code === "KeyQ" && !broomFlying) startAction("dodge", 1.1);
});
window.addEventListener("keyup", (event) => {
  pressed.delete(event.code);
  if (event.code === "Digit8") stopIceSpell();
});
window.addEventListener("blur", () => pressed.clear());

type RemoteControllerMessage =
  | { type: "key"; code: string; down: boolean }
  | { type: "camera"; dx: number; dy: number }
  | { type: "action"; action: "cross" | "start" | "triangle"; down: boolean };
const applyRemoteControllerMessage = (message: RemoteControllerMessage) => {
  if (message.type === "key") {
    window.dispatchEvent(new KeyboardEvent(message.down ? "keydown" : "keyup", { code: message.code, bubbles: true }));
    return;
  }
  if (message.type === "action") {
    if (message.action === "start") {
      if (message.down) window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI", bubbles: true }));
      else window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyI", bubbles: true }));
      return;
    }
    if (message.action === "triangle") {
      const canInteract = princessBedRest.active || !!princessBedRest.nearest(character.group.position,cityBuilder.objects.values()) || !!churchDoorPrompt(character.group.position) || citizenConversations.open || !!citizenConversations.nearest() || guildPanel.open || !!cityResidents.guildContact(character.group.position) || cityShop.open || !!cityResidents.nearestMerchant(character.group.position) || mounted || corpseLoot.classList.contains("open") || npcDialogue.classList.contains("open") || horseInteractionDistance() <= 2.35 || nearestWarrior().distance <= 2.7;
      const code = broomFlying || !canInteract ? "KeyF" : "KeyE";
      window.dispatchEvent(new KeyboardEvent(message.down ? "keydown" : "keyup", { code, bubbles: true }));
      return;
    }
    if (message.down) {
      const code = mounted || broomFlying ? "ShiftLeft" : "Space";
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
    } else {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    }
    return;
  }
  const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= message.dx * .012;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - message.dy * .01, .18, Math.PI - .22);
  camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
  controls.update();
};
if (import.meta.hot) import.meta.hot.on("rpg:controller-input", applyRemoteControllerMessage);

let currentAnimation: AnimationState = "idle";
function setAnimation(next: AnimationState) {
  if (next === currentAnimation) return;
  currentAnimation = next;
  character.setAnimation(next);
  setPlayStatus(
    next === "run"
      ? "Correndo"
      : next === "walk"
        ? "Caminhando"
        : "Explore livremente",
  );
}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const mountedCameraTarget = new THREE.Vector3();
const horseWorldScale = new THREE.Vector3();
const collisionScratch = new THREE.Vector3();
const followTargetScratch = new THREE.Vector3();
const preyPreviousPositionScratch = new THREE.Vector3();
const frameDirectionScratch=new THREE.Vector3(),frameRightScratch=new THREE.Vector3(),frameMovementScratch=new THREE.Vector3();
const screenPositionScratch=new THREE.Vector3(),shadowPositionScratch=new THREE.Vector3();
const frameQuaternionScratch=new THREE.Quaternion(),frameEulerScratch=new THREE.Euler();
let simulationAccumulator=0,shadowAccumulator=0,horseCameraLookYaw=0;
character.group.traverse(object=>{if(object instanceof THREE.Mesh)object.userData.alwaysShadow=true;});
const updateLocalShadowCasters=()=>{
  if(!renderer.shadowMap.enabled)return;
  scene.updateMatrixWorld();
  scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    if(object.userData.noFireShadow){object.castShadow=false;return;}
    if(object.userData.alwaysShadow){object.castShadow=true;return;}
    if(object instanceof THREE.InstancedMesh||object===floor||object.name.startsWith("Terreno ")){object.castShadow=false;return;}
    shadowPositionScratch.setFromMatrixPosition(object.matrixWorld);
    let reach=quality.shadowDistance;
    if(object.userData.palaceComplexMesh){
      if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
      const bounds=object.geometry.boundingSphere;
      if(bounds){shadowPositionScratch.copy(bounds.center).applyMatrix4(object.matrixWorld);reach+=bounds.radius*object.matrixWorld.getMaxScaleOnAxis();}
    }
    object.castShadow=object.visible&&shadowPositionScratch.distanceToSquared(character.group.position)<=reach*reach;
  });
};
const cameraFollowHeight = new THREE.Vector3(0, PLAYER_CAMERA_HEAD_HEIGHT, 0);
const underwaterFilter = document.querySelector("#underwaterFilter");
function resolveWorldCollisions(
  position: THREE.Vector3,
  radius: number,
  ignored?: THREE.Object3D,
) {
  // Animals use this resolver too. Treat the player as a solid body unless
  // the player itself is the object currently being moved.
  if(ignored!==character.group&&!mounted)resolveCircleCollision(position,radius,character.group.position,.34,collisionScratch);
  warriorNpcs.forEach((npc, index) => {
    if(npc.group.userData.mapHidden||npc.group.userData.cityResidentManaged)return;
    if (mounted && followingWarriorIndex === index) return;
    if (npc.group !== ignored) resolveCircleCollision(position, radius, npc.group.position, .34, collisionScratch);
  });
  cityResidents.resolveCollisions(position,radius);
  preyAnimals.forEach((prey) => {
    if (prey.root.visible && prey.root !== ignored) resolveCircleCollision(position, radius, prey.position, preyRadius(prey), collisionScratch);
  });
  if(!mounted&&horseRoot&&!rideableHorses.has(horseRoot)&&horseRoot!==ignored)resolveCircleCollision(position,radius,horseRoot.position,.78,collisionScratch);
  for(const state of rideableHorses.values()){
    if(state.root===ignored||(mounted&&state.root===horseRoot)||!state.root.parent)continue;
    resolveHorseCollision(state,position,radius);
  }
  // Ship hulls use an oriented box so collision follows the model even after
  // it is rotated, scaled, duplicated or moved through the Build editor.
  for(const object of scene.children){
    if(!object.visible||!object.userData.solidHarbor||object===ignored)continue;
    object.updateWorldMatrix(true,false);
    const local=object.worldToLocal(position.clone()),half=object.userData.collisionHalfSize as [number,number];
    const scale=Math.max(.001,Math.min(Math.abs(object.scale.x),Math.abs(object.scale.z))),padding=radius/scale;
    if(Math.abs(local.x)>half[0]+padding||Math.abs(local.z)>half[1]+padding)continue;
    const dx=half[0]+padding-Math.abs(local.x),dz=half[1]+padding-Math.abs(local.z);
    if(dx<dz)local.x=Math.sign(local.x||1)*(half[0]+padding);else local.z=Math.sign(local.z||1)*(half[1]+padding);
    object.localToWorld(local);position.x=local.x;position.z=local.z;
  }
  openWorld.resolveCollisions(position, radius);
  cityBuilder.resolveCollisions(position,radius);
  resolveCityAnimalCollisions(position,radius);
}
function moveAnimalAvoiding(prey:Prey,direction:THREE.Vector3,distance:number){
  const start=prey.position.clone(),radius=preyRadius(prey);
  const forward=start.clone().addScaledVector(direction,distance);
  resolveWorldCollisions(forward,radius,prey.root);
  const forwardProgress=forward.clone().sub(start).dot(direction);
  let destination=forward;
  if(forwardProgress<distance*.45){
    const side=new THREE.Vector3(-direction.z,0,direction.x);
    const now=performance.now();
    if(now>=prey.avoidanceUntil){
      prey.avoidanceSign=preyAnimals.indexOf(prey)%2?-1:1;
      prey.avoidanceUntil=now+700;
    }
    const lateral=(sign:-1|1)=>{
      const point=start.clone().addScaledVector(side,sign*distance*1.35);
      resolveWorldCollisions(point,radius,prey.root);
      return point;
    };
    destination=lateral(prey.avoidanceSign);
    if(destination.distanceToSquared(start)<distance*distance*.16){
      prey.avoidanceSign=prey.avoidanceSign===1?-1:1;
      prey.avoidanceUntil=now+700;
      destination=lateral(prey.avoidanceSign);
    }
  }
  const displacement=destination.clone().sub(start);
  prey.position.copy(destination);
  prey.root.position.add(displacement);
  // Asset-authored forward axes differ: bear faces -X and chicken faces -Z.
  const modelHeadingOffset=prey.id==="bear"?Math.PI*.5:prey.id==="chicken"?Math.PI:0;
  if(displacement.lengthSq()>.000001)prey.root.rotation.y=Math.atan2(displacement.x,displacement.z)+modelHeadingOffset;
}
function playerWaterDepth() {
  if (!openWorld.isWaterAt(character.group.position.x, character.group.position.z)) return 0;
  return Math.max(0, openWorld.getWaterLevelAt(character.group.position.x, character.group.position.z) - .5 - playerGroundHeightAt(character.group.position.x, character.group.position.z));
}
const isSubmergedAt=(position:THREE.Vector3)=>
  openWorld.isWaterAt(position.x,position.z)&&
  position.y<openWorld.getWaterLevelAt(position.x,position.z)-.08;
function updatePlayerBuoyancy(delta: number) {
  const ground = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
  const waterLevel = openWorld.getWaterLevelAt(character.group.position.x, character.group.position.z);
  const targetY=Math.max(ground,waterLevel-1.85+Math.sin(performance.now()*.0022)*.012);
  character.group.position.y=THREE.MathUtils.lerp(character.group.position.y,targetY,1-Math.exp(-5*delta));
}
let playerDeathElapsed:number|undefined;
const respawnPlayerInCity=()=>{
  const square=[...cityBuilder.objects.values()].find(o=>o.name==="Cidade:fountain");
  const x=square?.position.x??0,z=(square?.position.z??7.5)+30;
  character.group.position.set(x,playerGroundHeightAt(x,z)+PLAYER_GROUND_OFFSET,z);character.group.rotation.y=0;
  inventoryState.hp=totalStats().hp;inventoryState.stamina=totalStats().stamina;
  broomFallVelocity=0;playerDeathElapsed=undefined;activeAction=null;pressed.clear();setAnimation("idle");
  saveInventory(inventoryState);refreshHud();snapCameraToPlayer();setPlayStatus("Você voltou à Cidade Inicial");
};
function updatePlayer(delta: number) {
  if(companionKiss.active){character.setAnimation('idle');return;}
  if (princessBedRest.active) {
    if(inventoryState.hp<=0){restoreBedOutfits();cityResidents.setCompanionBed(null);princessBedRest.toggle(character.group,cityBuilder.objects.values());}
    else {character.setAnimation("idle");return;}
  }
  if (buildMode) return;
  if(cityShop.open||guildPanel.open||citizenConversations.open){character.setAnimation('idle');return;}
  if(inventoryState.hp<=0||playerDeathElapsed!==undefined){
    if(playerDeathElapsed===undefined){
      playerDeathElapsed=0;activeAction=null;pressed.clear();
      if(broomFlying)toggleBroomFlight();if(mounted)toggleMount();
      setAnimation("death");setPlayStatus("Você morreu...");saveInventory(inventoryState);refreshHud();
    }
    playerDeathElapsed+=delta;setAnimation("death");
    if(playerDeathElapsed>=3)respawnPlayerInCity();
    return;
  }
  const inWater = playerWaterDepth() > .08 && character.group.position.y<=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z)-.12;
  const movingInput =
      pressed.has("KeyW") ||
      pressed.has("KeyS") ||
      pressed.has("KeyA") ||
      pressed.has("KeyD") ||
      pressed.has("ArrowUp") ||
      pressed.has("ArrowDown") ||
      pressed.has("ArrowLeft") ||
      pressed.has("ArrowRight"),
    sprinting =
      !inWater && movingInput && (pressed.has("ShiftLeft") || pressed.has("ShiftRight"));
  inventoryState.stamina = THREE.MathUtils.clamp(
    inventoryState.stamina + (sprinting ? -14 : 10) * delta,
    0,
    totalStats().stamina,
  );
  updateStaminaHud(sprinting || activeAction?.state === "attack");
  if (broomFlying) {
    const vertical = Number(pressed.has("KeyW") || pressed.has("ArrowUp")) - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const horizontal = Number(pressed.has("KeyD") || pressed.has("ArrowRight")) - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const rising = Number(pressed.has("Space")) - Number(pressed.has("ControlLeft") || pressed.has("ControlRight"));
    const boosting = (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) && inventoryState.stamina > 0;
    const broomMoving=Boolean(vertical||horizontal||rising);
    const broomSubmerged=isSubmergedAt(character.group.position);
    gameAudio.setFlight(broomMoving&&!broomSubmerged,boosting&&broomMoving&&!broomSubmerged);
    camera.getWorldDirection(forward);
    if(forward.lengthSq()>.0001)forward.normalize();
    const targetBroomPitch=Math.asin(THREE.MathUtils.clamp(forward.y,-1,1));
    broomAimPitch=THREE.MathUtils.lerp(broomAimPitch,targetBroomPitch,1-Math.exp(-10*delta));
    character.setBroomAimPitch(broomAimPitch);
    if(broomMountVisual)broomMountVisual.rotation.set(
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[0])-broomAimPitch,
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[1]),
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[2]),
    );
    right.crossVectors(forward,camera.up).normalize();
    if(Math.hypot(forward.x,forward.z)>.001)character.group.rotation.y=Math.atan2(forward.x,forward.z);
    const flightStart=character.group.position.clone();
    move.set(0,0,0);
    if (vertical || horizontal) {
      const flightSpeed = boosting ? 80 : 40;
      move.copy(forward).multiplyScalar(vertical).addScaledVector(right,horizontal).normalize().multiplyScalar(flightSpeed*delta);
    }
    if(rising)move.y+=rising*(boosting?20:10)*delta;
    // Building floors must not snap the flying rider up into a ceiling/wall.
    // Clamp against outdoor ground before collision, never after collision.
    const target=flightStart.clone().add(move);
    const flightGround=Math.max(harborGroundHeightAt(target.x,target.z,openWorld.getHeightAt(target.x,target.z)),cityFloor.heightAt(target.x,target.z)??-Infinity,cityFloor.stairHeightAt(target.x,target.z)??-Infinity);
    target.y=THREE.MathUtils.clamp(target.y,flightGround+1.05,flightGround+250);
    openWorld.resolveCollisions(target,.42,target.y);
    move.subVectors(target,flightStart);
    broomImpact.move(character.group.position,move,delta,(start,end,normal)=>cityBuilder.resolveFlightMovement(start,end,.42,normal),boosting);
    character.setMountedLegSpread(.24);
    character.setBroomRiding(true);
    setAnimation("mounted");
    setPlayStatus(boosting ? "Nimbus em velocidade máxima · mouse direciona · F desmontar" : "Voando · mouse direciona · F desmontar");
    return;
  }
  if (mounted && horseRoot && horseMountAnchor) {
    character.setMountedLegSpread(mountDebug.legSpread);
    const vertical =
      Number(pressed.has("KeyW") || pressed.has("ArrowUp")) -
      Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const horizontal =
      Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
      Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const running =
      (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) &&
      inventoryState.stamina > 0;
    // A/D steer the shared camera heading; W/S provide forward/backward motion.
    if(horizontal){
      const turn=-horizontal*(running?1.35:1.05)*delta;
      cameraOffset.copy(camera.position).sub(controls.target).applyAxisAngle(camera.up,turn);
      camera.position.copy(controls.target).add(cameraOffset);
      camera.lookAt(controls.target);camera.updateMatrixWorld();
    }
    camera.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()>.000001){
      forward.normalize();
      const cameraHeading=Math.atan2(forward.x,forward.z);
      const cameraTurn=Math.atan2(Math.sin(cameraHeading-horseRoot.rotation.y),Math.cos(cameraHeading-horseRoot.rotation.y));
      horseCameraLookYaw=THREE.MathUtils.clamp(cameraTurn/Math.max(delta,.001)*.12-horizontal*.25,-.4,.4);
      horseRoot.rotation.set(0,cameraHeading,0);
    }else forward.set(Math.sin(horseRoot.rotation.y),0,Math.cos(horseRoot.rotation.y));
    const moving = vertical !== 0 || horizontal !== 0;
    if (moving) {
      const base=running?"run":"walk",turn=horizontal<0?"-left":horizontal>0?"-right":"";
      setHorseMotion(base+turn,(vertical<0?-1:1)*(running?1.6:1));
      const distance=(running?14.88:4.725)*vertical*delta;
      move.copy(forward).multiplyScalar(distance);
      horseRoot.position.add(move);
      horseRoot.getWorldScale(horseWorldScale);
      resolveWorldCollisions(horseRoot.position,.78*Math.max(.65,horseWorldScale.z),horseRoot);
      horseRoot.position.y=Math.max(openWorld.getHeightAt(horseRoot.position.x,horseRoot.position.z),cityFloor.heightAt(horseRoot.position.x,horseRoot.position.z)??-Infinity,cityBuilder.walkHeightAt(horseRoot.position.x,horseRoot.position.z,horseRoot.position.y)??-Infinity);
      setPlayStatus(
        running
          ? "Cavalo correndo · E desmontar"
          : "Cavalo andando · E desmontar",
      );
    } else if (horseCurrentMotion !== "idle") {
      setHorseMotion("idle");
      setPlayStatus("Montado · E desmontar");
    }
    horseMountAnchor.getWorldPosition(mountPosition);
    horseRoot.getWorldScale(horseWorldScale);
    const horseScaleFactor = Math.max(.65, horseWorldScale.z);
    // Keep the rider slightly forward from the saddle anchor. The offset is
    // proportional to the edited horse scale without pushing the rider onto
    // the neck or leaving them over the rump.
    const riderForwardOffset = mountDebug.riderForward * horseScaleFactor;
    character.group.position.set(
      mountPosition.x + Math.sin(horseRoot.rotation.y) * riderForwardOffset,
      mountPosition.y + mountDebug.riderHeight,
      mountPosition.z + Math.cos(horseRoot.rotation.y) * riderForwardOffset,
    );
    horseRoot.getWorldQuaternion(frameQuaternionScratch);
    character.group.rotation.set(0,frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y,0);
    // Follow the saddle without changing the player's orbit or zoom.
    mountedCameraTarget.copy(mountPosition);
    mountedCameraTarget.y += 0.35;
    const cameraAlpha = 1 - Math.exp(-6 * delta);
    controls.enabled = true;
    cameraOffset.copy(camera.position).sub(controls.target);
    controls.target.lerp(mountedCameraTarget, cameraAlpha);
    camera.position.copy(controls.target).add(cameraOffset);
    setAnimation("mounted");
    return;
  }
  controls.enabled = true;
  let airborne=broomFallVelocity!==0;
  const updateVertical=()=>{
    if(inWater&&broomFallVelocity<=0){broomFallVelocity=0;airborne=false;updatePlayerBuoyancy(delta);return;}
    const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z,!airborne)+PLAYER_GROUND_OFFSET;
    const motion=advancePlayerVertical(character.group.position.y,broomFallVelocity,ground,delta,PLAYER_GRAVITY);
    character.group.position.y=motion.height;broomFallVelocity=motion.velocity;airborne=motion.airborne;
  };
  if (activeAction) {
    const previousElapsed=activeAction.elapsed;
    activeAction.elapsed += delta;
    if(activeAction.state==="dodge"){
      const distance=DODGE_DISTANCE*(dodgeProgress(activeAction.elapsed)-dodgeProgress(previousElapsed));
      const steps=Math.max(1,Math.ceil(distance/.08));
      for(let i=0;i<steps;i++){
        character.group.position.addScaledVector(dodgeDirection,distance/steps);
        resolveWorldCollisions(character.group.position,.32,character.group);
        if(!airborne){
          const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
          if(character.group.position.y-ground<=.08)character.group.position.y=ground;
          else {broomFallVelocity=-Number.EPSILON;airborne=true;}
        }
      }
    }
    if (activeAction.elapsed < activeAction.duration){updateVertical();return;}
    activeAction = null;
  }
  const vertical =
    Number(pressed.has("KeyW") || pressed.has("ArrowUp")) -
    Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
  const horizontal =
    Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
    Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  if (!vertical && !horizontal) {
    updateVertical();
    setAnimation(airborne?"jump":inWater?"swim":"idle");
    return;
  }

  camera.getWorldDirection(forward);
  if(!inWater)forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();
  move
    .copy(forward)
    .multiplyScalar(vertical)
    .addScaledVector(right, horizontal)
    .normalize();
  const running =
    !inWater &&
    (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) &&
    inventoryState.stamina > 0;
  const speed = (running ? 13.5 : 5.7) * (inWater ? .48 : 1);
  const distance = speed * delta;
  // Sample short moves so running and slow frames cannot skip stair treads.
  const movementSteps=Math.max(1,Math.ceil(distance/.08));
  for(let step=0;step<movementSteps;step++){
    character.group.position.addScaledVector(move,distance/movementSteps);
    resolveWorldCollisions(character.group.position,0.32,character.group);
    if(!inWater&&!airborne){
      const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
      if(character.group.position.y-ground<=.08)character.group.position.y=ground;
      else {broomFallVelocity=-Number.EPSILON;airborne=true;}
    }
  }
  if(inWater&&!airborne){
    const swimGround=playerGroundHeightAt(character.group.position.x,character.group.position.z);
    const swimSurface=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z);
    character.group.position.y=THREE.MathUtils.clamp(character.group.position.y,swimGround+.18,swimSurface-.12);
  }
  updateVertical();
  character.group.rotation.set(0,Math.atan2(move.x, move.z),0);

  setAnimation(airborne?"jump":inWater?"swimMove":running ? "run" : "walk");
}

new ResizeObserver(() => {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(viewport);

let previous = performance.now();
let survivalSaveAccumulator = 0;
let minimapAccumulator = 0;
function playAnimalMotion(prey: Prey, motion: "idle" | "walk") {
  if (prey.currentMotion === motion) return;
  const clips = prey.root.userData.clips as THREE.AnimationClip[];
  const clip = motion === "walk"
    ? clips.find((value) => /walk|run|gallop|hop/i.test(value.name))
    : THREE.AnimationClip.findByName(clips, prey.idleClip) ?? clips.find((value) => /idle|eat/i.test(value.name));
  if (!clip) return;
  prey.mixer.stopAllAction();
  prey.mixer.clipAction(clip).reset().fadeIn(.16).play();
  prey.currentMotion = motion;
}
function playAnimalAttackMotion(prey:Prey){
  const clips=prey.root.userData.clips as THREE.AnimationClip[];
  const preferred=prey.id==="wolf"?/selection|attack|bite/i:prey.id==="puma"?/roar|attack|bite/i:/attack|bite/i;
  const clip=clips.find(value=>preferred.test(value.name));
  prey.mixer.stopAllAction();
  if(clip){const action=prey.mixer.clipAction(clip).reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.08).play();}
  else {const idle=THREE.AnimationClip.findByName(clips,prey.idleClip)??clips[0];if(idle)prey.mixer.clipAction(idle).reset().fadeIn(.08).play();}
  prey.currentMotion="idle";
}
let lastScheduledWolfHowl="";
function updateWorld(delta: number) {
  if (!timePaused) inventoryState.worldTime += (delta / 480) * timeSpeed;
  if (inventoryState.worldTime >= 1) {
    const elapsedDays = Math.floor(inventoryState.worldTime);
    inventoryState.worldTime -= elapsedDays;
    inventoryState.worldDay += elapsedDays;
  }
  const t = inventoryState.worldTime;
  const phase =
      t < 0.22
        ? "Noite"
        : t < 0.42
          ? "Manhã"
          : t < 0.7
            ? "Dia"
            : t < 0.82
              ? "Tarde"
              : "Noite",
    hours = Math.floor(t * 24),
    minutes = Math.floor((t * 24 - hours) * 60),
    clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    dateTime = `Dia ${inventoryState.worldDay} · ${clock} · ${phase}`;
  hudPhase.textContent = dateTime;
  document.querySelector("#mapPhase")!.textContent = dateTime;
  document.querySelector("#inventoryMapPhase")!.textContent=dateTime;
  timeEditorValue.textContent = clock;
  if (document.activeElement !== timeSlider) timeSlider.value = String(t * 24);
  if (document.activeElement !== dayInput)
    dayInput.value = String(inventoryState.worldDay);
  const wideCamera=buildMode||broomFlying;
  const shadowRadius = wideCamera ? Math.max(40, camera.position.distanceTo(controls.target) * 1.15) : 48;
  const localWeather=syncBiomeWeather();
  const skyLight = skySystem.update(t, camera.position, localWeather, delta, controls.target, shadowRadius);
  scene.environmentIntensity = (.04 + skyLight.daylight * .56) * (localWeather === "clear" ? 1 : .65);
  cloudSystem.update(delta, character.group.position, skyLight.daylight, localWeather);
  const fogColor = new THREE.Color(
    phase === "Noite" ? "#081024" : phase === "Tarde" ? "#b96e55" : "#8fc9e5",
  );
  if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(fogColor);
  const fog = scene.fog;
  if (fog instanceof THREE.Fog) {
    fog.near = wideCamera ? 10000 : 18;
    fog.far = wideCamera
      ? 10001
      : localWeather === "snow"
        ? 22
        : localWeather === "rain"
          ? 29
          : 40;
  }
  cityBuilder.prepareWeatherCover();
  weatherSystem.update(delta, character.group.position,(x,z)=>cityBuilder.roofHeightAt(x,z));
  // Survival drain is temporarily disabled while the combat/progression loop
  // is being tuned. Keep existing saves pinned to full hunger and thirst.
  inventoryState.hunger=100;
  inventoryState.thirst=100;
  survivalSaveAccumulator += delta;
  if (survivalSaveAccumulator >= 2) {
    survivalSaveAccumulator = 0;
    saveInventory(inventoryState);
    refreshHud();
  }
}
function updateEditorCamera(delta: number) {
  if (!buildMode || !editorFreeCamera) return;
  const vertical = Number(pressed.has("KeyW")) - Number(pressed.has("KeyS")), horizontal = Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
  const elevation=Number(pressed.has("Space"))-Number(pressed.has("ControlLeft")||pressed.has("ControlRight"));
  if (!vertical && !horizontal && !elevation) return;
  const direction=frameDirectionScratch;camera.getWorldDirection(direction);direction.y=0;direction.normalize();const rightward=frameRightScratch.crossVectors(direction,camera.up).normalize();
  const movement=frameMovementScratch.copy(direction).multiplyScalar(vertical).addScaledVector(rightward,horizontal).addScaledVector(camera.up,elevation).normalize().multiplyScalar(delta*(pressed.has("ShiftLeft")||pressed.has("ShiftRight")?72:28));camera.position.add(movement);controls.target.add(movement);
}
renderer.setAnimationLoop((now) => {
  updateCityPropLoading(character.group.position);
  const framePrevious=previous;
  const delta = Math.min((now - previous) / 1000, 0.05);
  simulationAccumulator+=delta;shadowAccumulator+=delta;
  const simulationStep=1/quality.simulationHz,simulationTick=simulationAccumulator>=simulationStep;
  const simulationDelta=simulationTick?simulationAccumulator:0;
  if(simulationTick)simulationAccumulator%=simulationStep;
  if(shadowAccumulator>=.5){shadowAccumulator=0;cityBuilder.updatePropVisibility(character.group.position,buildMode);updateLocalShadowCasters();}
  minimapAccumulator += delta;
  const residentsStart=performance.now();
  const talkingResidentId=citizenConversations.activeCitizenId??(npcDialogue.classList.contains('open')?cityResidents.residents.find(r=>r.citizen.existingIndex===activeWarriorIndex)?.citizen.id??null:null);
  cityResidents.setConversation(talkingResidentId);
  cityResidents.setCompanionPaused(buildMode||companionKiss.active);
  let residentHeightMs=0,residentCollisionMs=0;
  cityResidents.update(delta,character.group.position,(x,z,feetY=0)=>{const t=performance.now();const h=Math.max(openWorld.getHeightAt(x,z),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity,cityBuilder.walkHeightAt(x,z,feetY)??-Infinity);residentHeightMs+=performance.now()-t;return h;}, (p,r)=>{const t=performance.now();cityBuilder.resolveCollisions(p,r);residentCollisionMs+=performance.now()-t;},inventoryState.worldTime);
  performanceMonitor.record("moradores",performance.now()-residentsStart);

  performanceMonitor.record("NPC altura",residentHeightMs);performanceMonitor.record("NPC colisao",residentCollisionMs);
  const cityAnimalStart=performance.now();
  updateCityAnimals(delta,(x,z)=>Math.max(openWorld.getHeightAt(x,z),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity),
    (position,radius)=>{openWorld.resolveCollisions(position,radius);cityBuilder.resolveCollisions(position,radius);},character.group.position);
  performanceMonitor.record("animais cidade",performance.now()-cityAnimalStart);
  const cityLightStart=performance.now();
  updateChurchDoors(delta);
  updateCityFirelights(delta,character.group.position,qualityLevel==="low"?0:qualityLevel==="medium"?1:2,qualityLevel==="low"?3:5,inventoryState.worldTime);
  performanceMonitor.record("luzes cidade",performance.now()-cityLightStart);
  spellEffects.update(delta);
  updateWorld(delta);
  const playerStart=performance.now();
  updatePlayer(delta);
  performanceMonitor.record("jogador",performance.now()-playerStart);
  if (!buildMode && !mounted) {
    // Follow vertical changes even while idle, jumping, or settling onto land.
    cameraOffset.copy(character.group.position).add(cameraFollowHeight).sub(controls.target);
    controls.target.add(cameraOffset);
    camera.position.add(cameraOffset);
  }
  updateEditorCamera(delta);
  const streamStart=performance.now();
  openWorld.update(buildMode ? controls.target : character.group.position);
  performanceMonitor.record("chunks",performance.now()-streamStart);
  gameAudio.update(delta, currentAnimation);
  if(simulationTick){updateMarineLife(simulationDelta,now/1000);updateSchoolFish(now/1000);}
  // Visual flight must follow render cadence, not the throttled AI cadence.
  updateSkyBirds(delta);
  const animationStart=performance.now();
  character.update(delta);
  companionKiss.update(delta,(x,z)=>playerGroundHeightAt(x,z),(p,r)=>cityBuilder.resolveCollisions(p,r));
  if(restOutfitsRemoved&&(!princessBedRest.active||cityResidents.residents.find(r=>r.citizen.role==='princesa')?.routine!=='sleep'))restoreBedOutfits();
  princessBedRest.update(character.group);
  performanceMonitor.record("animação",performance.now()-animationStart);
  updateIceSpell(delta);
  if (followingWarriorIndex !== null && !(npcDialogue.classList.contains("open")&&activeWarriorIndex===followingWarriorIndex) && !cityResidents.residents.some(r=>r.citizen.existingIndex===followingWarriorIndex&&r.citizen.id===talkingResidentId)) {
    const follower = warriorNpcs[followingWarriorIndex];
    if (mounted && horseRoot) {
      const passengerOffset = new THREE.Vector3(
        -Math.sin(horseRoot.rotation.y) * 0.46,
        0,
        -Math.cos(horseRoot.rotation.y) * 0.46,
      );
      follower.group.position
        .copy(character.group.position)
        .add(passengerOffset);
      follower.group.position.y = character.group.position.y;
      follower.group.rotation.y = horseRoot.rotation.y;
      follower.setAnimation("mountedPassenger");
    } else {
      follower.group.position.y = openWorld.getHeightAt(follower.group.position.x, follower.group.position.z);
      const playerBack = new THREE.Vector3(
        -Math.sin(character.group.rotation.y) * 1.25,
        0,
        -Math.cos(character.group.rotation.y) * 1.25,
      );
      const followTarget = followTargetScratch.copy(character.group.position).add(playerBack);
      followTarget.y = follower.group.position.y;
      const direction = followTarget.sub(follower.group.position);
      direction.y = 0;
      const distance = direction.length();
      if (distance > 1.05) {
        direction.normalize();
        const step = Math.min(distance - 1.05, 2.75 * delta);
        follower.group.position.addScaledVector(direction, step);
        resolveWorldCollisions(follower.group.position, 0.34, follower.group);
        follower.group.rotation.y = Math.atan2(direction.x, direction.z);
        follower.setAnimation(distance > 3.5 ? "run" : "walk");
      } else follower.setAnimation("idle");
    }
  }
  cityResidents.updateLabels(camera,character.group.position,viewport);
  if(simulationTick)warriorNpcs.forEach((npc, index) => {
    if(npc.group.userData.cityResidentManaged){npcNameLabels[index].classList.remove("visible");return;}
    const delta=simulationDelta;
    if (!mounted || followingWarriorIndex !== index)
      npc.group.position.y = Math.max(openWorld.getHeightAt(npc.group.position.x, npc.group.position.z),cityFloor.heightAt(npc.group.position.x,npc.group.position.z)??-Infinity);
    npc.update(delta);
    const npcHead = npc.group
        .getWorldPosition(screenPositionScratch)
        .add(new THREE.Vector3(0, 2.78, 0))
        .project(camera),
      npcOnScreen = !npc.group.userData.mapHidden &&
        npc.group.position.distanceToSquared(character.group.position) <= 25 &&
        npcHead.z > -1 &&
        npcHead.z < 1 &&
        Math.abs(npcHead.x) < 1.1 &&
        Math.abs(npcHead.y) < 1.1,
      label = npcNameLabels[index];
    label.classList.toggle("visible", npcOnScreen);
    if (npcOnScreen) {
      label.style.left = `${(npcHead.x * 0.5 + 0.5) * viewport.clientWidth}px`;
      label.style.top = `${(-npcHead.y * 0.5 + 0.5) * viewport.clientHeight}px`;
    }
  });
  if (npcDialogue.classList.contains("open")) {
    const playerScreen = character.group
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 1.35, 0))
        .project(camera),
      panelWidth = npcDialogue.offsetWidth || 300,
      panelHeight = npcDialogue.offsetHeight || 250;
    const left = THREE.MathUtils.clamp(
        (playerScreen.x * 0.5 + 0.5) * viewport.clientWidth + 46,
        12,
        viewport.clientWidth - panelWidth - 12,
      ),
      top = THREE.MathUtils.clamp(
        (-playerScreen.y * 0.5 + 0.5) * viewport.clientHeight,
        panelHeight / 2 + 12,
        viewport.clientHeight - panelHeight / 2 - 12,
      );
    npcDialogue.style.left = `${left}px`;
    npcDialogue.style.top = `${top}px`;
  }
  if (npcSubtitleUntil && now > npcSubtitleUntil) {
    npcSubtitleUntil = 0;
    npcSubtitle.classList.remove("visible");
  }
  if(simulationTick){horseMixers.forEach((mixer)=>mixer.update(simulationDelta));updateRideableHorses(simulationDelta,character.group.position);}
  if(mounted&&horseRoot){
    const state=rideableHorses.get(horseRoot);
    if(state){camera.getWorldDirection(forward);updateHorseLook(state,Math.asin(THREE.MathUtils.clamp(forward.y,-1,1)),delta,horseCameraLookYaw);}
  }
  horseRegistryScanElapsed+=delta;
  if(horseRegistryScanElapsed>1){
    horseRegistryScanElapsed=0;const candidates:THREE.Object3D[]=[];
    scene.traverse(o=>{if(o.userData.animalModel?.includes('/horse/')&&(o!==horseRoot||rideableHorses.has(o)))candidates.push(o);});
    for(const root of candidates){
      registerRideableHorse(root,root.animations);if(root.userData.horseRuntimeApplied)continue;
      const key=root.userData.rideableHorseId??root.userData.buildId,saved=key?runtimeWorld.horses?.[key]:undefined;
      if(saved&&validPosition(saved.position)){scene.attach(root);root.position.fromArray(saved.position);root.rotation.y=saved.rotationY;}
      root.userData.horseRuntimeApplied=true;
    }
  }
  treasureChests.forEach(chest=>{
    if(chest.animating){chest.mixer.update(delta);if(!chest.mixer.existingAction(chest.isOpen?chest.openClip:chest.closeClip)?.isRunning())chest.animating=false;}
    if(chest.coin){chest.coin.rotation.y+=delta*2.4;chest.coin.visible=!chest.isOpen;}
  });
  if(simulationTick)updateCatAndRats(simulationDelta);
  horseIdleTime += delta;
  if (horseCurrentMotion === "idle")
    for (const { bone, base, phase, amount } of horseIdleBones) {
      const breathe = Math.sin(horseIdleTime * 1.75 + phase) * amount;
      bone.quaternion
        .copy(base)
        .multiply(frameQuaternionScratch.setFromEuler(frameEulerScratch.set(breathe*.35,breathe,breathe*.2)));
    }
  const worldHour=Math.floor(inventoryState.worldTime*24)%24;
  const wolfHowlHour=[19,21,23,1,3].includes(worldHour);
  const wolfHowlKey=`${inventoryState.worldDay}:${worldHour}`;
  const startScheduledWolfHowl=wolfHowlHour&&wolfHowlKey!==lastScheduledWolfHowl;
  if(startScheduledWolfHowl){lastScheduledWolfHowl=wolfHowlKey;gameAudio.wolfHowl();}
  if(simulationTick)preyAnimals.forEach((prey) => {
    const delta=simulationDelta;
    const distanceToCameraSq=prey.position.distanceToSquared(camera.position);
    const activationRange=qualityLevel==="low"?36:qualityLevel==="medium"?58:86;
    if(prey.position.distanceToSquared(character.group.position)>activationRange*activationRange){prey.root.visible=false;prey.hud.classList.remove("visible");return;}
    prey.root.visible=true;
    const frozen = prey.hp > 0 && now < prey.frozenUntil;
    const previousPosition=preyPreviousPositionScratch.copy(prey.position);
    prey.mixer.timeScale = frozen ? 0 : 1;
    if(distanceToCameraSq<55*55||prey.hostileState!=="calm"||prey.hitElapsed!==undefined)prey.mixer.update(delta);
    if (frozen) { constrainPreyToHabitat(prey,previousPosition); return; }
    if (prey.hitElapsed !== undefined && prey.hp > 0) {
      prey.hitElapsed += delta;
      const duration = 0.42,
        phase = Math.min(1, prey.hitElapsed / duration),
        impact = Math.sin(phase * Math.PI),
        recoil = impact * (prey.id === "deer" ? 0.28 : 0.17);
      prey.root.position
        .copy(prey.hitStartPosition)
        .addScaledVector(prey.hitDirection, recoil);
      prey.root.position.y += impact * (prey.id === "deer" ? 0.1 : 0.07);
      prey.root.rotation.x =
        prey.hitBaseRotationX - impact * (prey.id === "deer" ? 0.12 : 0.18);
      prey.root.rotation.z =
        prey.hitBaseRotationZ +
        Math.sin(phase * Math.PI * 2) * (prey.id === "deer" ? 0.08 : 0.14);
      if (phase >= 1) {
        prey.root.position.copy(prey.hitStartPosition);
        prey.root.rotation.x = prey.hitBaseRotationX;
        prey.root.rotation.z = prey.hitBaseRotationZ;
        prey.hitElapsed = undefined;
      }
    }
    const wolfBiome=openWorld.getBiomeAt(prey.position.x,prey.position.z),wolfOnMountain=wolfBiome==="Montanha"||(wolfBiome==="Neve"&&openWorld.getHeightAt(prey.position.x,prey.position.z)>35);
    if(prey.id==="wolf"&&prey.hp>0&&prey.hitElapsed===undefined&&prey.hostileState==="calm"&&wolfOnMountain){
      const distanceToPlayer=character.group.position.distanceTo(prey.position);
      if(prey.howlElapsed!==undefined){
        prey.howlElapsed+=delta;
        if(prey.howlElapsed>=3.2){prey.howlElapsed=undefined;playAnimalMotion(prey,"idle");}
        else if(distanceToPlayer>prey.territoryRadius){constrainPreyToHabitat(prey,previousPosition);return;}
      }else if(startScheduledWolfHowl&&distanceToPlayer>prey.territoryRadius){
        const clips=prey.root.userData.clips as THREE.AnimationClip[],howl=clips.find(clip=>/selection|howl/i.test(clip.name));
        prey.mixer.stopAllAction();if(howl)prey.mixer.clipAction(howl).reset().setLoop(THREE.LoopOnce,1).play();
        prey.currentMotion="idle";prey.howlElapsed=0;
        constrainPreyToHabitat(prey,previousPosition);return;
      }
    }
    if (prey.territoryRadius > 0 && prey.hp > 0 && prey.hitElapsed === undefined) {
      prey.attackCooldown = Math.max(0, prey.attackCooldown - delta);
      const playerDistance = character.group.position.distanceTo(prey.position);
      const homeDistance = prey.position.distanceTo(prey.home);
      if (prey.hostileState === "calm" && playerDistance <= prey.territoryRadius) {
        prey.hostileState = "chase";
        setPlayStatus(`Território de ${prey.label} invadido!`);
      }
      if (prey.hostileState === "chase") {
        if (homeDistance > ANIMAL_TERRITORIES[prey.id].patrol*2 || (playerDistance>prey.territoryRadius*2&&!isAnimalHabitat(openWorld,prey.id,character.group.position.x,character.group.position.z))) prey.hostileState = "return";
        else if (playerDistance <= 1.45 && prey.attackCooldown === 0) {
          prey.hostileState = "attack";
          prey.attackElapsed = 0;
          prey.attackDidDamage = false;
          prey.attackBasePosition.copy(prey.root.position);
          if(prey.id==="bear"||prey.id==="wolf"||prey.id==="puma")gameAudio.animalAttack(prey.id);
          playAnimalAttackMotion(prey);
        } else {
          const chaseDirection = character.group.position.clone().sub(prey.position).setY(0);
          if (chaseDirection.lengthSq() > .001) {
            chaseDirection.normalize();
            const step = Math.min(playerDistance, prey.moveSpeed * delta);
            moveAnimalAvoiding(prey,chaseDirection,step);
            playAnimalMotion(prey, "walk");
          }
        }
      } else if (prey.hostileState === "attack" && prey.attackElapsed !== undefined) {
        prey.attackElapsed += delta;
        const phase = Math.min(1, prey.attackElapsed / .82);
        const lunge = Math.sin(phase * Math.PI);
        const bite=Math.sin(Math.min(1,phase*1.8)*Math.PI);
        const attackDirection = character.group.position.clone().sub(prey.position).setY(0);
        if (attackDirection.lengthSq() > .001) attackDirection.normalize();
        else attackDirection.set(0, 0, 1);
        const contactDistance=preyRadius(prey)+.34;
        const availableLunge=Math.max(0,prey.attackBasePosition.distanceTo(character.group.position)-contactDistance);
        prey.root.position.copy(prey.attackBasePosition).addScaledVector(attackDirection,lunge*Math.min(.55,availableLunge));
        prey.root.rotation.x = prey.hitBaseRotationX - lunge * .22;
        prey.root.rotation.y = Math.atan2(attackDirection.x, attackDirection.z)+(prey.id === "bear" ? Math.PI*.5 : 0);
        if(prey.jaw&&prey.jawRest)prey.jaw.quaternion.copy(prey.jawRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,bite*.48)));
        if (!prey.attackDidDamage && phase >= .42) {
          prey.attackDidDamage = true;
          if (character.group.position.distanceTo(prey.position) <= 1.75 && !playerDodgingHit()) {
            const damage=physicalDamage(prey.attackDamage,totalStats().defense);
            inventoryState.hp = Math.max(0, inventoryState.hp - damage);
            character.group.position.addScaledVector(attackDirection,1.15);
            resolveWorldCollisions(character.group.position,.32,character.group);
            gameAudio.hit();
            showPlayerDamage();
            refreshHud();
            saveInventory(inventoryState);
            setPlayStatus(`${prey.label} atacou: -${damage} HP`);
          }
        }
        if (phase >= 1) {
          prey.root.position.copy(prey.attackBasePosition);
          prey.root.rotation.x = prey.hitBaseRotationX;
          if(prey.jaw&&prey.jawRest)prey.jaw.quaternion.copy(prey.jawRest);
          prey.attackElapsed = undefined;
          prey.attackCooldown = .65;
          prey.hostileState = homeDistance > ANIMAL_TERRITORIES[prey.id].patrol*2 ? "return" : "chase";
          if(prey.hostileState==="chase")playAnimalMotion(prey,"walk");
        }
      } else if (prey.hostileState === "return") {
        const returnDirection = prey.home.clone().sub(prey.position).setY(0);
        const distance = returnDirection.length();
        if (distance < .18) {
          prey.position.copy(prey.home);
          prey.hostileState = "calm";
          playAnimalMotion(prey, "idle");
        } else {
          returnDirection.normalize();
          const step = Math.min(distance, prey.moveSpeed * .75 * delta);
          moveAnimalAvoiding(prey,returnDirection,step);
          playAnimalMotion(prey, "walk");
        }
      }
    }
    if (prey.deathElapsed !== undefined) {
      prey.deathElapsed += delta;
      if (prey.deathElapsed > 35 && !prey.loot.length) {
        prey.deathElapsed = undefined;
        prey.hp = prey.maxHp;
        prey.root.visible = true;
        prey.mixer.stopAllAction();
        const clips = prey.root.userData.clips as THREE.AnimationClip[],
          idle =
            clips.find((clip) => !clip.name.toLowerCase().includes("die")) ??
            clips[0];
        if (idle) prey.mixer.clipAction(idle).reset().play();
        prey.currentMotion = "idle";
        prey.fleeTime = 0;
        prey.routinePause = 2 + Math.random() * 4;
        updatePreyHud(prey);
      }
    }
    if (
      prey.hp > 0 &&
      prey.root.visible &&
      prey.hitElapsed === undefined &&
      prey.fleeTime > 0
    ) {
      prey.fleeTime = Math.max(0, prey.fleeTime - delta);
      const threat = prey.predatorPosition ?? character.group.position;
      const direction = prey.position.clone().sub(threat);
      direction.y = 0;
      if (direction.lengthSq() < 0.0001)
        direction.set(
          Math.sin(prey.root.rotation.y),
          0,
          Math.cos(prey.root.rotation.y),
        );
      else direction.normalize();
      const movement = (prey.id === "deer" ? 5.4 : prey.id === "rabbit" ? 8.5 : prey.id === "raccoon" ? 3.8 : prey.id === "rat" ? 3.15 : 2.15) * delta;
      moveAnimalAvoiding(prey,direction,movement);
      if (prey.currentMotion !== "walk") {
        const clips = prey.root.userData.clips as THREE.AnimationClip[],
          run =
            clips.find((clip) => /run|gallop|hop/i.test(clip.name)) ??
            clips.find((clip) => /walk/i.test(clip.name)) ??
            clips[0];
        prey.mixer.stopAllAction();
        if (run) prey.mixer.clipAction(run).reset().fadeIn(0.12).play();
        prey.currentMotion = "walk";
      }
      if (prey.fleeTime === 0) {
        prey.predatorPosition = undefined;
        prey.routinePause = FOREST_ANIMAL_IDS.has(prey.id) ? .65+Math.random()*1.35 : 1.5+Math.random()*2;
      }
    }
    if (
      prey.hp > 0 &&
      prey.root.visible &&
      prey.hitElapsed === undefined &&
      prey.fleeTime === 0 &&
      prey.hostileState === "calm" &&
      prey.routine === "patrol" &&
      prey.waypoints.length
    ) {
      if (prey.routinePause > 0) {
        prey.routinePause -= delta;
        if (prey.currentMotion !== "idle") {
          const clips = prey.root.userData.clips as THREE.AnimationClip[];
          const idle =
            THREE.AnimationClip.findByName(clips, prey.idleClip) ??
            clips.find((clip) => /idle|eat/i.test(clip.name)) ??
            clips[0];
          prey.mixer.stopAllAction();
          if (idle) prey.mixer.clipAction(idle).reset().fadeIn(0.18).play();
          prey.currentMotion = "idle";
        }
      } else {
        const target = prey.waypoints[prey.waypointIndex],
          direction = target.clone().sub(prey.position);
        direction.y = 0;
        const distance = direction.length();
        if (distance < 0.18) {
          if(prey.waypointIndex>=prey.waypoints.length-1){
            const roamSeed=preyAnimals.indexOf(prey)*977+Math.floor(now*.001);
            prey.waypoints=animalPatrolPoints(openWorld,prey.id,roamSeed,[prey.position.x,prey.position.z]).map(point=>new THREE.Vector3(...point));
            prey.waypointIndex=0;
          }else prey.waypointIndex++;
          prey.routinePause = FOREST_ANIMAL_IDS.has(prey.id) ? .8+Math.random()*2.2 : 2+Math.random()*6;
        } else {
          direction.normalize();
          const movement = Math.min(distance, prey.moveSpeed * delta),
            movementDirection=direction;
          moveAnimalAvoiding(prey,movementDirection,movement);
          if (prey.currentMotion !== "walk") {
            const clips = prey.root.userData.clips as THREE.AnimationClip[];
            const walk =
              clips.find((clip) => /walk|run|hop/i.test(clip.name)) ??
              THREE.AnimationClip.findByName(clips, prey.idleClip) ??
              clips[0];
            prey.mixer.stopAllAction();
            if (walk) prey.mixer.clipAction(walk).reset().fadeIn(0.18).play();
            prey.currentMotion = "walk";
          }
        }
      }
    }
    constrainPreyToHabitat(prey,previousPosition);
    if(prey.id==="rabbit"){
      const moving=prey.currentMotion==="walk"&&prey.hp>0&&prey.root.visible;
      const phase=now*.012+preyAnimals.indexOf(prey)*1.7;
      prey.root.position.y=prey.position.y+(moving?Math.max(0,Math.sin(phase))*.42:0);
    }
    const head = prey.headAnchor
        .getWorldPosition(screenPositionScratch)
        .project(camera),
      visible =
        now < prey.hudUntil && prey.root.visible && head.z > -1 && head.z < 1;
    prey.hud.classList.toggle("visible", visible);
    if (visible) {
      prey.hud.style.left = `${(head.x * 0.5 + 0.5) * viewport.clientWidth}px`;
      prey.hud.style.top = `${(-head.y * 0.5 + 0.5) * viewport.clientHeight}px`;
    }
  });
  cityShop.update();guildPanel.update();
  citizenConversations.update(!buildMode&&!cityShop.open&&!guildPanel.open&&inventoryState.hp>0&&!mounted&&!broomFlying);
  if(buildMode){cityShop.close();guildPanel.close();}
  if (
    activeLootPrey &&
    character.group.position.distanceTo(activeLootPrey.position) > 3.2
  ) {
    setCorpseLootOpen();
    setPlayStatus("Você se afastou do saque");
  } else if (npcDialogue.classList.contains("open") && !isNpcNearby()) {
    setNpcDialogueOpen(false);
    setPlayStatus("Você se afastou da conversa");
  } else if (!activeLootPrey && !npcDialogue.classList.contains("open")) {
    const chest=nearestTreasureChest(),lootable = nearestLootablePrey();
    const churchPrompt=churchDoorPrompt(character.group.position);
    const merchant=cityResidents.nearestMerchant(character.group.position);
    const guild=cityResidents.guildContact(character.group.position);
    if(cityShop.open||guildPanel.open||citizenConversations.open)setInteractionPrompt();
    else if(princessBedRest.active)setInteractionPrompt('Levantar · F tirar/vestir roupas');
    else if(!mounted&&!broomFlying&&princessBedRest.nearest(character.group.position,cityBuilder.objects.values()))setInteractionPrompt('Deitar ao lado de Alice');
    else if(churchPrompt) setInteractionPrompt(churchPrompt);
    else if(citizenConversations.nearest())setInteractionPrompt(`Conversar com ${citizenConversations.nearest()!.citizen.name}`);
    else if(!broomFlying&&horseInteractionDistance()<=2.35)setInteractionPrompt(mounted?"Desmontar do cavalo":"Montar cavalo");
    else if(guild&&!mounted&&!broomFlying)setInteractionPrompt(`Missões da guilda · ${guild.name}`);
    else if(merchant&&!mounted&&!broomFlying)setInteractionPrompt(merchant.kind==='stable'?`Comprar cavalo · ${merchant.name}`:`Comprar / vender · ${merchant.name}`);
    else if(chest) setInteractionPrompt(`${chest.isOpen?"Fechar":"Abrir"} baú ${chestLabel[chest.kind]}`);
    else if (lootable) setInteractionPrompt(`Saquear ${lootable.label}`);
    else if (broomFlying) setInteractionPrompt("Desmontar da Nimbus 2000", "F");
    else if (mounted) setInteractionPrompt("Desmontar do cavalo");
    else if(nearestRideableHorse(character.group.position).distance<=2.35)setInteractionPrompt("Cavalo à venda · fale com o cavalariço", "");
    else if (hasEquippedNimbus()&&horseInteractionDistance()>2.35) setInteractionPrompt("Montar Nimbus 2000", "F");
    else {
      const nearest = nearestWarrior(),
        horseDistance = horseInteractionDistance();
      if (horseDistance <= 2.35 && horseDistance <= nearest.distance)
        setInteractionPrompt("Montar cavalo");
      else if (
        nearest.distance <= 2.7 &&
        !npcSubtitle.classList.contains("visible")
      )
        setInteractionPrompt(`Falar com ${warriorNames[nearest.index]}`);
      else if (horseDistance <= 2.35) setInteractionPrompt("Montar cavalo");
      else setInteractionPrompt();
    }
  } else setInteractionPrompt();
  // Canvas maps do not need the display's refresh rate. Updating at 10 Hz is
  // visually smooth for map markers and removes repeated 2D drawing work.
  const mapStep=1/quality.simulationHz;
  if (minimapAccumulator >= mapStep) {
    minimapAccumulator %= mapStep;
    drawMap(miniCanvas);
    if (mapPanel.classList.contains("open")) drawMap(worldMapCanvas);
    if(document.querySelector('[data-inventory-panel="map"]')?.classList.contains("active"))drawMap(inventoryMapCanvas);
  }
  previous = now;
  controls.update();
  const underwater=isSubmergedAt(camera.position);
  underwaterFilter?.classList.toggle("active",underwater);
  const renderStart=performance.now();
  renderer.render(scene, camera);
  performanceMonitor.record("render",performance.now()-renderStart);
  performanceMonitor.update((now - framePrevious) / 1000);
  if (inventoryModal.classList.contains("open")) {
    const portrait =
        avatarTarget === "female" ? femaleNpc.group : character.group,
      target = portrait
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 1.25, 0));
    const facingOffset = new THREE.Vector3(0, 0.02, 7.0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarYaw)
      .applyQuaternion(portrait.getWorldQuaternion(new THREE.Quaternion()));
    avatarCamera.position.copy(target).add(facingOffset);
    avatarCamera.lookAt(target);
    const background = scene.background;
    scene.background = null;
    avatarRenderer.render(scene, avatarCamera);
    scene.background = background;
  }
});

// Release GPU contexts before a reload replaces this large scene.
let graphicsReleased=false;
const releaseGraphics=()=>{
  if(graphicsReleased)return;graphicsReleased=true;
  for(const context of [renderer,previewRenderer,avatarRenderer]){
    context.setAnimationLoop(null);context.dispose();context.forceContextLoss();
  }
};
window.addEventListener('pagehide',releaseGraphics,{once:true});
