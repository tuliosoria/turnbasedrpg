# Diplomatic Conversation Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw, repetitive diplomatic history with a deterministic projection that preserves relationship origin, recent context, structured negotiation state, and one clearly isolated incoming letter; add an audited dry-run repair for the contaminated Solarion–Mandíbula records.

**Architecture:** `montarDossie` loads the complete pair history and relevant campaign facts. Pure selectors in a focused `conversationMemory.ts` project that material into origin plus recency, while `responseMemory.ts` separates the target letter from earlier same-turn messages and renders structured diplomatic state. The existing writer and reviewer receive the same smaller material; a standalone DynamoDB script repairs only the known persisted records and writes only with `--confirm`.

**Tech Stack:** TypeScript 5.6, Node.js 20 ESM, Vitest 2, AWS SDK v3 DynamoDB document client, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-26-memoria-de-conversa-diplomatica-design.md`

## Global Constraints

- Keep `gpt-5.5` and `reasoning_effort: high`; do not change model, temperature, or token budget.
- Add no rule to `HOUSE_REPLY_SYSTEM_PROMPT` or `REVIEW_SYSTEM_PROMPT`; improve the material and replace existing user-prompt labels only.
- Add no model call, persistent summary, table, dependency, admin UI, deploy step, or automatic production write.
- Never delete or rewrite a player-authored letter.
- The repair command is dry-run by default and requires `--confirm` to write.
- Do not run the repair with `--confirm` while executing this plan.
- Preserve whole message bodies; never truncate a clause to meet the memory budget.
- Use TDD for every behavior change: observe the relevant test fail before editing production code.

## Review Focus

- Two different messages can have identical bodies; selection must deduplicate by position, not text, so both remain when both positions are selected. Covered in Task 2.
- The target message may not be the last item returned from DynamoDB; later messages must not leak into the prompt. Covered in Task 2.
- Legacy origin messages may exceed the normal 12,000-character budget; preserve them whole and admit no recent message that no longer fits. Covered in Task 2.
- Campaign facts may share `createdAt` or omit it in old records; the newest-wins selection must remain deterministic via `id`. Covered in Task 1.
- A repair run may see one already-correct letter and one old letter after an interrupted prior run; validate every target, then update only the old record without reverting the corrected one. Covered in Task 4.

---

## File Map

| Path | Responsibility |
|---|---|
| `backend/src/ai/diplomacy/dossie.ts` | Load complete history, retain pair facts, deduplicate and render diplomatic state. |
| `backend/src/ai/diplomacy/dossie.test.ts` | Complete-history and fact-group regressions. |
| `backend/src/ai/diplomacy/conversationMemory.ts` | Pure origin/recency and same-turn target selection. |
| `backend/src/ai/diplomacy/conversationMemory.test.ts` | Character budget, ordering, overlap, duplicate-body, and legacy-message tests. |
| `backend/src/ai/diplomacy/responseMemory.ts` | Compose selected prior history, earlier same-turn messages, target letter, and diplomatic state. |
| `backend/src/ai/diplomacy/responseMemory.test.ts` | Solarion-shaped 27-message regression and target isolation. |
| `backend/src/ai/diplomacy/housePrompt.ts` | Render remembered speech as subordinate context and the incoming letter once at the end. |
| `backend/src/ai/diplomacy/housePrompt.test.ts` | Authority label, placement, and single-occurrence assertions. |
| `backend/src/ai/diplomacy/outreachPrompt.ts` | Render selected history and structured state for proactive letters. |
| `backend/src/ai/diplomacy/outreachPrompt.test.ts` | Proactive prompt receives projection rather than all raw letters. |
| `backend/src/diplomacy/gerarResposta.ts` | Pass `sent.id` and the new memory fields to the prompt. |
| `backend/scripts/reparar-solarion-mandibula.mjs` | Validate, preview, and conditionally repair the known records. |
| `backend/scripts/reparar-solarion-mandibula.test.mjs` | Pure repair transformations and mixed-state idempotency. |

---

### Task 1: Keep Complete History and Render Structured Diplomatic State

**Files:**
- Modify: `backend/src/ai/diplomacy/dossie.ts`
- Modify: `backend/src/ai/diplomacy/dossie.test.ts`
- Modify: `backend/src/ai/diplomacy/responseMemory.ts` (compatibility import/field only)
- Modify: `backend/src/ai/diplomacy/responseMemory.test.ts` (fixture field rename only after RED is established)
- Modify: `backend/src/ai/diplomacy/outreachPrompt.ts` (compatibility import/field only)

**Interfaces:**
- Consumes: `listPairHistory(...) -> DiplomaticMessage[]`, `listFacts(...) -> CampaignFact[]`.
- Produces: `Dossie = { fio: RememberedLetter[]; fatos: CampaignFact[] }`.
- Produces: `descreverEstadoDiplomatico(dossie: Dossie): string`.
- Preserves temporarily: `descreverFio(...)`; Task 2 changes its selection policy.

- [ ] **Step 1: Change the dossier tests to require all 27 messages**

Replace the existing "TODOS os turnos" assertion with a 27-message fixture and add fact helpers:

```ts
function fato(over: Partial<CampaignFact>): CampaignFact {
  return {
    id: "f", campaignId: "c", turnNumber: 10, kind: "ACORDO",
    betweenA: "solarion-k0hc", betweenB: "casa-ferrumor",
    summary: "Acordo.", sourceMessageId: "m", status: "ATIVO",
    createdAt: "2026-09-20T00:00:00Z", ...over,
  };
}

