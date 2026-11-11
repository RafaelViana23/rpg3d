# Topologia corporal procedural

## Escopo da remodelagem

A versão preservada está em `src/character.pre-remodel.ts`. O runtime continua usando `src/character.ts`.

O corpo permanece estilizado e procedural, mas os lofts agora possuem tampas e densidade seletiva. Os anéis adicionais se concentram na caixa torácica, cintura, ombros, cotovelos, joelhos, panturrilhas, tornozelos, mandíbula e têmporas. Isso evita subdivisão uniforme e mantém o custo baixo.

## Comparação visual

Abra `/body-lab.html`. A cena carrega simultaneamente a cópia preservada e a implementação atual, com câmera, configuração e animação equivalentes. Estão disponíveis as vistas frontal, lateral e traseira, todas as animações corporais e um modo wireframe.

## Skinning anatômico — etapa 2

O runtime possui sete `SkinnedMesh` corporais: tronco, braços esquerdo/direito, pernas esquerda/direita e pés esquerdo/direito. Cada vértice usa no máximo quatro influências normalizadas. Os pesos mudam progressivamente nos loops de ombro, cotovelo, quadril, joelho e tornozelo.

Foi adicionada a cadeia `Hips → Spine → Chest`. Coxas agora são filhas de `Hips`; clavículas e pescoço são filhos de `Chest`. As posições mundiais da pose de referência foram preservadas durante o reparenting e `skeleton.json` passou a registrar 19 ossos corporais.

`Hips`, `Spine` e `Chest` recebem movimentos procedurais pequenos em Idle, Walk, Run e Attack. As mãos continuam com seus `SkinnedMesh` e rigs independentes de 27 ossos.

## Restrições preservadas

- escala corporal e transformações mundiais de referência;
- rig de 27 ossos de cada mão;
- sockets e equipamentos;
- materiais e iluminação do lobby;
- personalização de corpo, pele, cabelo, roupa e olhos;
- estados de animação existentes.

## Validação

`validate:anatomy` percorre todos os `bodySkin.*`, valida atributos, índices, normalização, limite de quatro influências e inverse bind matrices. `body-lab.html` mantém a versão rígida à esquerda e a versão skinned à direita para inspeção sincronizada das oito animações.
