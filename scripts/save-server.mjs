import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export function gameSaveApi(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(12_000) }) } }) : null;
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/game-save') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); };
    // This single-player administration endpoint is local, never a public write API.
    const address = req.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reply(403, { error: 'Acesso local necessário.' });
    const host = req.headers.host ?? '';
    const hostname = host.replace(/:\d+$/, '');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return reply(403, { error: 'Host inválido.' });
    if (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`) return reply(403, { error: 'Origem inválida.' });
    if (!client) return reply(503, { error: 'Banco não configurado no servidor.' });
    try {
      if (req.method === 'GET') {
        const { data, error } = await client.from('rpg_world_saves').select('revision,payload,updated_at').eq('slot', 'main').maybeSingle();
        if (error) throw error;
        return reply(200, data ? { revision: data.revision, payload: data.payload, updatedAt: data.updated_at } : { revision: 0, payload: null });
      }
      if (req.method !== 'POST') return reply(405, { error: 'Método inválido.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON necessário.' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) return reply(413, { error: 'Save excede 8 MB.' }); chunks.push(chunk); }
      const { payload, expectedRevision } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || payload?.version !== 1 || !payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries) || typeof payload.origin !== 'string') return reply(400, { error: 'Save inválido.' });
      for (const [name, value] of Object.entries(payload.entries)) {
        if (typeof value !== 'string' || !((name.startsWith('rpg3d.') && !name.startsWith('rpg3d.cloud.')) || name.startsWith('aincrad-'))) return reply(400, { error: 'Dados inválidos no save.' });
      }
      const map = JSON.parse(payload.entries['rpg3d.worldBuilder.v1'] ?? 'null');
      if (map?.version !== 4 || !map.city || !map.assets || !map.terrain || !Array.isArray(map.removedAssets)) return reply(400, { error: 'Mapa incompleto.' });
      // A disk copy is mandatory before the first migration; no default/backup is seeded.
      if (expectedRevision === 0) {
        const json = JSON.stringify(payload);
        const hash = createHash('sha256').update(json).digest('hex');
        const directory = resolve('backups', 'database-migration');
        await mkdir(directory, { recursive: true });
        await writeFile(resolve(directory, `${Date.now()}-${randomUUID()}.json`), json, { flag: 'wx', mode: 0o600 });
        console.info(`[saves] Migração preservada: origem=${payload.origin} sha256=${hash}`);
      }
      const { data, error } = await client.rpc('write_rpg_world', { p_slot: 'main', p_expected: expectedRevision, p_payload: payload }).retry(false);
      if (error?.code === 'PT409') return reply(409, { error: 'O save foi alterado em outra sessão. Recarregue antes de salvar.' });
      if (error) throw error;
      return reply(200, data);
    } catch (error) {
      console.error('[saves] Falha no banco:', error?.message ?? 'erro desconhecido');
      return reply(503, { error: 'Não foi possível gravar ou carregar o banco. A cópia local foi preservada.' });
    }
  };
}
