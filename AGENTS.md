# Direção visual do projeto

- A fonte central usa `CityFountain`, versão monumental de três bacias (455 triângulos, uma malha), com 11 de altura e a mesma área de 16×16. Preservar o transform salvo da fonte; a versão compacta aprovada continua preservada em `artifacts/fountain-models/fountain-classic.ts`.

- Baldes `farm/Bucket` usam `CityBucket` com água integrada (172 triângulos) e alça de madeira; preservar dimensões e colisões do modelo original. No palácio, não adicionar outra superfície de água quando `containsWater` estiver ativo.

- Barris `farm/Barrel` usam `CityBarrel` (324 triângulos). Aros e alça usam as mesmas constantes de cor, metalness e roughness do ferro da armadura; preservar madeira padrão, dimensões do modelo original, apoios e limites contra sobreposição, também em lojas, pousada, taverna e palácio.

- Vasos de planta usam `CityPottedPlant` pelo carregador compartilhado (`potted-plant`): 264 triângulos, uma malha, vaso de barro e folhagem. Aplicar também nos comércios e palácio, preservando dimensões e encaixes.

- Pisos de madeira usam placas sólidas instanciadas de 12 triângulos com texturas de cor/juntas e relevo geradas do layout exato de `wood-floor.glb`. Compartilhar o material do piso derivado de `CITY_WOOD_MATERIAL`, manter o marrom padrão e preservar dimensões, altura de apoio e vãos das escadas em casas, lojas, pousada e taverna.

- Postes das avenidas usam o modelo em código `CityStreetLantern` (180 triângulos, duas malhas), preservando base de pedra, madeira padrão, ferragens e uma luz direta própria sem sombras. Posicionar e orientar pela avenida salva, com colisão apenas na base.

- As substituições aprovadas de janela, porta `church-door`, cadeira e cortina são globais pelo carregador compartilhado: valem para casas, lojas, pousada e taverna. Cortinas vermelhas sem faixas amarelas também são usadas nos quartos, sala de estar e escritório do rei no palácio.

- Por decisão do usuário, toda madeira de construção e mobiliário deve usar o marrom da referência do carrinho de mão: `#7b603f`.
- Reutilize `CITY_WOOD_COLOR` de `src/editor/CityWood.ts` em novas peças de madeira.
- Em modelos importados com materiais mistos, aplique a cor apenas à madeira, preservando metal, tecido, pedra e outros detalhes.

- A referência atual é a madeira das travessas 3D da casa, usando `CITY_WOOD_MATERIAL`; pisos, escadas, prateleiras, balcões e postes devem compartilhar esse material quando forem inteiramente de madeira. Não simule a cor escurecendo peças individualmente.

- As caixas `box-low-poly.glb` também usam o material e marrom padrão da madeira (`CITY_WOOD_MATERIAL`), sem escurecimento individual.

- Preencher pátios com pequenos grupos de barris, caixas e baldes junto às paredes, mantendo livres as entradas e o centro das passagens.

- Portas (`village-door` e `church-door`) também usam o novo marrom padrão da madeira (`#7b603f`).

- Objetos decorativos não devem se atravessar: validar os limites reais antes de posicionar barris, caixas e baldes; peças empilhadas devem permanecer apoiadas.
- Poções da cidade e miniaturas de poções consumíveis usam `potion.glb`; preservar a paleta original desse modelo.
- Antídoto conta como poção no comércio: somente a loja de poções o negocia. A taverna compra e vende apenas bebidas e comidas.
- Estantes da taverna exibem somente bebidas alcoólicas nas garrafas verdes, marrons e amarelas. Comidas, frutas e água continuam no menu, sem exposição nas estantes. Modelos de carne do inventário usam o corte T-bone; maçãs têm talo e folha e uvas formam um cacho.

- A taverna vende apenas bebidas e comidas, sem poções na oferta ou na decoração. Usa salão de 32×28, balcão próprio em U e prateleiras com garrafas de bebidas. Lojas recebem uma pilha de três caixas no canto; carroças ficam em áreas abertas diante dos prédios, com validação contra sobreposição.

- A decoração da taverna utiliza os modelos `tavern-round-table`, `tavern-table`, `tavern-stool`, `ale-mug`, `tavern-sign`, `tavern-butcher-sign`, `tavern-hearth`, `tavern-fire` e `tavern-chimney`. Preservar animação e iluminação do fogo, e alinhar a chaminé à lareira.

- As prateleiras da taverna usam as quatro garrafas selecionadas individualmente de `tavern-bottles.glb`, sem a base de exposição do arquivo. Mesas e balcão combinam `ale-mug` com `tavern-tankard` (caneca vazia de metal). Preservar materiais de vidro, rótulos e metal.

