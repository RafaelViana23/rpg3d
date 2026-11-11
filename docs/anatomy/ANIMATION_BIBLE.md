# RPG3D-MPV — Especificação anatômica de animações v1

**Finalidade:** corrigir qualidade visual de Idle, Walk, Run, Jump, Fall, Attack, Dodge, Death e das poses Open, Relaxed, Fist, SwordGrip, ShieldGrip, Point. Este documento especifica comportamento desejado; não afirma ter inspecionado o código local.

## 1. Estado conhecido e diagnóstico

Personagem procedural com altura geométrica **2,765 unidades**; rig corporal nomeado (Neck, Head, Clavicle_L/R, UpperArm_L/R, Forearm_L/R, Thigh_L/R, Shin_L/R, Ankle_L/R, Foot_L/R) e mãos articuladas. Não há Hips, Spine e Chest independentes. Na captura enviada, durante Attack a espada aparece perto do rosto, o braço elevado e a pegada pouco convincente. A causa exata exige inspeção do código: investigar sockets, eixos locais, ordem dos quaternions, IK e composição de poses.

**Regra:** matrizes finitas e dedos próximos do punho não comprovam animação natural. Validar silhueta, contato, equilíbrio, penetrações e continuidade temporal.

## 2. Referencial e matemática

- Three.js usa +Y para cima. Documentar qual direção local do modelo é a frente, antes de definir ângulos.
- FK: `M_world(b) = M_world(parent) * M_local(b)`.
- Delta em referencial da bind pose: `q_final = q_bind * q_delta`; verificar a ordem na implementação real.
- Skinning: `v' = Σ w_i M_boneWorld_i M_inverseBind_i v` (forma resumida; respeitar `bindMatrix`/`bindMatrixInverse` reais).
- Para alvos globais de ossos filhos, converter pelo inverso da matriz do pai; não copiar world position para `bone.position`.
- Recalcular poses a partir da bind pose a cada frame, nunca acumular deltas sem controle.
- `slerp` de quaternions normalizados, continuidade de sinal e curvas de aceleração suaves.
- Limites articulares no referencial anatômico local, com swing–twist quando necessário.

## 3. Preparação do rig

1. Ler `docs/anatomy/skeleton.json` e conferir bind pose, pivôs, comprimentos, eixos e nomes.
2. Criar modo debug: ossos, eixos RGB, IK targets, pole vectors, centro de massa aproximado, sockets, contato dos pés e hitboxes.
3. Registrar pose neutra e pose Relaxed; verificar cotovelos, joelhos, punhos e dedos sem arma.
4. Ordem de avaliação: bind → locomoção → ação superior → IK de contato → mãos/pegada → correção de pés → limites → skinning.
5. Preservar escala 2,765 e não alterar hierarquia silenciosamente.

## 4. Limites orientativos (calibrar contra eixos reais)

| Junta | Meta visual inicial |
|---|---|
| Cotovelo | flexão ~0–145°, sem hiperextensão |
| Joelho | flexão ~0–135°, sem dobrar para trás |
| Punho | flexão/extensão moderada até ~60–70°; desvio lateral ~20–30° |
| MCP | flexão até ~90°, pequena abertura lateral |
| PIP | flexão até ~100° |
| DIP | flexão até ~70°, correlacionada com PIP |
| Polegar | oposição tridimensional pela CMC; não agir como quinto dedo paralelo |

Faixas heurísticas de animação estilizada, não medidas extraídas do projeto nem limites clínicos.

## 5. Comportamento por estado

### Idle
Pés na largura dos quadris; joelhos destravados; ombros relaxados; cotovelos ligeiramente flexionados; dedos em Relaxed. Respiração e transferência de peso discretas. Arma, se equipada, fica em guarda baixa, sem ponta no rosto, pés ou tronco. **Reprovar:** T-pose, ombros encolhidos, pés deslizando, punhos fechados sem motivo.

