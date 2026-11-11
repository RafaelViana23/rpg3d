# ELF HEAD — Mapa técnico procedural v1

**Objetivo:** especificação inicial reproduzível para uma cabeça de guerreiro elfo estilizado, gerada em Three.js. Não é reconstrução exata da imagem: falta informação lateral/traseira, e o posicionamento do `Head` no projeto deve ser lido do `skeleton.json` real.

## Referencial
- Coordenadas locais da cabeça, origem no centro do crânio; X direita, Y cima, Z frente.
- Dimensões-base: 0,350 de altura, 0,342 de largura, 0,304 de profundidade (sem nariz/orelhas); pontas das orelhas a 0,530 de distância.
- Não alterar escala global do personagem (2,765 unidades). Converter coordenadas locais usando a matriz mundial do osso `Head`.

## Orçamento alvo (não contagem real da referência)
| Peça | Vértices | Triângulos |
|---|---:|---:|
| Crânio, rosto, mandíbula | 1250 | 2300 |
| Olhos e pálpebras | 450 | 800 |
| Nariz e boca | 300 | 500 |
| Orelhas | 300 | 500 |
| Cabelo | 1700 | 2900 |
| **Total** | **4000** | **7000** |

## Geometria inicial exata
`head-spec.json` contém **410 vértices e 816 triângulos** para a gaiola inicial (17 anéis de 24 pontos, mais duas tampas). Os índices estão em `base_cage.triangles`. Este é apenas o volume base, não a cabeça final; deve ser refinado com loops específicos ao redor de olhos, boca, nariz e orelhas. Use `BufferGeometry.setAttribute('position', ...)`, `setIndex(...)` e `computeVertexNormals()`; verificar orientação das faces e UVs antes de texturizar.

## Marcos anatômicos (X,Y,Z)
- `chin`: `(0, -0.175, 0.025)`
- `jaw_L`: `(-0.115, -0.12, 0.09)`
- `jaw_R`: `(0.115, -0.12, 0.09)`
- `cheek_L`: `(-0.145, -0.045, 0.12)`
- `cheek_R`: `(0.145, -0.045, 0.12)`
- `eye_L`: `(-0.075, 0.035, 0.151)`
- `eye_R`: `(0.075, 0.035, 0.151)`
- `brow_L`: `(-0.078, 0.065, 0.148)`
- `brow_R`: `(0.078, 0.065, 0.148)`
- `nose_bridge`: `(0, 0.025, 0.155)`
- `nose_tip`: `(0, -0.03, 0.205)`
- `mouth_center`: `(0, -0.085, 0.145)`
- `ear_root_L`: `(-0.165, 0.025, 0)`
- `ear_tip_L`: `(-0.265, 0.105, -0.025)`
- `ear_root_R`: `(0.165, 0.025, 0)`
- `ear_tip_R`: `(0.265, 0.105, -0.025)`
- `crown`: `(0, 0.175, 0)`
- `occiput`: `(0, 0.055, -0.15)`

## Regras de construção
1. Gerar a gaiola do crânio a partir de `base_cage`; não usar esferas como cabeça final.
2. Refinar a região dos olhos com 3 a 4 loops orbitais e criar pálpebras com espessura; olhos devem encaixar na cavidade.
3. Construir nariz com ponte, asas e ponta integradas ao rosto; unir topologia ou garantir continuidade visual.
4. Criar boca com loops labiais e canto da boca, sem placa flutuante.
5. Modelar orelhas pontudas como malhas côncavas, com raiz, hélice e cavidade; espelhar geometricamente.
6. Cabelo: mechas irregulares curvadas por splines, seção transversal variável, raízes parcialmente sobrepostas, pontas afiladas; sem cones repetidos.
7. Manter pescoço e cabeça alinhados ao rig; skinning em pescoço/mandíbula apenas se necessário, sem mudar bind pose sem validação.
8. Gerar visualizações frontal, perfil, costas e 3/4; comparar com a imagem original no mesmo FOV, câmera e luz.

## Critérios de aceite
- Silhueta, proporções, nariz, mandíbula, orelhas e cabelo avaliados contra referência antes da armadura.
- Nenhum buraco, face invertida, olho flutuante ou mecha atravessando a testa.
- `validate:anatomy`, `validate:animation` e `npm run build` aprovados, **mais inspeção visual humana**.
- Medidas acima são ponto de partida: ajustar no art lab sem assumir equivalência 1:1.
