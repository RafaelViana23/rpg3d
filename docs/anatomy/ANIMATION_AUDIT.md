# Auditoria do rig e calibração visual

## Referenciais confirmados no código

- Mundo e corpo: `+Y` para cima, `+Z` para frente e `+X` para a direita.
- Braços e pernas são cadeias locais; nenhuma posição mundial é escrita em ossos filhos.
- Dedos estendem em `-Y`. Como a face de contato da palma está em `+Z`, flexão anatômica usa rotação local **negativa em X**.
- O cabo da espada cruza a palma no eixo local `X`; a lâmina sai pelo lado do polegar.
- O socket é filho de `Hand_L/R`, em posição local, portanto não existe correção mundial circular entre mão e arma.
- Quaternions corporais e das mãos são reconstruídos como alvos locais a cada quadro e interpolados por `slerp`; deltas não são acumulados.

## Problemas encontrados e correções

| Antes | Depois |
|---|---|
| Curl positivo levava dedos para `-Z`, oposto ao cabo em `+Z` | Limites e curls invertidos para flexão local em `-X` |
| Open completamente rígida | Curvatura e abertura pequenas e progressivas |
| Relaxed pouco anatômica | Indicador mais aberto; anelar e mínimo progressivamente fechados; polegar em oposição |
| Palmas frontais no Idle | Punhos laterais, polegares orientados para a frente |
| Espada horizontal e próxima do corpo | Guarda baixa, para fora e para baixo |
| Attack senoidal sem fases | Guarda, antecipação, impacto, follow-through e recuperação em 0,82 s |
| Salto terminava congelado | Ciclo com preparação, fase aérea e aterrissagem amortecida |
| Teste exigia apoio contínuo na corrida | Corrida permite fase aérea; Walk/Idle/Attack/Dodge mantêm apoio |

## Preservação

Não foram alterados hierarquia, pivôs, posições locais da bind pose, `skinIndices`, `skinWeights`, inverse bind matrices, geometria corporal, escala geométrica ou personalização.

## Debug

O botão `Debug` do lobby mostra `SkeletonHelper` e eixos RGB nos dois sockets e nos dois pés. O overlay inicia desligado e não participa do build visual normal.

## Limitações

- Sem `Hips`, `Spine` e `Chest`, transferência de peso e torção do tronco continuam limitadas ao grupo corporal, clavículas e cabeça.
- O chão é plano; terrenos arbitrários exigem raycast e alinhamento pela normal.
- A mão é procedural e o cabo tem seção fixa. Grip adaptativo para armas com raios diferentes exigirá fornecer o raio do `WeaponGripFrame` ao solver.
