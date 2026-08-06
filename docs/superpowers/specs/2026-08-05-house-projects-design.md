# House Projects (Projetos da Casa) — Design

**Date:** 2026-08-05
**Status:** Approved (design)

## Problem / Goal

Each player controls a House in the async, turn-based political game "Valdren: O
Inverno dos Mortos". Today a player can only respond to the public event and
submit an order. This feature adds **continuous House Projects**: multi-turn
activities (build, recruit, research, spy, negotiate) that advance automatically
each turn and apply costs, risks and completion effects. It includes a
predefined card library, a player-driven AI card generator, a GM approval
panel, inter-House Favors, and turn-based project processing.

## Scope

Build the full feature (all subsystems) in one branch, delivered via many
sequential subagent tasks with per-task review:

1. Data model + Stability resource.
2. Predefined project card library (~50 cards).
3. DynamoDB persistence.
4. Rules engine (costs, slots, completion effects, idempotent turn processing).
5. Turn-processing hook in resolution.
6. AI custom-card generator (backend only).
7. Player + GM API layer (interface + HTTP + mock).
8. Player UI (active projects, library, "Criar minha carta", favors).
9. GM UI (approval tab).
10. Tests across shared/backend/frontend.

Out of scope: real-time notifications infrastructure (favors/approvals are shown
on next data fetch, no push); changing the existing 4-attribute system.

## Key Design Decisions

- **Stability is a separate resource, not an attribute.** Add optional
  `stability?: number` to `House`. Constants `STABILITY_DEFAULT = 3`,
  `STABILITY_MIN = 0`, `STABILITY_MAX = 5`. It is **not** in `ATTRIBUTE_KEYS`,
  not part of the point budget, and not shown in the attribute bars. Existing
  houses without the field are treated as `STABILITY_DEFAULT` on read.
- **Routing follows the existing convention** (fixed path + IDs in the request
  body), not `{param}` REST paths — the codebase registers only fixed paths.
- **No new DynamoDB infra.** Single-table PK/SK with `begins_with` Queries
  (never Scans). No GSI, no template.yaml change.
- **Turn processing is hooked into the existing `applyResolution`**, not a
  separate endpoint. Idempotency via a per-project `lastProcessedTurnId`.
- **AI uses only public canon** (published wiki entries), never GM secrets.

## Data Model (`shared/src/projects.ts`)

```ts
export type ProjectCategory =
  | "MILITARY" | "INFRASTRUCTURE" | "ECONOMY" | "DIPLOMACY"
  | "INTELLIGENCE" | "SOCIETY" | "MAGIC" | "EXPLORATION";

export type ProjectStatus =
  | "DRAFT" | "PENDING_AI" | "PENDING_PLAYER" | "PENDING_TARGET"
  | "PENDING_GM" | "APPROVED" | "ACTIVE" | "PAUSED"
  | "COMPLETED" | "CANCELLED" | "REJECTED";

export type ProjectCostType =
  | "WEALTH" | "RESOURCES" | "SOLDIERS_COMMITTED" | "CONTROL_COMMITTED"
  | "STABILITY" | "FAVOR" | "CUSTOM";

export type CostTiming = "ON_START" | "PER_TURN" | "ON_COMPLETION";

export interface ProjectCost {
  type: ProjectCostType;
  amount: number;
  timing: CostTiming;
  note?: string; // for CUSTOM
}

export type StabilityKey = "stability";
export type EffectAttribute = AttributeKey | StabilityKey; // riqueza|recursos|soldados|controle|stability

export interface AttributeChange {
  attribute: EffectAttribute;
  amount: number;
  permanent: boolean;
  durationTurns?: number | null; // for temporary changes
}

export interface FavorEffect {
  targetHouseId: string;
  amount: number;
  requiresAcceptance: boolean;
}

export interface CompletionEffects {
  attributeChanges: AttributeChange[];
  favors: FavorEffect[];
  assets: string[];
  qualitativeEffects: string[];
  unlocks: string[];
}

export interface ProjectCard {
  id: string;
  campaignId: string;
  houseId: string;
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  status: ProjectStatus;
  durationTurns: number;
  turnsCompleted: number;
  lastProcessedTurnId: number | null; // idempotency guard
  costs: ProjectCost[];
  requirements: string[];
  completionEffects: CompletionEffects;
  risks: string[];
  complications: string[];
  targetHouseId: string | null;
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
  playerOriginalRequest: string | null;
  gmNotes: string | null;
  templateId: string | null;
  createdBy: "PLAYER" | "AI" | "GM";
  createdAtTurn: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// Library entry — mechanical definition a player can instantiate.
export interface ProjectTemplate {
  id: string;
  title: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  description: string;
  completionEffects: CompletionEffects;
  risks: string[];
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
}

export interface Favor {
  id: string;
  campaignId: string;
  fromHouseId: string;
  toHouseId: string;
  amount: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  reason: string;
  createdAt: string;
  updatedAt: string;
}
```

