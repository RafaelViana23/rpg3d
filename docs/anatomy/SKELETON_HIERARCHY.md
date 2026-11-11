# Hierarquia do esqueleto

## Corpo atual

```text
parts
├── Neck (0, 2.02, 0)
│   └── Head (0, 0.15, 0)
├── Clavicle_L (0, 1.82, 0)
│   └── UpperArm_L (-shoulder, 0.09, 0)
│       └── Forearm_L (-0.075, -0.38, 0.01)
│           └── handRig.left
├── Clavicle_R (0, 1.82, 0)
│   └── UpperArm_R (+shoulder, 0.09, 0)
│       └── Forearm_R (+0.075, -0.38, 0.01)
│           └── handRig.right
├── Thigh_L (-0.18, 1.08, 0)
│   └── Shin_L (-0.015, -0.45, 0.015)
│       └── Ankle_L (0, -0.47, 0.02)
│           └── Foot_L (0, -0.03, 0.12)
└── Thigh_R (+0.18, 1.08, 0)
    └── Shin_R (+0.015, -0.45, 0.015)
        └── Ankle_R (0, -0.47, 0.02)
            └── Foot_R (0, -0.03, 0.12)
```

Os 19 ossos corporais usam esses nomes no runtime. A etapa de skinning adicionou `Hips`, `Spine` e `Chest` por migração controlada. `validate:anatomy` compara automaticamente nomes, pais, posições locais e quaternions com `skeleton.json`; qualquer divergência passa a ser erro de validação.

## Cada mão: 27 ossos

```text
Wrist_L/R
└── Hand_L/R
    ├── Palm
    ├── Thumb_CMC → Thumb_MCP → Thumb_IP → Thumb_Tip
    ├── Index_Metacarpal → Index_MCP → Index_PIP → Index_DIP → Index_Tip
    ├── Middle_Metacarpal → Middle_MCP → Middle_PIP → Middle_DIP → Middle_Tip
    ├── Ring_Metacarpal → Ring_MCP → Ring_PIP → Ring_DIP → Ring_Tip
    └── Pinky_Metacarpal → Pinky_MCP → Pinky_PIP → Pinky_DIP → Pinky_Tip
```

Posições numéricas estão em `skeleton.json`. Todos os filhos usam posições locais; nenhuma posição global é armazenada no rig.

