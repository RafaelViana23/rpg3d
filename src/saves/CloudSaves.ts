import { captureSave, fingerprint, restoreSave, validateSnapshot, type SaveSnapshot } from './snapshot';

const META_KEY = 'rpg3d.cloud.database.v1';
const MAP_KEYS = ['rpg3d.worldBuilder.v1', 'rpg3d.buildFolders.v1'];
type RemoteSave = { revision: number; payload: SaveSnapshot | null };
type SaveOptions = { storage: Storage; origin: string; request: typeof fetch };

/** Local storage is the synchronous/offline mirror. Supabase holds the committed world. */
export class DatabaseSaves {
  private revision: number | null = null;
  private committed: Record<string, string> = {};
  private lastSaved = '';
  private pending: Promise<void> | null = null;
  private ready = false;
  private conflict = false;
  constructor(private options: SaveOptions) {}

  private async request(method: 'GET' | 'POST', body?: unknown) {
    const response = await this.options.request('/api/game-save', {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) this.conflict = true;
      throw new Error(result.error || 'Banco indisponível. O save local foi preservado.');
    }
    return result;
  }

  async initialize() {
    if (this.ready) return;
    const { storage, origin } = this.options;
    const local = captureSave(storage, origin);
    const remote = await this.request('GET') as RemoteSave;
    if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw new Error('Revisão inválida no banco.');
    this.revision = remote.revision;
    if (remote.payload) {
      validateSnapshot(remote.payload);
      if (fingerprint(local.entries) !== fingerprint(remote.payload.entries)) {
        // Preserve local/offline work before loading the committed world on startup.
        restoreSave(storage, remote.payload, origin);
      }
      this.committed = { ...remote.payload.entries };
      this.lastSaved = fingerprint(remote.payload.entries);
      this.recordRevision();
    } else if (local.entries['rpg3d.worldBuilder.v1']) {
      // Migrate only an actual existing browser save, before the scene can seed defaults.
      validateSnapshot(local);
      await this.write(local);
    }
    this.ready = true;
  }

  private recordRevision() {
    this.options.storage.setItem(META_KEY, JSON.stringify({ revision: this.revision, savedAt: new Date().toISOString() }));
  }

  private async write(payload: SaveSnapshot) {
    validateSnapshot(payload);
    const result = await this.request('POST', { expectedRevision: this.revision, payload });
    this.revision = result.revision;
    this.committed = { ...payload.entries };
    this.lastSaved = fingerprint(payload.entries);
    this.recordRevision();
  }

  hasMapChanges() {
    return MAP_KEYS.some(key => this.options.storage.getItem(key) !== (this.committed[key] ?? null));
  }

  /** Map edits are committed only by the Build Save button; runtime saves preserve that map. */
  async save(includeMap = false): Promise<void> {
    if (this.pending) { await this.pending; return this.save(includeMap); }
    const action = async () => {
      if (this.conflict) throw new Error('Outra sessão alterou o banco. Recarregue o jogo; a cópia local está preservada.');
      if (!this.ready) {
        // Do not hydrate over a running scene after an offline start.
        const remote = await this.request('GET') as RemoteSave;
        const meta = JSON.parse(this.options.storage.getItem(META_KEY) ?? 'null');
        if (remote.revision && remote.revision !== meta?.revision) {
          this.conflict = true;
          throw new Error('O banco tem outro save. Recarregue o jogo para carregar o mapa salvo.');
        }
        this.revision = remote.revision;
        if (remote.payload) { validateSnapshot(remote.payload); this.committed = { ...remote.payload.entries }; }
        this.ready = true;
      }
      const payload = captureSave(this.options.storage, this.options.origin);
      if (!includeMap) {
        if (!this.committed['rpg3d.worldBuilder.v1']) return;
        for (const key of MAP_KEYS) {
          if (key in this.committed) payload.entries[key] = this.committed[key];
          else delete payload.entries[key];
        }
      }
      if (fingerprint(payload.entries) === this.lastSaved) return;
      await this.write(payload);
    };
    this.pending = action();
    try { await this.pending; } finally { this.pending = null; }
  }
}

let database: DatabaseSaves;
export async function initializeDatabaseSaves() {
  database = new DatabaseSaves({ storage: localStorage, origin: location.origin, request: window.fetch.bind(window) });
  try { await database.initialize(); }
  catch (error) { console.error('[saves] Banco indisponível ao abrir. Usando a cópia local preservada.', error); }
}

export function connectDatabaseSaveButton(beforeSave: () => void) {
  const button = document.querySelector<HTMLButtonElement>('[data-build-save]')!;
  const status = document.querySelector<HTMLOutputElement>('[data-build-save-status]')!;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Salvando…';
    try { beforeSave(); await database.save(true); status.textContent = 'Salvo no banco'; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Falha ao salvar. Cópia local preservada.'; }
    finally { button.disabled = false; }
  });
  const autoSave = () => {
    if (!button.disabled && database.hasMapChanges()) status.textContent = 'Alterações não salvas';
    void database.save().catch(error => console.error('[saves] Salvamento pendente; cópia local preservada.', error));
  };
  window.setInterval(autoSave, 5_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoSave(); });
}
