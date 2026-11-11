# Documentação do mundo

Referência técnica do mapa principal do RPG 3D. Os valores abaixo refletem o código em 4 de novembro de 2026.

## Sistema de coordenadas

- `X`: leste/oeste.
- `Y`: altura.
- `Z`: norte/sul.
- Posição padrão: `[x, y, z]` em metros/unidades de mundo.
- Rotação: radianos, na ordem `[x, y, z]`.
- O terreno define o `Y` real da maioria dos objetos através de `openWorld.getHeightAt(x, z)`.
- O mapa ocupa `2048 × 2048`, aproximadamente de `-1024` a `1024` em X e Z.

## Configuração e streaming

| Propriedade | Valor |
|---|---:|
| Tamanho do mundo | 2048 |
| Tamanho de chunk | 128 |
| Total de chunks | 16 × 16 = 256 |
| Raio normal de visualização | 2 chunks |
| Raio de props detalhados | 1 chunk |
| Seed procedural | 73421 |
| Resolução de edição por chunk | 18 × 18 |
| Streaming no Build | 2 chunks por frame |
| Janela durante voo | Ilha completa (256 chunks), carregamento progressivo |
| Streaming durante voo | 1 chunk a cada 90 ms |

## Regiões de navegação

O seletor do Build usa estas âncoras. O raio é usado para posicionar a câmera de visão geral.

| Região | X | Z | Raio |
|---|---:|---:|---:|
| Cidade Inicial | 0 | 0 | 160 |
| Planícies Centrais | -350 | 350 | 280 |
| Floresta de Horunka | -450 | -250 | 230 |
| Vila Horunka | -300 | -100 | 65 |
| Alpes de Neve | -550 | -700 | 280 |
| Bioma de Neve | 650 | -180 | 220 |
| Montanhas de Aincrad | 350 | -700 | 350 |
| Região dos Lagos | 450 | 150 | 230 |
| Tolbana | 250 | 550 | 110 |
| Deserto | -750 | 300 | 200 |
| Porto | 750 | 550 | 90 |

## Cidade Principal

- Centro lógico: `[0, terreno, 7.5]`.
- Formato: octógono regular.
- Lado: `172.5`.
- Raio até as torres: `225.3821`.
- Fundação e piso: quatro unidades acima do nível amostrado no centro.
- Camada do Build: `Cidade Principal`.
- Prefixo persistente: `capital-octagon-`.
- Escala das torres: `[5, 5, 5]`.
- Escala padrão das muralhas: `[3.75, 3.75, 3.75]`.
- Escala X dos portões: `45 / 14` (`≈ 3.2143`); Y e Z usam `3.75`.
- Portões: lados 1, 5 e 7 do octógono.
- O chão e as escadarias são vinculados à cidade e regenerados a partir das torres e portões.

### Torres

O valor de Y é o nível da fundação calculado em tempo de execução.

| Torre | X | Z |
|---|---:|---:|
| 1 | 208.23 | 93.75 |
| 2 | 86.25 | 215.73 |
| 3 | -86.25 | 215.73 |
| 4 | -208.23 | 93.75 |
| 5 | -208.23 | -78.75 |
| 6 | -86.25 | -200.73 |
| 7 | 86.25 | -200.73 |
| 8 | 208.23 | -78.75 |

Cada lado contém três segmentos, posicionados a `41.25`, `86.25` e `131.25` unidades a partir da torre inicial daquele lado.

### Piso e escadarias

- Piso: polígono derivado das oito torres.
- Espessura da fundação: `4`.
- Escadas: geradas para cada portão quando o terreno externo está abaixo do piso.
- Comprimento de escada: `24`.
- Largura mínima: `5`; normalmente acompanha a largura escalada do portão.
- Altura máxima por degrau: aproximadamente `0.25`.
- IDs antigos `city-stairs-*` são removidos para impedir que escadas se separem da cidade.

## Água

| Corpo d’água | Nível Y |
|---|---:|
| Mar | 0 |
| Rio e lago internos | 11 |

- O lago principal da ilha Arena é formado por bacias sobrepostas próximas de `[445, 150]`, `[330, 180]` e `[545, 120]`.
- A borda da lâmina interna se estende até distância assinada `42` das bacias, com transição iniciando em `18`.
- Mar e água interna têm geometrias mutuamente recortadas; nunca existem duas superfícies no mesmo ponto.
- O leito interno é rebaixado para aproximadamente `Y = -3` antes da margem.
- O material da água usa a cor `#3e9fc0`, opacidade `0.78` e não escreve no depth buffer.
- Fauna aquática consulta `getWaterLevelAt(x, z)`; portanto acompanha automaticamente o nível elevado do rio/lago.

### Mundo procedural legado

Quando o preset Arena não está ativo:

- Centro do rio: `x = 265 + sin(z × 0.0048) × 180 + sin(z × 0.013) × 30`.
- Nível do rio: `Y = -0.55`.
- Lago legado: centro `[430, -350]`, raio visual `61`, nível `Y = -0.5`.

