# Especificação do personagem e equipamentos

Este documento define medidas, eixos e contratos de encaixe usados pelo personagem procedural. O objetivo é impedir que armas atravessem o corpo ou sejam posicionadas manualmente para uma única pose.

## Sistema de coordenadas

- `+Y`: para cima.
- `+X`: lado direito do personagem.
- `+Z`: frente do personagem/câmera na pose inicial.
- Unidade: metro aproximado; o personagem-base possui 2,8 unidades de altura.
- Todos os pivôs de membros ficam no centro anatômico da articulação.

## Hierarquia do rig

```text
character.group
└── parts (escala de altura)
    ├── tronco e cabeça
    ├── clavicle.L/R
    │   └── upperArm.L/R (ombro)
    │       └── forearm.L/R (cotovelo)
    │           └── hand.L/R (rig de punho)
    │           ├── handVisual (palma + 5 dedos)
    │           └── grip.L/R
    │               └── equipamento
    └── thigh.L/R (quadril)
        └── shin.L/R (joelho)
            └── ankle.L/R (tornozelo)
                └── foot.L/R
```

Cada mão avançada usa exatamente 27 ossos: `Wrist_L/R` fica acima de `Hand_L/R`; abaixo de `Hand_L/R`, `Palm`, `Thumb_CMC → Thumb_MCP → Thumb_IP → Thumb_Tip` e as cadeias `Index/Middle/Ring/Pinky_Metacarpal → MCP → PIP → DIP → Tip`. Pescoço e cabeça também possuem pivôs independentes. O punho controla toda a mão, os dedos e o `grip` sem alterar manualmente o equipamento.

O equipamento nunca deve ser anexado ao tronco, braço ou cena. Ele é sempre filho de `grip.L` ou `grip.R`.

## Mão

- A mão possui palma, base dos nós, quatro dedos com duas falanges e polegar com duas falanges.
- O centro do `grip` fica em `(0, -0.09, 0.082)` no espaço local do pulso.
- Objetos equipados usam origem `(0, 0, 0)` no centro físico da empunhadura.
- O eixo lateral da palma é X. Para espadas, o cabo atravessa a palma em X e permanece horizontal em relação à mão.
- `nenhum` usa dedos relaxados; qualquer objeto usa dedos curvados ao redor do cabo.
- Sem objeto ou segurando a espada em `idle`, o punho gira `±90°` em Y: a palma fica de lado e o polegar aponta para `+Z` (frente).
- Com espada, as falanges proximal e distal fecham ao redor do cabo também na pose `idle`.
- Diâmetro recomendado de cabos: `0.045` a `0.065`.

## Contrato dos objetos

### Espada

- Origem: centro do cabo.
- Cabo: eixo X, comprimento `0.25`, diâmetro `0.055`; portanto ele cruza a palma horizontalmente.
- Guarda: `X = thumbDirection × 0.155`.
- Lâmina: cresce em X no sentido do polegar (`+X` na mão direita e `-X` na esquerda).
- A ponta é uma pirâmide integrada: sua base coincide exatamente com a extremidade da lâmina em `|X| = 0.90` e o ápice fica em `|X| = 1.04`.
- O ataque orienta a arma no espaço exclusivamente pelo rig do punho; a transformação local espada–mão nunca muda.

### Escudo

- Origem: centro da alça interna.
- A face fica deslocada `+0.16` em Z a partir da palma.
- O plano do escudo é perpendicular ao eixo frontal do personagem.

### Poção

- Origem: gargalo, exatamente onde os dedos fecham.
- O frasco cresce em `-Y`, pendendo abaixo da mão.
- A rolha permanece próxima ao centro da empunhadura.

## Regras de animação

1. A pose deve movimentar as articulações, nunca compensar a posição do objeto.
2. Ombro e cotovelo devem formar uma cadeia contínua; o objeto acompanha a mão automaticamente.
3. Durante o ataque, braço e lâmina apontam para fora do corpo. O cotovelo não deve dobrar mais que o necessário para evitar retorno da lâmina ao peito.
4. A troca de corpo, altura, cabelo ou cor reconstrói a malha e reaplica os equipamentos selecionados aos mesmos encaixes.

## Como adicionar um objeto

1. Modele o objeto com a origem no centro do ponto segurado.
2. Oriente a parte principal para crescer em `-Y` quando ela for continuação do braço.
3. Mantenha o cabo dentro do intervalo aceito pela mão.
4. Adicione o tipo a `HeldItem` e construa a geometria em `buildHeldItem()`.
5. Teste pelo menos as poses `idle`, `walk` e `attack`, vistas de frente, perfil e costas.

