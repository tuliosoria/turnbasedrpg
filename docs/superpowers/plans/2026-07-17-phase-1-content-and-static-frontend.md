# Phase 1: Content & Static Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared campaign-content package and a fully navigable, responsive React/Vite frontend backed by a mock API, so the whole game UX works locally without AWS.

**Architecture:** npm workspaces monorepo (`shared/`, `frontend/`). `shared/` is the single source of truth for campaign content and types (`@ravenloft/content`). The frontend imports it and talks to an `ApiClient` interface whose Phase-1 implementation is an in-memory **mock** (Phases 2–3 swap in an HTTP implementation). Content correctness is guarded by a `validate-content.ts` script.

**Tech Stack:** TypeScript 5, npm workspaces, React 18, Vite 5, react-router-dom 6, Vitest 2 + @testing-library/react 16 + jsdom.

**Source spec:** `docs/campaign-spec.md` (in-repo copy). Design: `docs/superpowers/specs/2026-07-17-ravenloft-winter-mvp-design.md`.

**Scope note:** This is Plan 1 of 4. Plan 2 = SAM backend + DynamoDB + auth; Plan 3 = admin + real API wiring; Plan 4 = deploy. This plan produces working, testable software on its own (a runnable mock-backed site).

---

## File structure produced by this plan

```
turnbasedrpg/
  package.json                 # workspaces root + scripts
  tsconfig.base.json
  .gitignore  .nvmrc
  shared/
    package.json  tsconfig.json
    src/
      types.ts                 # all domain types (spec §31)
      campaign.ts              # CampaignDefinition + initial state
      houses.ts                # 6 HouseDefinition
      turns/turn-001.ts        # Turn 1 TurnDefinition (publishedResult: undefined)
      version.ts               # CONTENT_VERSION
      index.ts                 # barrel export
  scripts/
    validate-content.ts        # content invariants
    validate-content.test.ts
  frontend/
    package.json  tsconfig.json  tsconfig.node.json  vite.config.ts
    index.html
    src/
      main.tsx  App.tsx
      theme.css
      types/api.ts
      api/client.ts            # ApiClient interface
      api/mockClient.ts        # in-memory mock implementation
      auth/playerSession.ts  auth/adminSession.ts
      components/
        LoadingState.tsx  KingdomStats.tsx  HouseCard.tsx
        CardChoice.tsx  PrivatePanel.tsx  AdminChoiceTable.tsx
      pages/
        LandingPage.tsx  ClaimHousePage.tsx  LoginPage.tsx
        GamePage.tsx  AdminPage.tsx
      test/setup.ts
```

---

