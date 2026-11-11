# Sistema de coordenadas oficial

Fonte: medições do `ProceduralCharacter(DEFAULT_CONFIG)` em pose de bind.

| Item | Convenção real |
|---|---|
| +X | direita do personagem |
| -X | esquerda do personagem |
| +Y | cima |
| -Y | baixo |
| +Z | frente do personagem |
| -Z | costas |
| Origem do personagem | centro do pedestal; `parts.position = (0,0,0)` |
| Ordem Euler usada | `XYZ` |
| Quaternions | Three.js `(x,y,z,w)`, identidade `(0,0,0,1)` |
| Matrizes | `THREE.Matrix4`, column-major |

O projeto usa unidades de cena, não metros. O bounding box real do personagem masculino padrão com espada é `min=(-0.746624,0.025000,-0.278983)` e `max=(1.600000,2.790000,0.418732)`. A largura inclui a espada. A altura geométrica é `2.765` unidades.

Se a altura padrão for interpretada externamente como 1,75 m, use apenas na camada de conversão:

`metersPerSceneUnit = 1.75 / 2.765 = 0.6329113924`

Isso não altera coordenadas internas. A escala configurável `height` multiplica `parts` uniformemente entre `0.9` e `1.1`.

Transformação hierárquica:

`M_world(i) = M_world(parent(i)) × M_local(i)`

Geometria de filhos deve ser criada em espaço local. É proibido usar `getWorldPosition()` para fabricar posições armazenadas no `BufferGeometry` local.