## Docas e porto

As docas são procedurais e não dependem mais de `dock-platform.glb`.
O asset adicionável **Doca artesanal** fica na pasta **Floresta** do Build.

### Módulo de doca

- Comprimento: `17`.
- Largura do deck: `3.8`.
- 17 tábuas alternadas.
- Duas vigas longitudinais.
- Dez estacas principais, esticadas individualmente até `3` unidades abaixo do terreno/leito calculado por `getHeightAt(x, z)`.
- Dez postes de guarda-corpo.
- Dois corrimãos laterais.
- Detalhes metálicos nas extremidades.
- Superfície marcada como `walkableDock`.
- O pivô do grupo é centralizado apenas em X/Z; Y permanece em zero para que o comprimento das estacas não levante o deck.

### Doca de pesca do lago

Três módulos alinhados; rotação Y de `π/2` (`90°`) e deck em `Y = 15`, quatro unidades acima da água interna.

| Módulo | X | Y | Z |
|---|---:|---:|---:|
| Lago 1 | 277 | 15 | 150 |
| Lago 2 | 294 | 15 | 150 |
| Lago 3 | 311 | 15 | 150 |

Grupo persistente: `dock-lake-group`.

### Doca marítima

Orientação baseada no vetor do porto `[750, 550]`. Os módulos ficam nas distâncias 950, 967 e 984 a partir da origem.

| Módulo | X aproximado | Y | Z aproximado |
|---|---:|---:|---:|
| Mar 1 | 766.08 | 0 | 561.80 |
| Mar 2 | 779.79 | 0 | 571.85 |
| Mar 3 | 793.50 | 0 | 581.90 |

Grupo persistente: `dock-sea-group`.

### Navio pirata

- Posição aproximada: `[788.18, 0, 607.76]`.
- Distância-base da costa: `995`.
- Deslocamento lateral: `24`.
- ID persistente: `harbor-pirate-ship`.
- Caixa de colisão local: `[17, 7.5]`.

## Pontos principais de personagens

| Entidade | Posição/âncora |
|---|---|
| Respawn do jogador | `[0, terreno - 0.06, 7.5]` |
| Castelo medieval | `[0, terreno, 7.5]` |
| Estábulo do cavalo | âncora local `[17.86, 0.35, 15.71]` dentro do castelo |
| NPC feminina | `[2.15, 0, -2.35]` |
| Gato caçador legado | `[-7, terreno, -3]` |

## População animal inicial

O posicionamento final pode ser corrigido para o habitat do preset Arena. `Y` sempre é recalculado pelo terreno.

| Espécie | Base X/Z | Quantidade configurada | Comportamento |
|---|---|---:|---|
| Cervos | 6 bases próximas da origem | 2 por base | estacionário/patrulha |
| Coelhos | 8 bases próximas da origem | 3 por base | estacionário/patrulha |
| Guaxinins | `[-5.5, 5.5]` | 12 | patrulha |
| Ursos | `[-7, 7]` | 6 | territorial |
| Lobos | `[8, -7]` | 6 | territorial |
| Pumas | `[9, 8]` | 8 | territorial |

As rotas são regeneradas por habitat quando um animal é reposicionado na Arena.

## Terreno e biomas

- Altura-base da ilha: aproximadamente `16` mais ruído procedural.
- A costa começa a cair na faixa normalizada `0.78–1.02` do raio da ilha.
- A cidade é suavizada dentro de raio `180`, com núcleo até `135`.
- O terreno combina materiais `grass`, `dirt`, `sand`, `stone`, `snow` e `road`.
- Florestas, pedras, neve e deserto são distribuídos por chunk usando a seed do mundo.
- Assets editados no Build persistem em `rpg3d.worldBuilder.v1` no `localStorage`.

## Persistência do Build

| Dado | Local |
|---|---|
| Terreno, cidade e assets | `rpg3d.worldBuilder.v1` |
| Pastas personalizadas | `rpg3d.buildFolders.v1` |
| Versão/escala da capital | `rpg3d.capitalScaleVersion` |
| Qualidade gráfica | `rpg3d.quality` |

Objetos movidos pelo usuário podem divergir das posições padrão deste documento. Para obter a posição efetiva de um mapa editado, exporte o JSON pelo Build; o JSON é a fonte de verdade para aquela instalação.

## Arquivos-fonte relacionados

- `src/world/OpenWorld.ts`: terreno, água, biomas, chunks e regiões.
- `src/world/ArenaTerrainLayout.ts`: preenchimento de terreno da Arena.
- `src/world/MedievalCityFloor.ts`: piso e escadarias da cidade.
- `src/editor/LowPolyCityBuilder.ts`: peças e colisões da cidade.
- `src/editor/WorldEditorSupport.ts`: esquema de persistência do Build.
- `src/world/AnimalTerritories.ts`: habitats e patrulhas.
- `src/main.ts`: composição do mundo, posições e gameplay.
