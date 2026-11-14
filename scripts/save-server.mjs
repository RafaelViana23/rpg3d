import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export function gameSaveApi(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache:'no-store',headers:{...Object.fromEntries(new Headers(options?.headers)), 'Cache-Control':'no-cache'},signal: AbortSignal.timeout(12_000) }) } }) : null;
  const parseJson=(value,fallback)=>{try{return JSON.parse(value??'');}catch{return fallback;}};
  const inventoryOf=payload=>{try{return JSON.parse(payload?.entries?.['rpg3d.inventory.v1']??'null');}catch{return null;}};
  const claimedQuests=inventory=>new Set([
    ...Object.entries(inventory?.guildQuests??{}).filter(([,value])=>value?.status==='claimed').map(([id])=>id),
    ...Object.entries(inventory?.citizenQuests??{}).filter(([,value])=>value?.status==='claimed').map(([id])=>id),
  ]);
  const eventLabel=id=>id.replace(/^(guild-|citizen-)/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
  const gameplaySummary=payload=>{
    const inventory=inventoryOf(payload)??{};
    return {
      level:Number(inventory.level??1),xp:Number(inventory.xp??0),gold:Number(inventory.gold??0),
      inventory:Object.fromEntries(Object.entries(inventory.quantities??{}).filter(([,quantity])=>Number(quantity)>0)),
      chestInventories:inventory.chestInventories??{},
      equipped:inventory.equipped??{},quickSlots:inventory.quickSlots??[],
      openedChests:parseJson(payload?.entries?.['rpg3d.opened-chests.v1'],[]),
    };
  };
  const recordGameplay=async(event_type,label,payload,event_data={})=>{
    const {error}=await client.from('game_saves').insert({user_id:null,slot:'main',event_type,label,payload,event_data:{...gameplaySummary(payload),...event_data}});
    if(error)throw error;
  };
  return async (req, res, next) => {
    const route=req.url?.split('?')[0];
    if (route !== '/api/game-save'&&route!=='/api/game-save/history'&&route!=='/api/game-save/backup-layout'&&route!=='/api/game-save/archive-backups') return next();
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
      if(route==='/api/game-save/backup-layout'||route==='/api/game-save/archive-backups'){
        if(req.method!=='POST')return reply(405,{error:'Método inválido.'});
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)return reply(413,{error:'Save excede 8 MB.'});chunks.push(chunk);}
        let value;
        try { value=JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return reply(400,{error:'JSON inválido.'}); }
        if(route.endsWith('archive-backups')){
          if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([k,v])=>!k.startsWith('rpg3d.cloud.backup.')||typeof v!=='string'))return reply(400,{error:'Backups inválidos.'});
        }else if(value?.version!==4||!value.city||!value.assets||!value.terrain)return reply(400,{error:'Mapa incompleto.'});
        const directory=resolve('backups','military-relocation');await mkdir(directory,{recursive:true});
        const file=`${route.endsWith('archive-backups')?'archived-backups':'browser'}-${Date.now()}-${randomUUID()}.json`;await writeFile(resolve(directory,file),JSON.stringify(value),{flag:'wx',mode:0o600});
        return reply(200,{ok:true});
      }
      if (route === '/api/game-save/history') {
        if (req.method !== 'GET') return reply(405, { error: 'Método inválido.' });
        const query = new URL(req.url ?? '', 'http://localhost');
        const limit = Math.min(Math.max(Number(query.searchParams.get('limit') ?? 20) || 20, 1), 100);
        const { data, error } = await client.from('rpg_world_history').select('slot,revision,created_at,payload').eq('slot','main').order('revision',{ascending:false}).limit(limit);
        if (error) throw error;
        return reply(200, { history: data ?? [] });
      }
      if (req.method === 'GET') {
        const { data, error } = await client.from('rpg_world_saves').select('revision,payload,updated_at').eq('slot', 'main').maybeSingle();
        if (error) throw error;
        if(data?.payload)await recordGameplay('game_started','Jogo iniciado',data.payload,{revision:data.revision});
        return reply(200, data ? { revision: data.revision, payload: data.payload, updatedAt: data.updated_at } : { revision: 0, payload: null });
      }
      if (req.method !== 'POST') return reply(405, { error: 'Método inválido.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON necessário.' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) return reply(413, { error: 'Save excede 8 MB.' }); chunks.push(chunk); }
      let body;
      try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply(400,{error:'JSON inválido.'}); }
      const { payload, expectedRevision } = body ?? {};
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || payload?.version !== 1 || !payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries) || typeof payload.origin !== 'string') return reply(400, { error: 'Save inválido.' });
      for (const [name, value] of Object.entries(payload.entries)) {
        if (typeof value !== 'string' || !((name.startsWith('rpg3d.') && !name.startsWith('rpg3d.cloud.')) || name.startsWith('aincrad-'))) return reply(400, { error: 'Dados inválidos no save.' });
      }
      let map;
      try { map=JSON.parse(payload.entries['rpg3d.worldBuilder.v1'] ?? 'null'); }
      catch { return reply(400,{error:'Mapa JSON inválido.'}); }
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
      const {data:previousSave,error:previousError}=await client.from('rpg_world_saves').select('payload').eq('slot','main').maybeSingle();
      if(previousError)throw previousError;
      const { data, error } = await client.rpc('write_rpg_world', { p_slot: 'main', p_expected: expectedRevision, p_payload: payload }).retry(false);
      if (error?.code === 'PT409') {
        const directory=resolve('backups','military-relocation');await mkdir(directory,{recursive:true});
        await writeFile(resolve(directory,`save-conflict-${Date.now()}-${randomUUID()}.json`),JSON.stringify({expectedRevision,payload}),{flag:'wx',mode:0o600});
        return reply(409, { error: 'O save foi alterado em outra sessão. Recarregue antes de salvar.' });
      }
      if (error) throw error;
      const previousInventory=inventoryOf(previousSave?.payload),nextInventory=inventoryOf(payload);
      let milestone=false;
      if(nextInventory&&Number(nextInventory.level)>Number(previousInventory?.level??nextInventory.level)){
        milestone=true;
        await recordGameplay('level_up',`Nível ${nextInventory.level} alcançado`,payload,{fromLevel:Number(previousInventory?.level??1),level:Number(nextInventory.level),xp:Number(nextInventory.xp??0),revision:data.revision});
      }
      const beforeClaims=claimedQuests(previousInventory);
      for(const questId of claimedQuests(nextInventory))if(!beforeClaims.has(questId)){
        milestone=true;
        await recordGameplay('quest_completed',`Missão concluída: ${eventLabel(questId)}`,payload,{questId,level:Number(nextInventory?.level??1),revision:data.revision});
      }
      if(!milestone){
        const since=new Date(Date.now()-5*60_000).toISOString();
        const {data:recent,error:recentError}=await client.from('game_saves').select('id').eq('slot','main').eq('event_type','gameplay_checkpoint').gte('created_at',since).limit(1);
        if(recentError)throw recentError;
        if(!recent?.length)await recordGameplay('gameplay_checkpoint','Checkpoint de gameplay',payload,{level:Number(nextInventory?.level??1),xp:Number(nextInventory?.xp??0),worldDay:Number(nextInventory?.worldDay??1),revision:data.revision});
      }
      return reply(200, data);
    } catch (error) {
      console.error('[saves] Falha no banco:', error?.message ?? 'erro desconhecido');
      return reply(503, { error: 'Não foi possível gravar ou carregar o banco. A cópia local foi preservada.' });
    }
  };
}
