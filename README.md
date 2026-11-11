# Aincrad — Lobby de Criação de Personagem

Projeto **Three.js + TypeScript + Vite** com personagem low-poly gerado proceduralmente por `BufferGeometry`. Não utiliza GLB, FBX, imagens ou texturas externas.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite. Para compilar: `npm run build`.

## Funcionalidades

- Personagem 3D com cabeça, tronco, braços, pernas, roupa, cabelo, olhos, espada e acessórios gerados por código.
- Dois tipos corporais; três classes e penteados; paletas de pele, cabelo, olhos e roupa; altura.
- Câmera orbital e zoom, iluminação e sombras, animações procedurais demonstrativas.
- Nome, sorteio de aparência, rascunho automático e botão **Criar personagem** com persistência em `localStorage`.

## Arquitetura

- `src/character.ts`: malhas procedurais e animações. `loft()` constrói superfícies por anéis de vértices.
- `src/main.ts`: Three.js, palco, interface, eventos e persistência.
- `src/style.css`: visual responsivo do lobby.

## Próximas etapas para o Codex

1. Melhorar topologia do rosto, cabelo e mãos; corrigir interseções e fechar as extremidades das malhas.
2. Implementar rig/`SkinnedMesh` com articulações reais, animações com transições e equipamentos presos às mãos.
3. Criar visualização de frente/costas e salvar vários slots de personagem.
4. Migrar persistência de `localStorage` para backend/autenticação, com validação de nome.
5. Fazer testes visuais e de desempenho em dispositivos móveis.

**Importante:** o protótipo não implementa multiplayer, backend, criação de contas nem um rig profissional. A malha é procedural, mas ainda é composta de seções anatômicas independentes.
