import { createClient } from '@supabase/supabase-js';
import { captureSave, restoreSave, validateSnapshot } from './snapshot';

export function mountCloudSaves() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10000';
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    [hidden]{display:none!important}:host{font:14px system-ui;color:#eee}details{background:#201b16;border:1px solid #7b603f;border-radius:10px;padding:12px;width:min(340px,calc(100vw - 56px));box-shadow:0 4px 24px #0008}summary{cursor:pointer;font-weight:bold}form,section{display:grid;gap:8px;margin-top:12px}input,button,select{font:inherit;padding:9px;border-radius:5px;border:1px solid #79664e;background:#30281f;color:#fff;min-width:0}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}p{font-size:12px;line-height:1.5}label{font-size:12px}output{display:block;font-size:12px;margin-top:10px;white-space:pre-wrap}a{color:#edc98d}
  </style><details><summary>Saves na nuvem</summary>
  <p>O save deste navegador continua local. Carregar um backup substitui o estado local somente após confirmação.</p>
  <form><input name="email" type="email" placeholder="E-mail" aria-label="E-mail" autocomplete="username" required><input name="password" type="password" placeholder="Senha" aria-label="Senha" autocomplete="current-password" required minlength="6"><button type="submit">Entrar</button><button type="button" id="signup">Criar conta</button></form>
  <section hidden id="saves"><span id="account"></span><input id="label" maxlength="120" placeholder="Nome do backup" aria-label="Nome do backup"><button id="upload">Salvar agora na nuvem</button><label><input type="checkbox" id="auto"> Backup automático a cada 5 minutos nesta sessão</label><button id="refresh">Atualizar histórico</button><select id="history" aria-label="Backup para carregar"></select><button id="restore">Carregar backup selecionado</button><button id="logout">Sair</button></section>
  <output role="status" aria-live="polite"></output></details>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const status = find<HTMLOutputElement>('output');
  const form = find<HTMLFormElement>('form');
  const section = find<HTMLElement>('#saves');
  const history = find<HTMLSelectElement>('#history');
  const auto = find<HTMLInputElement>('#auto');
  // Keep game keyboard shortcuts from firing while typing in the panel.
  for (const event of ['keydown', 'keyup', 'pointerdown', 'click']) host.addEventListener(event, e => e.stopPropagation());
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) { status.textContent = 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para conectar.'; form.hidden = true; return; }
  const client = createClient(url, key);
  let busy = false;
  let lastUploaded = '';
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = true);
    try { await action(); } catch (error) { status.textContent = `Não foi possível concluir: ${error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)}. Seu save local foi preservado.`; }
    finally { busy = false; root.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = false); }
  }
  async function userId() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Entre na sua conta');
    return data.user.id;
  }
  async function list() {
    const uid = await userId();
    const { data, error } = await client.from('game_saves').select('id,label,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    history.replaceChildren();
    for (const save of data ?? []) {
      const option = document.createElement('option');
      option.value = save.id;
      option.textContent = `${new Date(save.created_at).toLocaleString('pt-BR')} — ${save.label}`;
      history.append(option);
    }
  }
  async function upload(automatic = false) {
    const uid = await userId();
    const payload = captureSave(localStorage, location.origin);
    validateSnapshot(payload);
    const fingerprint = JSON.stringify(payload.entries);
    if (automatic && fingerprint === lastUploaded) return;
    const label = find<HTMLInputElement>('#label').value.trim() || (automatic ? 'Backup automático' : 'Save manual');
    const { error } = await client.from('game_saves').insert({ user_id: uid, label, payload });
    if (error) throw error;
    lastUploaded = fingerprint;
    status.textContent = `Backup salvo às ${new Date().toLocaleTimeString('pt-BR')}.`;
    await list();
  }
  form.onsubmit = event => {
    event.preventDefault();
    void run(async () => {
      const { error } = await client.auth.signInWithPassword({ email: (form.elements.namedItem('email') as HTMLInputElement).value, password: (form.elements.namedItem('password') as HTMLInputElement).value });
      if (error) throw error;
      (form.elements.namedItem('password') as HTMLInputElement).value = '';
      status.textContent = 'Conectado. Escolha salvar o estado local ou carregar um backup.';
      await list();
    });
  };
  find<HTMLButtonElement>('#signup').onclick = () => void run(async () => {
    if (!form.reportValidity()) return;
    const { error } = await client.auth.signUp({ email: (form.elements.namedItem('email') as HTMLInputElement).value, password: (form.elements.namedItem('password') as HTMLInputElement).value });
    if (error) throw error;
    (form.elements.namedItem('password') as HTMLInputElement).value = '';
    status.textContent = 'Conta criada. Se solicitado, confirme o e-mail para entrar.';
  });
  find<HTMLButtonElement>('#upload').onclick = () => void run(() => upload());
  find<HTMLButtonElement>('#refresh').onclick = () => void run(list);
  find<HTMLButtonElement>('#logout').onclick = () => void run(async () => {
    auto.checked = false;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    history.replaceChildren(); status.textContent = 'Desconectado. Save local mantido.';
  });
  find<HTMLButtonElement>('#restore').onclick = () => void run(async () => {
    if (!history.value) throw new Error('Selecione um backup');
    const uid = await userId();
    const { data, error } = await client.from('game_saves').select('payload').eq('user_id', uid).eq('id', history.value).single();
    if (error) throw error;
    validateSnapshot(data.payload);
    if (!window.confirm(`Carregar ${history.selectedOptions[0].textContent}?\nOrigem: ${data.payload.origin}\nO save atual será preservado em um backup local antes da substituição. A página será recarregada.`)) return;
    restoreSave(localStorage, data.payload, location.origin);
    location.reload();
  });
  client.auth.onAuthStateChange((_event, session) => {
    form.hidden = !!session;
    section.hidden = !session;
    // Author CSS uses display:grid, so explicitly override the hidden attribute.
    form.style.display = session ? 'none' : '';
    section.style.display = session ? '' : 'none';
    find<HTMLElement>('#account').textContent = session?.user.email ?? '';
    if (!session) auto.checked = false;
    lastUploaded = '';
  });
  void run(async () => { const { data, error } = await client.auth.getSession(); if (error) throw error; if (data.session) await list(); });
  window.setInterval(() => { if (auto.checked) void run(() => upload(true)); }, 300_000);
}
