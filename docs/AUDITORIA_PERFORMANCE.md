# Auditoria de performance do RPG 3D

Data: 12 de novembro de 2026. O jogo ainda não atende à meta de 60 FPS na vista externa observada. Há custo significativo tanto na simulação dos moradores quanto na submissão da cena ao renderizador. Foram aplicadas otimizações em consultas espaciais, navegação, carregamento e interface, mantendo o mapa e a política atual de iluminação.

## Medição no jogo

Sessão existente do Chrome Rafael (Rafaeal Viana), em `http://localhost:5173/`, no Distrito Residencial, qualidade Baixa. A sessão foi reutilizada; nenhum backup ou default substituiu o save.

| Indicador | Primeira amostra |
|---|---:|
| FPS | 17 |
| Chamadas de desenho | 2181 |
| Triângulos | 696658 |
| Geometrias na GPU | 1316 |
| Texturas | 248 |
| Heap JavaScript | 666 MB |
| Luzes pontuais visíveis | 40 |
| Programas de shader | 114 |
| Maior intervalo entre frames da janela | 83 ms |
| Moradores, pico na janela | 28,8 ms |
| Consultas de altura dos moradores, pico | 21,2 ms |
| Colisões dos moradores, pico | 7,4 ms |
| Renderização, pico de CPU | 36,8 ms |

Os picos de etapas podem ocorrer em frames diferentes e não devem ser somados. O tempo de `renderer.render` mede trabalho no lado da CPU, incluindo eventuais esperas do driver; não é uma medição isolada do tempo da GPU. A meta de 60 FPS exige um frame completo em aproximadamente 16,7 ms.

Uma amostra intermediária após as primeiras correções mostrou 20 FPS, 2076 chamadas, 641246 triângulos e pico de moradores de 13 ms. Carregamento, horário e população ativa variaram entre amostras: esses números não constituem um benchmark A/B nem comprovam ganho percentual. O painel antigo também subcontava consultas executadas por rotas retomadas em frames posteriores; essa atribuição foi corrigida.

Na leitura final, já à noite, duas amostras consecutivas mostraram **23 e 18 FPS**, P95 de **66,7 ms**, cerca de **2066 a 2081 chamadas**, **40 luzes** e **215 shaders**. A janela móvel continha de 55 a 60 intervalos acima de 50 ms em 300 frames. Os picos de renderização foram de 35,5 a 42,5 ms e os de colisão de NPCs chegaram a 17,6 ms. A carga de geometrias e texturas continuou crescendo durante a sessão; não há base para declarar 60 FPS nem um ganho percentual consolidado.

## Correções aplicadas

- **Pisos caminháveis:** cada célula espacial passou a armazenar somente as superfícies que a intersectam. Antes, a presença do palácio em uma célula fazia a consulta percorrer todas as superfícies do prédio. Recortes por polígonos, altura dos degraus, transforms e invalidação do cache foram preservados.
- **Reconstrução de caminhos:** a etapa que calculava as alturas de todos os pontos de uma rota passou a ceder execução entre pontos. O limite de tempo do gerenciador consegue interromper também essa etapa, evitando concluir uma rota longa inteira dentro de uma chamada.
- **Colisões:** rejeição conservadora por limites mundiais antes da transformação para o espaço local, para estruturas sem inclinação. Estruturas inclinadas mantêm o caminho anterior. A seleção de candidatos e a ordem de resolução foram mantidas.
- **Escadas da fundação:** cache da matriz inversa e dos limites, invalidado quando a matriz mundial muda. As consultas reutilizam um vetor. O descarte pelos limites se restringe a escadas sem inclinação, preservando a semântica anterior nas demais rotações.
- **Escritório da pousada:** a escala mundial é obtida uma vez por preparação da restrição, em vez de recalculada para cada NPC e tentativa de colisão.
- **Fila de props:** a admissão continua em todo frame, com duas tarefas por chamada. A ordenação por distância ocorre a cada 250 ms ou após deslocamento superior a dois metros, reduzindo ordenações repetidas durante a carga.
- **Relógio da interface:** os textos mudam somente quando o minuto, dia ou período exibido muda; os elementos dos mapas ficam referenciados, sem nova busca por seletor a cada frame.
- **Retrato do inventário:** limitado a 30 atualizações por segundo enquanto aberto. O retrato já usa camadas para selecionar o personagem; continua compartilhando o modelo e os materiais reais.
- **Simulação em frequência reduzida:** o tempo consumido corresponde aos passos completos acumulados. A fração restante não é contabilizada novamente na próxima atualização de cavalos e vida marinha.
- **Diagnóstico:** janela móvel de até 300 frames com P95 e contagem de intervalos acima de 50 ms. Tempos das etapas explicitamente identificados como picos. Callbacks estáveis atribuem o trabalho das rotas ao frame em que ele realmente ocorre.

