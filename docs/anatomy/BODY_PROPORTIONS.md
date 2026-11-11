# Proporções extraídas

Valores em unidades de cena, extraídos de `src/character.ts` e do bounding box em runtime.

| Região | Intervalo/medida |
|---|---:|
| Personagem completo, Y | `0.025 … 2.790` |
| Quadril/pivô da coxa | `Y=1.080`, `X=±0.180` |
| Joelho | deslocamento local `Y=-0.450` |
| Tornozelo | deslocamento local `Y=-0.470` |
| Pé | deslocamento local `(0,-0.030,+0.120)` |
| Ombro visual | `Y=1.910`, `X=±0.430` masculino; `±0.340` feminino |
| Clavícula | `(0,1.820,0)` |
| Cotovelo | deslocamento local `(±0.075,-0.380,+0.010)` |
| Punho | deslocamento do cotovelo `(±0.055,-0.350,+0.025)` |
| Base do pescoço | `Y=2.020` |
| Cabeça | deslocamento local do pescoço `(0,0.150,0)` |
| Topo da cabeça/cabelo | `Y=2.790` |

As proporções são estilizadas low-poly. Não devem ser substituídas por médias humanas sem uma alteração explícita de direção artística.

Os tipos corporais alteram ombro, cintura e quadril. A altura usa escala uniforme e, portanto, preserva todas as razões.