### Task 1: Initialize the monorepo workspaces

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
dist/
.env
.env.*
*.local
coverage/
.DS_Store
.aws-sam/
```

- [ ] **Step 3: Create the root `package.json`**

```json
{
  "name": "turnbasedrpg",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "shared",
    "frontend"
  ],
  "scripts": {
    "build:shared": "npm run build --workspace shared",
    "validate-content": "npm run build:shared && tsx scripts/validate-content.ts",
    "dev": "npm run dev --workspace frontend",
    "build": "npm run build:shared && npm run build --workspace frontend",
    "test": "npm run test --workspace shared --if-present && npm run test --workspace frontend"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 5: Install root dev dependencies**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .nvmrc package-lock.json
git commit -m "chore: initialize npm workspaces monorepo"
```

---

### Task 2: Shared package skeleton + domain types

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@ravenloft/content",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsc -p tsconfig.json --noEmit"
  }
}
```

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `shared/src/types.ts` (verbatim domain types from spec §31)**

```ts
export type HouseId =
  | "vargen"
  | "auremont"
  | "valerius"
  | "iron-guild"
  | "pale-bell"
  | "ravens";

export type CardCategory =
  | "military"
  | "logistics"
  | "politics"
  | "administration"
  | "investigation"
  | "religion"
  | "engineering"
  | "popular-support"
  | "sacrifice";

export interface KingdomState {
  provisions: number;
  militaryStrength: number;
  unity: number;
  publicOrder: number;
  enemyKnowledge: number;
  undeadAdvance: number;
}

export interface HouseDefinition {
  id: HouseId;
  name: string;
  subtitle: string;
  motto: string;
  publicIntroduction: string;
  privateIntroduction: string;
  leaderName: string;
  strength: string;
  weakness: string;
  publicInterest: string;
  privateObjective: string;
  privateConcern: string;
}

export interface TurnCard {
  id: string;
  houseId: HouseId;
  title: string;
  categories: CardCategory[];
  description: string;
  contribution: string;
  risk?: string;
  cost?: string;
  adminTags: string[];
}

export interface HouseTurnContent {
  privateInformation: string;
  cardIds: [string, string, string];
}

export interface PublishedTurnResult {
  publicResult: string;
  stateAfter: KingdomState;
  houseResults: Partial<Record<HouseId, string>>;
  discoveries: string[];
}

export interface TurnDefinition {
  id: number;
  slug: string;
  title: string;
  publicEvent: string;
  stateBefore: KingdomState;
  houseContent: Record<HouseId, HouseTurnContent>;
  cards: TurnCard[];
  adminResolutionNotes: string;
  publishedResult?: PublishedTurnResult;
}

export interface CampaignDefinition {
  id: string;
  title: string;
  activeTurnId: number;
  introduction: string;
  initialState: KingdomState;
}

export const HOUSE_IDS: HouseId[] = [
  "vargen",
  "auremont",
  "valerius",
  "iron-guild",
  "pale-bell",
  "ravens",
];
```

- [ ] **Step 4: Install the shared workspace and typecheck**

Run: `npm install && npm run test --workspace shared`
Expected: PASS (tsc `--noEmit` exits 0).

- [ ] **Step 5: Commit**

```bash
git add shared/package.json shared/tsconfig.json shared/src/types.ts package-lock.json
git commit -m "feat(content): add shared package and domain types"
```

---

### Task 3: Campaign definition, initial state, and content version

**Files:**
- Create: `shared/src/version.ts`
- Create: `shared/src/campaign.ts`

- [ ] **Step 1: Create `shared/src/version.ts`**

```ts
export const CONTENT_VERSION = "2026-07-17-turn-001";
```

- [ ] **Step 2: Create `shared/src/campaign.ts` (initial state from spec §9; introduction is the public prologue §7)**

Copy the `introduction` string verbatim from the public prologue in `docs/campaign-spec.md` §7 "Prólogo público para todos os jogadores" (lines 219–301). Preserve paragraph breaks with `\n\n`. The numeric initial state comes from spec §9.

```ts
import type { CampaignDefinition, KingdomState } from "./types.js";

export const INITIAL_STATE: KingdomState = {
  provisions: 6,
  militaryStrength: 5,
  unity: 5,
  publicOrder: 6,
  enemyKnowledge: 0,
  undeadAdvance: 1,
};

export const campaign: CampaignDefinition = {
  id: "winter-dead",
  title: "Ravenloft: O Inverno dos Mortos",
  activeTurnId: 1,
  introduction: [
    "Durante quase trezentos anos, o Reino de Valdren sobreviveu cercado pelas Brumas.",
    // ... continue with every paragraph of spec §7, each as its own array element ...
    "E que, se as Grandes Casas não agirem juntas, cada soldado perdido tornará o inimigo ainda mais forte.",
  ].join("\n\n"),
  initialState: INITIAL_STATE,
};
```

Note: replace the `// ...` comment by pasting each remaining paragraph of §7 as a quoted array element in order. Do not summarize — copy the text exactly.

- [ ] **Step 3: Typecheck**

Run: `npm run test --workspace shared`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add shared/src/version.ts shared/src/campaign.ts
git commit -m "feat(content): add campaign definition and initial state"
```

---

### Task 4: Houses content (6 HouseDefinition)

**Files:**
- Create: `shared/src/houses.ts`

**Content source:** `docs/campaign-spec.md` §10–15. Each house's fields map as: `publicIntroduction` ← "Introdução pública", `leaderName`+`privateIntroduction` region ← "Líder" / "Introdução privada", `strength` ← "Força", `weakness` ← "Fraqueza", `publicInterest` ← "Interesse público", `privateObjective` ← "Objetivo particular", `privateConcern` ← "Preocupação", `motto` ← "Lema". Copy Portuguese text **verbatim**, preserving paragraph breaks as `\n\n`.

House metadata (fixed — do not change ids/subtitles):

| id | name | subtitle | spec lines |
|----|------|----------|-----------|
| vargen | Casa Vargen | Os Lobos do Norte | 364–446 |
| auremont | Casa Auremont | Os Senhores da Colheita | 448–528 |
| valerius | Casa Valerius | O Sangue da Coroa | 530–612 |
| iron-guild | Guilda do Ferro Negro | Os Mestres das Fornalhas | 614–688 |
| pale-bell | Ordem do Sino Pálido | Guardiões dos Vivos e dos Mortos | 690–764 |
| ravens | Irmandade dos Corvos | Aqueles que Sabem Primeiro | 766–842 |

- [ ] **Step 1: Create `shared/src/houses.ts` with the fully-worked Vargen entry, then transcribe the other five from the spec**

The Vargen entry below is complete and correct (transcribed from spec lines 364–446). Use it as the exact pattern. For the other five houses, create objects with the identical shape, filling every string verbatim from the referenced spec lines. **Do not leave any field empty and do not summarize.**

```ts
import type { HouseDefinition, HouseId } from "./types.js";

export const houses: Record<HouseId, HouseDefinition> = {
  vargen: {
    id: "vargen",
    name: "Casa Vargen",
    subtitle: "Os Lobos do Norte",
    motto: "Primeiro a muralha. Depois o homem.",
    leaderName: "Lady Elira Vargen",
    publicIntroduction: [
      "A Casa Vargen governa as Marcas do Norte há mais de duzentos anos.",
      "Seus soldados defendem as passagens das montanhas, protegem aldeias isoladas e mantêm as fortalezas que separam o coração de Valdren das terras selvagens.",
      "Os Vargen não são a Casa mais rica nem a mais influente. Seus castelos são austeros, seus campos produzem pouco e seus exércitos dependem dos alimentos enviados pela Casa Auremont.",
      "Entretanto, nenhuma outra Casa conhece melhor as estradas, as montanhas e os perigos do Norte.",
      "O símbolo da Casa é um lobo cinzento diante de uma montanha branca.",
    ].join("\n\n"),
    strength: "Exército experiente, fortalezas e conhecimento do terreno.",
    weakness: "Poucos alimentos, pouca riqueza e tropas já desgastadas.",
    publicInterest: "Impedir que o Norte seja abandonado.",
    privateIntroduction: [
      "Você é Lady Elira Vargen.",
      "Durante dois meses, enviou mensagens ao Conselho alertando sobre desaparecimentos no Norte.",
      "Nenhuma resposta veio.",
      "Quando a aldeia de Hollen foi encontrada vazia, você pediu cinquenta soldados. A Coroa enviou cinco investigadores.",
      "Quando uma patrulha encontrou cadáveres caminhando na neve, você pediu autorização para convocar seus estandartes. A Casa Auremont recusou-se a fornecer provisões para uma mobilização baseada em rumores.",
      "Quando Varn enviou sua última mensagem, você pediu que o reino evacuasse as aldeias próximas.",
      "A Casa Valerius ordenou que a população permanecesse onde estava para evitar pânico.",
      "Agora Varn caiu.",
      "Um dos sobreviventes que chegou à sua fortaleza é seu sobrinho, Arlen Vargen. Ele comandava vinte homens na muralha oeste.",
      "Arlen afirma que os mortos não atacaram imediatamente.",
      "Eles cercaram a fortaleza e permaneceram imóveis durante três noites.",
      "Na quarta noite, o portão principal foi aberto por dentro.",
      "Arlen não sabe quem o abriu.",
      "Ele afirma que alguns soldados ouviram vozes de parentes mortos chamando por eles do lado de fora da muralha.",
      "Antes de fugir, Arlen viu uma figura montada em um cavalo morto, observando a fortaleza de uma colina.",
      "A figura não carregava uma espada.",
      "Carregava a coroa do antigo rei Halric V, desaparecida de seu túmulo há quase cento e cinquenta anos.",
      "Você não sabe se o Rei Pálido é Halric.",
      "Mas sabe que alguém abriu o túmulo real.",
    ].join("\n\n"),
    privateObjective:
      "Preservar pelo menos duas fortalezas do Norte até o fim da campanha.",
    privateConcern:
      "Caso as outras Casas recuem cedo demais, todo o Norte será transformado em parte do exército inimigo.",
  },

  // auremont: spec lines 448–528
  auremont: {
    id: "auremont",
    name: "Casa Auremont",
    subtitle: "Os Senhores da Colheita",
    motto: "", // ← paste "Lema" from spec (line ~464)
    leaderName: "", // ← "Líder" (line ~466)
    publicIntroduction: "", // ← "Introdução pública" (lines 450–462)
    strength: "", // ← "Força" (line ~474)
    weakness: "", // ← "Fraqueza" (line ~478)
    publicInterest: "", // ← "Interesse público" (line ~482)
    privateIntroduction: "", // ← "Introdução privada" (lines 484–518)
    privateObjective: "", // ← "Objetivo particular" (line ~522)
    privateConcern: "", // ← "Preocupação" (line ~526)
  },

  // valerius: spec lines 530–612  (same shape, fill verbatim)
  valerius: {
    id: "valerius",
    name: "Casa Valerius",
    subtitle: "O Sangue da Coroa",
    motto: "",
    leaderName: "",
    publicIntroduction: "",
    strength: "",
    weakness: "",
    publicInterest: "",
    privateIntroduction: "",
    privateObjective: "",
    privateConcern: "",
  },

  // iron-guild: spec lines 614–688
  "iron-guild": {
    id: "iron-guild",
    name: "Guilda do Ferro Negro",
    subtitle: "Os Mestres das Fornalhas",
    motto: "",
    leaderName: "",
    publicIntroduction: "",
    strength: "",
    weakness: "",
    publicInterest: "",
    privateIntroduction: "",
    privateObjective: "",
    privateConcern: "",
  },

  // pale-bell: spec lines 690–764
  "pale-bell": {
    id: "pale-bell",
    name: "Ordem do Sino Pálido",
    subtitle: "Guardiões dos Vivos e dos Mortos",
    motto: "",
    leaderName: "",
    publicIntroduction: "",
    strength: "",
    weakness: "",
    publicInterest: "",
    privateIntroduction: "",
    privateObjective: "",
    privateConcern: "",
  },

  // ravens: spec lines 766–842
  ravens: {
    id: "ravens",
    name: "Irmandade dos Corvos",
    subtitle: "Aqueles que Sabem Primeiro",
    motto: "",
    leaderName: "",
    publicIntroduction: "",
    strength: "",
    weakness: "",
    publicInterest: "",
    privateIntroduction: "",
    privateObjective: "",
    privateConcern: "",
  },
};
```

> The empty strings above are **transcription placeholders that the executing worker must fill from the cited spec lines before moving on** — Task 7's `validate-content` test asserts no house field is empty, so the build fails if any remain blank. This is intentional: it forces verbatim transcription rather than leaving gaps.

- [ ] **Step 2: Typecheck**

Run: `npm run test --workspace shared`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add shared/src/houses.ts
git commit -m "feat(content): add six house definitions"
```

---

### Task 5: Turn 1 definition (event, private info, 18 cards, admin notes)

**Files:**
- Create: `shared/src/turns/turn-001.ts`

**Content source:** `docs/campaign-spec.md` — event §16 (846–880), private info §17 (882–908), cards §18–23 (910–1112), admin notes §24 (1114–1172).

**adminTags vocabulary** (used by the admin to resolve the four challenges in §24; assign per card based on its category and effect):
`"military-contribution"`, `"logistics-contribution"`, `"administration-contribution"`, `"popular-support-contribution"`, `"investigation-contribution"`, `"religion-contribution"`, `"bridge-defend"`, `"bridge-destroy"`, `"bridge-demolition-prep"`.

**Category mapping** (Portuguese "Categoria:" → `CardCategory[]`):
`Militar`→`["military"]`, `Militar e Logística`→`["military","logistics"]`, `Logística`→`["logistics"]`, `Política`→`["politics"]`, `Administração`→`["administration"]`, `Investigação`→`["investigation"]`, `Religião`→`["religion"]`, `Engenharia`→`["engineering"]`, `Apoio Popular`→`["popular-support"]`, `Sacrifício`→`["sacrifice"]`. Combined categories (e.g. "Logística e Administração") map to both slugs.

**Card id scheme:** `"<houseId>-<slug>"`, kebab-case English slug of the title. The three Vargen ids (worked below) are `vargen-defend-bridge`, `vargen-retreat-droskar`, `vargen-destroy-bridge`. Assign the remaining 15 ids following the same pattern (e.g. `auremont-send-caravans`).

- [ ] **Step 1: Create `shared/src/turns/turn-001.ts` with the fully-worked Vargen slice, then transcribe the rest from the spec**

The `publicEvent`, `stateBefore`, Vargen `privateInformation`, and the three Vargen `TurnCard`s below are complete (transcribed from the spec). Fill the other five houses' `privateInformation` (§17, lines 888–908) and their 15 cards (§19–23, lines 944–1112) using the identical shape and the mappings above. `publishedResult` stays `undefined` (unpublished at content-authoring time).

```ts
import type { TurnDefinition, TurnCard, HouseId, HouseTurnContent } from "../types.js";
import { INITIAL_STATE } from "../campaign.js";

const cards: TurnCard[] = [
  // ---- Casa Vargen (spec §18, lines 910–942) ----
  {
    id: "vargen-defend-bridge",
    houseId: "vargen",
    title: "Defender a Ponte",
    categories: ["military"],
    description:
      "Envie soldados para manter a ponte aberta até que o maior número possível de refugiados atravesse.",
    contribution:
      "aumenta a Proteção da Retirada e mantém a ponte aberta por mais tempo.",
    risk: "sem apoio militar ou logístico, a Casa Vargen perde tropas.",
    adminTags: ["military-contribution", "bridge-defend"],
  },
  {
    id: "vargen-retreat-droskar",
    houseId: "vargen",
    title: "Recuar para Droskar",
    categories: ["military", "logistics"],
    description: "Abandone a estrada e concentre suas forças na fortaleza.",
    contribution:
      "fortalece Droskar e reduz a possibilidade de perda militar imediata.",
    risk:
      "centenas de refugiados ficam sem proteção e a Ordem Pública pode cair.",
    adminTags: ["military-contribution", "logistics-contribution"],
  },
  {
    id: "vargen-destroy-bridge",
    houseId: "vargen",
    title: "Destruir a Ponte",
    categories: ["sacrifice"],
    description:
      "Derrube a ponte assim que a maior parte de suas tropas atravessar.",
    contribution:
      "atrasa imediatamente os mortos e protege Droskar de um ataque direto.",
    risk: "refugiados ainda no Norte são abandonados e a Unidade pode cair.",
    adminTags: ["bridge-destroy"],
  },

  // ---- Casa Auremont (spec §19, lines 944–976): 3 cards ----
  //   Enviar Caravanas de Alimentos / Preservar as Reservas / Desviar os Refugiados para Harrow
  // ---- Casa Valerius (spec §20, lines 978–1010): 3 cards ----
  //   Mobilizar a Guarda Real / Ordenar a Destruição da Ponte / Declarar Estado de Emergência
  // ---- Guilda do Ferro Negro (spec §21, lines 1012–1044): 3 cards ----
  //   Fortificar a Ponte / Preparar a Demolição / Examinar as Armas de Varn
  // ---- Ordem do Sino Pálido (spec §22, lines 1046–1078): 3 cards ----
  //   Examinar os Feridos / Abrir os Templos / Queimar os Mortos
  // ---- Irmandade dos Corvos (spec §23, lines 1080–1112): 3 cards ----
  //   Infiltrar-se entre os Refugiados / Encontrar uma Rota Alternativa / Espalhar a Notícia
];

const houseContent: Record<HouseId, HouseTurnContent> = {
  vargen: {
    // spec §17 "Casa Vargen" (line 886)
    privateInformation:
      "Arlen Vargen reconhece um dos oficiais entre os refugiados. O homem afirma ter escapado de Varn, mas Arlen viu seu corpo ser colocado na cripta dois dias antes da queda da fortaleza.",
    cardIds: ["vargen-defend-bridge", "vargen-retreat-droskar", "vargen-destroy-bridge"],
  },
  auremont: {
    privateInformation: "", // ← spec §17 "Casa Auremont" (line 890)
    cardIds: ["auremont-send-caravans", "auremont-preserve-reserves", "auremont-divert-harrow"],
  },
  valerius: {
    privateInformation: "", // ← spec §17 "Casa Valerius" (line 894)
    cardIds: ["valerius-mobilize-guard", "valerius-order-bridge-destruction", "valerius-declare-emergency"],
  },
  "iron-guild": {
    privateInformation: "", // ← spec §17 "Guilda do Ferro Negro" (line 898)
    cardIds: ["iron-guild-fortify-bridge", "iron-guild-prepare-demolition", "iron-guild-examine-weapons"],
  },
  "pale-bell": {
    privateInformation: "", // ← spec §17 "Ordem do Sino Pálido" (line 902)
    cardIds: ["pale-bell-examine-wounded", "pale-bell-open-temples", "pale-bell-burn-dead"],
  },
  ravens: {
    privateInformation: "", // ← spec §17 "Irmandade dos Corvos" (line 906)
    cardIds: ["ravens-infiltrate-refugees", "ravens-find-alternate-route", "ravens-spread-news"],
  },
};

export const turn001: TurnDefinition = {
  id: 1,
  slug: "the-road-from-varn",
  title: "A Estrada de Varn",
  publicEvent: [
    "Ao amanhecer, os vigias da Fortaleza de Droskar avistam uma longa coluna de pessoas na Estrada Branca.",
    "São sobreviventes da queda de Varn.",
    "Mais de dois mil homens, mulheres e crianças caminham para o sul. Muitos estão feridos. Alguns carregam crianças pequenas. Outros arrastam carroças vazias.",
    "Atrás deles, a menos de um dia de distância, marcha uma força de aproximadamente quinhentos mortos.",
    "Os inimigos avançam lentamente, mas não descansam.",
    "A tempestade que se aproxima deve alcançar a estrada antes do anoitecer. Quando isso acontecer, a visibilidade será quase inexistente e a temperatura poderá matar qualquer pessoa sem abrigo.",
    "A ponte sobre o Rio Keld é a única passagem rápida para o sul.",
    "Caso a ponte seja destruída, os mortos serão atrasados por vários dias.",
    "Porém, nem todos os refugiados conseguirão atravessar a tempo.",
    "A Fortaleza de Droskar pode receber aproximadamente oitocentas pessoas sem comprometer completamente suas reservas. A cidade de Harrow, dois dias ao sul, pode receber o restante, desde que alimentos e escolta sejam enviados.",
    "Há ainda um problema.",
    "Entre os refugiados existem soldados de Varn.",
    "Alguns estão gravemente feridos.",
    "Um deles morreu durante a madrugada.",
    "Ao nascer do sol, seu corpo desapareceu.",
    "O Conselho precisa agir antes do anoitecer.",
  ].join("\n\n"),
  stateBefore: INITIAL_STATE,
  houseContent,
  cards,
  adminResolutionNotes: [
    // spec §24 (lines 1114–1172) — transcribe verbatim, preserving the four challenges and the "Primeira pista possível".
  ].join("\n\n"),
  publishedResult: undefined,
};
```

> The empty `privateInformation` strings, the 15 unwritten cards, and the empty `adminResolutionNotes` are transcription work the worker must complete from the cited spec lines. Task 7's validator asserts exactly 18 cards, non-empty private info for all 6 houses, and non-empty admin notes — so the build fails until every gap is filled.

- [ ] **Step 2: Typecheck**

Run: `npm run test --workspace shared`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add shared/src/turns/turn-001.ts
git commit -m "feat(content): add Turn 1 definition"
```

---

### Task 6: Barrel export + shared build

**Files:**
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create `shared/src/index.ts`**

```ts
export * from "./types.js";
export { CONTENT_VERSION } from "./version.js";
export { campaign, INITIAL_STATE } from "./campaign.js";
export { houses } from "./houses.js";
export { turn001 } from "./turns/turn-001.js";
```

- [ ] **Step 2: Build the shared package (emit `dist/`)**

Run: `npm run build:shared`
Expected: PASS, produces `shared/dist/index.js` and `shared/dist/index.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add shared/src/index.ts
git commit -m "feat(content): add barrel export for shared package"
```

---

### Task 7: Content validation script (invariants)

**Files:**
- Create: `scripts/validate-content.ts`
- Create: `scripts/validate-content.test.ts`
- Modify: `shared/package.json` (add `vitest`)

This script enforces content invariants and is runnable both as a CLI (`npm run validate-content`) and as a Vitest suite. Run it against the built `@ravenloft/content`.

- [ ] **Step 1: Add vitest to the shared workspace**

Run: `npm install -D vitest@^2.1.8 --workspace shared`
Expected: adds vitest to `shared/package.json` devDependencies.

- [ ] **Step 2: Write the failing test `scripts/validate-content.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateContent } from "./validate-content.js";