## Instâncias das estruturas repetidas

Foi acrescentado `src/editor/CityStructureInstances.ts`. Durante o desenho do mundo, malhas rígidas diretamente vinculadas aos prédios podem compartilhar uma chamada por geometria, material, estado de sombra e região de 64 metros. Os modelos e materiais originais são reutilizados. Portas, hierarquias animadas, transparências, callbacks próprios, materiais de profundidade personalizados, matrizes espelhadas e transforms com cisalhamento ficam fora do agrupamento.

Os objetos originais são ocultados apenas durante a chamada de renderização e restaurados em `finally`, inclusive em caso de erro. No Build o renderizador usa os objetos individuais. A otimização não modifica posições salvas, colisões ou hierarquia de seleção. Instâncias acompanham os estados de sombra dos originais, e a revisão de emissores de sombra ignora as cópias de desenho.

O teste com as geometrias e materiais reais das 141 casas do mapa padrão agrupou 834 malhas em 168 grupos, economizando potencialmente 666 submissões se todos esses objetos participarem da mesma passagem. A câmera e o descarte por região determinam a economia efetiva de cada frame. Essa contagem não é um benchmark de FPS e não foi medida no save aberto nesta etapa. A aparência final e o desempenho de GPU ainda precisam de validação no navegador.

`node scripts/validate-city-structure-instances.mjs` verifica transforms mundiais, materiais, sombras, modo Build, exclusão de portas e vidro, recuperação após erro, visibilidade e preservação de geometrias e materiais compartilhados ao liberar instâncias.

## Interiores preparados pela entrada

A decoração importada passa a aguardar aproximação da entrada antes do download do template. A admissão das instâncias aguarda porta aberta próxima, entrada do jogador ou inspeção regional no Build. Depois de carregada, a decoração é mantida em cache e fica fora da renderização quando o interior está fechado e desocupado. Fechar a porta com o jogador dentro mantém o interior ativo; em outro interior, somente o ocupado permanece ativo.

Os grupos de props são separados entre interior e exterior antes do batching. Barris do pátio, fachadas, folhas das portas, pisos e tetos permanecem independentes. Balcões, mercadorias, tapetes, candelabros e móveis procedurais registrados também obedecem à visibilidade do interior. Camas procedurais continuam sendo preparadas antecipadamente para preservar âncoras de sono e dados físicos dos moradores. Geometria decorativa já fundida à estrutura do prédio permanece com a estrutura, preservando seus tetos e sombras reais.

A atualização segue a abertura e o fechamento das portas no loop do jogo. A política existente de emissores diretos próprios e alternância interior/exterior foi mantida. As miniaturas do Build restauram a visibilidade da cópia dos objetos reais, incluindo decoração temporariamente oculta.

`node scripts/validate-city-interior-streaming.mjs` verifica adiamento de download distante, preparação perto da entrada, ativação pela porta, permanência enquanto ocupado, ocultação ao sair, cache na reabertura, separação de pátio/interior, miniaturas e manutenção de estrutura e transforms. O ganho de FPS ainda não foi medido no navegador após esta mudança.

## Renderização e iluminação

A vista observada ultrapassa duas mil chamadas de desenho mesmo na qualidade baixa. O agrupamento de estruturas repetidas foi implementado conforme descrito acima; a redução efetiva de chamadas precisa ser medida na câmera do jogador. O projeto já agrupa irmãos estáticos, props por prédio e vegetação distante; qualquer novo agrupamento precisa identificar os grupos que permanecem separados e preservar portas, animações, materiais e edição.