Stability constants live in `shared/src/types.ts` next to `ATTR_MIN/ATTR_MAX`:
`STABILITY_DEFAULT = 3`, `STABILITY_MIN = 0`, `STABILITY_MAX = 5`. `House` gains
`stability?: number`. A helper `houseStability(house)` returns
`house.stability ?? STABILITY_DEFAULT`.

## Predefined Library (`shared/src/projectTemplates.ts`)

`DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[]` transcribes every card in the
spec. Costs/effects are encoded structurally; narrative "or"/conditional
outcomes that can't be auto-applied are represented as `qualitativeEffects`
strings (the GM adjudicates them narratively). Attribute increases use
`attributeChanges` with `permanent: true`. Temporary bonuses use
`permanent: false` + `durationTurns`. Where a card grants "+1 X or +1 Y (chosen
on completion)", encode both as `qualitativeEffects` describing the choice and
do NOT auto-apply an attribute change (GM/next iteration handles the choice);
this keeps auto-application unambiguous.

The full mechanical table is in Appendix A. Categories map:
- Cartas militares → MILITARY
- Cartas de infraestrutura e recursos → INFRASTRUCTURE (economy-flavored ones
  that yield +Riqueza use ECONOMY where clearly economic, e.g. Expandir o Porto,
  Criar um Mercado Regional)
- Cartas de diplomacia → DIPLOMACY
- Cartas de espionagem e informação → INTELLIGENCE
- Cartas sociais, culturais e de Estabilidade → SOCIETY
- Cartas de exploração, magia e conhecimento → EXPLORATION or MAGIC (magic-heavy
  ones: Contratar a Ordem dos Três, Construir Proteções Arcanas → MAGIC)

## Persistence (`backend/src/db/projects.ts`, keys in `backend/src/keys.ts`)

Key helpers to add in `keys.ts`:
- `projectSk(houseId, projectId)` → `PROJECT#<houseId>#<projectId>`
- `projectHousePrefix(houseId)` → `PROJECT#<houseId>#`
- `projectPrefix()` → `PROJECT#`
- `favorSk(toHouseId, favorId)` → `FAVOR#<toHouseId>#<favorId>`
- `favorHousePrefix(toHouseId)` → `FAVOR#<toHouseId>#`

All items use `PK = campaignPk(campaignId)`. Functions (mirror `turns.ts`
style, `DynamoDBDocumentClient`):
- `putProject`, `getProject(houseId, projectId)`, `listHouseProjects(houseId)`
  (Query begins_with house prefix), `listCampaignProjects()` (Query begins_with
  `PROJECT#`), `deleteProject`.
- `putFavor`, `getFavor(toHouseId, favorId)`, `listFavorsForHouse(toHouseId)`.
- `campaignReset.ts` extended to delete `PROJECT#` and `FAVOR#` items.

GM "pending approval" and "active" lists are derived by filtering
`listCampaignProjects()` in code (campaign project count is small).

## Rules Engine (`backend/src/projects/engine.ts`)

Pure functions (no I/O) so they're unit-testable:

- `projectSlotLimit(house)` → `houseAttr(controle) >= 4 ? 2 : 1`.
- `activeProjectCount(projects)` → count status ACTIVE or PAUSED.
- `canAffordStart(house, project)` → checks the sum of `ON_START` costs against
  house wealth/resources/stability and available (uncommitted) soldiers/control
  and favors. Returns `{ ok, reason? }`.
