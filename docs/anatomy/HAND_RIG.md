# Rig das mãos

Implementação: `HandRig.ts`, `HandMesh.ts`, `HandAnimator.ts` e `GripSolver.ts`.

- 27 ossos por mão.
- Mão esquerda construída por `sideSign=-1`; mão direita por `sideSign=+1`.
- Não há escala negativa para espelhamento.
- O `SkinnedMesh` possui 9.360 vértices por mão.
- Cada vértice usa duas influências positivas; o formato reserva quatro componentes.
- Pesos medidos: soma entre `0.9999999702` e `1.0000000298`.
- Poses: `Open`, `Relaxed`, `Fist`, `SwordGrip`, `ShieldGrip`, `Point`.
- Controles: `curl`, `spread`, `opposition`, `relaxation` e curl individual.
- IK CCD de ponta é opcional e desativado por padrão.

O espaço de bind é sempre relativo a `handRig.root`. `HandRig.bindMatrixLocal()` acumula somente `bone.matrix` ao longo dos pais. `getWorldPosition()` não participa da construção de vértices.

Região válida: em todas as poses, qualquer vértice deve permanecer a no máximo `0.4` unidade do respectivo `Wrist_L/R`. O máximo medido é `0.3469` com escala de teste `1.1`.