describe("campaign content invariants", () => {
  it("passes validation with no errors", () => {
    const errors = validateContent();
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run scripts/validate-content.test.ts`
Expected: FAIL — cannot resolve `./validate-content.js` (not created yet).

- [ ] **Step 4: Implement `scripts/validate-content.ts`**

```ts
import {
  houses,
  turn001,
  campaign,
  HOUSE_IDS,
  CONTENT_VERSION,
  type HouseId,
} from "@ravenloft/content";

export function validateContent(): string[] {
  const errors: string[] = [];

  // 1. Exactly six houses, one per HouseId, non-empty text fields.
  for (const id of HOUSE_IDS) {
    const h = houses[id];
    if (!h) {
      errors.push(`Missing house: ${id}`);
      continue;
    }
    if (h.id !== id) errors.push(`House ${id} has mismatched id ${h.id}`);
    for (const field of [
      "name", "subtitle", "motto", "leaderName",
      "publicIntroduction", "strength", "weakness", "publicInterest",
      "privateIntroduction", "privateObjective", "privateConcern",
    ] as const) {
      if (!h[field] || h[field].trim() === "") {
        errors.push(`House ${id} has empty field: ${field}`);
      }
    }
  }

  // 2. Turn 1 has exactly 18 cards (3 per house).
  if (turn001.cards.length !== 18) {
    errors.push(`Turn 1 expected 18 cards, found ${turn001.cards.length}`);
  }

  // 3. Card ids are unique.
  const ids = new Set<string>();
  for (const c of turn001.cards) {
    if (ids.has(c.id)) errors.push(`Duplicate card id: ${c.id}`);
    ids.add(c.id);
    if (c.categories.length === 0) errors.push(`Card ${c.id} has no categories`);
    if (!c.description.trim()) errors.push(`Card ${c.id} has empty description`);
    if (!c.contribution.trim()) errors.push(`Card ${c.id} has empty contribution`);
    if (c.adminTags.length === 0) errors.push(`Card ${c.id} has no adminTags`);
  }

  // 4. Each house has exactly 3 cards, and its cardIds resolve to real cards owned by that house.
  for (const id of HOUSE_IDS) {
    const content = turn001.houseContent[id];
    if (!content) {
      errors.push(`Turn 1 missing houseContent for ${id}`);
      continue;
    }
    if (!content.privateInformation.trim()) {
      errors.push(`Turn 1 house ${id} has empty privateInformation`);
    }
    if (content.cardIds.length !== 3) {
      errors.push(`Turn 1 house ${id} must have 3 cardIds`);
    }
    for (const cardId of content.cardIds) {
      const card = turn001.cards.find((c) => c.id === cardId);
      if (!card) {
        errors.push(`Turn 1 house ${id} references missing card ${cardId}`);
      } else if (card.houseId !== id) {
        errors.push(`Card ${cardId} belongs to ${card.houseId}, referenced by ${id}`);
      }
    }
  }

  // 5. Every card is referenced by exactly one house's cardIds.
  const referenced = new Set<string>(
    HOUSE_IDS.flatMap((id: HouseId) => turn001.houseContent[id]?.cardIds ?? []),
  );
  for (const c of turn001.cards) {
    if (!referenced.has(c.id)) errors.push(`Card ${c.id} is not referenced by any house`);
  }

  // 6. Admin notes present.
  if (!turn001.adminResolutionNotes.trim()) {
    errors.push("Turn 1 adminResolutionNotes is empty");
  }

  // 7. Unpublished turn (Phase 1 authoring state).
  if (turn001.publishedResult !== undefined) {
    errors.push("Turn 1 publishedResult should be undefined at authoring time");
  }

  // 8. Campaign points at an existing active turn and version is set.
  if (campaign.activeTurnId !== turn001.id) {
    errors.push("campaign.activeTurnId does not match turn 1");
  }
  if (!CONTENT_VERSION.trim()) errors.push("CONTENT_VERSION is empty");

  return errors;
}

// CLI entry: `tsx scripts/validate-content.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateContent();
  if (errors.length > 0) {
    console.error("Content validation FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("Content validation passed.");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run build:shared && npx vitest run scripts/validate-content.test.ts`
Expected: PASS (assuming all transcription gaps in Tasks 4–5 are filled; if it fails, the error list names the exact missing field — fill it and re-run).

- [ ] **Step 6: Verify the CLI form works**

Run: `npm run validate-content`
Expected: prints "Content validation passed." and exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-content.ts scripts/validate-content.test.ts shared/package.json package-lock.json
git commit -m "test(content): add content validation invariants"
```

---

### Task 8: Scaffold the frontend workspace (Vite + React + TS + Vitest)

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "@ravenloft/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@ravenloft/content": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `frontend/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});
```

- [ ] **Step 5: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ravenloft: O Inverno dos Mortos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Install and confirm the empty test runner works**

Run: `npm install && npx vitest run --workspace frontend`
Expected: exits 0 with "No test files found" (no tests yet). If the flag isn't supported, run `cd frontend && npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html frontend/src/test/setup.ts package-lock.json
git commit -m "chore(frontend): scaffold Vite + React + TS + Vitest"
```

---

### Task 9: Theme, API types, and auth session helpers

**Files:**
- Create: `frontend/src/theme.css`
- Create: `frontend/src/types/api.ts`
- Create: `frontend/src/auth/playerSession.ts`
- Create: `frontend/src/auth/adminSession.ts`
- Test: `frontend/src/auth/playerSession.test.ts`

- [ ] **Step 1: Create `frontend/src/theme.css` (visual direction §45)**

```css
:root {
  --bg: #0c0d10;
  --surface: #16181d;
  --surface-2: #1e2128;
  --border: #3a3f4b;
  --text: #e8e4d8;
  --text-muted: #9aa0ab;
  --accent-red: #7c2b2b;
  --accent-blue: #38506e;
  --danger: #b3541e;
  --font-title: Georgia, "Times New Roman", serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.55;
}

h1, h2, h3 { font-family: var(--font-title); font-weight: 600; }

button {
  font-family: var(--font-body);
  background: var(--accent-blue);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.7rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  min-height: 44px;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }

.app-shell { max-width: 720px; margin: 0 auto; padding: 1rem; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.private-panel { border-left: 4px solid var(--accent-red); background: var(--surface-2); }
.error { color: var(--danger); }
```

- [ ] **Step 2: Create `frontend/src/types/api.ts` (Phase-2 backend will implement these exact shapes)**

```ts
import type { KingdomState, CardCategory, HouseId } from "@ravenloft/content";

export type TurnStatus = "OPEN" | "LOCKED";

export type ApiErrorCode =
  | "HOUSE_TAKEN"
  | "INVALID_CODE"
  | "TURN_LOCKED"
  | "INVALID_CARD"
  | "SESSION_EXPIRED"
  | "VERSION_CONFLICT"
  | "NO_PUBLISHED_TURN"
  | "NETWORK";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CampaignSummary {
  id: string;
  title: string;
  introduction: string;
  publicState: KingdomState;
  activeTurnId: number;
  turnStatus: TurnStatus;
  contentVersion: string;
}

export interface HouseSummary {
  id: HouseId;
  name: string;
  subtitle: string;
  motto: string;
  strength: string;
  available: boolean;
}

export interface ClaimResult {
  playerCode: string;
  playerToken: string;
  houseId: HouseId;
  displayName: string;
}

export interface LoginResult {
  playerToken: string;
  houseId: HouseId;
  displayName: string;
}

export interface CardView {
  id: string;
  title: string;
  categories: CardCategory[];
  description: string;
  contribution: string;
  risk?: string;
  cost?: string;
}

export interface CurrentChoice {
  cardId: string;
  chosenAt: string;
}

export interface PreviousResult {
  publicResult: string;
  privateResult?: string;
  stateAfter: KingdomState;
  discoveries: string[];
}

export interface PlayerGameView {
  houseId: HouseId;
  houseName: string;
  houseSubtitle: string;
  privateIntroduction: string;
  displayName: string;
  kingdomState: KingdomState;
  turnId: number;
  turnTitle: string;
  publicEvent: string;
  privateInformation: string;
  cards: CardView[];
  currentChoice?: CurrentChoice;
  turnStatus: TurnStatus;
  previousResult?: PreviousResult;
}

export interface AdminChoiceRow {
  houseId: HouseId;
  houseName: string;
  claimed: boolean;
  displayName?: string;
  cardId?: string;
  cardTitle?: string;
  categories?: CardCategory[];
  chosenAt?: string;
}

export interface AdminDashboard {
  activeTurnId: number;
  turnTitle: string;
  turnStatus: TurnStatus;
  kingdomState: KingdomState;
  rows: AdminChoiceRow[];
  summaryText: string;
}
```

- [ ] **Step 3: Write the failing test `frontend/src/auth/playerSession.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { savePlayerSession, loadPlayerSession, clearPlayerSession } from "./playerSession";

describe("playerSession", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadPlayerSession()).toBeNull();
  });

  it("round-trips a saved session", () => {
    savePlayerSession({ playerToken: "t1", houseId: "vargen", displayName: "Elira" });
    expect(loadPlayerSession()).toEqual({
      playerToken: "t1",
      houseId: "vargen",
      displayName: "Elira",
    });
  });

  it("clears the session", () => {
    savePlayerSession({ playerToken: "t1", houseId: "vargen", displayName: "Elira" });
    clearPlayerSession();
    expect(loadPlayerSession()).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/auth/playerSession.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `frontend/src/auth/playerSession.ts`**

```ts
import type { HouseId } from "@ravenloft/content";

export interface PlayerSession {
  playerToken: string;
  houseId: HouseId;
  displayName: string;
}

const KEY = "ravenloft.player";

export function savePlayerSession(session: PlayerSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadPlayerSession(): PlayerSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(): void {
  sessionStorage.removeItem(KEY);
}
```

- [ ] **Step 6: Create `frontend/src/auth/adminSession.ts`**

```ts
const KEY = "ravenloft.admin";

export function saveAdminToken(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function loadAdminToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(KEY);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/auth/playerSession.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/theme.css frontend/src/types/api.ts frontend/src/auth/
git commit -m "feat(frontend): add theme, API types, and session helpers"
```

---

### Task 10: ApiClient interface + in-memory mock client

**Files:**
- Create: `frontend/src/api/client.ts` (interface)
- Create: `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/mockClient.test.ts`

The mock backs the entire Phase-1 UI with data from `@ravenloft/content` and in-memory claim/choice state. Phase 3 replaces it with an HTTP client implementing the same `ApiClient` interface.

- [ ] **Step 1: Create `frontend/src/api/client.ts`**

```ts
import type {
  CampaignSummary, HouseSummary, ClaimResult, LoginResult,
  PlayerGameView, CurrentChoice, AdminDashboard,
} from "../types/api";
import type { HouseId } from "@ravenloft/content";

export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouses(): Promise<HouseSummary[]>;
  claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  lockTurn(adminToken: string): Promise<void>;
  unlockTurn(adminToken: string): Promise<void>;
}
```

- [ ] **Step 2: Write the failing test `frontend/src/api/mockClient.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { MockApiClient } from "./mockClient";
import { ApiError } from "../types/api";

let api: MockApiClient;
beforeEach(() => { api = new MockApiClient(); });

describe("MockApiClient", () => {
  it("lists six available houses initially", async () => {
    const houses = await api.getHouses();
    expect(houses).toHaveLength(6);
    expect(houses.every((h) => h.available)).toBe(true);
  });

  it("claims a free house and marks it unavailable", async () => {
    const res = await api.claimHouse("vargen", "Elira");
    expect(res.houseId).toBe("vargen");
    expect(res.playerCode).toMatch(/^vargen-[A-Z0-9]{4}$/);
    const houses = await api.getHouses();
    expect(houses.find((h) => h.id === "vargen")!.available).toBe(false);
  });

  it("rejects claiming an already-taken house", async () => {
    await api.claimHouse("vargen", "Elira");
    await expect(api.claimHouse("vargen", "Other")).rejects.toMatchObject({
      code: "HOUSE_TAKEN",
    });
  });

  it("logs in with a valid code and rejects an invalid one", async () => {
    const { playerCode } = await api.claimHouse("vargen", "Elira");
    const login = await api.login(playerCode);
    expect(login.houseId).toBe("vargen");
    await expect(api.login("nope-0000")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("returns only the player's own private content with three cards", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    expect(game.houseId).toBe("vargen");
    expect(game.cards).toHaveLength(3);
    expect(game.privateIntroduction.length).toBeGreaterThan(0);
    expect(game.turnStatus).toBe("OPEN");
  });

  it("saves and replaces a choice while the turn is open", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    const first = await api.submitChoice(playerToken, 1, game.cards[0].id);
    expect(first.cardId).toBe(game.cards[0].id);
    const second = await api.submitChoice(playerToken, 1, game.cards[1].id);
    expect(second.cardId).toBe(game.cards[1].id);
    expect((await api.getGame(playerToken)).currentChoice!.cardId).toBe(game.cards[1].id);
  });

  it("rejects a card that does not belong to the house", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    await expect(api.submitChoice(playerToken, 1, "auremont-send-caravans")).rejects.toMatchObject({
      code: "INVALID_CARD",
    });
  });

  it("blocks choosing when the turn is locked", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    const { adminToken } = await api.adminLogin("admin-test");
    await api.lockTurn(adminToken);
    await expect(api.submitChoice(playerToken, 1, game.cards[0].id)).rejects.toMatchObject({
      code: "TURN_LOCKED",
    });
  });

  it("admin dashboard reflects claims and choices", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    await api.submitChoice(playerToken, 1, game.cards[0].id);
    const { adminToken } = await api.adminLogin("admin-test");
    const dash = await api.getAdminDashboard(adminToken);
    const vargen = dash.rows.find((r) => r.houseId === "vargen")!;
    expect(vargen.claimed).toBe(true);
    expect(vargen.cardId).toBe(game.cards[0].id);
    expect(dash.rows).toHaveLength(6);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: FAIL — `MockApiClient` not found.

- [ ] **Step 4: Implement `frontend/src/api/mockClient.ts`**

```ts
import {
  campaign, houses, turn001, HOUSE_IDS, CONTENT_VERSION,
  type HouseId, type TurnCard,
} from "@ravenloft/content";
import {
  ApiError,
  type CampaignSummary, type HouseSummary, type ClaimResult, type LoginResult,
  type PlayerGameView, type CurrentChoice, type CardView, type AdminDashboard,
  type AdminChoiceRow, type TurnStatus,
} from "../types/api";
import type { ApiClient } from "./client";

interface ClaimRecord {
  houseId: HouseId;
  displayName: string;
  playerCode: string;
  playerToken: string;
  choice?: CurrentChoice;
}

function randomSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function toCardView(card: TurnCard): CardView {
  return {
    id: card.id,
    title: card.title,
    categories: card.categories,
    description: card.description,
    contribution: card.contribution,
    risk: card.risk,
    cost: card.cost,
  };
}

export class MockApiClient implements ApiClient {
  private claims = new Map<HouseId, ClaimRecord>();
  private byToken = new Map<string, ClaimRecord>();
  private byCode = new Map<string, ClaimRecord>();
  private turnStatus: TurnStatus = "OPEN";
  private adminToken = "mock-admin-token";

  async getCampaign(): Promise<CampaignSummary> {
    return {
      id: campaign.id,
      title: campaign.title,
      introduction: campaign.introduction,
      publicState: turn001.stateBefore,
      activeTurnId: campaign.activeTurnId,
      turnStatus: this.turnStatus,
      contentVersion: CONTENT_VERSION,
    };
  }

  async getHouses(): Promise<HouseSummary[]> {
    return HOUSE_IDS.map((id) => {
      const h = houses[id];
      return {
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        motto: h.motto,
        strength: h.strength,
        available: !this.claims.has(id),
      };
    });
  }

  async claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult> {
    if (this.claims.has(houseId)) {
      throw new ApiError("HOUSE_TAKEN", "Esta Casa já foi escolhida.");
    }
    const playerCode = `${houseId}-${randomSuffix()}`;
    const playerToken = `tok-${houseId}-${randomSuffix()}`;
    const record: ClaimRecord = { houseId, displayName, playerCode, playerToken };
    this.claims.set(houseId, record);
    this.byToken.set(playerToken, record);
    this.byCode.set(playerCode, record);
    return { playerCode, playerToken, houseId, displayName };
  }

  async login(playerCode: string): Promise<LoginResult> {
    const record = this.byCode.get(playerCode);
    if (!record) throw new ApiError("INVALID_CODE", "Código inválido.");
    return {
      playerToken: record.playerToken,
      houseId: record.houseId,
      displayName: record.displayName,
    };
  }

  private requirePlayer(playerToken: string): ClaimRecord {
    const record = this.byToken.get(playerToken);
    if (!record) throw new ApiError("SESSION_EXPIRED", "Sessão expirada.");
    return record;
  }

  async getGame(playerToken: string): Promise<PlayerGameView> {
    const record = this.requirePlayer(playerToken);
    const house = houses[record.houseId];
    const content = turn001.houseContent[record.houseId];
    const cards = content.cardIds.map((id) => {
      const card = turn001.cards.find((c) => c.id === id)!;
      return toCardView(card);
    });
    return {
      houseId: house.id,
      houseName: house.name,
      houseSubtitle: house.subtitle,
      privateIntroduction: house.privateIntroduction,
      displayName: record.displayName,
      kingdomState: turn001.stateBefore,
      turnId: turn001.id,
      turnTitle: turn001.title,
      publicEvent: turn001.publicEvent,
      privateInformation: content.privateInformation,
      cards,
      currentChoice: record.choice,
      turnStatus: this.turnStatus,
      previousResult: undefined,
    };
  }

  async submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice> {
    const record = this.requirePlayer(playerToken);
    if (this.turnStatus === "LOCKED") {
      throw new ApiError("TURN_LOCKED", "O Conselho está resolvendo o turno.");
    }
    if (turnId !== turn001.id) {
      throw new ApiError("VERSION_CONFLICT", "Turno desatualizado.");
    }
    const hand = turn001.houseContent[record.houseId].cardIds;
    if (!hand.includes(cardId as (typeof hand)[number])) {
      throw new ApiError("INVALID_CARD", "Esta carta não pertence à sua Casa.");
    }
    const choice: CurrentChoice = { cardId, chosenAt: new Date().toISOString() };
    record.choice = choice;
    return choice;
  }

  async adminLogin(adminCode: string): Promise<{ adminToken: string }> {
    if (!adminCode || adminCode.trim() === "") {
      throw new ApiError("INVALID_CODE", "Código de admin inválido.");
    }
    return { adminToken: this.adminToken };
  }

  private requireAdmin(adminToken: string): void {
    if (adminToken !== this.adminToken) {
      throw new ApiError("SESSION_EXPIRED", "Sessão de admin expirada.");
    }
  }

  async getAdminDashboard(adminToken: string): Promise<AdminDashboard> {
    this.requireAdmin(adminToken);
    const rows: AdminChoiceRow[] = HOUSE_IDS.map((id) => {
      const h = houses[id];
      const record = this.claims.get(id);
      const card = record?.choice
        ? turn001.cards.find((c) => c.id === record.choice!.cardId)
        : undefined;
      return {
        houseId: id,
        houseName: h.name,
        claimed: !!record,
        displayName: record?.displayName,
        cardId: record?.choice?.cardId,
        cardTitle: card?.title,
        categories: card?.categories,
        chosenAt: record?.choice?.chosenAt,
      };
    });
    const summaryText = rows
      .map((r) => `${r.houseName}: ${r.cardTitle ?? "(sem escolha)"}`)
      .join("\n");
    return {
      activeTurnId: turn001.id,
      turnTitle: turn001.title,
      turnStatus: this.turnStatus,
      kingdomState: turn001.stateBefore,
      rows,
      summaryText,
    };
  }

  async lockTurn(adminToken: string): Promise<void> {
    this.requireAdmin(adminToken);
    this.turnStatus = "LOCKED";
  }

  async unlockTurn(adminToken: string): Promise<void> {
    this.requireAdmin(adminToken);
    this.turnStatus = "OPEN";
  }
}

export const mockApi = new MockApiClient();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: PASS (9 tests). Requires the shared package built (`npm run build:shared`) and Tasks 4–5 transcription complete.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/
git commit -m "feat(frontend): add ApiClient interface and in-memory mock"
```

---

### Task 11: KingdomStats + LoadingState components

**Files:**
- Create: `frontend/src/components/LoadingState.tsx`
- Create: `frontend/src/components/KingdomStats.tsx`
- Test: `frontend/src/components/KingdomStats.test.tsx`

- [ ] **Step 1: Create `frontend/src/components/LoadingState.tsx`**

```tsx
export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="card">
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `frontend/src/components/KingdomStats.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KingdomStats } from "./KingdomStats";

const state = {
  provisions: 6, militaryStrength: 5, unity: 5,
  publicOrder: 6, enemyKnowledge: 0, undeadAdvance: 1,
};

describe("KingdomStats", () => {
  it("renders all six indicators with values out of 10", () => {
    render(<KingdomStats state={state} />);
    expect(screen.getByText("Provisões")).toBeInTheDocument();
    expect(screen.getByText("Avanço dos Mortos")).toBeInTheDocument();
    expect(screen.getByText("6 / 10")).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/KingdomStats.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `frontend/src/components/KingdomStats.tsx`**

```tsx
import type { KingdomState } from "@ravenloft/content";

const LABELS: { key: keyof KingdomState; label: string }[] = [
  { key: "provisions", label: "Provisões" },
  { key: "militaryStrength", label: "Força Militar" },
  { key: "unity", label: "Unidade" },
  { key: "publicOrder", label: "Ordem Pública" },
  { key: "enemyKnowledge", label: "Conhecimento sobre o Inimigo" },
  { key: "undeadAdvance", label: "Avanço dos Mortos" },
];

export function KingdomStats({ state }: { state: KingdomState }) {
  return (
    <section className="card" aria-label="Estado do reino">
      <h2>Estado do Reino</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {LABELS.map(({ key, label }) => (
          <li
            key={key}
            style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0" }}
          >
            <span>{label}</span>
            <span>{state[key]} / 10</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/KingdomStats.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LoadingState.tsx frontend/src/components/KingdomStats.tsx frontend/src/components/KingdomStats.test.tsx
git commit -m "feat(frontend): add KingdomStats and LoadingState"
```

---

### Task 12: HouseCard component

**Files:**
- Create: `frontend/src/components/HouseCard.tsx`
- Test: `frontend/src/components/HouseCard.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/components/HouseCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HouseCard } from "./HouseCard";

const house = {
  id: "vargen" as const,
  name: "Casa Vargen",
  subtitle: "Os Lobos do Norte",
  motto: "Primeiro a muralha.",
  strength: "Exército experiente.",
  available: true,
};

describe("HouseCard", () => {
  it("shows name, subtitle and an available action", async () => {
    const onSelect = vi.fn();
    render(<HouseCard house={house} onSelect={onSelect} />);
    expect(screen.getByText("Casa Vargen")).toBeInTheDocument();
    expect(screen.getByText("Os Lobos do Norte")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /disponível/i }));
    expect(onSelect).toHaveBeenCalledWith("vargen");
  });

  it("disables the button and shows 'Escolhida' when unavailable", () => {
    render(<HouseCard house={{ ...house, available: false }} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /escolhida/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/HouseCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `frontend/src/components/HouseCard.tsx`**

```tsx
import type { HouseSummary } from "../types/api";
import type { HouseId } from "@ravenloft/content";

export function HouseCard({
  house,
  onSelect,
}: {
  house: HouseSummary;
  onSelect: (id: HouseId) => void;
}) {
  return (
    <article className="card">
      <h3>{house.name}</h3>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>{house.subtitle}</p>
      <p><em>{house.motto}</em></p>
      <p>{house.strength}</p>
      <button
        disabled={!house.available}
        onClick={() => onSelect(house.id)}
      >
        {house.available ? "Disponível — escolher" : "Escolhida"}
      </button>
    </article>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/HouseCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HouseCard.tsx frontend/src/components/HouseCard.test.tsx
git commit -m "feat(frontend): add HouseCard component"
```

---

### Task 13: CardChoice component

**Files:**
- Create: `frontend/src/components/CardChoice.tsx`
- Test: `frontend/src/components/CardChoice.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/components/CardChoice.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardChoice } from "./CardChoice";

const card = {
  id: "vargen-defend-bridge",
  title: "Defender a Ponte",
  categories: ["military"] as const,
  description: "Envie soldados para manter a ponte aberta.",
  contribution: "aumenta a Proteção da Retirada.",
  risk: "a Casa Vargen perde tropas.",
};

describe("CardChoice", () => {
  it("renders card details and fires onChoose", async () => {
    const onChoose = vi.fn();
    render(<CardChoice card={card} selected={false} disabled={false} onChoose={onChoose} />);
    expect(screen.getByText("Defender a Ponte")).toBeInTheDocument();
    expect(screen.getByText(/Proteção da Retirada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /escolher esta carta/i }));
    expect(onChoose).toHaveBeenCalledWith("vargen-defend-bridge");
  });

  it("shows a selected state and disables the button when locked", () => {
    render(<CardChoice card={card} selected disabled onChoose={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/carta escolhida/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/CardChoice.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `frontend/src/components/CardChoice.tsx`**

```tsx
import type { CardView } from "../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  military: "Militar",
  logistics: "Logística",
  politics: "Política",
  administration: "Administração",
  investigation: "Investigação",
  religion: "Religião",
  engineering: "Engenharia",
  "popular-support": "Apoio Popular",
  sacrifice: "Sacrifício",
};

export function CardChoice({
  card,
  selected,
  disabled,
  onChoose,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  onChoose: (cardId: string) => void;
}) {
  return (
    <article
      className="card"
      style={selected ? { borderColor: "var(--accent-red)" } : undefined}
      aria-current={selected}
    >
      <h3>{card.title}</h3>
      <p style={{ color: "var(--text-muted)" }}>
        {card.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · ")}
      </p>
      <p>{card.description}</p>
      <p><strong>Contribuição:</strong> {card.contribution}</p>
      {card.risk && <p><strong>Risco:</strong> {card.risk}</p>}
      {card.cost && <p><strong>Custo:</strong> {card.cost}</p>}
      <button disabled={disabled} onClick={() => onChoose(card.id)}>
        Escolher esta carta
      </button>
      {selected && <p aria-live="polite">✓ Carta escolhida</p>}
    </article>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CardChoice.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CardChoice.tsx frontend/src/components/CardChoice.test.tsx
git commit -m "feat(frontend): add CardChoice component"
```

---

### Task 14: PrivatePanel + AdminChoiceTable components

**Files:**
- Create: `frontend/src/components/PrivatePanel.tsx`
- Create: `frontend/src/components/AdminChoiceTable.tsx`
- Test: `frontend/src/components/AdminChoiceTable.test.tsx`

- [ ] **Step 1: Create `frontend/src/components/PrivatePanel.tsx`**

```tsx
export function PrivatePanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="card private-panel" aria-label={title}>
      <h3>{title}</h3>
      <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
        Informação privada da sua Casa
      </p>
      {text.split("\n\n").map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Write the failing test `frontend/src/components/AdminChoiceTable.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminChoiceTable } from "./AdminChoiceTable";

const rows = [
  {
    houseId: "vargen" as const, houseName: "Casa Vargen", claimed: true,
    displayName: "Elira", cardId: "vargen-defend-bridge",
    cardTitle: "Defender a Ponte", categories: ["military"] as const,
    chosenAt: "2026-07-17T10:00:00.000Z",
  },
  {
    houseId: "ravens" as const, houseName: "Irmandade dos Corvos", claimed: false,
  },
];

describe("AdminChoiceTable", () => {
  it("shows each house's choice and a placeholder for missing ones", () => {
    render(<AdminChoiceTable rows={rows} />);
    expect(screen.getByText("Defender a Ponte")).toBeInTheDocument();
    expect(screen.getByText("Casa Vargen")).toBeInTheDocument();
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/AdminChoiceTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `frontend/src/components/AdminChoiceTable.tsx`**

```tsx
import type { AdminChoiceRow } from "../types/api";

export function AdminChoiceTable({ rows }: { rows: AdminChoiceRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Casa</th>
          <th style={{ textAlign: "left" }}>Carta escolhida</th>
          <th style={{ textAlign: "left" }}>Horário</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.houseId}>
            <td>{r.houseName}{r.claimed ? "" : " (sem jogador)"}</td>
            <td>{r.cardTitle ?? "—"}</td>
            <td>{r.chosenAt ? new Date(r.chosenAt).toLocaleString("pt-BR") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/AdminChoiceTable.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PrivatePanel.tsx frontend/src/components/AdminChoiceTable.tsx frontend/src/components/AdminChoiceTable.test.tsx
git commit -m "feat(frontend): add PrivatePanel and AdminChoiceTable"
```

---

### Task 15: API provider hook + Landing and Claim pages

**Files:**
- Create: `frontend/src/api/ApiProvider.tsx`
- Create: `frontend/src/pages/LandingPage.tsx`
- Create: `frontend/src/pages/ClaimHousePage.tsx`
- Test: `frontend/src/pages/ClaimHousePage.test.tsx`

The provider lets tests inject a fresh `MockApiClient` and lets Phase 3 swap in the HTTP client at the app root.

- [ ] **Step 1: Create `frontend/src/api/ApiProvider.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used within an ApiProvider");
  return client;
}
```

- [ ] **Step 2: Create `frontend/src/pages/LandingPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { LoadingState } from "../components/LoadingState";
import type { CampaignSummary } from "../types/api";

export function LandingPage() {
  const api = useApi();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCampaign().then(setCampaign).catch(() => setError("Não foi possível carregar a campanha."));
  }, [api]);

  if (error) return <div className="app-shell error">{error}</div>;
  if (!campaign) return <div className="app-shell"><LoadingState /></div>;

  return (
    <main className="app-shell">
      <h1>{campaign.title}</h1>
      {campaign.introduction.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link to="/claim"><button>Escolher uma Casa</button></Link>
        <Link to="/login"><button>Já tenho um código</button></Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write the failing test `frontend/src/pages/ClaimHousePage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { ClaimHousePage } from "./ClaimHousePage";

function renderPage() {
  const client = new MockApiClient();
  render(
    <ApiProvider client={client}>
      <MemoryRouter><ClaimHousePage /></MemoryRouter>
    </ApiProvider>,
  );
  return client;
}

describe("ClaimHousePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("lists the six houses", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Casa Vargen")).toBeInTheDocument());
    expect(screen.getByText("Irmandade dos Corvos")).toBeInTheDocument();
  });

  it("claims a house and shows the generated code", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Casa Vargen")).toBeInTheDocument());
    const vargenButton = screen.getAllByRole("button", { name: /disponível/i })[0];
    await userEvent.click(vargenButton);
    // confirmation dialog
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() =>
      expect(screen.getByText(/seu código/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/vargen-/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ClaimHousePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `frontend/src/pages/ClaimHousePage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { HouseCard } from "../components/HouseCard";
import { LoadingState } from "../components/LoadingState";
import { savePlayerSession } from "../auth/playerSession";
import type { HouseSummary, ClaimResult } from "../types/api";
import type { HouseId } from "@ravenloft/content";
import { ApiError } from "../types/api";

export function ClaimHousePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [houses, setHouses] = useState<HouseSummary[] | null>(null);
  const [pending, setPending] = useState<HouseId | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getHouses().then(setHouses).catch(() => setError("Falha ao carregar as Casas."));
  }, [api]);

  async function confirmClaim() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.claimHouse(pending, displayName.trim() || "Jogador");
      savePlayerSession({
        playerToken: result.playerToken,
        houseId: result.houseId,
        displayName: result.displayName,
      });
      setClaim(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao reivindicar a Casa.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !houses) return <div className="app-shell error">{error}</div>;
  if (!houses) return <div className="app-shell"><LoadingState /></div>;

  if (claim) {
    return (
      <main className="app-shell">
        <h1>Casa reivindicada</h1>
        <p>Seu código (guarde-o, ele é mostrado apenas uma vez):</p>
        <p style={{ fontSize: "1.6rem", fontFamily: "var(--font-title)" }}>{claim.playerCode}</p>
        <button onClick={() => navigate("/game")}>Entrar no jogo</button>
      </main>
    );
  }

  if (pending) {
    const house = houses.find((h) => h.id === pending)!;
    return (
      <main className="app-shell">
        <h1>Confirmar escolha</h1>
        <p>Você escolheu <strong>{house.name}</strong>. Esta ação não pode ser desfeita.</p>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          Seu nome de exibição:
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: "0.25rem", minHeight: "44px" }}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button disabled={saving} onClick={confirmClaim}>
            {saving ? "Confirmando..." : "Confirmar"}
          </button>
          <button disabled={saving} onClick={() => setPending(null)}>Voltar</button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>Escolha sua Casa</h1>
      <div style={{ display: "grid", gap: "1rem" }}>
        {houses.map((h) => (
          <HouseCard key={h.id} house={h} onSelect={setPending} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/ClaimHousePage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/ApiProvider.tsx frontend/src/pages/LandingPage.tsx frontend/src/pages/ClaimHousePage.tsx frontend/src/pages/ClaimHousePage.test.tsx
git commit -m "feat(frontend): add API provider, Landing and Claim pages"
```

---

### Task 16: Login and Game pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/GamePage.tsx`
- Test: `frontend/src/pages/GamePage.test.tsx`

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { savePlayerSession } from "../auth/playerSession";
import { ApiError } from "../types/api";

export function LoginPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(code.trim());
      savePlayerSession({
        playerToken: result.playerToken,
        houseId: result.houseId,
        displayName: result.displayName,
      });
      navigate("/game");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <h1>Entrar com seu código</h1>
      <form onSubmit={submit}>
        <input
          aria-label="Código do jogador"
          placeholder="ex.: vargen-4K7P"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ display: "block", width: "100%", minHeight: "44px", marginBottom: "1rem" }}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Write the failing test `frontend/src/pages/GamePage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { savePlayerSession } from "../auth/playerSession";
import { GamePage } from "./GamePage";

async function setup() {
  const client = new MockApiClient();
  const claim = await client.claimHouse("vargen", "Elira");
  savePlayerSession({
    playerToken: claim.playerToken, houseId: "vargen", displayName: "Elira",
  });
  render(
    <ApiProvider client={client}>
      <MemoryRouter><GamePage /></MemoryRouter>
    </ApiProvider>,
  );
  return client;
}

describe("GamePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("renders the event and exactly three cards", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText(/A Estrada de Varn/)).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /escolher esta carta/i })).toHaveLength(3);
  });

  it("selects a card and shows a confirmation", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("Defender a Ponte")).toBeInTheDocument());
    const buttons = screen.getAllByRole("button", { name: /escolher esta carta/i });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getByText(/carta escolhida/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `frontend/src/pages/GamePage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { KingdomStats } from "../components/KingdomStats";
import { CardChoice } from "../components/CardChoice";
import { PrivatePanel } from "../components/PrivatePanel";
import { LoadingState } from "../components/LoadingState";
import { loadPlayerSession, clearPlayerSession } from "../auth/playerSession";
import { ApiError, type PlayerGameView } from "../types/api";

export function GamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [game, setGame] = useState<PlayerGameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const session = loadPlayerSession();
    if (!session) {
      navigate("/login");
      return;
    }
    try {
      setGame(await api.getGame(session.playerToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        clearPlayerSession();
        navigate("/login");
        return;
      }
      setError("Não foi possível carregar o jogo.");
    }
  }, [api, navigate]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function choose(cardId: string) {
    const session = loadPlayerSession();
    if (!session || !game) return;
    setSaving(true);
    setError(null);
    try {
      await api.submitChoice(session.playerToken, game.turnId, cardId);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao salvar a escolha.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearPlayerSession();
    navigate("/");
  }

  if (error && !game) return <div className="app-shell error">{error}</div>;
  if (!game) return <div className="app-shell"><LoadingState /></div>;

  const locked = game.turnStatus === "LOCKED";

  return (
    <main className="app-shell">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>{game.houseName}</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {game.houseSubtitle} · {game.displayName}
          </p>
        </div>
        <button onClick={logout}>Sair</button>
      </header>

      <KingdomStats state={game.kingdomState} />

      {game.previousResult && (
        <section className="card">
          <h2>Resultado anterior</h2>
          {game.previousResult.publicResult.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
        </section>
      )}

      <section className="card">
        <h2>Turno {game.turnId}: {game.turnTitle}</h2>
        {game.publicEvent.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
      </section>

      <PrivatePanel title="Informação privada" text={game.privateInformation} />

      <h2>Sua escolha</h2>
      {locked && <p className="card">O Conselho está resolvendo o turno.</p>}
      {error && <p className="error">{error}</p>}
      <div style={{ display: "grid", gap: "1rem" }}>
        {game.cards.map((card) => (
          <CardChoice
            key={card.id}
            card={card}
            selected={game.currentChoice?.cardId === card.id}
            disabled={saving || locked}
            onChoose={choose}
          />
        ))}
      </div>

      {game.currentChoice && !locked && (
        <p aria-live="polite">
          Escolha registrada às{" "}
          {new Date(game.currentChoice.chosenAt).toLocaleTimeString("pt-BR")}. Você pode trocar
          enquanto o turno estiver aberto.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx
git commit -m "feat(frontend): add Login and Game pages"
```

---

### Task 17: Admin page (login + dashboard + lock/unlock + copy summary)

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`
- Test: `frontend/src/pages/AdminPage.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/pages/AdminPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { AdminPage } from "./AdminPage";

function renderPage(client: MockApiClient) {
  render(
    <ApiProvider client={client}>
      <MemoryRouter><AdminPage /></MemoryRouter>
    </ApiProvider>,
  );
}

describe("AdminPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("logs in and shows the choices dashboard", async () => {
    const client = new MockApiClient();
    const claim = await client.claimHouse("vargen", "Elira");
    const game = await client.getGame(claim.playerToken);
    await client.submitChoice(claim.playerToken, 1, game.cards[0].id);
    renderPage(client);

    await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(screen.getByText("Defender a Ponte")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /bloquear turno/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/pages/AdminPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `frontend/src/pages/AdminPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/ApiProvider";
import { AdminChoiceTable } from "../components/AdminChoiceTable";
import { KingdomStats } from "../components/KingdomStats";
import { LoadingState } from "../components/LoadingState";
import { saveAdminToken, loadAdminToken, clearAdminToken } from "../auth/adminSession";
import { ApiError, type AdminDashboard } from "../types/api";

export function AdminPage() {
  const api = useApi();
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [code, setCode] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      setDashboard(await api.getAdminDashboard(adminToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        clearAdminToken();
        setToken(null);
      } else {
        setError("Falha ao carregar o painel.");
      }
    }
  }, [api]);

  useEffect(() => { if (token) void refresh(token); }, [token, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { adminToken } = await api.adminLogin(code.trim());
      saveAdminToken(adminToken);
      setToken(adminToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock(lock: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      if (lock) await api.lockTurn(token);
      else await api.unlockTurn(token);
      await refresh(token);
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!dashboard) return;
    await navigator.clipboard.writeText(dashboard.summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function logout() {
    clearAdminToken();
    setToken(null);
    setDashboard(null);
  }

  if (!token) {
    return (
      <main className="app-shell">
        <h1>Administração</h1>
        <form onSubmit={login}>
          <input
            aria-label="Código de admin"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ display: "block", width: "100%", minHeight: "44px", marginBottom: "1rem" }}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
        </form>
      </main>
    );
  }

  if (!dashboard) return <div className="app-shell"><LoadingState /></div>;

  return (
    <main className="app-shell">
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Painel do Turno {dashboard.activeTurnId}</h1>
        <button onClick={logout}>Sair</button>
      </header>
      <p>Status: <strong>{dashboard.turnStatus === "OPEN" ? "Aberto" : "Bloqueado"}</strong></p>

      <KingdomStats state={dashboard.kingdomState} />

      <section className="card">
        <h2>Escolhas do turno</h2>
        <AdminChoiceTable rows={dashboard.rows} />
      </section>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => toggleLock(dashboard.turnStatus === "OPEN")}>
          {dashboard.turnStatus === "OPEN" ? "Bloquear turno" : "Desbloquear turno"}
        </button>
        <button disabled={busy} onClick={copySummary}>
          {copied ? "Copiado!" : "Copiar resumo"}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/AdminPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/pages/AdminPage.test.tsx
git commit -m "feat(frontend): add Admin page"
```

---

### Task 18: App routing, entry point, and full build/responsive check

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/api/index.ts`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/src/api/index.ts` (the app-level client; Phase 3 swaps this for the HTTP client)**

```ts
import { MockApiClient } from "./mockClient";
import type { ApiClient } from "./client";

export const apiClient: ApiClient = new MockApiClient();
```

- [ ] **Step 2: Write the failing test `frontend/src/App.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "./api/ApiProvider";
import { MockApiClient } from "./api/mockClient";
import { AppRoutes } from "./App";

describe("App routing", () => {
  it("renders the landing page at /", async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/"]}><AppRoutes /></MemoryRouter>
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Inverno dos Mortos/i })).toBeInTheDocument(),
    );
  });

  it("redirects /game to /login without a session", async () => {
    sessionStorage.clear();
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/game"]}><AppRoutes /></MemoryRouter>
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /entrar com seu código/i })).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `frontend/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { ClaimHousePage } from "./pages/ClaimHousePage";
import { LoginPage } from "./pages/LoginPage";
import { GamePage } from "./pages/GamePage";
import { AdminPage } from "./pages/AdminPage";
import { loadPlayerSession } from "./auth/playerSession";

function RequirePlayer({ children }: { children: React.ReactNode }) {
  return loadPlayerSession() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/claim" element={<ClaimHousePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/game" element={<RequirePlayer><GamePage /></RequirePlayer>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ApiProvider } from "./api/ApiProvider";
import { apiClient } from "./api";
import { AppRoutes } from "./App";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiProvider client={apiClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ApiProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Run the App test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — all component and page suites green.

- [ ] **Step 8: Production build (typecheck + bundle)**

Run: `npm run build`
Expected: `build:shared` emits `shared/dist`, then `tsc -b && vite build` produces `frontend/dist` with no type errors.

- [ ] **Step 9: Manual responsive smoke check**

Run: `npm run dev` and open the served URL. Verify at a 375px-wide viewport (browser devtools): Landing → "Escolher uma Casa" → grid of 6 houses stacks vertically → claim a house → code shown → "Entrar no jogo" → event + 3 cards + private panel → choose a card → confirmation appears → `/admin` login with any non-empty code → dashboard lists the choice → "Bloquear turno" disables card choice on the game screen after refresh. Stop the dev server when done.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx frontend/src/api/index.ts frontend/src/App.test.tsx
git commit -m "feat(frontend): wire routing, entry point, and route guard"
```

---

## Definition of done (Phase 1)

- `npm run build` succeeds from the repo root (shared + frontend).
- `npm test` passes (shared typecheck + frontend Vitest suites).
- `npm run validate-content` prints "Content validation passed."
- The mock-backed site is fully navigable at 375px width: claim → play → choose → admin lock/unlock.
- No content placeholders remain (all house/card/private-info/admin-notes text transcribed verbatim from `docs/campaign-spec.md`).

## Handoff to Phase 2

Phase 2 implements the real SAM backend and replaces `frontend/src/api/index.ts` with an HTTP client implementing the same `ApiClient` interface — no component or page changes required. `CONTENT_VERSION` and all `@ravenloft/content` exports are reused unchanged by the Lambda.
