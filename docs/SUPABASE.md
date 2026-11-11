# Banco de saves

Projeto Supabase: https://zmeohgrjlflqzyshrgth.supabase.co

## Uso no jogo

- O jogo carrega o JSON do banco antes de importar os módulos de gameplay e montar a cena.
- **Criação → Salvar** grava o mapa completo: cidade, posições, rotações, escalas, terreno e pastas do Build. Aguarde **Salvo no banco**.
- Inventário, progresso e posição persistida do jogador/cavalos são enviados automaticamente a cada cinco segundos enquanto o jogo está aberto. O salvamento automático mantém o último mapa confirmado pelo botão Salvar; não publica edições pendentes do Build.
- Não há painel de login, conta adicional nem seleção manual de backups para jogar.

O navegador mantém um espelho local para continuar funcionando sem rede. Ao abrir com conexão, o banco fornece o estado salvo. Qualquer estado local diferente é preservado antes da substituição em `rpg3d.cloud.backup.<timestamp>.<uuid>`. Edições do Build só ficam confirmadas no banco após clicar em Salvar. Fechar a aba antes de concluir um envio pode deixar mudanças apenas na cópia local.

## Migração executada

Em 11/11/2026, o save existente do Chrome **Rafael (Rafaeal Viana)** em `http://localhost:5173/` foi enviado ao banco automaticamente, antes da inicialização da cena. A migração usou os valores originais do localStorage, sem arredondar coordenadas nem importar defaults ou backups antigos.

O JSON completo anterior ao envio foi preservado em `backups/database-migration/` (ignorado pelo Git). O hash SHA-256 e a origem são registrados pelo servidor. O JSON do mapa no banco foi comparado com essa cópia.

## Servidor e segurança

O Vite e o preview servem `/api/game-save`. Configure `.env.local` no servidor:

```
SUPABASE_URL=https://zmeohgrjlflqzyshrgth.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<credencial de servidor>
```

A configuração já existe neste workspace. Nunca usar prefixo `VITE_` para a credencial de servidor. Ela fica fora do Git e do bundle do navegador.

Este fluxo atende o mundo único de desenvolvimento local. O endpoint aceita somente conexões loopback, host local e origem correspondente. Acesso direto pelo IP da rede é recusado para saves. Para publicar o jogo em um servidor público, adicionar autenticação/autorização do servidor antes de expor esse endpoint. Hospedagem apenas estática não executa a API; `npm run preview` executa a API local junto do build.

`rpg_world_saves` contém o estado atual do slot `main`. `rpg_world_history` preserva cada mudança de mapa e checkpoints de progresso a cada cinco minutos. As gravações passam por `write_rpg_world`, em uma transação com trava e revisão esperada. Duas abas não sobrescrevem silenciosamente o mesmo save: a segunda recebe conflito e precisa recarregar. A cópia local permanece preservada.

As tabelas têm RLS e nenhum acesso concedido às funções anon/authenticated. Apenas o backend usa a credencial privilegiada. A antiga tabela `game_saves`, criada na primeira implementação, permanece preservada, mas não é usada por este fluxo.

Os snapshots incluem todas as chaves do jogo `rpg3d.*` e `aincrad-*`, preservadas como strings exatas. Tokens de autenticação e backups internos `rpg3d.cloud.*` não entram no banco.

## Verificação

- `npm run build`
- `npm run validate:saves`: migração, precisão, isolamento de tokens, carregamento inicial, mapa manual/progresso automático, falha offline, restauração e concorrência.
- Verificação real: botão Salvar no mesmo Chrome/origem, confirmação visual e leitura do JSON gravado. Acesso anônimo, origem externa e gravação com revisão desatualizada devem ser recusados.