### Walk
Ciclo contato → apoio → impulso → balanço; oscilação de braços contralateral às pernas, exceto braço com arma; tronco estável. Sincronizar ciclo com distância percorrida e velocidade. Foot locking apenas na fase de apoio, com transferência de peso. **Reprovar:** moonwalk, joelhos invertidos, pés atravessando piso ou deslizando em apoio.

### Run
Passadas maiores, leve inclinação frontal, joelhos flexionando na recuperação, cotovelos dobrados, arma em pose segura. Permitir fase aérea: **não** exigir pé apoiado em todos os frames. Soltar foot lock na fase aérea. **Reprovar:** corrida rígida, pés colados ao chão o tempo todo, mãos cruzando o rosto.

### Jump
Preparação com flexão de joelhos → impulso → subida → ápice → descida → aterrissagem amortecida. Usar velocidade vertical/contato para transições. Reduzir foot IK no ar. **Reprovar:** pé preso ao piso durante subida, aterrissagem sem flexão.

### Fall
Pernas levemente flexionadas, braços para equilíbrio, arma sem atravessar corpo. Desativar foot lock em fase aérea; preparar aterrissagem quando houver detecção de chão. **Reprovar:** pose de morte confundida com queda comum.

### Attack
Fases: guarda → antecipação → aceleração → janela de impacto → follow-through → recuperação. Duração inicial indicativa ~0,55–0,85 s para golpe simples. Ombro conduz arco, cotovelo flexiona/estende sem hiperextensão, punho faz ajuste pequeno. Lâmina percorre arco longe do rosto; não atravessa cabeça ou tronco. Mão envolve cabo com polegar oposto e dedos adaptados à seção do cabo. Hitbox só na janela de impacto. **Reprovar:** espada colada ao rosto, mão descolada do cabo, cotovelo invertido, golpe sem antecipação, braço preso no alto ao retornar ao Idle.

### Dodge
Antecipação curta → deslocamento → recuperação. Joelhos flexionados, peso deslocado, arma protegida. Para rolamento, exigir rotação e colisão próprias; não girar apenas o grupo sem checar piso. Sincronizar deslocamento, animação e janela de invulnerabilidade se existir. **Reprovar:** pés travados durante deslocamento ou teletransporte visual.

### Death
Reação → desequilíbrio → queda → pose final. Desativar locomoção e IK incompatível; relaxar dedos; equipamento permanece na mão ou é solto por evento explícito. Pose final persistente até respawn. **Reprovar:** personagem congelado em pé ou atravessando chão.

## 6. Poses das mãos

- **Open:** dedos estendidos naturalmente, levemente curvados e separados; polegar abduzido.
- **Relaxed:** flexão progressiva leve; anelar e mínimo um pouco mais fechados; polegar repousa próximo do indicador.
- **Fist:** fechamento MCP → PIP → DIP; polegar por fora, sem atravessar palma ou dedos.
- **SwordGrip:** dedos curvam em torno do cabo real; anelar e mínimo firmam; polegar faz oposição; punho próximo ao eixo do antebraço; não usar apenas ângulos fixos independentes do tamanho do cabo.
- **ShieldGrip:** dedos envolvem alça; escudo orientado pelo antebraço; não aplicar a pose à outra mão automaticamente.
- **Point:** indicador estendido, outros três flexionados, polegar apoiado sem interseções.

**Transições:** interpolar por junta com ordem de fechamento; não abrir mão mantendo arma rigidamente presa sem uma etapa de soltar. Mistura de poses deve preservar bind pose e pesos corretos.

## 7. Grip Solver e sockets

Definir `PalmGripFrame` na palma e `WeaponGripFrame` no cabo, ambos com posição e orientação locais. Uma mão é autoridade do objeto rígido. Exemplo de composição (ajustar convenção de frames):

`M_weaponWorld = M_handWorld * M_palmGrip * inverse(M_weaponGrip)`

