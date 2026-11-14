import { ITEM_BY_ID } from "./catalog";
import type { EquipmentSlot, InventoryItem } from "./types";

// Keep the live equipment map: comparisons must reflect subsequent equipment changes.
export function initializeItemTooltips(equippedItems: ReadonlyMap<EquipmentSlot, string>) {
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
  return hideItemTooltip;
}
