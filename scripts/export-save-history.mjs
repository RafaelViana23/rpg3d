import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const revision = Number(process.argv[2]);
if (!Number.isSafeInteger(revision) || revision < 1) {
  console.error('Uso: node scripts/export-save-history.mjs REVISAO [arquivo.json]');
  process.exit(2);
}
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários.');
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.from('rpg_world_history').select('payload').eq('slot','main').eq('revision',revision).maybeSingle();
if (error) throw error;
if (!data) throw new Error(`Revisão ${revision} não encontrada.`);
const output = process.argv[3] ?? `backups/history-${revision}.json`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data.payload, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Exportada revisão ${revision} para ${output}. Importe pelo Build e salve explicitamente para restaurar.`);
