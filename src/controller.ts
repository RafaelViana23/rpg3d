import "./controller.css";
import "./controller-alignment.css";

type ControllerMessage =
  | { type: "key"; code: string; down: boolean }
  | { type: "camera"; dx: number; dy: number }
  | { type: "action"; action: "cross" | "start" | "triangle"; down: boolean };

const send = (message: ControllerMessage) => import.meta.hot?.send("rpg:controller-input", message);
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

const bindPress = (button: HTMLButtonElement, onDown: () => void, onUp: () => void) => {
  button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add("pressed"); navigator.vibrate?.(10); onDown(); });
  const release = (event: PointerEvent) => { event.preventDefault(); button.classList.remove("pressed"); onUp(); };
  button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release);
};
document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => bindPress(button, () => send({ type: "key", code: button.dataset.key!, down: true }), () => send({ type: "key", code: button.dataset.key!, down: false })));
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => bindPress(button, () => send({ type: "action", action: button.dataset.action as "cross" | "start" | "triangle", down: true }), () => send({ type: "action", action: button.dataset.action as "cross" | "start" | "triangle", down: false })));

const moveStick = document.querySelector<HTMLElement>('[data-stick="move"]')!, moveKnob = moveStick.querySelector<HTMLElement>("span")!;
let movePointer: number | null = null, moveKeys = new Set<string>();
const move = (event: PointerEvent) => {
  const rect = moveStick.getBoundingClientRect(); let x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
  const radius = rect.width * .31, length = Math.hypot(x, y) || 1, scale = Math.min(1, radius / length); x *= scale; y *= scale; moveKnob.style.transform = `translate(${x}px,${y}px)`;
  const threshold = radius * .34, next = new Set<string>(); if (y < -threshold) next.add("KeyW"); if (y > threshold) next.add("KeyS"); if (x < -threshold) next.add("KeyA"); if (x > threshold) next.add("KeyD");
  moveKeys.forEach((code) => { if (!next.has(code)) send({ type: "key", code, down: false }); }); next.forEach((code) => { if (!moveKeys.has(code)) send({ type: "key", code, down: true }); }); moveKeys = next;
};
const stopMove = () => { moveKeys.forEach((code) => send({ type: "key", code, down: false })); moveKeys.clear(); moveKnob.style.transform = "translate(0,0)"; movePointer = null; };
moveStick.addEventListener("pointerdown", (event) => { event.preventDefault(); movePointer = event.pointerId; moveStick.setPointerCapture(event.pointerId); moveStick.classList.add("active"); move(event); });
moveStick.addEventListener("pointermove", (event) => { if (event.pointerId === movePointer) move(event); }); moveStick.addEventListener("pointerup", () => { moveStick.classList.remove("active"); stopMove(); }); moveStick.addEventListener("pointercancel", stopMove);

const cameraStick = document.querySelector<HTMLElement>('[data-stick="camera"]')!, cameraKnob = cameraStick.querySelector<HTMLElement>("span")!;
let cameraPointer: number | null = null, lastX = 0, lastY = 0, cameraDx = 0, cameraDy = 0, cameraFrame = 0;
const flushCamera = () => { cameraFrame = 0; if (cameraDx || cameraDy) send({ type: "camera", dx: cameraDx, dy: cameraDy }); cameraDx = 0; cameraDy = 0; };
cameraStick.addEventListener("pointerdown", (event) => { event.preventDefault(); cameraPointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; cameraStick.setPointerCapture(event.pointerId); cameraStick.classList.add("active"); });
cameraStick.addEventListener("pointermove", (event) => { if (event.pointerId !== cameraPointer) return; cameraDx += event.clientX - lastX; cameraDy += event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; if (!cameraFrame) cameraFrame = requestAnimationFrame(flushCamera); const rect = cameraStick.getBoundingClientRect(), radius = rect.width * .29, rawX = event.clientX - rect.left - rect.width / 2, rawY = event.clientY - rect.top - rect.height / 2, length = Math.hypot(rawX, rawY) || 1, scale = Math.min(1, radius / length); cameraKnob.style.transform = `translate(${rawX * scale}px,${rawY * scale}px)`; });
const stopCamera = () => { if (cameraFrame) cancelAnimationFrame(cameraFrame); flushCamera(); cameraPointer = null; cameraKnob.style.transform = "translate(0,0)"; cameraStick.classList.remove("active"); };
cameraStick.addEventListener("pointerup", stopCamera); cameraStick.addEventListener("pointercancel", stopCamera);

window.addEventListener("blur", () => { stopMove(); stopCamera(); });