- `applyStartCharges(house, project)` → returns a new `House` with wealth/
  resources/stability reduced and committed soldiers/control tracked. Committed
  amounts are restored on completion/cancel. (Committed tracking: store the
  committed totals on the project via a `committed` field derived from costs;
  simplest is to recompute from `costs` where type is `*_COMMITTED`.)
- `applyCompletion(house, project)` → returns `{ house, favorsToCreate,
  assetsAdded }`: applies `attributeChanges` (permanent, clamped to
  `[ATTR_MIN, ATTR_MAX]` for attributes and `[STABILITY_MIN, STABILITY_MAX]` for
  stability), restores committed soldiers/control, collects favors to create.
  Permanent attribute increase capped so it never exceeds 5. Temporary changes
  are recorded as qualitative notes for now (no temporary-buff subsystem in v1;
  encode as qualitativeEffects) — see Simplification below.
- `processProjectForTurn(project, turnId)` → if `project.lastProcessedTurnId ===
  turnId` return unchanged (idempotent); else increment `turnsCompleted`, set
  `lastProcessedTurnId = turnId`; if `turnsCompleted >= durationTurns` mark
  `COMPLETED` and set `completedAt`. Returns the updated project + whether it
  just completed.

**Simplification (v1):** temporary attribute changes and per-turn narrative
risks are surfaced as text (qualitativeEffects / risks) and adjudicated by the
GM; only permanent attribute/stability changes, favors, and assets are
auto-applied. This keeps auto-application deterministic and idempotent.

## Turn Processing Hook (`backend/src/routes/adminRoutes.ts` → `applyResolution`)

After the existing attribute-delta application and `saveTurnResult`, and using
the resolved `turn.turnId`:
1. `listCampaignProjects()`, filter `status === "ACTIVE"`.
2. For each: `processProjectForTurn(project, turn.turnId)`.
3. If it advanced, charge any `PER_TURN` costs (best-effort: if unaffordable,
   auto-`PAUSED` with a note).
4. If it just completed: `applyCompletion`, persist updated `House`
   (attributes + stability + assets), create pending favors, set project
   `COMPLETED`.
5. Persist each updated project.
6. Idempotent: re-running the same `turnId` is a no-op via `lastProcessedTurnId`.

This runs before `createNextTurnDraft` so effects land on the just-resolved turn.

## AI Custom-Card Generator (`backend/src/ai/projectPrompts.ts` + parser in `openai.ts`)

- `buildProjectCardPrompt(house, publicCanon, input)` returns `{ system, user }`.
  `system` is the "Árbitro de Projetos de Valdren" prompt from the spec (fair,
  balanced, public-canon-only, sets `requiresTargetApproval`/`requiresGmApproval`
  per rules). `user` includes the house summary, the player's free-text request
  and optional fields (target, desired outcome, max spend, risk level), plus the
  public canon (published wiki titles/bodies).
- `parseProjectCardProposal(raw)` validates the JSON against the schema:
  enum checks for category/costs/attributes/aiBalanceStatus, numeric ranges,
  arrays present. On invalid JSON, throws `HttpError(502, "AI_PARSE", ...)` so
  `generateJson` retries; after retries, the route returns an error and no card
  is saved.
- GM-approval triggers enforced server-side after parse: if the AI set
  `requiresGmApproval` OR the text/effects hit a trigger (permanent attribute
  change > 1, duration > 6, favor without a real cost, etc.), force
  `requiresGmApproval = true`.

## API Layer

Request/response types in `frontend/src/types/api.ts` (re-export shared project
types + add input shapes). Methods added to `ApiClient` (interface),
`HttpApiClient`, and `MockApiClient`:

**Player**
- `getProjects(token)` → `{ templates: ProjectTemplate[]; projects: ProjectCard[]; favors: Favor[]; slotLimit: number; stability: number }`
- `startProjectFromTemplate(token, { templateId })` → `ProjectCard`
- `analyzeCustomProject(token, input)` → `ProjectCard` (status `PENDING_PLAYER`)
- `acceptProject(token, { projectId })` → `ProjectCard`
- `requestProjectRevision(token, { projectId, note })` → `ProjectCard`
- `submitProjectToGm(token, { projectId })` → `ProjectCard`
- `cancelProject(token, { projectId })` → `ProjectCard`
- `respondToFavor(token, { favorId, accept })` → `Favor`