- Garrafas atuais da taverna: `tavern-bottle-a`, `tavern-bottle-b` e variações azul, vermelha, verde, âmbar e roxa da branca. Distribuir algumas deitadas nos pátios e em pé junto às caixas, com verificação de sobreposição.
- `magic-potion.glb` representa a Poção de Magia consumível: recupera 40 de vigor (energia usada nas magias), aparece no inventário e nas prateleiras de poções.

- No Build, estabelecimentos e casas devem ser selecionáveis e transformáveis individualmente por clique. A pasta Estabelecimentos lista os comércios existentes; a seleção explícita Cidade Principal continua disponível para transformar o conjunto.

- Taverna tem apenas um andar (sem escada nem mezanino), nove mesas variadas com cadeiras e bancos. Garrafas decorativas usam somente verde, marrom e amarelo.
- Interiores: o teto deve bloquear a luz solar por sombras reais. Não escurecer globalmente o sol/ambiente ao entrar e não criar luzes artificiais nas janelas. Velas e tochas internas acendem ao abrir uma porta próxima ou entrar no interior; enquanto o jogador estiver dentro, a iluminação externa fica apagada. Todos os emissores, inclusive os do palácio, usam o orçamento compartilhado de luzes próximas para preservar FPS.


# Preservação do mapa e dos saves

- Ler `docs/MAPA_POSICOES.md` antes de mexer em posição, rotação, escala, muralhas, portões, avenidas ou seleção de localhost.
- Preservar o endereço completo e o perfil do navegador usados pelo usuário; não abrir outro localhost/perfil como se fosse o mesmo save.
- Nunca substituir o save existente automaticamente por `default-city.json`, `recovered-map.json` ou backups antigos.
- Antes de restaurar coordenadas, preservar o JSON atual e identificar o JSON aprovado pelo usuário. Não corrigir alinhamentos por aproximação nem rodar uma migração de posição para encobrir a abertura do save errado.
- O snapshot transcrito no MD tem fonte e hash, mas não é automaticamente o mapa atual aprovado. Registrar as coordenadas do save correto sem arredondamento.

- Casas e estabelecimentos não têm tochas externas. Postes e tochas externas do palácio usam iluminação fixa no mapa compartilhado, sem emissores dinâmicos nem sombras. Ao entrar em um interior, apagar toda iluminação externa e de outros interiores; restaurar a iluminação fixa externa ao sair. Luminárias internas só carregam ao abrir uma porta próxima ou entrar, usando o orçamento compartilhado.

- Postes de luz das avenidas ficam apoiados no centro das bordas, em fileiras paralelas com pares frente a frente, luminárias voltadas para a pista. A posição deriva da própria avenida, preservando os transforms salvos.

- O portão externo da praça do palácio, voltado para a cidade, tem duas tochas simétricas nos pilares do arco, também com iluminação fixa no mapa compartilhado, acesas no exterior e apagadas enquanto o jogador estiver em um interior.

- Postes das avenidas mantêm iluminação contínua por mapa de luz compartilhado, inclusive longe do jogador e de dia, apagada enquanto o jogador estiver em interiores, sem adicionar luzes dinâmicas ou sombras.

- O portão do palácio e os portões das muralhas nunca são ocultados por distância. As entradas das muralhas usam o modelo `church-door`, com abertura/fechamento e colisão, ajustado ao arco sem alterar os transforms salvos das muralhas.

- O terreno externo à muralha mantém o relevo salvo. Não rebaixar faixas externas ao piso da cidade: o ajuste subterrâneo se limita ao interior da fundação, sem criar valas ou morros artificiais junto às escadas.

- Portões das muralhas fecham automaticamente após o jogador atravessar: ao entrar, depois de liberar as folhas abertas; ao sair, após chegar ao pé da escada. Não fechar enquanto o jogador ainda estiver na passagem ou descendo.

- Os portões das muralhas abrem sempre para dentro da cidade. Determinar o lado interno pelo centro da cidade e pela rotação salva de cada entrada, sem girar a própria muralha.

- Build: a pasta `Cidades` lista as cidades do mundo; atualmente contém apenas `Cidade Principal`. Esse item seleciona a cidade inteira, incluindo construções, piso/escadas vinculados, moradores, animais e assets avulsos dentro do perímetro. Miniaturas usam a geometria e os materiais do objeto/modelo real, sem desenhos ou modelos substitutos; Cidade Principal deve mostrar o conjunto, não uma torre.

- Miniaturas do Build excluem auxiliares de edição (`SkeletonHelper` etc.) e luzes da cópia de prévia, preservando malhas e materiais reais. As sete malhas coloridas do asset de galinha compõem o mesmo animal: preservar todas (corpo, crista, bico, olhos e demais partes), com pose idle e vista frontal de três quartos.

## Iluminação — decisão atual do usuário

