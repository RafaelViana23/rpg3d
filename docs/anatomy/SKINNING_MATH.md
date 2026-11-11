# Matemática de skinning

Para o osso `i`:

`M_world(i) = M_world(parent(i)) × M_local(i)`

Para um vértice local `v`:

`v_deformed = B_mesh^-1 × Σ(w_i × M_world(i) × B_i^-1) × B_mesh × v`

Onde `B_mesh` é a matriz de bind da malha e `B_i^-1` é a inverse bind matrix do osso.

Invariantes verificadas:

1. `0 ≤ skinIndex < skeleton.bones.length`.
2. `Σ weights = 1`, tolerância `1e-5`.
3. No máximo quatro pesos positivos por vértice.
4. Toda matriz e quaternion contém apenas números finitos.
5. `bindMatrix × bindMatrixInverse ≈ I`.
6. Após montar a hierarquia final: `updateWorldMatrix(true,true)`, `skeleton.calculateInverses()` e `mesh.bind()`.
7. Geometria e bind position usam o mesmo espaço local.

O erro corrigido em 2026-10-26 armazenava posições globais de dedos dentro do `BufferGeometry` local. Isso produzia distâncias de até `1.7405` do punho e 2.160 vértices fora da região. Depois da correção: zero vértices fora da região.