**Admin/GM**
- `adminListProjects(token)` → `ProjectCard[]`
- `adminApproveProject(token, { projectId, edits? })` → `ProjectCard`
- `adminRejectProject(token, { projectId, note })` → `ProjectCard`
- `adminPauseProject(token, { projectId })` / `adminResumeProject(token, { projectId })` → `ProjectCard`

Routes registered in `backend/src/router.ts` under
`/api/player/project*`, `/api/player/projects`, `/api/player/favor/respond`,
`/api/admin/project*`, `/api/admin/projects`, handled in new
`backend/src/routes/projectRoutes.ts` (player) and additions to `adminRoutes.ts`
(GM). Validation parsers in `backend/src/validation/schemas.ts`
(`parseStartTemplateBody`, `parseAnalyzeCustomBody`, `parseProjectIdBody`,
`parseRevisionBody`, `parseFavorRespondBody`, `parseApproveProjectBody`, etc.).

State machine (server-enforced):
- Template start: affordable → `ACTIVE` (charges ON_START), else 400.
- Custom analyze → AI → `PENDING_PLAYER`. Accept: if
  `requiresGmApproval` → `PENDING_GM`; elif `requiresTargetApproval` →
  `PENDING_TARGET` + create pending favor/consent; else affordable → `ACTIVE`.
- `request-revision` → re-run AI with the note → `PENDING_PLAYER`.
- `submit-to-gm` → `PENDING_GM`.
- GM approve → `ACTIVE` (or `APPROVED` then activated); reject → `REJECTED`.
- Player can only act on projects whose `houseId` matches their token; GM-only
  for approve/reject/pause/resume and `gmNotes`.

## Frontend UI

**Player — `frontend/src/components/HouseProjectsPanel.tsx`** rendered in
`GamePage.tsx` (new "Projetos da Casa" card, after the House card):
- **Projetos Ativos:** each active/paused project as a card with title,
  category chip, progress "N de M turnos" + `LinearProgress`, paid costs,
  expected benefits, risks, PAUSED/blocked badge, Cancelar button (confirm:
  "cancelamento não gera reembolso").
- **Biblioteca:** category filter (chips/Select) + name search; each template
  shows duration/costs; "Visualizar" (details) and "Iniciar" (confirm costs).
  Disabled when slot limit reached.
- **Criar minha carta:** MUI `Dialog` with the natural-language form (required
  "O que sua Casa deseja realizar?"; optional target/region, desired outcome,
  max spend, risk level low/medium/high) → "Analisar" (loading) → preview of the
  AI proposal (title, category, duration, costs, benefits, risks, balance
  explanation) → Aceitar / Pedir ajuste (note) / Enviar ao mestre.
- **Favores:** inbox of pending favors targeting this house with Aceitar/Recusar.

**GM — `frontend/src/components/admin/AdminProjectsTab.tsx`** (`?tab=projetos`,
added to `TABS` in `AdminPage.tsx`):
- Pending approvals: original request + AI proposal + House/player; editable
  cost/duration/effects fields; Aprovar / Rejeitar (note) / Pausar.
- Active projects list with Pausar/Retomar.

## Testing

Backend (vitest, mock db via `vi.mock`):
- slot limit blocks a 2nd active project when controle < 4; allows when ≥ 4.
- permanent attribute change never exceeds 5 (clamp).
- completion effects applied exactly once (idempotency: re-processing same
  turnId is a no-op).
- turn advance increments `turnsCompleted` and completes at duration.
- cancel does not refund charged costs.
- `requiresTargetApproval` project goes to `PENDING_TARGET`, not `ACTIVE`.
- `requiresGmApproval` project cannot become `ACTIVE` without GM approve.
- invalid AI JSON → no card saved, error returned.
- diplomacy/favor never auto-forces the target (favor is `PENDING`).
- a player cannot modify another House's project (403).
- completion recorded (project `COMPLETED`, `completedAt` set).

