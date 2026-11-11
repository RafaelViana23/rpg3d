# Limites articulares

Fonte: `HandRig.ts` e amplitudes efetivamente usadas por `character.ts`. Valores em graus.

| Articulação | X | Y | Z |
|---|---:|---:|---:|
| Wrist | `[-55,55]` | `[-90,90]` | `[-35,35]` |
| Hand | `[-12,18]` | `[-8,8]` | `[-10,10]` |
| Palm | `[-8,12]` | `[-6,6]` | `[-8,8]` |
| Thumb CMC | `[-25,55]` | `[-45,30]` | `[-50,35]` |
| Thumb MCP | `[-10,70]` | `[-20,20]` | `[-18,18]` |
| Thumb IP | `[0,85]` | `[-8,8]` | `[-8,8]` |
| Finger metacarpal | `[-8,16]` | `[-8,8]` | `[-15,15]` |
| Finger MCP | `[-15,95]` | `[-20,20]` | `[-22,22]` |
| Finger PIP | `[-8,105]` | `[-12,12]` | `[-8,8]` |
| Finger DIP | `[0,85]` | `[-7,7]` | `[-7,7]` |

`HandAnimator` constrói um Euler `XYZ`, aplica clamp e converte o resultado para quaternion. A interpolação usa `Quaternion.slerp` com `alpha = 1-exp(-speed×dt)`.

O corpo ainda não possui uma tabela formal de limites; as animações atuais aplicam amplitudes diretamente em `character.ts`. Todos os ossos corporais, porém, são identificáveis nominalmente e comparados com `skeleton.json`.

