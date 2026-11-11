export type RuntimeTransform = { position: [number, number, number]; rotationY: number };
export type RuntimeWorldState = { player?: RuntimeTransform; horse?: RuntimeTransform; horses?: Record<string,RuntimeTransform>; cameraOffset?: [number, number, number] };

export const validPosition = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

export class RuntimeWorldStore {
  readonly state: RuntimeWorldState;
  constructor(private readonly storageKey: string) {
    try { this.state = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as RuntimeWorldState; }
    catch { this.state = {}; }
  }
  save() { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); }
}