As 40 luzes exteriores permanecem como emissores diretos próprios, sem sombras. O shader já evita o cálculo completo da contribuição fora do alcance de cada luz. A contagem de luzes ainda participa dos programas de shader e o custo de avaliar emissores permanece; a medição atual não separa esse custo do restante da renderização. Não foi introduzido pool, limite por proximidade, desligamento à distância ou redução global da luz ambiente.

Sol e Lua usam sombras reais. O código atual atualiza sombras continuamente e revisa emissores de sombra locais a cada meio segundo. Reduzir a frequência dos mapas de sombra exige medir movimento, portas e ciclo solar para evitar sombras atrasadas ou luz atravessando os tetos.

## Carregamento e memória

A pasta de modelos ocupa aproximadamente 62 MiB em disco. Isso não equivale ao volume transferido na abertura: há caches, peças selecionadas e carregamento sob demanda.

| Arquivo | Tamanho em bytes | Malhas no arquivo | Materiais |
|---|---:|---:|---:|
| medieval-market.glb | 14153116 | 23 | 12 |
| tavern-furniture.glb | 6904576 | 520 | 6 |
| street-lantern.glb | 1056900 | 9 | 5 |

O pacote de móveis contém 992 nós. A seleção de uma peça reduz a instância utilizada, mas o loader ainda precisa obter e interpretar o GLB de origem. Separar peças de uso frequente em arquivos menores e medir compressão de geometria/texturas é prioridade para reduzir o tempo de abertura. Os originais devem permanecer disponíveis para validar materiais, escala e aparência.

O build de produção gerou um chunk principal de aproximadamente 1,30 MB, ou 323 kB com gzip, além do chunk compartilhado de aproximadamente 622 kB, ou 159 kB com gzip. O Vite alertou sobre chunks acima de 500 kB. Dividir funcionalidades usadas apenas no Build e em painéis pode reduzir o JavaScript inicial; dividir arquivos sem reduzir o trabalho inicial não garante abertura mais rápida.

O descarregamento de chunks já libera geometrias próprias e instâncias, preservando recursos compartilhados. Os três renderizadores liberam os contextos na saída da página. Os valores de heap observados não demonstram vazamento por si só: faltam séries após coleta de lixo e percursos repetidos.

## Interface e tarefas periódicas

Os mapas já atualizam em frequência inferior à tela. O plano distrital possui cache, mas cada desenho ainda calcula footprints e uma chave serializada antes de reutilizá-lo. Invalidação por mudanças efetivas de geometria pode reduzir esse trabalho, especialmente com vários mapas abertos.

O jogo consulta calibração compartilhada da mão a cada 750 ms e verifica calibração local a cada 250 ms. São tarefas de edição presentes também durante gameplay. O custo não foi isolado nesta amostra; vale medir antes de restringir a consulta ao editor, foco ou mudanças notificadas. A persistência de runtime ocorre a cada 1,5 s e o inventário a cada 2 s; os respectivos formatos e mecanismos de gravação foram mantidos.

## Validação

- `npm run build`: TypeScript e build de produção concluídos; aviso de tamanho de chunks permanece.
- `node scripts/validate-performance-spatial.mjs`: 500 superfícies; média de 4,236 candidatos por consulta, em vez das 500 superfícies do prédio. Alturas, recortes poligonais, escala, rotação e atualização após movimento preservados. Escadas comparadas com o cálculo anterior. Colisões comparadas em 400 posições. Navegação faz no máximo quatro consultas de altura por retomada no cenário testado.
- `node scripts/validate-flight-collisions.mjs`: 99 cenários de deslocamento contínuo, rebote, saída, penetração e telhados aprovados.
- `node scripts/validate-city-floor-surface.mjs`: fundação fechada, pavimentação, terreno externo e coordenadas preservados.
- `node scripts/validate-direct-city-lighting.mjs`: luz própria por luminária, alternância interior/exterior e ausência de sombras pontuais aprovadas.
- `node scripts/validate-directional-shadows.mjs`: 12 combinações de câmera/resolução com sombras reais preservadas.
- `git diff --check`: sem erros de whitespace.