- Não há limite compartilhado de luzes. Luminárias ativas usam luz direta própria, sem seleção por proximidade nem pool. Esta decisão substitui as instruções anteriores sobre orçamento compartilhado e mapas de iluminação fixa.
- Manter postes e tochas externos acesos no exterior, apagando-os enquanto o jogador estiver em um interior; somente o interior ocupado fica aceso. Usar emissores sem sombras para reduzir o custo de renderização.
- Iluminação fixa segue o funcionamento atual dos postes: luz direta em posição e intensidade constantes, sem oscilação e sem sombras dos emissores. Velas, tochas e candelabros seguem essa regra; a taverna também tem um candelabro grande de 12 velas sobre a mesa central.
- Lustres e candelabros usam o modelo compartilhado `candle`, como no palácio; não criar velas ou chamas substitutas com primitivas. A estrutura de suporte pode ser procedural.
- Onde há lustre, ele ilumina o ambiente inteiro, incluindo paredes e região das janelas. Dimensionar alcance e intensidade pelo tamanho real do ambiente, incluindo a escala do prédio; não limitar a iluminação às mesas nem criar emissores nas janelas.
- Pousada da Selena: sem tochas internas; um candelabro pequeno por andar ilumina todo o piso, incluindo escritório e escada. Tetos usam o mesmo acabamento de madeira do quarto da Alice, preservando os vãos das escadas.

- As três barraquinhas (`Stand_Vegetables`, `Stand_Tools`, `Stand_Meat`) usam `CityMarketStall.ts`, com madeira compartilhada, tecidos e produtos coloridos e ferro da armadura. Preservar transforms do mercado e orientação de atendimento.

- Carrinhos de mão usam `CityWheelbarrow.ts`, com madeira padrão e ferro da armadura. O mercado tem um carrinho ao lado de cada uma das 12 barracas, sem cestas de frutas ou placas soltas no piso.

- Carroças grandes (`wagon`) usam `CityWagon.ts`, com frente fechada, traseira aberta, rodas maciças e madeira compartilhada. Preservar posição, rotação e altura das instâncias existentes.

- GLBs antigos dos modelos procedurais aprovados foram removidos de `public/models/city/props`. Não restaurar esses binários: usar as fábricas em código. Comparações antigas ficam preservadas como imagens estáticas. `farm.glb` também foi removido: os únicos elementos usados, Barrel e Bucket, já são procedurais.

- Pinheiro verde usa `WorldPine.ts` (80 triângulos, uma malha/material). Preservar alturas e transforms das árvores salvas; o pinheiro cheio de neve ainda está em comparação.

- Pinheiro cheio de neve usa `WorldSnowPine.ts` (164 triângulos, uma malha/material); preservar altura, biome, zona interior e transforms salvos.

- Pinheiro com pouca neve usa `WorldLightSnowPine.ts` (260 triângulos, uma malha/material), mantendo o nome de catálogo Pinheiro com neve e a zona transition.

- Os GLBs antigos dos três pinheiros foram excluídos (`arvores.glb`, `treesnow_low_poly.glb`, `fir_tree_set_with_snow.glb`). Usar apenas as fábricas procedurais; comparações preservadas como imagens.

- Mesas redondas pequenas da taverna e mesa com barril foram removidas, incluindo `tavern-round-table.glb` e `tavern-table.glb`. A cozinha do palácio usa a mesa de madeira real existente. Mesa redonda grande está em comparação procedural.

- Mesa redonda grande usa `CityRoundTable.ts`, com base circular chapada. Taverna tem mesa principal no centro, diâmetro 5 m, altura 1,1 m e dez cadeiras em volta; substituir o antigo conjunto central para evitar sobreposição.

- As laterais da taverna também têm seis mesas quadradas (2,4 × 2,4 m), usando a construção de madeira das mesas da pousada/biblioteca, com quatro cadeiras cada.

- Mesas quadradas laterais da taverna formam conjuntos com banco estofado vinho encostado na parede e duas cadeiras do lado oposto, estilo lanchonete. Preservar o espaço da lareira (sem conjunto nesse ponto).

- Taverna: as duas quinas da parede da porta têm bancos em L com mesa quadrada; duas mesas redondas menores ficam uma de cada lado da entrada, corredor central livre. Caixas, balde e vaso antes nesses cantos ficam na região traseira de serviço.

- Barril de cerveja deitado (`tavern-interior/barrelCrane`) usa `CityBeerBarrel.ts`, com madeira padrão, suporte e torneira/aros de ferro. A pousada tem um exemplar pequeno apoiado no balcão da recepção.

- Cantos em L da taverna têm bancos mais profundos (1,1 m), prolongados até as quinas das mesas e afastados das travessas verticais para evitar madeira atravessando o estofado.

- Taverna sem tochas internas: não carregar o modelo nem criar os emissores das tochas. Preservar velas e fogo da lareira.

- Mesas da taverna recebem um `ale-mug` por lugar, alinhado às cadeiras e lugares dos bancos, incluindo os dez lugares da mesa principal.
