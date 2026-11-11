export type SaveSnapshot = { version: 1; origin: string; capturedAt: string; entries: Record<string, string> };
export const isSaveKey = (key: string) => (key.startsWith('rpg3d.') && !key.startsWith('rpg3d.cloud.')) || key === 'aincrad-sword-socket-v1' || key === 'aincrad-hand-bone-tuning-v1';
export function captureSave(storage: Storage, origin: string): SaveSnapshot {
  const entries: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isSaveKey(key)) entries[key] = storage.getItem(key)!;
  }
  return { version: 1, origin, capturedAt: new Date().toISOString(), entries };
}
export function validateSnapshot(value: unknown): asserts value is SaveSnapshot {
  const snapshot = value as SaveSnapshot;
  if (!snapshot || snapshot.version !== 1 || typeof snapshot.origin !== 'string' || typeof snapshot.capturedAt !== 'string' || !snapshot.entries || typeof snapshot.entries !== 'object' || Array.isArray(snapshot.entries)) throw new Error('Save inválido.');
  for (const [key, entry] of Object.entries(snapshot.entries)) {
    if (!isSaveKey(key) || typeof entry !== 'string') throw new Error('Save contém dados inválidos.');
  }
  const map = JSON.parse(snapshot.entries['rpg3d.worldBuilder.v1'] ?? 'null');
  if (!map || map.version !== 4 || !map.city || !map.assets || !map.terrain || !Array.isArray(map.removedAssets)) throw new Error('Save sem mapa completo.');
}
export function restoreSave(storage: Storage, snapshot: SaveSnapshot, origin: string) {
  validateSnapshot(snapshot);
  const previous = captureSave(storage, origin);
  // Preserve the exact strings before any replacement. A quota failure aborts here.
  const backupKey = `rpg3d.cloud.backup.${Date.now()}.${crypto.randomUUID()}`;
  storage.setItem(backupKey, JSON.stringify(previous));
  try {
    for (const key of Object.keys(previous.entries)) storage.removeItem(key);
    for (const [key, entry] of Object.entries(snapshot.entries)) storage.setItem(key, entry);
  } catch (error) {
    for (const key of Object.keys(snapshot.entries)) storage.removeItem(key);
    storage.removeItem(backupKey);
    for (const [key, entry] of Object.entries(previous.entries)) storage.setItem(key, entry);
    throw error;
  }
}