Frontend (vitest + Testing Library, `MockApiClient`):
- active project renders progress; library filters by category; start disabled
  at slot limit; "Criar minha carta" flow (analyze → preview → accept); favors
  accept/decline; GM tab lists pending and approves.

Mock client mirrors all server rules (slots, charging, completion on a simulated
turn advance, favors, GM approval) so UI tests are meaningful.

## Deploy

No infra change. Frontend via manual Amplify zip flow; backend via SAM (new code
only, same table/config). Smoke test `/game` projects panel and `?tab=projetos`.

---

## Appendix A — Predefined Card Library (mechanical encoding)

Format: **Title** | category | duration | costs(type:amount@timing) | permanent
effects | requirements/risks as text. "ON_START" default timing unless noted.
Narrative-only outcomes are qualitativeEffects (q). Attribute increases are
permanent unless "temp".

### MILITARY
1. Recrutar Companhias Errantes | MILITARY | 3 | WEALTH:1, STABILITY:1 | soldados +1 | req: acesso a povo errante/mercenário; risk: exigem terras/pagamento/direitos
2. Treinar a Milícia Popular | MILITARY | 2 | RESOURCES:1 | asset "Milícia Local" (q: bônus defensivo território) | risk: retirada de trabalhadores afeta produção
3. Fundar uma Academia de Oficiais | MILITARY | 5 | WEALTH:2, RESOURCES:1 | q: +1 Controle durante ações militares; reorganizar unidade derrotada 1x/ciclo
4. Fortificar a Fronteira | MILITARY | 4 | RESOURCES:2 | asset "Fronteira Fortificada" (q: invasores gastam mais; +1 temp Controle em invasões)
5. Construir Torres de Sinalização | MILITARY | 3 | RESOURCES:1, WEALTH:1 | q: sem ataques totalmente de surpresa; mensagens mais rápidas
6. Criar uma Rede de Batedores | MILITARY | 2 | WEALTH:1 | q: info antecipada de movimentações; investigação territorial extra em crise
7. Domesticar Animais de Guerra | MILITARY | 4 | RESOURCES:2 | asset "Animais de Guerra" (q) | risk: acidentes, oposição cultural
8. Construir um Arsenal Regional | MILITARY | 4 | RESOURCES:2, WEALTH:1 | q: próxima mobilização custa -1 Recurso | risk: sabotagem/confisco
9. Contratar uma Companhia Mercenária | MILITARY | 1 | WEALTH:2 | q: +1 Soldados temporário por 2 turnos | risk: podem trocar de lado
10. Formar uma Guarda de Elite | MILITARY | 4 | WEALTH:2 | asset "Guarda de Elite" (q)
11. Expandir a Frota | MILITARY | 5 | RESOURCES:2, WEALTH:2 | q: +1 Soldados em conflitos marítimos; transporte | req: porto ou estaleiro
12. Preparar Reservas de Guerra | MILITARY | 3 | RESOURCES:2 | q: sustenta campanha por 2 turnos sem manutenção

### INFRASTRUCTURE / ECONOMY
13. Construir um Aqueduto | INFRASTRUCTURE | 5 | RESOURCES:2, WEALTH:1 | q: +1 Recursos OU +1 Estabilidade (escolha na conclusão); resistência a seca/cerco
14. Construir um Grande Celeiro | INFRASTRUCTURE | 4 | RESOURCES:2 | asset "Reservas de Alimento" (q)
15. Abrir uma Nova Mina | ECONOMY | 5 | RESOURCES:2, WEALTH:1 | recursos +1 | req: território mineral; risk: acidente/criatura/conflito
16. Restaurar uma Estrada Real | INFRASTRUCTURE | 3 | RESOURCES:1, WEALTH:1 | q: viagens mais rápidas; vantagem comercial inicial
17. Construir uma Ponte Fortificada | INFRASTRUCTURE | 4 | RESOURCES:2 | q: melhora comércio/defesa sobre rio; pedágio/controle de passagem
18. Expandir o Porto | ECONOMY | 5 | RESOURCES:2, WEALTH:2 | riqueza +1 | q: rivalidade com portos próximos
19. Criar um Mercado Regional | ECONOMY | 3 | RESOURCES:1, WEALTH:1 | riqueza +1 | q: bônus em negociações
20. Estabelecer uma Rota de Caravanas | ECONOMY | 3 | WEALTH:1 | q: benefício comercial a participantes | req: caminho seguro; risk: pode ser atacada; requiresTargetApproval (se envolver outra Casa)
21. Construir Oficinas Reais | INFRASTRUCTURE | 4 | RESOURCES:2 | q: -1 turno na duração do próximo projeto de construção
22. Drenar Pântanos e Recuperar Terras | INFRASTRUCTURE | 5 | RESOURCES:2 | q: +1 Recursos OU nova comunidade agrícola | risk: doença/dano/ruínas
23. Criar um Sistema de Irrigação | INFRASTRUCTURE | 4 | RESOURCES:2 | q: melhora colheitas; +1 Recursos após 1ª colheita em território agrícola
24. Fundar um Estaleiro | INFRASTRUCTURE | 5 | RESOURCES:2, WEALTH:2 | asset "Estaleiro" (q: permite cartas navais) | req: rio navegável/litoral

