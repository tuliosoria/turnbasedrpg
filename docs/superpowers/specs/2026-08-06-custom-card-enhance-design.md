# Carta "Outros" — Escrita livre + Aprimorar com IA (Design)

**Goal:** Permitir que o jogador escreva livremente uma carta de projeto (título + texto) e clique em "Aprimorar com IA"; a IA preserva o texto do jogador (só corrige gramática/clareza) e adiciona as regras (categoria, duração, custos, requisitos, riscos, efeitos). O jogador pode editar texto e regras antes de iniciar.

## Fluxo
1. Diálogo "Criar minha carta (Outros)": campos **Título** e **Texto** livres.
2. Botão **"Aprimorar com IA"** → IA retorna uma prévia (não persistida) preservando o texto e adicionando mecânicas + nota de balanceamento.
3. O jogador edita texto e/ou regras (duração, custos, requisitos, riscos).
4. Botão **"Iniciar projeto"** → servidor valida, cobra/roteia, persiste.

## Balanceamento e integridade
- O servidor sempre re-valida e re-aplica `enforceGmTriggers` sobre os valores finais.
- Se o jogador **alterar qualquer regra** (custo/duração/efeito), a carta é forçada a `requiresGmApproval = true` (vai ao mestre), com aviso na UI.
- Edições apenas no texto mantêm a decisão de balanceamento da IA (auto-aprovação se equilibrada).
- Slot limit, afford check e cobrança seguem a mesma lógica de `startProjectFromTemplate`.

## Mudanças técnicas
- **shared:** tipos `EnhanceCardInput`, `CustomCardDraft`.
- **backend AI:** `buildEnhanceCardPrompt` (preserva texto do jogador). Reusa parser/enforceGmTriggers.
- **backend rotas:** `POST /api/player/project/enhance` (prévia, sem salvar) e `POST /api/player/project/custom` (valida, força mestre se regras editadas, cobra/roteia, salva). Remove `analyze`.
- **backend validação:** `parseEnhanceCardBody`, `parseCustomCardDraftBody`.
- **frontend:** substitui `analyzeCustomProject` por `enhanceCustomProject` + `startCustomProject` (interface/http/mock); reescreve o diálogo em HouseProjectsPanel.

## Testes
- backend: prompt enhance preserva texto; startCustomProject (regras editadas → PENDING_GM; equilibrada não editada → ACTIVE; slot limit; afford); parsers.
- frontend: mockClient enhance+custom; diálogo aprimorar→iniciar.
