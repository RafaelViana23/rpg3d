# Sockets de equipamentos

Cada `HandRig` possui um `THREE.Group` não ósseo chamado `equipmentSocket.left/right`, filho de `Hand_L/R`.

| Equipamento | Posição local do socket | Pose |
|---|---|---|
| espada | `(0,-0.055,0.068)` | `SwordGrip` |
| escudo | `(0,-0.052,0.064)` | `ShieldGrip` |
| poção | `(0,-0.058,0.066)` | `ShieldGrip` |
| nenhum | `(0,-0.055,0.068)` | `Relaxed` |

Objetos devem ser modelados com origem no centro físico da empunhadura. A espada usa o eixo X: cabo horizontal na palma e lâmina no sentido do polegar. O socket nunca recebe coordenadas globais.

