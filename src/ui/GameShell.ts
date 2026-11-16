import { INVENTORY_CATALOG } from "../inventory/catalog";
import { clothPantsColor } from "../inventory/clothColors";
import type { InventoryItem } from "../inventory/types";
import type { BroomRideNode } from "../animation/AnimationController";
import { ARENA_REGIONS } from "../world/OpenWorld";

// Called at the original bootstrap point, before any viewport queries or listeners.
export function initializeGameShell(app: HTMLDivElement) {
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
        <div class="hud-crest" aria-label="Nível"><b id="hudLevel">1</b></div>
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
        <header><strong>Bainha e escudo</strong><kbd>L</kbd></header>
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
        <small data-bow-status>Arco · mão esquerda</small>
        <fieldset><legend>Posição do arco</legend>
          <label><b>X</b><input data-bow-position="0" type="number" step="0.01"></label><label><b>Y</b><input data-bow-position="1" type="number" step="0.01"></label><label><b>Z</b><input data-bow-position="2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação do arco</legend>
          <label><b>X</b><input data-bow-rotation="0" type="number" step="1"></label><label><b>Y</b><input data-bow-rotation="1" type="number" step="1"></label><label><b>Z</b><input data-bow-rotation="2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Tamanho do arco</legend><label><b>Esc</b><input data-bow-scale type="number" min="0.1" step="0.05"></label></fieldset>
        <small data-quiver-status>Aljava · costas</small>
        <fieldset><legend>Posição da mochila</legend>
          <label><b>X</b><input data-quiver-position="0" type="number" step="0.01"></label><label><b>Y</b><input data-quiver-position="1" type="number" step="0.01"></label><label><b>Z</b><input data-quiver-position="2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação da mochila</legend>
          <label><b>X</b><input data-quiver-rotation="0" type="number" step="1"></label><label><b>Y</b><input data-quiver-rotation="1" type="number" step="1"></label><label><b>Z</b><input data-quiver-rotation="2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Tamanho da aljava</legend><label><b>Esc</b><input data-quiver-scale type="number" min="0.1" step="0.05"></label></fieldset>
        <small data-shield-status="right">Escudo · Mão esquerda</small>
        <fieldset><legend>Posição do escudo</legend>
          <label><b>X</b><input data-shield-position="right-0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-shield-position="right-1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-shield-position="right-2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação do escudo</legend>
          <label><b>X</b><input data-shield-rotation="right-0" type="number" step="1"></label>
          <label><b>Y</b><input data-shield-rotation="right-1" type="number" step="1"></label>
          <label><b>Z</b><input data-shield-rotation="right-2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Tamanho do escudo</legend><label><b>Escala</b><input data-shield-scale="right" type="number" min="0.1" step="0.05"></label></fieldset>
        <button type="button" data-shield-reset="right">Restaurar escudo</button>
        <small data-shield-status="left">Escudo · Mão direita</small>
        <fieldset><legend>Posição do escudo</legend>
          <label><b>X</b><input data-shield-position="left-0" type="number" step="0.01"></label>
          <label><b>Y</b><input data-shield-position="left-1" type="number" step="0.01"></label>
          <label><b>Z</b><input data-shield-position="left-2" type="number" step="0.01"></label>
        </fieldset>
        <fieldset><legend>Rotação do escudo</legend>
          <label><b>X</b><input data-shield-rotation="left-0" type="number" step="1"></label>
          <label><b>Y</b><input data-shield-rotation="left-1" type="number" step="1"></label>
          <label><b>Z</b><input data-shield-rotation="left-2" type="number" step="1"></label>
        </fieldset>
        <fieldset><legend>Tamanho do escudo</legend><label><b>Escala</b><input data-shield-scale="left" type="number" min="0.1" step="0.05"></label></fieldset>
        <button type="button" data-shield-reset="left">Restaurar escudo</button>
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
      <section class="world-map" id="worldMap" aria-hidden="true"><header><strong>Mapa da Cidade</strong><span id="mapPhase">Manhã</span><button type="button" aria-label="Fechar mapa">×</button></header><div class="city-map-layout"><canvas width="720" height="520"></canvas><aside class="district-legend" aria-label="Legenda dos distritos"></aside></div><small>Você ▲ · Especiais ✦ · Caça ● · Cavalo ◆ · Cores: distritos</small></section>
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
      <section class="corpse-loot" id="corpseLoot" role="dialog" aria-labelledby="corpseLootTitle" aria-hidden="true">
        <header><div><small>INVESTIGAR</small><strong id="corpseLootTitle">Itens encontrados</strong></div><kbd>E</kbd></header>
        <div id="corpseLootItems"></div>
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
            <nav class="inventory-main-nav"><button type="button" data-open-build>Criação</button><button class="active" type="button" id="inventoryTitle" data-inventory-tab="player" data-main-tab="inventory">Inventário</button><span>Habilidades</span><button type="button" data-inventory-tab="map" data-main-tab="map">Mapa</button><button type="button" data-inventory-tab="quests" data-main-tab="quests">Missões</button><button type="button" data-inventory-tab="settings" data-main-tab="settings">Configurações</button></nav>
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
              <div class="inventory-avatar" id="inventoryAvatar"><canvas aria-label="Avatar 3D ao vivo"></canvas></div>
              <section class="inventory-consumables" aria-label="Consumíveis"><strong>Consumíveis rápidos <small>Selecione um slot e escolha no inventário</small></strong><div class="consumable-grid">${quickSlots}</div></section>
            </div>
            <aside class="equipment-slots" aria-label="Itens equipados">
              <button data-equip-slot="head" draggable="true"><span></span><small>Capacete</small></button><button data-equip-slot="accessory" draggable="true"><span></span><small>Acessório</small></button>
              <button data-equip-slot="torso" draggable="true"><span></span><small>Roupa</small></button><button data-equip-slot="armor" draggable="true"><span></span><small>Armadura</small></button>
              <button data-equip-slot="legs" draggable="true"><span></span><small>Pernas</small></button><button data-equip-slot="gloves" draggable="true"><span></span><small>Luvas</small></button>
              <button data-equip-slot="boots" draggable="true"><span></span><small>Botas</small></button><span class="equipment-slot-spacer" aria-hidden="true"></span>
              <button class="hand-slot" data-equip-slot="leftHand" draggable="true"><span></span><small>Mão esquerda</small></button><button class="hand-slot" data-equip-slot="rightHand" draggable="true"><span></span><small>Mão direita</small></button>
            </aside>
            <div class="inventory-items">
              <div class="inventory-section-title"><span>Inventário</span><small id="inventoryCount">58 itens</small></div>
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
          <section class="inventory-panel inventory-quests-page" data-inventory-panel="quests" aria-label="Missões"><h2>Missões</h2></section>
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
        <div class="build-toolbar" role="toolbar"><button class="active" type="button" data-build-tool="translate" title="Mover (W)">↔ <span>Mover</span></button><button type="button" data-build-tool="rotate" title="Girar (E)">⟳ <span>Girar</span></button><button type="button" data-build-tool="scale" title="Escalar (R)">⤢ <span>Escalar</span></button><button type="button" data-build-space>Local</button><button class="active" type="button" data-build-grid title="Mostrar ou ocultar a grade do chão"># Grade</button></div>
        <div class="build-history" role="toolbar" aria-label="Histórico e arquivo"><button type="button" data-build-save title="Gravar o mundo atual no banco de dados">Salvar mundo</button><output data-build-save-status role="status" aria-live="polite"></output><button type="button" data-build-undo title="Desfazer (Ctrl+Z)">↶ Desfazer</button><button type="button" data-build-redo title="Refazer (Ctrl+Shift+Z)">↷ Refazer</button><button type="button" data-build-duplicate title="Duplicar (Ctrl+D)">⧉ Duplicar</button><button type="button" data-build-export>Exportar JSON</button><button type="button" data-build-import>Importar JSON</button><input type="file" accept="application/json" data-build-import-file hidden></div>
        <nav class="build-tabs" aria-label="Seções do editor"><button class="active" data-build-tab="objects">Objetos</button><button data-build-tab="terrain">Terreno</button><button data-build-tab="world">Mundo</button></nav>
        <div class="build-panel-scroll">
        <div class="build-tab-panel" data-build-panel="terrain">
        <section class="terrain-editor">
          <header><span>Terreno low poly</span><button type="button" data-terrain-toggle>Ativar pincel</button></header>
          <div class="terrain-tools" role="toolbar">
            <button class="active" data-terrain-mode="paint">Pintar terreno</button>
          </div>
          <div class="terrain-paint-presets" role="toolbar" aria-label="Pincéis de bioma">
            <button class="active" type="button" data-terrain-paint="grass"><i></i>Grama</button>
            <button type="button" data-terrain-paint="snow"><i></i>Neve</button>
          </div>
          <label>Material <select data-terrain-material><option value="grass">Grama</option><option value="dirt">Terra</option><option value="sand">Areia</option><option value="stone">Pedra</option><option value="snow">Neve</option></select></label>
          <div data-forest-brush-options hidden aria-hidden="true">
            <label>Assets <select data-forest-brush-kind><option value="grass">Só grama</option><option value="rocks">Só pedras</option></select></label>
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
  return broomRideNodes;
}
