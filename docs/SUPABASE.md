# Saves no Supabase

Projeto: https://zmeohgrjlflqzyshrgth.supabase.co

## Ativação

A migração `202611110001` já foi aplicada ao projeto remoto em 11/11/2026 pelo CLI. Leitura e escrita sem login foram verificadas e recusadas. A verificação com duas contas e o primeiro envio do save aprovado ainda dependem de login no jogo.

1. Para um projeto novo, executar `supabase link --project-ref <ref>` e `supabase db push`; a migração está em `supabase/migrations/202611110001_game_saves.sql`. No projeto atual, ela já está aplicada.
2. Copiar `.env.example` para `.env.local` e reiniciar o Vite na mesma origem e perfil do navegador já usados. A configuração local já foi criada neste workspace.
3. No jogo, abrir **Saves na nuvem**, criar conta ou entrar com e-mail e senha. Confirmar o e-mail se o projeto exigir.
4. No perfil Chrome Rafael e endereço `http://localhost:5173/` aprovados, escolher **Salvar agora na nuvem** para enviar o save atual. Nenhum arquivo default ou backup antigo é importado automaticamente.

A publishable key é pública e pode ir no frontend; nunca configurar `service_role`, `sb_secret_*` ou senha de banco em variáveis `VITE_*`.

## Dados e recuperação

Os snapshots preservam os valores originais do localStorage, sem arredondar coordenadas: mapa, terreno, objetos, inventário, progresso, posições persistidas do jogador/cavalos, configurações e marcadores de migração `rpg3d.*`, além das duas calibrações `aincrad-*`. Tokens de autenticação e backups internos ficam de fora.

O banco mantém registros imutáveis por usuário. Não há sobrescrita entre abas ou dispositivos. O histórico mostra os últimos 100 backups; registros anteriores continuam no banco. O backup automático é opcional, a cada cinco minutos enquanto a página permanece aberta; fechar a página não garante um último envio. Sem internet, o save continua local e o próximo intervalo tenta novamente.

Entrar nunca baixa ou substitui o save. Para carregar, selecionar um backup no histórico e confirmar a origem e data. O estado anterior é preservado em `localStorage` sob `rpg3d.cloud.backup.<timestamp>` antes da substituição. Falha de espaço impede a restauração ou desfaz as alterações. A página recarrega na mesma URL, com os carregadores e migrações já existentes do jogo.

Para recuperar um backup local, no console do mesmo navegador/origem: listar `Object.keys(localStorage).filter(k => k.startsWith('rpg3d.cloud.backup.'))`, ler o JSON da chave desejada e preservar/exportar esse JSON antes de qualquer ação. Não substituir coordenadas sem identificar qual é o save aprovado.

## Segurança e verificação

A tabela `game_saves` usa RLS: apenas usuários autenticados podem inserir e ler seus próprios registros. Não há permissões de atualização nem exclusão pelo cliente. Não compartilhar contas entre jogadores.

Verificações locais: `npm run build` e `node scripts/validate-cloud-saves.mjs`.

Verificação após aplicar o SQL: criar duas contas; enviar um backup em cada uma; confirmar que cada histórico mostra apenas os próprios registros. Carregar um backup escolhido e verificar mapa/inventário/posições na origem correta. Testar offline e confirmar que os saves locais continuam funcionando.