## Cache dos candidatos de colisão

As consultas de colisão agora reutilizam candidatos pelo retângulo de células consultado. Antes, cada consulta criava um novo `Set` e percorria novamente todos os volumes dessas células. A caminhada possui uma lista própria sem os volumes exclusivos de voo; as consultas de voo continuam incluindo esses volumes. A ordem de resolução é preservada.

O cache é invalidado junto com o índice físico ao mudar transforms ou revisões de colisores, incluindo portas e carregamento de props. O limite é de 2048 entradas. A primeira consulta a uma região ainda precisa coletar os candidatos; a economia vem das consultas repetidas.

O benchmark `scripts/benchmark-npc-collisions.mjs` utiliza 180 estruturas e 39037 volumes gerados com transforms exatos do mapa padrão do repositório. As 4096 posições consultadas são determinísticas. A comparação alternada no mesmo processo mediu mediana de 73,134 ms no coletor anterior e 26,519 ms no cache, redução de 63,74%. P95 dos lotes: 105,407 e 45,179 ms. Esses tempos correspondem a lotes de 4096 consultas em Node, sem GPU, modelos GLB de decoração ou o save aberto; não representam duração de frame nem ganho de FPS. O hash de todas as posições resolvidas coincide com a linha de base.

Resultados completos em `artifacts/performance/npc-collision-before.json` e `artifacts/performance/npc-collision-after.json`. O teste `scripts/validate-collision-candidate-cache.mjs` confirma ordem e deduplicação nas bordas das células, separação caminhada/voo, invalidação após revisão de colisores e movimento no Build, além do limite de entradas. Os 99 cenários existentes de voo e o teste espacial também passaram. O build de produção passou, mantendo o aviso de chunks grandes.

## Fila de prioridade da navegação

A busca A estrela passou a usar uma fila de prioridade estável em vez de percorrer a lista completa de nós pendentes e remover um elemento do meio do array a cada expansão. Custos iguais preservam a ordem de inserção anterior. Foram mantidos os limites de visitas, alturas, tolerâncias de colisão e destinos aceitos. A reconstrução de rotas internas passa a ceder execução entre pontos, permitindo que o orçamento por frame interrompa também essa etapa.

O benchmark `scripts/benchmark-resident-navigation.mjs` alterna a implementação anterior, preservada em `artifacts/performance/ResidentNavigation.before-heap.ts`, com a atual no mesmo processo. Os seis cenários incluem rua reta, diagonal, desvio de parede, destino cercado, obstáculo interno e degraus. Todas as coordenadas das rotas coincidiram; o destino cercado continuou sem rota. A amostra final mediu mediana de 5,284 ms antes e 4,871 ms depois para o lote completo, redução de 7,80%. P95 dos lotes: 5,955 e 5,223 ms.

O ganho observado foi modesto e está sujeito à variação de execução do Node. Não representa ganho de FPS nem tempo de navegação de todos os moradores no save aberto. O resultado completo está em `artifacts/performance/resident-navigation-comparison.json`. Validações de rotina dos moradores, navegação incremental e consultas espaciais passaram.

## Critério para considerar o jogo fluido

Validar uma versão estabilizada sem recarregamentos de desenvolvimento, com mesma resolução, câmera, horário e qualidade. Medir trajetos repetíveis no exterior, pousada, taverna e palácio, além de voo, troca de chunks e abertura do Build/inventário. Separar abertura fria de cache quente. Registrar FPS, P95, P99, chamadas de desenho, tempo efetivo de GPU e memória após percursos repetidos.

A meta é 60 FPS sustentados nos cenários definidos, com P95 próximo ou abaixo de 16,7 ms e ausência de travadas recorrentes acima de 50 ms. Essa meta ainda não foi demonstrada. A auditoria cobriu o código dos subsistemas e uma vista externa da sessão real; não substitui um perfil de GPU nem um benchmark completo de todos os interiores.