### DIPLOMACY
25. Enviar um Presente Cerimonial | DIPLOMACY | 1 | WEALTH:1 | q: boa vontade; possível 1 Favor | requiresTargetApproval
26. Oferecer Ajuda Durante uma Crise | DIPLOMACY | 2 | CUSTOM:1 (conforme ajuda) | q: 1 Favor se resolver problema real | requiresTargetApproval
27. Realizar um Grande Banquete | DIPLOMACY | 2 | WEALTH:2 | q: convida até 3 Casas para negociações | requiresTargetApproval
28. Propor um Casamento Político | DIPLOMACY | 4 | WEALTH:1 | q: vínculo dinástico, possível Favor, reivindicações | requiresTargetApproval; requiresGmApproval
29. Enviar uma Delegação Permanente | DIPLOMACY | 3 | WEALTH:1 | q: embaixada; melhor info/negociação | requiresTargetApproval
30. Perdoar uma Dívida | DIPLOMACY | 1 | CUSTOM:1 (valor da dívida) | q: 1 Favor / boa vontade / Estabilidade | requiresTargetApproval
31. Oferecer Proteção Militar | DIPLOMACY | 1 | SOLDIERS_COMMITTED:1 | q: 1 Favor após proteger | requiresTargetApproval
32. Criar um Tratado Comercial | DIPLOMACY | 2 | WEALTH:1 | q: benefício comercial mútuo; possível +1 Riqueza após 3 turnos | requiresTargetApproval
33. Financiar um Projeto Estrangeiro | DIPLOMACY | 3 | WEALTH:1 | q: 1 Favor + participação | requiresTargetApproval
34. Receber Refugiados de Outra Casa | DIPLOMACY | 2 | RESOURCES:1 | q: boa vontade, mão de obra, possível Favor | risk: -Estabilidade temporária
35. Realizar Intercâmbio de Estudiosos | DIPLOMACY | 3 | WEALTH:1 | q: troca de conhecimento; desbloqueia carta | requiresTargetApproval
36. Mediar uma Disputa | DIPLOMACY | 2 | (nenhum) | q: Favor de cada lado se aceitarem | requiresTargetApproval

### INTELLIGENCE
37. Estabelecer uma Rede de Informantes | INTELLIGENCE | 3 | WEALTH:2 | q: perguntas privadas sobre região/Casa | risk: exposição
38. Infiltrar um Agente | INTELLIGENCE | 2 | WEALTH:1 | q: uma informação específica sobre alvo
39. Criar uma Unidade de Contraespionagem | INTELLIGENCE | 3 | WEALTH:1, CONTROL_COMMITTED:1 | q: reduz infiltrações; identifica origem
40. Mapear Rotas Secretas | INTELLIGENCE | 3 | RESOURCES:1 | q: descobre rota alternativa; reduz tempo de expedição futura
41. Interrogar Prisioneiros | INTELLIGENCE | 1 | WEALTH:1 | q: informações (precisão variável); métodos cruéis -Estabilidade
42. Decifrar Documentos Antigos | INTELLIGENCE | 3 | WEALTH:1 | q: revela info histórica/reivindicação/segredo
43. Espalhar Propaganda | INTELLIGENCE | 2 | WEALTH:1 | q: melhora imagem própria ou prejudica outra | risk: -Estabilidade se descoberta
44. Investigar o Fluxo do Dinheiro | INTELLIGENCE | 2 | WEALTH:1 | q: identifica financiadores/beneficiários
45. Vigiar uma Estrada ou Porto | INTELLIGENCE | 1 | SOLDIERS_COMMITTED:1 | q: registra movimentações
46. Plantar uma Informação Falsa | INTELLIGENCE | 2 | WEALTH:1 | q: induz erro no inimigo | risk: perda de confiança se descoberta