Evitar dependência circular mão↔arma no mesmo frame. Validar distância palma-cabo, alinhamento angular, penetração, posição da guarda e ponta da lâmina. Para escudo, usar attachment de antebraço e alça da mão. Não corrigir arma com `position.set` mundial em cada frame.

## 8. FK, IK, contato e camadas

- FK controla intenção do gesto; IK resolve contato (pés no piso, mão no cabo, escudo, alvos).
- IK de dois segmentos com comprimentos L1 e L2: alvo alcançável se `|L1-L2| ≤ d ≤ L1+L2`; aplicar margem e pole vector estável.
- Evitar inversão de cotovelo/joelho quando alvo cruza eixo do membro; registrar clamp.
- Pé plantado na fase de apoio e liberado no balanço; jamais travar pé no ar.
- Misturar IK por estado/fase, não com peso fixo global.
- Prioridade inicial: Death > Dodge > Attack > Jump/Fall > Run > Walk > Idle.
- Camadas: corpo inteiro, parte superior, mãos. Ao sair do estado, zerar influências residuais.
- Transições iniciais: Idle↔Walk ~0,15–0,25 s; Walk↔Run ~0,20–0,35 s; ajustar visualmente.

## 9. Limitação estrutural e evolução

Sem Hips/Spine/Chest independentes, torção de tronco, respiração e transferência de peso são limitadas. **Primeiro** corrigir o que é possível com o rig atual. Se persistir rigidez, planejar migração versionada `rigVersion: 2` com novos ossos, novos pesos, bind pose e testes de compatibilidade. Não acrescentar ossos de surpresa em correção de animação.

## 10. Validação automatizada + visual

Para cada estado, gravar frames de início, 25%, 50%, 75% e fim, em vistas frontal/lateral/traseira. Para estados cíclicos, inspecionar também a emenda entre ciclos. Registrar overlays de ossos, alvos IK e sockets.

**Testes numéricos:** matrizes finitas; quaternions normalizados; continuidade angular; limites de juntas; distâncias entre palma e cabo; alcance IK; interseção simplificada de lâmina com cabeça/tronco; contato do pé em apoio; deslocamento de pé durante foot lock; ausência de deslocamentos abruptos no blend; regressão da bind pose.

**Testes perceptuais obrigatórios:** silhueta humana; mãos realmente fechadas em torno do cabo; ombros não encolhidos; cotovelos/joelhos dobrando no sentido correto; nenhuma lâmina no rosto; equilíbrio e intenção legíveis; transições sem estalos. Teste automatizado aprovado **não substitui** revisão visual.

**Critérios de aceite por prioridade:**
1. Relaxed + Open + Fist visualmente naturais, sem arma.
2. SwordGrip com cabo imóvel em relação à palma durante Idle e Attack.
3. Idle com ombros relaxados e espada fora do rosto.
4. Walk/Run com contato de pés coerente e sem escorregamento visível.
5. Attack com antecipação, arco seguro, impacto e recuperação.
6. Jump/Fall, Dodge, Death sem interseções e com transições limpas.
7. Seis poses das mãos e oito estados aprovados em 3 ângulos de câmera.

## 11. Plano de implementação para Codex

**Fase A — Auditoria:** medir rig, eixos, bind pose, sockets e gravar capturas de referência. Não modificar código ainda.

**Fase B — Mãos:** corrigir Open, Relaxed, Fist, Point; implementar Grip Solver para SwordGrip/ShieldGrip. Validar palma/cabo em repouso e movimento.

**Fase C — Idle e locomotion:** naturalizar Idle, Walk e Run com foot locking por fase e estabilidade corporal.

**Fase D — Ações:** Attack com fases explícitas; Jump/Fall; Dodge; Death; transições e prioridades.

**Fase E — Regressão:** executar `npm run validate:anatomy`, `npm run validate:animation`, `npm run build`; capturar comparações visuais antes/depois e registrar limitações remanescentes.

Não mudar geometria, aparência, personalização, escala nem bind pose sem autorização específica. Reportar alterações de hierarquia e pesos separadamente.
