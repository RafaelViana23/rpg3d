# Direção visual do projeto

- Por decisão do usuário, toda madeira de construção e mobiliário deve usar o marrom da referência do carrinho de mão: `#7b603f`.
- Reutilize `CITY_WOOD_COLOR` de `src/editor/CityWood.ts` em novas peças de madeira.
- Em modelos importados com materiais mistos, aplique a cor apenas à madeira, preservando metal, tecido, pedra e outros detalhes.

- A referência atual é a madeira das travessas 3D da casa, usando `CITY_WOOD_MATERIAL`; pisos, escadas, prateleiras, balcões e postes devem compartilhar esse material quando forem inteiramente de madeira. Não simule a cor escurecendo peças individualmente.

- As caixas `box-low-poly.glb` também usam o material e marrom padrão da madeira (`CITY_WOOD_MATERIAL`), sem escurecimento individual.

- Preencher pátios com pequenos grupos de barris, caixas e baldes junto às paredes, mantendo livres as entradas e o centro das passagens.

- Portas (`village-door` e `church-door`) também usam o novo marrom padrão da madeira (`#7b603f`).

- Objetos decorativos não devem se atravessar: validar os limites reais antes de posicionar barris, caixas e baldes; peças empilhadas devem permanecer apoiadas.
- Poções da cidade e miniaturas de poções consumíveis usam `potion.glb`; preservar a paleta original desse modelo.

- A taverna usa salão de 32×28, balcão próprio em U, seis mesas e prateleiras com `potion.glb`. Lojas recebem uma pilha de três caixas no canto; carroças ficam em áreas abertas diante dos prédios, com validação contra sobreposição.

- A decoração da taverna utiliza os modelos `tavern-round-table`, `tavern-table`, `tavern-stool`, `ale-mug`, `tavern-sign`, `tavern-butcher-sign`, `tavern-hearth`, `tavern-fire` e `tavern-chimney`. Preservar animação e iluminação do fogo, e alinhar a chaminé à lareira.

- As prateleiras da taverna usam as quatro garrafas selecionadas individualmente de `tavern-bottles.glb`, sem a base de exposição do arquivo. Mesas e balcão combinam `ale-mug` com `tavern-tankard` (caneca vazia de metal). Preservar materiais de vidro, rótulos e metal.

- Garrafas atuais da taverna: `tavern-bottle-a`, `tavern-bottle-b` e variações azul, vermelha, verde, âmbar e roxa da branca. Distribuir algumas deitadas nos pátios e em pé junto às caixas, com verificação de sobreposição.
- `magic-potion.glb` representa a Poção de Magia consumível: recupera 40 de vigor (energia usada nas magias), aparece no inventário e nas prateleiras de poções.

- No Build, estabelecimentos e casas devem ser selecionáveis e transformáveis individualmente por clique. A pasta Estabelecimentos lista os comércios existentes; a seleção explícita Cidade Principal continua disponível para transformar o conjunto.

- Taverna tem apenas um andar (sem escada nem mezanino), nove mesas variadas com cadeiras e bancos. Garrafas decorativas usam somente verde, marrom e amarelo.
- Interiores: o teto deve bloquear a luz solar por sombras reais. Não escurecer globalmente o sol/ambiente ao entrar e não criar luzes artificiais nas janelas. Todas as velas permanecem acesas, mas seus emissores usam o orçamento compartilhado de luzes próximas para preservar FPS.


# Preservação do mapa e dos saves

- Ler `docs/MAPA_POSICOES.md` antes de mexer em posição, rotação, escala, muralhas, portões, avenidas ou seleção de localhost.
- Preservar o endereço completo e o perfil do navegador usados pelo usuário; não abrir outro localhost/perfil como se fosse o mesmo save.
- Nunca substituir o save existente automaticamente por `default-city.json`, `recovered-map.json` ou backups antigos.
- Antes de restaurar coordenadas, preservar o JSON atual e identificar o JSON aprovado pelo usuário. Não corrigir alinhamentos por aproximação nem rodar uma migração de posição para encobrir a abertura do save errado.
- O snapshot transcrito no MD tem fonte e hash, mas não é automaticamente o mapa atual aprovado. Registrar as coordenadas do save correto sem arredondamento.