### SOCIETY
47. Realizar um Festival Popular | SOCIETY | 1 | WEALTH:1, RESOURCES:1 | q: +1 Estabilidade temporária ou remove penalidade
48. Distribuir Alimentos | SOCIETY | 1 | RESOURCES:1 | q: impede perda de Estabilidade por fome
49. Fundar um Hospital | SOCIETY | 4 | RESOURCES:2, WEALTH:1 | stability +1 | q: reduz perdas em epidemias/guerras
50. Reformar a Justiça Local | SOCIETY | 4 | WEALTH:1 | q: +1 Estabilidade OU +1 Controle | req: Controle ≥ 3
51. Realizar um Censo | SOCIETY | 3 | WEALTH:1 | q: melhora arrecadação/recrutamento | risk: desconfiança de minorias
52. Construir uma Escola de Escribas | SOCIETY | 4 | RESOURCES:1, WEALTH:1 | q: melhora administração; -1 turno no próximo projeto de Controle/diplomacia
53. Reconhecer uma Tradição Local | SOCIETY | 1 | (político) | q: +Dignidade; possível +1 Estabilidade
54. Conceder Anistia | SOCIETY | 1 | (nenhum) | q: reduz tensão; risk: parecer fraqueza
55. Criar um Fundo para Viúvas e Órfãos | SOCIETY | 2 | WEALTH:1 | q: impede perda de Estabilidade pós-guerra
56. Erguer um Monumento aos Mortos | SOCIETY | 3 | RESOURCES:1, WEALTH:1 | q: +Dignidade; possível +1 Estabilidade após tragédia

### EXPLORATION / MAGIC
57. Enviar uma Expedição às Ruínas | EXPLORATION | 3 | RESOURCES:1, WEALTH:1 | q: conhecimento/riqueza/artefato/ameaça (depende da região)
58. Investigar uma Alteração nas Brumas | EXPLORATION | 3 | WEALTH:1 | q: info sobre padrões/riscos/rotas | req: acesso a magos/estudiosos
59. Contratar a Ordem dos Três | MAGIC | 3 | WEALTH:2 | q: ritual mágico específico | requiresGmApproval (a Ordem pode recusar)
60. Construir Proteções Arcanas | MAGIC | 5 | RESOURCES:2, WEALTH:2 | asset "Proteções Arcanas" (q: protege contra tipo de magia; definir ameaça)
61. Fundar um Observatório | EXPLORATION | 5 | RESOURCES:2, WEALTH:1 | asset "Observatório" (q: previsões/navegação)
62. Pesquisar um Artefato | MAGIC | 3 | WEALTH:1 | q: revela origem/função/risco do objeto | requiresGmApproval (artefatos poderosos)
63. Criar uma Biblioteca Regional | EXPLORATION | 5 | WEALTH:2, RESOURCES:1 | asset "Biblioteca Regional" (q: desbloqueia pesquisa)
64. Organizar uma Expedição Além das Fronteiras | EXPLORATION | 4 | RESOURCES:2, WEALTH:1 | q: descobre território/povo/rota/ameaça | risk: parte pode não retornar

Notes: cards whose only mechanical output is narrative use empty
`attributeChanges` + descriptive `qualitativeEffects`. Cards granting a
permanent attribute (15,18,19,49) encode a single `attributeChanges` entry.
"OR-choice" cards (13,22,50) keep the choice as qualitativeEffects (GM
adjudicates) to keep auto-application deterministic. `requiresTargetApproval`
cards create a pending consent/favor on start and go `PENDING_TARGET` instead of
`ACTIVE`. `requiresGmApproval` cards go `PENDING_GM` on start.