it("conserva as 27 cartas do par para relação e auditoria", async () => {
  vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue(
    Array.from({ length: 27 }, (_, i) => carta(8 + Math.floor(i / 9), i % 2 ? "PLAYER" : "AI", `carta-${i}`)),
  );
  vi.spyOn(factsDb, "listFacts").mockResolvedValue([]);
  const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
  expect(d.fio).toHaveLength(27);
  expect(d.fio[0].body).toBe("carta-0");
  expect(d.fio[26].body).toBe("carta-26");
});
```

- [ ] **Step 2: Add failing tests for diplomatic groups and exact normalized deduplication**

```ts
it("separa obrigação, proposta e decisão sem promover pedido a acordo", async () => {
  vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
  vi.spyOn(factsDb, "listFacts").mockResolvedValue([
    fato({ id: "a", kind: "ACORDO", summary: "Troca no Vau Negro." }),
    fato({ id: "p", kind: "PEDIDO", summary: "Enviar estudiosos." }),
    fato({ id: "r", kind: "RECUSA", summary: "Garok recusa recuar." }),
  ]);
  const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
  const texto = descreverEstadoDiplomatico(d);
  expect(secao(texto, "OBRIGAÇÕES EM VIGOR")).toContain("Troca no Vau Negro");
  expect(secao(texto, "PROPOSTAS ABERTAS")).toContain("Enviar estudiosos");
  expect(secao(texto, "DECISÕES RECENTES")).toContain("Garok recusa recuar");
  expect(secao(texto, "OBRIGAÇÕES EM VIGOR")).not.toContain("Enviar estudiosos");
});

it("deduplica tipo e resumo normalizados e desempata por id", async () => {
  vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
  vi.spyOn(factsDb, "listFacts").mockResolvedValue([
    fato({ id: "a", summary: "Troca no Vau-Negro!", createdAt: "" }),
    fato({ id: "b", summary: "troca no vau negro", createdAt: "" }),
  ]);
  const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
  const texto = descreverEstadoDiplomatico(d);
  expect(texto.match(/troca no vau/gi)).toHaveLength(1);
  expect(texto).toContain("[b]");
});
```

Add this local test helper, which stops at the next blank-line-delimited group:

```ts
function secao(texto: string, titulo: string): string {
  return texto.split(`${titulo}:\n`)[1]?.split("\n\n")[0] ?? "";
}
```

- [ ] **Step 3: Run the dossier test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/dossie.test.ts
```

Expected: FAIL because `TETO_DE_CARTAS` still returns only 24, `Dossie` has `compromissos`, and `descreverEstadoDiplomatico` does not exist.

- [ ] **Step 4: Implement the new dossier shape and renderer**

In `dossie.ts`, import `CampaignFact` and `fold`, remove `TETO_DE_CARTAS`, and use this public shape:

```ts
export interface RememberedLetter {
  turnNumber: number;
  author: "PLAYER" | "AI";
  body: string;
}

export interface Dossie {
  fio: RememberedLetter[];
  fatos: CampaignFact[];
}
```

Return all messages and only facts belonging to this pair:

```ts
return {
  fio: historia.map((m) => ({ turnNumber: m.turnNumber, author: m.author, body: m.body })),
  fatos: fatos.filter((f) =>
    [f.betweenA, f.betweenB].includes(playerHouseId) &&
    [f.betweenA, f.betweenB].includes(toHouseKey)),
};
```

Add deterministic normalization and newest-wins deduplication:

```ts
function factKey(f: CampaignFact): string {
  return `${f.kind}|${fold(f.summary).replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function activeUniqueFacts(facts: CampaignFact[]): CampaignFact[] {
  const ordered = [...facts]
    .filter((f) => f.status === "ATIVO")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
  const seen = new Set<string>();
  return ordered.filter((f) => {
    const key = factKey(f);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

Render the three groups, including ids for auditability, and no block when all groups are empty:

```ts
export function descreverEstadoDiplomatico(d: Dossie): string {
  const facts = activeUniqueFacts(d.fatos);
  if (!facts.length) return "";
  const turns = [...new Set(facts.map((f) => f.turnNumber))].sort((a, b) => b - a).slice(0, 2);
  const groups = [
    ["OBRIGAÇÕES EM VIGOR", facts.filter((f) => ["ALIANCA", "ACORDO", "PROMESSA"].includes(f.kind))],
    ["PROPOSTAS ABERTAS — ainda não são acordo", facts.filter((f) => f.kind === "PEDIDO")],
    ["DECISÕES RECENTES — não são obrigação", facts.filter((f) =>
      (f.kind === "RECUSA" || f.kind === "AMEACA") && turns.includes(f.turnNumber))],
  ] as const;
  const body = groups
    .filter(([, entries]) => entries.length)
    .map(([title, entries]) => `${title}:\n${entries.map((f) => `- [Turno ${f.turnNumber}, ${f.id}] ${f.summary}`).join("\n")}`)
    .join("\n\n");
  return body
    ? `ESTADO DIPLOMÁTICO E SUA AUTORIDADE:\n${body}`
    : "";
}
```

Delete `descreverCompromissos`. Update fixtures from `compromissos: []` to `fatos: []`; imports that still need the replacement are completed in Tasks 2 and 3.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/dossie.test.ts
```

Expected: all dossier tests PASS.

- [ ] **Step 6: Run backend typecheck and resolve only shape fallout**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run typecheck --workspace backend
```

Expected at this intermediate boundary: no `compromissos`/`descreverCompromissos` references remain. If prompt consumers need the new renderer, replace only the import and field name; do not yet alter selection or prompt layout.

- [ ] **Step 7: Commit Task 1**

```bash
git add backend/src/ai/diplomacy/dossie.ts backend/src/ai/diplomacy/dossie.test.ts backend/src/ai/diplomacy/responseMemory.test.ts backend/src/ai/diplomacy/outreachPrompt.ts backend/src/ai/diplomacy/outreachPrompt.test.ts
git commit -m "refactor(diplomacia): estruturar estado do dossiê"
```

---

### Task 2: Project Origin, Recency, and the Exact Incoming Letter

**Files:**
- Create: `backend/src/ai/diplomacy/conversationMemory.ts`
- Create: `backend/src/ai/diplomacy/conversationMemory.test.ts`
- Modify: `backend/src/ai/diplomacy/responseMemory.ts`
- Modify: `backend/src/ai/diplomacy/responseMemory.test.ts`
- Modify: `backend/src/ai/diplomacy/dossie.ts`
- Modify: `backend/src/ai/diplomacy/dossie.test.ts`

**Interfaces:**
- Produces: `selectHistoricalLetters(letters, options?) -> RememberedLetter[]`.
- Produces: `selectCurrentExchange(messages, targetMessageId, limit?) -> { before: DiplomaticMessage[]; incoming: DiplomaticMessage }`.
- Changes: `responseMemory(dossie, turnNumber, currentThread, targetMessageId)` returns `{ priorLetters, thread, incomingLetter, diplomaticState }`.
- `HISTORY_MAX_CHARS = 12_000`, `HISTORY_RECENT_LIMIT = 6`, `CURRENT_THREAD_LIMIT = 6`.

- [ ] **Step 1: Write failing unit tests for historical projection**

Create `conversationMemory.test.ts` with these concrete cases:

```ts
import { describe, expect, it } from "vitest";
import { selectCurrentExchange, selectHistoricalLetters } from "./conversationMemory";
import type { DiplomaticMessage } from "@ravenloft/content";

const letter = (n: number, body = `m${n}`) => ({ turnNumber: 8 + Math.floor(n / 9), author: n % 2 ? "PLAYER" as const : "AI" as const, body });
const message = (id: string, createdAt: string, body = id) => ({
  id, createdAt, body, author: "PLAYER", turnNumber: 10,
} as DiplomaticMessage);

it("preserva as duas origens e as seis mais recentes de um fio de 27", () => {
  const selected = selectHistoricalLetters(Array.from({ length: 27 }, (_, i) => letter(i)));
  expect(selected.map((m) => m.body)).toEqual(["m0", "m1", "m21", "m22", "m23", "m24", "m25", "m26"]);
});

it("não confunde duas posições que têm o mesmo corpo", () => {
  const input = [letter(0, "igual"), letter(1, "igual"), ...Array.from({ length: 7 }, (_, i) => letter(i + 2))];
  expect(selectHistoricalLetters(input).filter((m) => m.body === "igual")).toHaveLength(2);
});

it("preserva origem legada inteira e não acrescenta recente fora do orçamento", () => {
  const input = [letter(0, "a".repeat(7_000)), letter(1, "b".repeat(7_000)), letter(2, "recente")];
  expect(selectHistoricalLetters(input).map((m) => m.body)).toEqual(["a".repeat(7_000), "b".repeat(7_000)]);
});
```

- [ ] **Step 2: Add failing unit tests for a target that is not last**

```ts
it("ordena, limita o passado e exclui tudo posterior ao alvo", () => {
  const items = [
    message("depois", "2026-09-20T12:00:00Z"),
    ...Array.from({ length: 8 }, (_, i) => message(`antes-${i}`, `2026-09-20T0${i}:00:00Z`)),
    message("alvo", "2026-09-20T10:00:00Z", "pergunta estratégica"),
  ];
  const selected = selectCurrentExchange(items, "alvo");
  expect(selected.before.map((m) => m.id)).toEqual(["antes-2", "antes-3", "antes-4", "antes-5", "antes-6", "antes-7"]);
  expect(selected.incoming.body).toBe("pergunta estratégica");
  expect(selected.before.map((m) => m.id)).not.toContain("depois");
});

it("recusa id que não pertence ao fio", () => {
  expect(() => selectCurrentExchange([message("a", "2026-09-20T00:00:00Z")], "ausente"))
    .toThrow(/Carta atual ausente/);
});
```

- [ ] **Step 3: Run the new test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/conversationMemory.test.ts
```

Expected: FAIL because `conversationMemory.ts` does not exist.

- [ ] **Step 4: Implement the pure selectors**

Create `conversationMemory.ts`:

```ts
import type { DiplomaticMessage } from "@ravenloft/content";
import type { RememberedLetter } from "./dossie";

export const HISTORY_MAX_CHARS = 12_000;
export const HISTORY_RECENT_LIMIT = 6;
export const CURRENT_THREAD_LIMIT = 6;

export function selectHistoricalLetters(
  letters: readonly RememberedLetter[],
  options: { maxChars?: number; recentLimit?: number } = {},
): RememberedLetter[] {
  const maxChars = options.maxChars ?? HISTORY_MAX_CHARS;
  const recentLimit = options.recentLimit ?? HISTORY_RECENT_LIMIT;
  const selected = new Set<number>();
  for (let i = 0; i < Math.min(2, letters.length); i++) selected.add(i);
  let used = [...selected].reduce((sum, i) => sum + letters[i].body.length, 0);
  let recent = 0;
  for (let i = letters.length - 1; i >= 0 && recent < recentLimit; i--) {
    if (selected.has(i)) continue;
    const size = letters[i].body.length;
    if (used + size > maxChars) continue;
    selected.add(i);
    used += size;
    recent++;
  }
  return [...selected].sort((a, b) => a - b).map((i) => letters[i]);
}

export function selectCurrentExchange(
  messages: readonly DiplomaticMessage[], targetMessageId: string, limit = CURRENT_THREAD_LIMIT,
): { before: DiplomaticMessage[]; incoming: DiplomaticMessage } {
  const ordered = [...messages].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const index = ordered.findIndex((m) => m.id === targetMessageId);
  if (index < 0) throw new Error(`Carta atual ausente do fio: ${targetMessageId}`);
  return { before: ordered.slice(Math.max(0, index - limit), index), incoming: ordered[index] };
}
```

- [ ] **Step 5: Verify selector tests GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/conversationMemory.test.ts
```

Expected: all selector tests PASS.

- [ ] **Step 6: Write the failing Solarion-shaped response-memory test**

In `responseMemory.test.ts`, build 18 previous messages plus nine current-turn messages. Use explicit bodies for the first proposal, acceptance, repeated logistics, strategic question, and target:

```ts
it("reduz o fio de Solarion e separa a pergunta atual sem duplicá-la", () => {
  const previous = Array.from({ length: 18 }, (_, i) => ({
    turnNumber: i < 9 ? 8 : 9,
    author: i % 2 ? "PLAYER" as const : "AI" as const,
    body: i === 0 ? "Propomos a primeira troca." : i === 1 ? "Solarion aceita." : `histórico-${i}`,
  }));
  const current = Array.from({ length: 9 }, (_, i) =>
    message(`t10-${i}`, `2026-09-20T0${i}:00:00Z`, i === 7 ? "O que pensa da estratégia?" : `turno-atual-${i}`));
  const dossie = { fio: previous, fatos: [] };
  const result = responseMemory(dossie, 10, current, "t10-7");
  expect(result.priorLetters.map((m) => m.body)).toEqual([
    "Propomos a primeira troca.", "Solarion aceita.",
    "histórico-12", "histórico-13", "histórico-14", "histórico-15", "histórico-16", "histórico-17",
  ]);
  expect(result.thread).toHaveLength(6);
  expect(result.incomingLetter).toBe("O que pensa da estratégia?");
  expect(result.thread.map((m) => m.body)).not.toContain("O que pensa da estratégia?");
});
```

- [ ] **Step 7: Run response-memory test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/responseMemory.test.ts
```

Expected: FAIL because the function still takes three arguments and returns no `incomingLetter` or `diplomaticState`.

- [ ] **Step 8: Implement response composition and proactive history selection**

Update `responseMemory.ts`:

```ts
import type { DiplomaticMessage } from "@ravenloft/content";
import { descreverEstadoDiplomatico, type Dossie } from "./dossie";
import { selectCurrentExchange, selectHistoricalLetters } from "./conversationMemory";

export function responseMemory(
  dossie: Dossie, turnNumber: number, currentThread: DiplomaticMessage[], targetMessageId: string,
) {
  const exchange = selectCurrentExchange(currentThread, targetMessageId);
  return {
    priorLetters: selectHistoricalLetters(dossie.fio.filter((m) => m.turnNumber < turnNumber)),
    thread: exchange.before.map((m) => ({ author: m.author, body: m.body })),
    incomingLetter: exchange.incoming.body,
    diplomaticState: descreverEstadoDiplomatico(dossie),
  };
}
```

Update `descreverFio` in `dossie.ts` to map `selectHistoricalLetters(d.fio)` rather than all `d.fio`. Its empty behavior remains unchanged.

- [ ] **Step 9: Verify memory and dossier tests GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/conversationMemory.test.ts src/ai/diplomacy/responseMemory.test.ts src/ai/diplomacy/dossie.test.ts
```

Expected: all tests PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add backend/src/ai/diplomacy/conversationMemory.ts backend/src/ai/diplomacy/conversationMemory.test.ts backend/src/ai/diplomacy/responseMemory.ts backend/src/ai/diplomacy/responseMemory.test.ts backend/src/ai/diplomacy/dossie.ts backend/src/ai/diplomacy/dossie.test.ts
git commit -m "feat(diplomacia): projetar memória da conversa"
```

---

### Task 3: Isolate the Incoming Letter in Writer and Reviewer Material

**Files:**
- Modify: `backend/src/ai/diplomacy/housePrompt.ts`
- Modify: `backend/src/ai/diplomacy/housePrompt.test.ts`
- Modify: `backend/src/ai/diplomacy/outreachPrompt.ts`
- Modify: `backend/src/ai/diplomacy/outreachPrompt.test.ts`
- Modify: `backend/src/diplomacy/gerarResposta.ts`

**Interfaces:**
- Changes `HouseReplyContext`: add required `incomingLetter: string`; `thread` now means only messages before it.
- Consumes `responseMemory(...).diplomaticState` and `.incomingLetter`.
- Proactive prompts consume `descreverEstadoDiplomatico(dossie)` and selected `descreverFio(dossie, ...)`.

- [ ] **Step 1: Add a failing house-prompt regression for authority and single occurrence**

Add `incomingLetter: "O que sabe dos mortos?"` to each shared base fixture in `housePrompt.test.ts`, then add:

```ts
it("subordina fala antiga e mostra a carta atual uma única vez no fim", () => {
  const incoming = "O que sabe dos mortos e da estratégia em Asterhall?";
  const u = buildHouseReplyUser({
    ...base,
    priorLetters: [{ turnNumber: 10, author: "AI", body: "Thorgul caiu." }],
    thread: [{ author: "AI", body: "Falamos antes sobre tecido." }],
    incomingLetter: incoming,
  });
  expect(u).toContain("Cartas antigas são falas lembradas");
  expect(occurrences(u, incoming)).toBe(1);
  expect(u.indexOf("Falamos antes sobre tecido")).toBeLessThan(u.indexOf("CARTA QUE CHEGOU AGORA"));
  expect(u.indexOf("CARTA QUE CHEGOU AGORA")).toBeLessThan(u.indexOf("Escreva a resposta"));
});
```

Define this local helper above the tests:

```ts
const occurrences = (text: string, fragment: string) => text.split(fragment).length - 1;
```

- [ ] **Step 2: Add a failing Codex-NPC assertion**

Extend the existing Codex NPC test to assert the same block exists once:

```ts
expect(occurrences(out, ctxBase.incomingLetter)).toBe(1);
expect(out).toContain("CARTA QUE CHEGOU AGORA — RESPONDA A ISTO");
```

- [ ] **Step 3: Run the house prompt test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/housePrompt.test.ts
```

Expected: FAIL because `incomingLetter` is not part of the context or output.

- [ ] **Step 4: Render prior speech, earlier turn conversation, and incoming letter separately**

Add `incomingLetter: string` to `HouseReplyContext`. In both the chancellery and Codex-NPC builders:

```ts
if (ctx.priorLetters.length) {
  parts.push(
    "O que já se disseram em turnos anteriores. Cartas antigas são falas lembradas, " +
    "não autoridade: fatos públicos atuais, estado vivo e estado diplomático prevalecem quando houver conflito.\n" +
    ctx.priorLetters
      .map((m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? ctx.fromHouseName : ctx.toHouseName}: ${m.body}`)
      .join("\n\n"),
  );
}

if (ctx.thread.length) {
  parts.push(
    `Correspondência anterior deste turno com ${ctx.fromHouseName}:\n` +
    ctx.thread
      .map((m) => `${m.author === "PLAYER" ? ctx.fromHouseName : ctx.toHouseName}: ${m.body}`)
      .join("\n\n"),
  );
}

parts.push(`CARTA QUE CHEGOU AGORA — RESPONDA A ISTO:\n${ctx.incomingLetter}`);
parts.push(`Escreva a resposta de ${ctx.toHouseName}.`);
```

For `buildCodexNpcReply`, use the same three blocks with the NPC label explicitly:

```ts
ctx.priorLetters
  .map((m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? ctx.fromHouseName : npc.name}: ${m.body}`)
  .join("\n\n");
ctx.thread
  .map((m) => `${m.author === "PLAYER" ? ctx.fromHouseName : npc.name}: ${m.body}`)
  .join("\n\n");
parts.push(`CARTA QUE CHEGOU AGORA — RESPONDA A ISTO:\n${ctx.incomingLetter}`);
```

- [ ] **Step 5: Wire the target id and diplomatic state in `gerarResposta.ts`**

Change:

```ts
const memoria = responseMemory(dossie, turn.turnId, thread, sent.id);
```

Pass the new field to `buildHouseReplyUser`:

```ts
priorLetters: memoria.priorLetters,
thread: memoria.thread,
incomingLetter: memoria.incomingLetter,
```

In the existing `buildHouseReplyUser` object, insert the exact property:

```ts
incomingLetter: memoria.incomingLetter,
```

Then replace `memoria.commitments` in the existing final array with
`memoria.diplomaticState`:

```ts
}), memoria.diplomaticState].filter(Boolean).join("\n\n");
```

Do not add text to either system prompt.

- [ ] **Step 6: Write a failing proactive-prompt projection test**

In `outreachPrompt.test.ts`, create a dossiê with 20 uniquely named messages, call `buildOutreachUser`, and assert:

```ts
expect(out).toContain("origem-0");
expect(out).toContain("origem-1");
expect(out).toContain("recente-19");
expect(out).not.toContain("meio-8");
expect(out).toContain("PROPOSTAS ABERTAS");
```

Use `fatos: [{ kind: "PEDIDO", status: "ATIVO", ... }]` in the fixture.

- [ ] **Step 7: Run proactive test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/outreachPrompt.test.ts
```

Expected: FAIL until the prompt replaces `descreverCompromissos` with `descreverEstadoDiplomatico` and `descreverFio` uses the projection from Task 2.

- [ ] **Step 8: Update the proactive prompt**

Replace the import and block:

```ts
import { descreverEstadoDiplomatico, descreverFio, type Dossie } from "./dossie";

if (ctx.dossie) {
  const fio = descreverFio(ctx.dossie, plan.toHouseName, plan.fromSeatName);
  if (fio) parts.push(fio);
  const estado = descreverEstadoDiplomatico(ctx.dossie);
  if (estado) parts.push(estado);
}
```

- [ ] **Step 9: Run all diplomacy prompt and integration tests**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run src/ai/diplomacy/housePrompt.test.ts src/ai/diplomacy/outreachPrompt.test.ts src/ai/diplomacy/responseMemory.test.ts src/ai/diplomacy/dossie.test.ts src/diplomacy
```

Expected: all selected tests PASS.

- [ ] **Step 10: Run backend typecheck**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run typecheck --workspace backend
```

Expected: PASS with no missing `incomingLetter`, `compromissos`, or old `responseMemory` call signatures.

- [ ] **Step 11: Commit Task 3**

```bash
git add backend/src/ai/diplomacy/housePrompt.ts backend/src/ai/diplomacy/housePrompt.test.ts backend/src/ai/diplomacy/outreachPrompt.ts backend/src/ai/diplomacy/outreachPrompt.test.ts backend/src/diplomacy/gerarResposta.ts
git commit -m "fix(diplomacia): focar a carta que chegou agora"
```

---

### Task 4: Add the Audited Solarion–Mandíbula Repair Command

**Files:**
- Create: `backend/scripts/reparar-solarion-mandibula.mjs`
- Create: `backend/scripts/reparar-solarion-mandibula.test.mjs`

**Interfaces:**
- Produces: `planejarReparo(items) -> { updates, unchanged }` without AWS writes.
- Produces: `corrigirCarta(item) -> { state: "update" | "unchanged"; before; after }`.
- Produces: `corrigirFato(item) -> { state: "update" | "unchanged"; before; after }`.
- CLI: `node scripts/reparar-solarion-mandibula.mjs` previews; `--confirm` conditionally writes.

- [ ] **Step 1: Write failing pure transformation tests**

Create `reparar-solarion-mandibula.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { corrigirCarta, corrigirFato, planejarReparo } from "./reparar-solarion-mandibula.mjs";

const carta = (over = {}) => ({
  PK: "CAMPAIGN#WINTER_DEAD",
  SK: "DIPLMSG#0010#solarion-k0hc~cla-mandibula-de-osso#mu7bh7vm-ryesl2",
  id: "mu7bh7vm-ryesl2", turnNumber: 10, author: "AI",
  fromHouseId: "solarion-k0hc", toHouseKey: "cla-mandibula-de-osso",
  body: "Escrevo isso com a boca amarga: Thorgul Crânio Cinzento caiu, e ainda não tivemos noite limpa para chorar direito.",
  ...over,
});

it("corrige apenas a premissa falsa e preserva o resto da carta", () => {
  const result = corrigirCarta(carta());
  expect(result.state).toBe("update");
  expect(result.after.body).not.toContain("Thorgul Crânio Cinzento caiu");
  expect(result.after.body).toContain("nossos mortos engrossarem a fileira inimiga");
});

it("recusa texto de jogador mesmo quando contém a frase alvo", () => {
  expect(() => corrigirCarta(carta({ author: "PLAYER" }))).toThrow(/autor IA/);
});

it("reconhece a carta já corrigida sem reescrever", () => {
  const once = corrigirCarta(carta()).after;
  expect(corrigirCarta(once).state).toBe("unchanged");
});

it("revoga o acordo antigo sem apagar procedência", () => {
  const old = {
    PK: "CAMPAIGN#WINTER_DEAD", SK: "CFACT#mu7bh7vv-ywo3lm", id: "mu7bh7vv-ywo3lm",
    betweenA: "solarion-k0hc", betweenB: "cla-mandibula-de-osso",
    turnNumber: 10, kind: "ACORDO", status: "ATIVO", sourceMessageId: "mu7bh7vm-ryesl2",
  };
  const result = corrigirFato(old);
  expect(result.after).toEqual({ ...old, status: "REVOGADO" });
  expect(corrigirFato(result.after).state).toBe("unchanged");
});
```

- [ ] **Step 2: Add failing validation and interrupted-run tests**

Add fixtures for the second letter (`mua8jyze-4ykmgk`), the old fact, and keeper fact (`mua8uzjq-buoc2p`), then assert:

```js
it("valida todos os alvos antes de devolver qualquer escrita", () => {
  expect(() => planejarReparo([primeiraCarta, segundaCarta, fatoAntigo]))
    .toThrow(/mua8uzjq-buoc2p/);
});

it("aceita execução interrompida e atualiza somente o alvo ainda antigo", () => {
  const primeiraCorrigida = corrigirCarta(primeiraCarta).after;
  const plan = planejarReparo([primeiraCorrigida, segundaCarta, fatoAntigo, fatoMantido]);
  expect(plan.updates.map((u) => u.id).sort()).toEqual(["mua8jyze-4ykmgk", "mu7bh7vv-ywo3lm"].sort());
  expect(plan.unchanged).toContain("mu7bh7vm-ryesl2");
});

it("recusa terceiro estado em vez de adivinhar correção", () => {
  expect(() => planejarReparo([
    { ...primeiraCarta, body: "texto inesperado" }, segundaCarta, fatoAntigo, fatoMantido,
  ])).toThrow(/estado inesperado/);
});
```

- [ ] **Step 3: Run the repair test and verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run scripts/reparar-solarion-mandibula.test.mjs
```

Expected: FAIL because the repair module does not exist.

- [ ] **Step 4: Implement closed target definitions and pure transformations**

Create `reparar-solarion-mandibula.mjs` using `pathToFileURL` so importing it in tests does not run `main`. Define two immutable letter repairs:

```js
export const LETTER_REPAIRS = [
  {
    id: "mu7bh7vm-ryesl2",
    oldText: "Thorgul Crânio Cinzento caiu",
    newText: "vimos nossos mortos engrossarem a fileira inimiga",
  },
  {
    id: "mua8jyze-4ykmgk",
    oldText: "Depois de Thorgul cair",
    newText: "Depois de vermos nossos mortos se levantarem",
  },
];

export const OLD_FACT_ID = "mu7bh7vv-ywo3lm";
export const KEEPER_FACT_ID = "mua8uzjq-buoc2p";
```

`corrigirCarta` must require the closed id list, `author === "AI"`, turn 10, exact pair, and exactly one of `oldText`/`newText`. `corrigirFato` must require the old fact id, pair, turn 10, kind `ACORDO`, and status `ATIVO` or `REVOGADO`. `planejarReparo` must find exactly one of each letter and fact id, validate the keeper as active, and only then return update descriptors.

Use descriptors with enough information for conditional writes:

```js
{
  type: "letter",
  id: item.id,
  key: { PK: item.PK, SK: item.SK },
  oldBody: item.body,
  newBody: next.body,
}
```

and:

```js
{
  type: "fact",
  id: item.id,
  key: { PK: item.PK, SK: item.SK },
  oldStatus: "ATIVO",
  newStatus: "REVOGADO",
}
```

- [ ] **Step 5: Implement dry-run main and conditional writes**

Query the campaign partition twice with prefixes `DIPLMSG#` and `CFACT#`,
following `LastEvaluatedKey` until it is absent:

```js
async function queryPrefix(doc, prefix) {
  const items = [];
  let cursor;
  do {
    const result = await doc.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": PK, ":sk": prefix },
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }));
    items.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}
```

Print every update and unchanged id. Return before constructing any
`UpdateCommand` when `--confirm` is absent.

For letters use:

```js
new UpdateCommand({
  TableName: TABLE_NAME,
  Key: update.key,
  UpdateExpression: "SET body = :newBody, rewrittenAt = :now",
  ConditionExpression: "body = :oldBody AND author = :ai",
  ExpressionAttributeValues: {
    ":newBody": update.newBody,
    ":oldBody": update.oldBody,
    ":now": new Date().toISOString(),
    ":ai": "AI",
  },
})
```

For the fact use expression-name escaping:

```js
new UpdateCommand({
  TableName: TABLE_NAME,
  Key: update.key,
  UpdateExpression: "SET #status = :newStatus",
  ConditionExpression: "#status = :oldStatus",
  ExpressionAttributeNames: { "#status": "status" },
  ExpressionAttributeValues: { ":newStatus": "REVOGADO", ":oldStatus": "ATIVO" },
})
```

End with:

```js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 6: Run repair unit tests and verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run scripts/reparar-solarion-mandibula.test.mjs
```

Expected: all repair tests PASS without an AWS call.

- [ ] **Step 7: Run the real command in dry-run mode only**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
node scripts/reparar-solarion-mandibula.mjs
```

Expected: exactly two letter updates and one fact revocation are previewed; keeper fact is reported unchanged; final line says no data was written and names `--confirm`. Do not run the confirmed form.

- [ ] **Step 8: Commit Task 4**

```bash
git add backend/scripts/reparar-solarion-mandibula.mjs backend/scripts/reparar-solarion-mandibula.test.mjs
git commit -m "fix(dados): preparar reparo de Solarion e Mandíbula"
```

---

### Task 5: Full Verification Against the Specification

**Files:**
- Review: `docs/superpowers/specs/2026-09-26-memoria-de-conversa-diplomatica-design.md`
- Review: all files changed in Tasks 1–4
- Modify only if verification finds a defect; any behavior fix starts with a failing test.

**Interfaces:**
- Consumes all prior task outputs.
- Produces fresh evidence for tests, typecheck, diff hygiene, prompt size, and dry-run safety.

- [ ] **Step 1: Re-run every focused regression**

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
npx vitest run \
  src/ai/diplomacy/dossie.test.ts \
  src/ai/diplomacy/conversationMemory.test.ts \
  src/ai/diplomacy/responseMemory.test.ts \
  src/ai/diplomacy/housePrompt.test.ts \
  src/ai/diplomacy/outreachPrompt.test.ts \
  scripts/reparar-solarion-mandibula.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the entire repository suite**

```bash
cd /Users/jessicarosa/turnbasedrpg
npm test
```

Expected: shared, backend, and frontend suites all PASS with zero failed tests.

- [ ] **Step 3: Run the entire repository typecheck**

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 4: Check patch hygiene and scope**

```bash
cd /Users/jessicarosa/turnbasedrpg
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors; only the spec, plan, diplomacy memory/prompt files, integration call, and repair script/tests changed.

- [ ] **Step 5: Re-run production dry-run and inspect exact target count**

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
node scripts/reparar-solarion-mandibula.mjs
```

Expected: two letter changes + one fact revocation, zero writes. Save no secrets or full table dump in the repository.

- [ ] **Step 6: Compare implementation to every acceptance criterion**

Read the spec's `# Critérios de aceitação` section and record in the final report:

- complete history retained for relation/audit;
- origin + recency projected;
- incoming letter occurs once and last;
- fact kinds remain separate;
- no system-prompt rule added;
- repair is dry-run, conditional, idempotent, and player-safe;
- no deploy and no `--confirm` execution occurred.

- [ ] **Step 7: Commit verification-only fixes if any**

If verification required code changes, first add a reproducing failing test, fix it, re-run Steps 1–5, then commit only those files:

```bash
git add backend/src/ai/diplomacy backend/src/diplomacy/gerarResposta.ts backend/scripts/reparar-solarion-mandibula.mjs backend/scripts/reparar-solarion-mandibula.test.mjs
git commit -m "fix(diplomacia): corrigir regressão da memória"
```

If verification required no changes, do not create an empty commit.
