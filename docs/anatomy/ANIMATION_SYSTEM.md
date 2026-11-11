# Sistema de animação procedural

`src/animation/AnimationController.ts` é a única camada que anima o corpo. Ele recebe referências aos ossos existentes; não recria a hierarquia, não altera posições locais de juntas, pesos, bind pose ou escala.

## Estados

| Estado | Solução corporal | Mãos |
|---|---|---|
| `idle` | respiração, contrarrotação de ombros e movimento sutil da cabeça | grip do equipamento |
| `walk` | IK analítico de duas juntas nas pernas e FK contralateral dos braços | grip do equipamento |
| `run` | IK de pernas com passada e elevação maiores, braços e ombros sincronizados | grip do equipamento |
| `jump` | arco vertical repetível, pernas recolhidas e braços elevados | grip do equipamento |
| `fall` | queda repetível de teste, pernas e braços abertos | abre mãos livres |
| `attack` | IK analítico do braço direito, clavícula, cabeça e rotação axial | `SwordGrip` à direita |
| `dodge` | IK das duas pernas mantendo apoio, rotação axial e proteção dos braços | fecha mãos livres |
| `death` | queda amortecida e relaxamento dos membros | `Open` |

As poses manuais `Open`, `Relaxed`, `Fist`, `SwordGrip`, `ShieldGrip` e `Point` substituem temporariamente a escolha automática do estado/equipamento.

## Matemática

Os alvos articulares são quaternions construídos no espaço local do osso. A transição usa:

`q(t+dt) = slerp(q(t), q_target, 1-exp(-speed×dt))`

O passo é limitado a `0.05 s`. A solução IK de braços e pernas aplica lei dos cossenos a cadeias de duas juntas. O tornozelo compensa quadril + joelho para manter o pé paralelo ao plano do chão durante os ciclos locomotores. FK é a composição normal da hierarquia local existente.

## Validação

`npm run validate:animation` percorre 240 quadros de cada estado e verifica matrizes finitas, escala imutável, posições locais das juntas imutáveis, contato de pelo menos um pé nos estados apoiados e distância máxima dos ossos das seis poses de mão ao punho.

## Limitação estrutural

O esqueleto existente não possui ossos separados `Hips`, `Spine` e `Chest`. Assim, balanço de quadril/tronco é aplicado ao grupo corporal e às clavículas, sem modificar geometria ou introduzir ossos que alterariam a estrutura atual. IK usa o chão plano do lobby; terreno irregular exigirá raycast e normal de contato.

