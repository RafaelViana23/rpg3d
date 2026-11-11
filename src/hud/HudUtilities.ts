export function setBarPercent(selector: string, value: number) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.style.width = `${Math.min(100, Math.max(0, value))}%`;
}

export function setHudStatus(text: string) {
  const status = document.querySelector<HTMLElement>("#playStatus span");
  if (status && status.textContent !== text) status.textContent = text;
}
