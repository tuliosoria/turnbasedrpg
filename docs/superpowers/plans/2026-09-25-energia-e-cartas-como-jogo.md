# Energia e cartas como jogo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o painel de cartas do jogador para que Energia, passo grátis, conclusão e "tentar de novo" se expliquem sozinhos, com gravação a cada toque, animações nativas e uma revelação das cartas resolvidas no fechamento.

**Architecture:** O `HouseProjectsPanel` vira um orquestrador fino. As peças vão para `frontend/src/components/projetos/`: contas puras em `previa.ts`, animações em `animacoes.ts`, o hook `useEnergiaAutoSave`, e componentes de apresentação que só recebem números e callbacks. O backend muda num ponto só: `refazerProjeto` passa a conferir o teto de cartas.

**Tech Stack:** React 18 + MUI 5 + Emotion (`keyframes` de `@emotion/react`), Web Animations API, Vitest + Testing Library, TypeScript. Monorepo: `shared` (`@ravenloft/content`), `backend`, `frontend`.

**Spec:** `docs/superpowers/specs/2026-09-25-energia-e-cartas-como-jogo-design.md`

## Global Constraints

- Regras intocadas: `ENERGIA_POR_TURNO = 3`, `PASSO_POR_TURNO = 1`, `energiaMaximaPara`, juiz de desfecho. Nenhum número de regra digitado na tela; sempre importado de `@ravenloft/content`.
- Nenhuma dependência nova no `package.json`.
- Cor de Energia: `#4fd1c5` (contraste 10,21:1 sobre `#0e1013`), usada **só** para Energia. O ouro `#c8a24b` continua nos três usos do tema e no brilho do sucesso.
- Alvos de toque de pelo menos 48px. Tela de referência: 390px de largura.
- `prefers-reduced-motion: reduce` desliga voo, pulso, virada e rachadura; resta um fade de 120ms.
- localStorage só dentro de try/catch, chave `valdren.revelacao.<houseId>`. Sem storage, a revelação não aparece e nada quebra.
- Gravação de Energia: 400ms depois do último toque, sempre com a distribuição **inteira** da Casa (todas as categorias).
- Texto da tela em português, frases curtas no presente.
- `vitest` não faz typecheck: rode `npm run typecheck` (raiz) antes de cada commit.
- Mudou `shared/`? Rode `npm run build:shared` antes de o backend ou o frontend enxergarem o símbolo novo.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A aba Espiões grava Energia e apaga a das obras.** O painel de Espiões só mostra cartas `INTELLIGENCE`, mas a alocação é da Casa inteira. Gravar só o recorte zeraria a Energia das cartas da aba Projetos. Esperado: a gravação sempre leva o mapa inteiro. Teste na Task 4 (hook) e na Task 8 (painel).
2. **Toque e saída antes dos 400ms.** O jogador toca "+" e troca de aba em seguida. Esperado: a gravação pendente sai no desmontar, e não se perde. Teste na Task 4.
3. **Turno trancado.** `setEnergia` responde 423 `TURN_LOCKED`. Esperado: a tela volta ao último valor gravado e mostra a mensagem do servidor. Teste na Task 4.
4. **Carta antiga sem `resolvedAt`.** Cartas resolvidas antes do campo existir não têm data. Esperado: ficam fora da revelação, sem erro. Teste na Task 2.
5. **"Tentar de novo" sem vaga.** Refazer com as vagas cheias. Esperado: o servidor recusa com 409 e a tela mostra "Libere uma vaga primeiro" com o botão desativado. Teste na Task 1 (backend) e na Task 7 (componente).

---

## Estrutura de arquivos

| Arquivo | Papel |
|---|---|
| `backend/src/routes/projectRoutes.ts` (modificar) | `refazerProjeto` confere o teto |
| `frontend/src/api/mockClient.ts` (modificar) | mock espelha o teto no refazer |
| `frontend/src/theme.ts` (modificar) | `brand.energia` |
| `frontend/src/components/projetos/cores.ts` | `CORES_DE_CATEGORIA` |
| `frontend/src/components/projetos/previa.ts` | `previaDoFechamento`, `cartasParaRevelar`, `lerVistoEm`, `gravarVistoEm`, `EVENTO_REVELACAO` |
| `frontend/src/components/projetos/animacoes.ts` | `querMovimentoReduzido`, `voarOrbe`, keyframes |
| `frontend/src/components/projetos/useEnergiaAutoSave.ts` | estado local + gravação com pausa |
| `frontend/src/components/projetos/TrilhaDePassos.tsx` | casinhas de progresso |
| `frontend/src/components/projetos/CofreDeEnergia.tsx` | orbes, saldo, "Como funciona?" |
| `frontend/src/components/projetos/CartaAtiva.tsx` | carta em andamento |
| `frontend/src/components/projetos/CartaFracassada.tsx` | faixa "Pode tentar de novo" |
| `frontend/src/components/projetos/RevelacaoDoTurno.tsx` | a revelação |
| `frontend/src/components/projetos/useNovidadesDasCartas.ts` | contagem para os selos das abas |
| `frontend/src/components/HouseProjectsPanel.tsx` (modificar) | orquestrador |
| `frontend/src/pages/GamePage.tsx` (modificar) | `houseId` no painel e selos nas abas |

---

### Task 1: `refazerProjeto` confere o teto de cartas

**Files:**
- Modify: `backend/src/routes/projectRoutes.ts` (função `refazerProjeto`, ~linha 238)
- Modify: `frontend/src/api/mockClient.ts` (`async refazerProjeto`, ~linha 1543)
- Test: `backend/src/routes/projectRoutes.test.ts` (`describe("refazerProjeto")`, ~linha 393)

**Interfaces:**
- Consumes: `listHouseProjects`, `activeProjectCount`, `projectSlotLimit`, `loadHouse` (já importados em `projectRoutes.ts`).
- Produces: `POST /api/player/project/refazer` responde `409 BAD_STATUS` com a mensagem `"Libere uma vaga primeiro: sua Casa já tem o máximo de cartas ativas."` quando as vagas estão cheias.

- [ ] **Step 1: Write the failing test**

No `describe("refazerProjeto")` de `backend/src/routes/projectRoutes.test.ts`, depois do teste "devolve a carta ao jogo com desfecho garantido":

```ts
  // Refazer põe a carta de volta em ACTIVE. Sem conferir o teto, uma Casa com
  // três ativas ficaria com quatro — como Khazdrun ficou pela aprovação antiga.
  it("recusa refazer quando as vagas estão cheias", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada });
    vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue(cartasNoTeto());
    await expect(refazerProjeto(deps(), req({ projectId: "p-falha" }))).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/Libere uma vaga/),
    });
    expect(projectsDb.putProject).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/routes/projectRoutes.test.ts -t "vagas estão cheias"`
Expected: FAIL (a promessa resolve em vez de rejeitar).

- [ ] **Step 3: Write minimal implementation**

Em `refazerProjeto`, logo depois do `if (project.status !== "FAILED") { ... }`:

```ts
  // Voltar para ACTIVE ocupa vaga como qualquer carta. Sem esta conferência a
  // reparação de um bug abria um segundo bug: Casa acima do teto.
  const house = await loadHouse(deps, player.houseId);
  const cartas = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (activeProjectCount(cartas) >= projectSlotLimit(house)) {
    throw new HttpError(409, "BAD_STATUS", "Libere uma vaga primeiro: sua Casa já tem o máximo de cartas ativas.");
  }
```

Em `frontend/src/api/mockClient.ts`, substitua o corpo de `async refazerProjeto`:

```ts
  async refazerProjeto(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const list = this.projects.get(rec.houseId) ?? [];
    if (activeProjectCount(list) >= projectSlotLimit(house)) {
      throw new ApiError("BAD_STATUS", "Libere uma vaga primeiro: sua Casa já tem o máximo de cartas ativas.");
    }
    return this.mutateProject(playerToken, input.projectId, (p) => {
      p.refeita = true; p.status = "ACTIVE"; p.outcome = null; p.outcomeNarrative = null;
      p.durationTurns = 1; p.turnsCompleted = 0; p.lastProcessedTurnId = null;
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --root backend src/routes/projectRoutes.test.ts`
Expected: PASS, todos. Os testes antigos de `refazerProjeto` continuam passando porque o `beforeEach` do arquivo mocka `listHouseProjects` com `[]`.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add backend/src/routes/projectRoutes.ts backend/src/routes/projectRoutes.test.ts frontend/src/api/mockClient.ts
git commit -m "fix(projetos): refazer carta confere o teto de vagas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Contas puras — prévia do fechamento e o que revelar

**Files:**
- Create: `frontend/src/components/projetos/previa.ts`
- Test: `frontend/src/components/projetos/previa.test.ts`

**Interfaces:**
- Consumes: `PASSO_POR_TURNO`, `type ProjectCard` de `@ravenloft/content`.
- Produces:
  - `interface Previa { andadas: number; gratis: number; comEnergia: number; depois: number; total: number; conclui: boolean }`
  - `previaDoFechamento(carta: Pick<ProjectCard, "status" | "turnsCompleted" | "durationTurns">, energia: number): Previa`
  - `cartasParaRevelar(cartas: ProjectCard[], vistoEm: string | null): ProjectCard[]` — ordenadas por `resolvedAt` crescente
  - `lerVistoEm(houseId: string): string | null`
  - `gravarVistoEm(houseId: string, quando: string): void` — também dispara `window` event `EVENTO_REVELACAO`
  - `const EVENTO_REVELACAO = "valdren:revelacao-vista"`
  - `const JANELA_DO_FECHAMENTO_MS = 15 * 60 * 1000`

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/previa.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProjectCard } from "@ravenloft/content";
import { previaDoFechamento, cartasParaRevelar, lerVistoEm, gravarVistoEm, EVENTO_REVELACAO } from "./previa";

const ativa = (turnsCompleted: number, durationTurns: number) =>
  ({ status: "ACTIVE", turnsCompleted, durationTurns }) as const;

describe("previaDoFechamento", () => {
  it("sem Energia, a carta anda o passo grátis", () => {
    expect(previaDoFechamento(ativa(1, 5), 0)).toEqual({ andadas: 1, gratis: 1, comEnergia: 0, depois: 2, total: 5, conclui: false });
  });

  it("Energia soma passos além do grátis", () => {
    expect(previaDoFechamento(ativa(1, 5), 2)).toMatchObject({ gratis: 1, comEnergia: 2, depois: 4, conclui: false });
  });

  it("0 de 1: conclui sozinha, e Energia não compra nada", () => {
    expect(previaDoFechamento(ativa(0, 1), 2)).toEqual({ andadas: 0, gratis: 1, comEnergia: 0, depois: 1, total: 1, conclui: true });
  });

  it("nunca passa do total", () => {
    expect(previaDoFechamento(ativa(3, 5), 3)).toMatchObject({ comEnergia: 1, depois: 5, conclui: true });
  });

  it("pausada não anda", () => {
    expect(previaDoFechamento({ status: "PAUSED", turnsCompleted: 1, durationTurns: 3 }, 2))
      .toEqual({ andadas: 1, gratis: 0, comEnergia: 0, depois: 1, total: 3, conclui: false });
  });
});

const resolvida = (id: string, status: "COMPLETED" | "FAILED", resolvedAt: string | null) =>
  ({ id, status, resolvedAt }) as unknown as ProjectCard;

describe("cartasParaRevelar", () => {
  const cartas = [
    resolvida("velha", "COMPLETED", "2026-09-18T14:00:00.000Z"),
    resolvida("b", "FAILED", "2026-09-23T14:06:03.100Z"),
    resolvida("a", "COMPLETED", "2026-09-23T14:06:02.900Z"),
    resolvida("sem-data", "COMPLETED", null),
    { id: "ativa", status: "ACTIVE", resolvedAt: null } as unknown as ProjectCard,
  ];

  it("com vistoEm, revela só o que foi resolvido depois, em ordem", () => {
    expect(cartasParaRevelar(cartas, "2026-09-20T00:00:00.000Z").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("sem vistoEm, revela só o último fechamento — não a campanha inteira", () => {
    expect(cartasParaRevelar(cartas, null).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("carta antiga sem resolvedAt fica de fora, sem erro", () => {
    expect(cartasParaRevelar([resolvida("sem-data", "FAILED", null)], null)).toEqual([]);
  });

  it("nada novo depois do visto: lista vazia", () => {
    expect(cartasParaRevelar(cartas, "2026-09-24T00:00:00.000Z")).toEqual([]);
  });
});

describe("vistoEm no aparelho", () => {
  beforeEach(() => localStorage.clear());

  it("grava, lê e avisa a tela", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_REVELACAO, ouvinte);
    gravarVistoEm("casa-x", "2026-09-23T14:06:03.100Z");
    expect(lerVistoEm("casa-x")).toBe("2026-09-23T14:06:03.100Z");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_REVELACAO, ouvinte);
  });

  it("sem storage, não quebra: lê null e grava nada", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(lerVistoEm("casa-x")).toBeNull();
    expect(() => gravarVistoEm("casa-x", "2026-09-23T00:00:00.000Z")).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/previa.test.ts`
Expected: FAIL, "Failed to resolve import ./previa".

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/previa.ts`:

```ts
import { PASSO_POR_TURNO, type ProjectCard } from "@ravenloft/content";

/**
 * Onde a carta estará depois do fechamento, contado como o motor conta
 * (`backend/src/projects/processTurn.ts`): só carta ACTIVE anda, e anda o passo
 * grátis mais a Energia, sem passar do total.
 */
export interface Previa {
  andadas: number;
  gratis: number;
  comEnergia: number;
  depois: number;
  total: number;
  conclui: boolean;
}

export function previaDoFechamento(
  carta: Pick<ProjectCard, "status" | "turnsCompleted" | "durationTurns">,
  energia: number,
): Previa {
  const andadas = carta.turnsCompleted;
  const total = carta.durationTurns;
  const falta = Math.max(0, total - andadas);
  if (carta.status !== "ACTIVE") {
    return { andadas, gratis: 0, comEnergia: 0, depois: andadas, total, conclui: false };
  }
  const gratis = Math.min(PASSO_POR_TURNO, falta);
  const comEnergia = Math.min(Math.max(0, energia), falta - gratis);
  const depois = andadas + gratis + comEnergia;
  return { andadas, gratis, comEnergia, depois, total, conclui: depois >= total };
}

/**
 * Cartas de um mesmo fechamento são resolvidas em sequência, com milissegundos
 * de diferença. Quinze minutos separam com folga um fechamento do próximo.
 */
export const JANELA_DO_FECHAMENTO_MS = 15 * 60 * 1000;

function resolvidaComData(c: ProjectCard): c is ProjectCard & { resolvedAt: string } {
  return (c.status === "COMPLETED" || c.status === "FAILED") && typeof c.resolvedAt === "string" && c.resolvedAt !== "";
}

/**
 * O que a revelação mostra. Sem `vistoEm` (primeiro acesso neste aparelho), só
 * o último fechamento: revelar a campanha inteira seria uma parede, não um
 * momento.
 */
export function cartasParaRevelar(cartas: ProjectCard[], vistoEm: string | null): ProjectCard[] {
  const comData = cartas.filter(resolvidaComData);
  let escolhidas: typeof comData;
  if (vistoEm) {
    escolhidas = comData.filter((c) => c.resolvedAt > vistoEm);
  } else {
    const ultima = comData.reduce((max, c) => (c.resolvedAt > max ? c.resolvedAt : max), "");
    if (!ultima) return [];
    const corte = new Date(Date.parse(ultima) - JANELA_DO_FECHAMENTO_MS).toISOString();
    escolhidas = comData.filter((c) => c.resolvedAt >= corte);
  }
  return [...escolhidas].sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
}

export const EVENTO_REVELACAO = "valdren:revelacao-vista";
const chave = (houseId: string) => `valdren.revelacao.${houseId}`;

export function lerVistoEm(houseId: string): string | null {
  try {
    return localStorage.getItem(chave(houseId));
  } catch {
    return null;
  }
}

export function gravarVistoEm(houseId: string, quando: string): void {
  try {
    localStorage.setItem(chave(houseId), quando);
  } catch {
    // Sem storage a revelação simplesmente volta na próxima visita.
  }
  window.dispatchEvent(new Event(EVENTO_REVELACAO));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/previa.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/previa.ts frontend/src/components/projetos/previa.test.ts
git commit -m "feat(projetos): prévia do fechamento e seleção da revelação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cores e animações nativas

**Files:**
- Modify: `frontend/src/theme.ts` (objeto `brand`)
- Create: `frontend/src/components/projetos/cores.ts`
- Create: `frontend/src/components/projetos/animacoes.ts`
- Test: `frontend/src/components/projetos/animacoes.test.ts`

**Interfaces:**
- Produces:
  - `brand.energia = "#4fd1c5"` em `theme.ts`
  - `CORES_DE_CATEGORIA: Record<ProjectCategory, string>` em `cores.ts`
  - `querMovimentoReduzido(): boolean`
  - `voarOrbe(de: Element | null, para: Element | null): Promise<void>`
  - `pulsoEnergia`, `brilhoSucesso`, `rachadura`, `virarCarta`, `aparecer` (keyframes do Emotion)
  - `animacao(nome, duracao, extra?): string` — devolve `"none"` com movimento reduzido, ou o valor para a prop `animation` do `sx`

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/animacoes.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { querMovimentoReduzido, voarOrbe, animacao, pulsoEnergia } from "./animacoes";

function comMovimentoReduzido(reduzido: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduzido && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("animações", () => {
  it("lê a preferência do sistema", () => {
    comMovimentoReduzido(true);
    expect(querMovimentoReduzido()).toBe(true);
    comMovimentoReduzido(false);
    expect(querMovimentoReduzido()).toBe(false);
  });

  it("sem matchMedia, assume movimento normal", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(querMovimentoReduzido()).toBe(false);
  });

  it("com movimento reduzido, o orbe não voa e nada é criado", async () => {
    comMovimentoReduzido(true);
    const de = document.createElement("div");
    const para = document.createElement("div");
    const animate = vi.fn();
    (de as unknown as { animate: unknown }).animate = animate;
    await voarOrbe(de, para);
    expect(document.body.children.length).toBe(0);
  });

  it("sem Web Animations (jsdom), resolve sem erro e limpa o orbe", async () => {
    comMovimentoReduzido(false);
    const de = document.createElement("div");
    const para = document.createElement("div");
    document.body.append(de, para);
    await expect(voarOrbe(de, para)).resolves.toBeUndefined();
    expect(document.querySelectorAll("[data-orbe-voando]").length).toBe(0);
  });

  it("animacao() vira 'none' com movimento reduzido", () => {
    comMovimentoReduzido(true);
    expect(animacao(pulsoEnergia, "2s", "infinite")).toBe("none");
    comMovimentoReduzido(false);
    expect(animacao(pulsoEnergia, "2s", "infinite")).toContain("2s");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/animacoes.test.ts`
Expected: FAIL, "Failed to resolve import ./animacoes".

- [ ] **Step 3: Write minimal implementation**

Em `frontend/src/theme.ts`, dentro de `export const brand = { ... }`, depois de `accentDim`:

```ts
  /**
   * Só Energia usa esta cor: orbes, passos comprados, carta energizada. O ouro
   * já tem três donos no tema; se a Energia também fosse ouro, tudo brilharia
   * igual. 10,21:1 sobre a base.
   */
  energia: "#4fd1c5",
```

`frontend/src/components/projetos/cores.ts`:

```ts
import type { ProjectCategory } from "@ravenloft/content";

/**
 * A faixa de 4px à esquerda da carta. Tons dessaturados, longe do turquesa da
 * Energia e do ouro do tema, para a categoria orientar sem competir.
 */
export const CORES_DE_CATEGORIA: Record<ProjectCategory, string> = {
  MILITARY: "#b06a5e",
  INFRASTRUCTURE: "#8f8a7a",
  ECONOMY: "#b59a5a",
  DIPLOMACY: "#6f8fb0",
  INTELLIGENCE: "#8a7aa8",
  SOCIETY: "#9a7f6a",
  MAGIC: "#a07ab0",
  EXPLORATION: "#6f9a7a",
};
```

`frontend/src/components/projetos/animacoes.ts`:

```ts
import { keyframes } from "@emotion/react";
import { brand } from "../../theme";

/**
 * Movimento neste painel é o jogo; fora dele, o tema manda que seja só acento.
 * Toda decisão de animar passa por aqui, para que `prefers-reduced-motion`
 * desligue tudo num lugar só.
 */
export function querMovimentoReduzido(): boolean {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const pulsoEnergia = keyframes`
  0%, 100% { box-shadow: 0 0 0 1px ${brand.energia}, 0 0 6px 0 ${brand.energia}55; }
  50% { box-shadow: 0 0 0 1px ${brand.energia}, 0 0 14px 2px ${brand.energia}88; }
`;

export const brilhoSucesso = keyframes`
  0% { box-shadow: 0 0 0 0 ${brand.accent}00; }
  40% { box-shadow: 0 0 32px 6px ${brand.accent}aa; }
  100% { box-shadow: 0 0 12px 2px ${brand.accent}55; }
`;

export const virarCarta = keyframes`
  0% { transform: perspective(800px) rotateY(90deg); opacity: 0; }
  100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
`;

export const rachadura = keyframes`
  0% { transform: translateX(0); filter: grayscale(0); }
  20% { transform: translateX(-4px) rotate(-1deg); }
  40% { transform: translateX(4px) rotate(1deg); }
  60% { transform: translateX(-2px); }
  100% { transform: translateX(0); filter: grayscale(0.7); }
`;

export const aparecer = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

type Keyframes = ReturnType<typeof keyframes>;

/** Valor da prop `animation` do `sx`, ou "none" com movimento reduzido. */
export function animacao(nome: Keyframes, duracao: string, extra = ""): string {
  if (querMovimentoReduzido()) return "none";
  return `${nome} ${duracao} ease-out ${extra}`.trim();
}

function centro(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Um orbe de Energia sai de `de` e pousa em `para`, num arco. Resolve quando
 * termina; com movimento reduzido, sem Web Animations ou sem os dois pontos,
 * resolve na hora sem criar nada.
 */
export async function voarOrbe(de: Element | null, para: Element | null): Promise<void> {
  if (!de || !para || querMovimentoReduzido()) return;
  const orbe = document.createElement("div");
  orbe.setAttribute("data-orbe-voando", "");
  if (typeof orbe.animate !== "function") return;
  const a = centro(de);
  const b = centro(para);
  const topo = Math.min(a.y, b.y) - 60;
  Object.assign(orbe.style, {
    position: "fixed", left: "0", top: "0", width: "18px", height: "18px", borderRadius: "50%",
    background: brand.energia, boxShadow: `0 0 12px 4px ${brand.energia}99`, pointerEvents: "none", zIndex: "2000",
  });
  document.body.appendChild(orbe);
  const ponto = (x: number, y: number) => `translate(${x - 9}px, ${y - 9}px)`;
  try {
    await orbe.animate(
      [
        { transform: ponto(a.x, a.y), opacity: 1 },
        { transform: ponto((a.x + b.x) / 2, topo), opacity: 1, offset: 0.5 },
        { transform: ponto(b.x, b.y), opacity: 0.2 },
      ],
      { duration: 450, easing: "cubic-bezier(.3,.7,.4,1)" },
    ).finished;
  } catch {
    // Animação cancelada (aba escondida, navegação): o estado já mudou.
  } finally {
    orbe.remove();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/animacoes.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/theme.ts frontend/src/components/projetos/cores.ts frontend/src/components/projetos/animacoes.ts frontend/src/components/projetos/animacoes.test.ts
git commit -m "feat(projetos): cor de Energia, cores de categoria e animações nativas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `useEnergiaAutoSave` — grava a cada toque

**Files:**
- Create: `frontend/src/components/projetos/useEnergiaAutoSave.ts`
- Test: `frontend/src/components/projetos/useEnergiaAutoSave.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function useEnergiaAutoSave(opts: {
    gravado: Record<string, number>;               // o que o servidor devolveu (mapa inteiro da Casa)
    gravar: (porProjeto: Record<string, number>) => Promise<unknown>;
    atrasoMs?: number;                             // padrão 400
  }): {
    energia: Record<string, number>;               // estado local, mapa inteiro
    mudar: (projectId: string, delta: 1 | -1) => void;
    erro: string | null;
  }
  ```
  `mudar` não confere teto nem saldo: quem chama desativa os botões. O hook garante nunca negativo.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/useEnergiaAutoSave.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../types/api";
import { useEnergiaAutoSave } from "./useEnergiaAutoSave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useEnergiaAutoSave", () => {
  it("atualiza na hora e grava uma vez só depois da pausa, juntando toques", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
    act(() => { result.current.mudar("a", 1); result.current.mudar("a", 1); });
    expect(result.current.energia.a).toBe(2);
    expect(gravar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledWith({ a: 2 });
  });

  // Review Focus 1: a aba Espiões só mexe numa carta, mas grava o mapa inteiro.
  it("grava o mapa inteiro, preservando as cartas que não foram tocadas", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { obra: 2, espiao: 0 }, gravar }));
    act(() => result.current.mudar("espiao", 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(gravar).toHaveBeenCalledWith({ obra: 2, espiao: 1 });
  });

  it("nunca fica negativo", () => {
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: {}, gravar: vi.fn() }));
    act(() => result.current.mudar("a", -1));
    expect(result.current.energia.a ?? 0).toBe(0);
  });

  // Review Focus 3: turno trancado.
  it("se a gravação falha, volta ao último valor gravado e mostra o motivo", async () => {
    const gravar = vi.fn().mockRejectedValue(new ApiError("TURN_LOCKED", "O turno não está aberto para distribuir Energia."));
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 1 }, gravar }));
    act(() => result.current.mudar("a", 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(result.current.energia.a).toBe(1);
    expect(result.current.erro).toMatch(/turno não está aberto/);
  });

  // Review Focus 2: tocou e saiu antes da pausa.
  it("grava o que estava pendente ao desmontar", () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
    act(() => result.current.mudar("a", 1));
    unmount();
    expect(gravar).toHaveBeenCalledWith({ a: 1 });
  });

  it("acompanha o servidor quando não há nada pendente", () => {
    const gravar = vi.fn();
    const { result, rerender } = renderHook((p: { gravado: Record<string, number> }) => useEnergiaAutoSave({ gravado: p.gravado, gravar }), {
      initialProps: { gravado: { a: 0 } },
    });
    rerender({ gravado: { a: 2 } });
    expect(result.current.energia.a).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/useEnergiaAutoSave.test.ts`
Expected: FAIL, "Failed to resolve import ./useEnergiaAutoSave".

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/useEnergiaAutoSave.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../types/api";

/**
 * Energia gravada a cada toque, sem botão "Distribuir".
 *
 * O botão fazia o jogador perder a escolha sem perceber quando esquecia de
 * apertar. Aqui a tela muda na hora e a gravação sai depois de uma pausa,
 * sempre com o mapa INTEIRO da Casa: a aba Espiões mostra uma categoria só, e
 * gravar só o recorte apagaria a Energia das obras.
 */
export function useEnergiaAutoSave(opts: {
  gravado: Record<string, number>;
  gravar: (porProjeto: Record<string, number>) => Promise<unknown>;
  atrasoMs?: number;
}): { energia: Record<string, number>; mudar: (projectId: string, delta: 1 | -1) => void; erro: string | null } {
  const { gravado, gravar, atrasoMs = 400 } = opts;
  const [energia, setEnergia] = useState<Record<string, number>>(gravado);
  const [erro, setErro] = useState<string | null>(null);
  const confirmado = useRef(gravado);
  const pendente = useRef<Record<string, number> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravarRef = useRef(gravar);
  gravarRef.current = gravar;

  // O servidor é a verdade quando não há toque esperando para sair.
  useEffect(() => {
    confirmado.current = gravado;
    if (!pendente.current) setEnergia(gravado);
  }, [gravado]);

  const enviar = useCallback(async () => {
    const mapa = pendente.current;
    pendente.current = null;
    timer.current = null;
    if (!mapa) return;
    try {
      await gravarRef.current(mapa);
      confirmado.current = mapa;
      setErro(null);
    } catch (e) {
      setEnergia(confirmado.current);
      setErro(e instanceof ApiError ? e.message : "Não foi possível gravar a Energia.");
    }
  }, []);

  const mudar = useCallback((projectId: string, delta: 1 | -1) => {
    setEnergia((atual) => {
      const proximo = { ...atual, [projectId]: Math.max(0, (atual[projectId] ?? 0) + delta) };
      pendente.current = proximo;
      return proximo;
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void enviar(), atrasoMs);
  }, [atrasoMs, enviar]);

  // Tocou e trocou de aba antes da pausa: a escolha não pode se perder.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pendente.current) void gravarRef.current(pendente.current);
  }, []);

  return { energia, mudar, erro };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/useEnergiaAutoSave.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/useEnergiaAutoSave.ts frontend/src/components/projetos/useEnergiaAutoSave.test.ts
git commit -m "feat(projetos): Energia gravada a cada toque, com o mapa inteiro da Casa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `TrilhaDePassos` e `CofreDeEnergia`

**Files:**
- Create: `frontend/src/components/projetos/TrilhaDePassos.tsx`
- Create: `frontend/src/components/projetos/CofreDeEnergia.tsx`
- Test: `frontend/src/components/projetos/TrilhaECofre.test.tsx`

**Interfaces:**
- Consumes: `Previa` (Task 2), `brand.energia` (Task 3), `animacao`, `aparecer` (Task 3), `ENERGIA_POR_TURNO`, `PASSO_POR_TURNO` de `@ravenloft/content`.
- Produces:
  - `TrilhaDePassos({ previa }: { previa: Previa })` — cada casinha com `data-passo="andada" | "gratis" | "energia" | "vazia"`; o conjunto com `aria-label="{andadas} de {total} turnos; no fim do turno: {depois} de {total}"`.
  - `CofreDeEnergia({ total, livre, origemRef }: { total: number; livre: number; origemRef: React.Ref<HTMLDivElement> })` — orbes com `data-orbe="aceso" | "apagado"`, texto "Energia do turno", "{livre} de {total} livres", botão "Como funciona?" que abre um diálogo com as três regras.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/TrilhaECofre.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ENERGIA_POR_TURNO } from "@ravenloft/content";
import { TrilhaDePassos } from "./TrilhaDePassos";
import { CofreDeEnergia } from "./CofreDeEnergia";

describe("TrilhaDePassos", () => {
  it("uma casinha por turno, marcando andada, grátis, Energia e vazia", () => {
    const { container } = render(<TrilhaDePassos previa={{ andadas: 1, gratis: 1, comEnergia: 2, depois: 4, total: 5, conclui: false }} />);
    const tipos = [...container.querySelectorAll("[data-passo]")].map((e) => e.getAttribute("data-passo"));
    expect(tipos).toEqual(["andada", "gratis", "energia", "energia", "vazia"]);
    expect(screen.getByLabelText("1 de 5 turnos; no fim do turno: 4 de 5")).toBeInTheDocument();
  });
});

describe("CofreDeEnergia", () => {
  it("mostra orbes acesos para o que está livre e o saldo", () => {
    const { container } = render(<CofreDeEnergia total={3} livre={2} origemRef={createRef()} />);
    expect(container.querySelectorAll('[data-orbe="aceso"]').length).toBe(2);
    expect(container.querySelectorAll('[data-orbe="apagado"]').length).toBe(1);
    expect(screen.getByText("2 de 3 livres")).toBeInTheDocument();
    expect(screen.getByText(/o que sobrar se perde no fechamento/i)).toBeInTheDocument();
  });

  it("'Como funciona?' explica as três regras com os números do jogo", () => {
    render(<CofreDeEnergia total={ENERGIA_POR_TURNO} livre={ENERGIA_POR_TURNO} origemRef={createRef()} />);
    fireEvent.click(screen.getByRole("button", { name: /Como funciona/i }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/anda 1 passo por turno, de graça/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Cada ponto de Energia é 1 passo a mais/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/tentar de novo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/TrilhaECofre.test.tsx`
Expected: FAIL, imports não resolvem.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/TrilhaDePassos.tsx`:

```tsx
import Box from "@mui/material/Box";
import { brand } from "../../theme";
import type { Previa } from "./previa";

type Passo = "andada" | "gratis" | "energia" | "vazia";

const ESTILO: Record<Passo, object> = {
  andada: { bgcolor: brand.text, borderColor: brand.text },
  gratis: { bgcolor: "transparent", borderColor: brand.text, borderStyle: "dashed" },
  energia: { bgcolor: brand.energia, borderColor: brand.energia, boxShadow: `0 0 8px ${brand.energia}88` },
  vazia: { bgcolor: "transparent", borderColor: brand.line },
};

/** Uma casinha por turno da carta: o progresso lido de relance. */
export function TrilhaDePassos({ previa }: { previa: Previa }) {
  const passos: Passo[] = Array.from({ length: previa.total }, (_, i) => {
    if (i < previa.andadas) return "andada";
    if (i < previa.andadas + previa.gratis) return "gratis";
    if (i < previa.depois) return "energia";
    return "vazia";
  });
  return (
    <Box
      role="img"
      aria-label={`${previa.andadas} de ${previa.total} turnos; no fim do turno: ${previa.depois} de ${previa.total}`}
      sx={{ display: "flex", gap: 0.75, my: 1 }}
    >
      {passos.map((p, i) => (
        <Box
          key={i}
          data-passo={p}
          sx={{ flex: 1, maxWidth: 40, height: 14, borderRadius: 1, border: "2px solid", transition: "background-color 200ms ease-out", ...ESTILO[p] }}
        />
      ))}
    </Box>
  );
}
```

`frontend/src/components/projetos/CofreDeEnergia.tsx`:

```tsx
import { useState, type Ref } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ENERGIA_POR_TURNO, PASSO_POR_TURNO } from "@ravenloft/content";
import { brand } from "../../theme";

/**
 * O saldo do turno, no topo e grudado ao rolar. `origemRef` é de onde o orbe
 * sai quando o jogador põe Energia numa carta.
 */
export function CofreDeEnergia({ total, livre, origemRef }: { total: number; livre: number; origemRef: Ref<HTMLDivElement> }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Box sx={{ position: "sticky", top: 64, zIndex: 2, bgcolor: brand.surface, border: `1px solid ${brand.line}`, borderRadius: 3, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>Energia do turno</Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{livre} de {total} livres</Typography>
        </Box>
        <Stack ref={origemRef} direction="row" spacing={1} aria-hidden>
          {Array.from({ length: total }, (_, i) => {
            const aceso = i < livre;
            return (
              <Box
                key={i}
                data-orbe={aceso ? "aceso" : "apagado"}
                sx={{
                  width: 24, height: 24, borderRadius: "50%",
                  bgcolor: aceso ? brand.energia : "transparent",
                  border: `2px solid ${aceso ? brand.energia : brand.line}`,
                  boxShadow: aceso ? `0 0 10px ${brand.energia}88` : "none",
                  transition: "all 200ms ease-out",
                }}
              />
            );
          })}
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{total} de Energia por turno · o que sobrar se perde no fechamento.</Typography>
        <Button size="small" onClick={() => setAberto(true)} sx={{ minHeight: 48 }}>Como funciona?</Button>
      </Stack>
      <Dialog open={aberto} onClose={() => setAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle>Como funciona</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pb: 1 }}>
            <Typography>◇ Toda carta ativa anda {PASSO_POR_TURNO} passo por turno, de graça. Não precisa de Energia para andar.</Typography>
            <Typography>◆ Cada ponto de Energia é 1 passo a mais. Você recebe {ENERGIA_POR_TURNO} por turno, e o que sobrar se perde no fechamento.</Typography>
            <Typography>↻ Carta que fracassa pode tentar de novo: volta com 1 turno, de graça, e com sucesso garantido.</Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/TrilhaECofre.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/TrilhaDePassos.tsx frontend/src/components/projetos/CofreDeEnergia.tsx frontend/src/components/projetos/TrilhaECofre.test.tsx
git commit -m "feat(projetos): trilha de passos e cofre de Energia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `CartaAtiva`

**Files:**
- Create: `frontend/src/components/projetos/CartaAtiva.tsx`
- Test: `frontend/src/components/projetos/CartaAtiva.test.tsx`

**Interfaces:**
- Consumes: `previaDoFechamento` (Task 2), `TrilhaDePassos` (Task 5), `CORES_DE_CATEGORIA` (Task 3), `animacao`, `pulsoEnergia` (Task 3), `resumoDoGanho`, `CATEGORY_LABELS`, `type ProjectCard` de `@ravenloft/content`.
- Produces:
  ```ts
  CartaAtiva(props: {
    carta: ProjectCard;
    energia: number;        // pontos nesta carta
    teto: number;           // data.energia.tetoPorProjeto[carta.id] ?? 0
    livre: number;          // saldo da Casa
    busy: boolean;
    alvoRef?: (el: HTMLDivElement | null) => void;   // onde o orbe pousa
    onMudar: (delta: 1 | -1) => void;
    onCancelar: () => void;
    onReescrever: (pedido: string) => void;          // só aparece para refeita
  })
  ```
  Textos: "Fim do turno: → {depois} de {total}", selo "Conclui neste turno", selo "Sucesso garantido" (refeita), selo "Pausada", teto 0: "✓ Conclui sozinha no fim do turno. Não precisa de Energia." quando conclui, ou "Não aceita Energia agora." quando não conclui. Botões com `aria-label` "Tirar Energia de {título}" e "Pôr Energia em {título}". "+" desativado mostra "Esta carta já recebe o máximo" (no teto) ou "Sem Energia livre" (saldo 0). Menu "⋯" (`aria-label="Mais ações"`) com "Reescrever" (refeita) e "Cancelar".

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/CartaAtiva.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectCard } from "@ravenloft/content";
import { CartaAtiva } from "./CartaAtiva";

function carta(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "c1", title: "Rota de Caravanas", category: "ECONOMY", status: "ACTIVE", description: "d",
    turnsCompleted: 0, durationTurns: 3, refeita: false,
    completionEffects: { attributeChanges: [{ attribute: "riqueza", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    ...over,
  } as ProjectCard;
}

const base = { energia: 0, teto: 2, livre: 3, busy: false, onMudar: vi.fn(), onCancelar: vi.fn(), onReescrever: vi.fn() };

describe("CartaAtiva", () => {
  it("diz onde a carta vai estar no fim do turno", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={1} />);
    expect(screen.getByText("Fim do turno: → 2 de 3")).toBeInTheDocument();
  });

  it("+ e − chamam onMudar", () => {
    const onMudar = vi.fn();
    render(<CartaAtiva {...base} carta={carta()} energia={1} onMudar={onMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" }));
    fireEvent.click(screen.getByRole("button", { name: "Tirar Energia de Rota de Caravanas" }));
    expect(onMudar.mock.calls).toEqual([[1], [-1]]);
  });

  it("no teto, + desativa e diz por quê", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={2} />);
    expect(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" })).toBeDisabled();
    expect(screen.getByText("Esta carta já recebe o máximo")).toBeInTheDocument();
  });

  it("sem saldo, + desativa e diz por quê", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={0} livre={0} />);
    expect(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" })).toBeDisabled();
    expect(screen.getByText("Sem Energia livre")).toBeInTheDocument();
  });

  // A dúvida do Obelisco: teto 0 não é "não consigo", é "não precisa".
  it("teto 0 e conclui: selo no lugar dos botões", () => {
    render(<CartaAtiva {...base} carta={carta({ turnsCompleted: 0, durationTurns: 1, refeita: true })} teto={0} />);
    expect(screen.getByText(/Conclui sozinha no fim do turno. Não precisa de Energia./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pôr Energia/ })).toBeNull();
    expect(screen.getByText("Sucesso garantido")).toBeInTheDocument();
    expect(screen.getByText("Conclui neste turno")).toBeInTheDocument();
  });

  it("pausada: selo e sem controles", () => {
    render(<CartaAtiva {...base} carta={carta({ status: "PAUSED" })} teto={0} />);
    expect(screen.getByText("Pausada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pôr Energia/ })).toBeNull();
  });

  it("menu ⋯ oferece Reescrever só para refeita, e Cancelar sempre", () => {
    const { rerender } = render(<CartaAtiva {...base} carta={carta()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(screen.queryByRole("menuitem", { name: "Reescrever" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Cancelar carta" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    rerender(<CartaAtiva {...base} carta={carta({ refeita: true, durationTurns: 1 })} teto={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(screen.getByRole("menuitem", { name: "Reescrever" })).toBeInTheDocument();
  });

  it("mostra o ganho ao concluir", () => {
    render(<CartaAtiva {...base} carta={carta()} />);
    expect(screen.getByText(/^Ao concluir: /)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/CartaAtiva.test.tsx`
Expected: FAIL, import não resolve.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/CartaAtiva.tsx`:

```tsx
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { CATEGORY_LABELS, resumoDoGanho, type ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";
import { CORES_DE_CATEGORIA } from "./cores";
import { animacao, pulsoEnergia } from "./animacoes";
import { previaDoFechamento } from "./previa";
import { TrilhaDePassos } from "./TrilhaDePassos";

const rotulo = { fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em" };

export function CartaAtiva({ carta, energia, teto, livre, busy, alvoRef, onMudar, onCancelar, onReescrever }: {
  carta: ProjectCard;
  energia: number;
  teto: number;
  livre: number;
  busy: boolean;
  alvoRef?: (el: HTMLDivElement | null) => void;
  onMudar: (delta: 1 | -1) => void;
  onCancelar: () => void;
  onReescrever: (pedido: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [reescrever, setReescrever] = useState(false);
  const [pedido, setPedido] = useState("");
  const previa = previaDoFechamento(carta, energia);
  const ativa = carta.status === "ACTIVE";
  const energizada = energia > 0;
  const podeMais = energia < teto && livre > 0;
  const motivoSemMais = energia >= teto ? "Esta carta já recebe o máximo" : "Sem Energia livre";

  return (
    <Box
      ref={alvoRef}
      sx={{
        position: "relative", bgcolor: brand.raised, border: `1px solid ${energizada ? brand.energia : brand.line}`,
        borderRadius: 3, p: 2, pl: 2.5, overflow: "hidden",
        animation: energizada ? animacao(pulsoEnergia, "2.4s", "infinite") : "none",
        "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: CORES_DE_CATEGORIA[carta.category] },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography sx={rotulo}>{carta.title}</Typography>
          <Typography variant="caption" color="text.secondary">{CATEGORY_LABELS[carta.category]}</Typography>
        </Box>
        <IconButton aria-label="Mais ações" onClick={(e) => setMenu(e.currentTarget)} sx={{ width: 48, height: 48 }}>⋯</IconButton>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
        {!ativa && <Chip size="small" color="warning" label="Pausada" />}
        {carta.refeita && <Chip size="small" color="success" label="Sucesso garantido" />}
        {previa.conclui && <Chip size="small" sx={{ bgcolor: brand.energia, color: brand.base }} label="Conclui neste turno" />}
      </Stack>

      <TrilhaDePassos previa={previa} />
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Fim do turno: → {previa.depois} de {previa.total}</Typography>
      <Typography variant="caption" display="block" color="success.main">
        Ao concluir: {resumoDoGanho(carta.completionEffects, carta.pagamentoNarrativo)}
      </Typography>

      {ativa && teto <= 0 && energia <= 0 && (
        <Typography sx={{ mt: 1.5, color: brand.energia }}>
          {previa.conclui ? "✓ Conclui sozinha no fim do turno. Não precisa de Energia." : "Não aceita Energia agora."}
        </Typography>
      )}

      {ativa && (teto > 0 || energia > 0) && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={2}>
            <Button variant="outlined" aria-label={`Tirar Energia de ${carta.title}`} disabled={busy || energia <= 0}
              onClick={() => onMudar(-1)} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.4rem" }}>−</Button>
            <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: brand.energia, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>
              ◆ {energia}
            </Typography>
            <Button variant="outlined" aria-label={`Pôr Energia em ${carta.title}`} disabled={busy || !podeMais}
              onClick={() => onMudar(1)} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.4rem", borderColor: brand.energia, color: brand.energia }}>+</Button>
          </Stack>
          {!podeMais && <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 0.5 }}>{motivoSemMais}</Typography>}
        </Box>
      )}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {carta.refeita && (
          <MenuItem onClick={() => { setMenu(null); setPedido(""); setReescrever(true); }}>Reescrever</MenuItem>
        )}
        <MenuItem onClick={() => { setMenu(null); onCancelar(); }}>Cancelar carta</MenuItem>
      </Menu>

      <Dialog open={reescrever} onClose={() => setReescrever(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reescrever {carta.title}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline minRows={3} autoFocus sx={{ mt: 1 }} label="O que esta carta deveria ser agora?"
            value={pedido} onChange={(e) => setPedido(e.target.value)} />
          <Typography variant="caption" color="text.secondary">Continua com 1 turno e sucesso garantido. Um prêmio maior que o atual não é aceito.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReescrever(false)}>Voltar</Button>
          <Button variant="contained" disabled={busy || !pedido.trim()} onClick={() => { setReescrever(false); onReescrever(pedido.trim()); }}>Reescrever</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/CartaAtiva.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/CartaAtiva.tsx frontend/src/components/projetos/CartaAtiva.test.tsx
git commit -m "feat(projetos): carta ativa com trilha, controles de toque e selos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `CartaFracassada` e `RevelacaoDoTurno`

**Files:**
- Create: `frontend/src/components/projetos/CartaFracassada.tsx`
- Create: `frontend/src/components/projetos/RevelacaoDoTurno.tsx`
- Test: `frontend/src/components/projetos/Revelacao.test.tsx`

**Interfaces:**
- Consumes: `animacao`, `virarCarta`, `brilhoSucesso`, `rachadura`, `aparecer` (Task 3), `resumoDoGanho`, `type ProjectCard`.
- Produces:
  - `CartaFracassada({ carta, semVaga, busy, onTentarDeNovo }: { carta: ProjectCard; semVaga: boolean; busy: boolean; onTentarDeNovo: () => void })` — botão "Tentar de novo — grátis"; com `semVaga`, desativado e com o texto "Libere uma vaga primeiro".
  - `RevelacaoDoTurno({ cartas, aberta, semVaga, busy, onFechar, onTentarDeNovo }: { cartas: ProjectCard[]; aberta: boolean; semVaga: boolean; busy: boolean; onFechar: () => void; onTentarDeNovo: (id: string) => void })` — título "Fechamento do turno", contador "1 de N", selo "Concluída" ou "Fracassou", narrativa, "Recebido: …" no sucesso, botão "Tentar de novo — grátis, sucesso garantido" no fracasso, "Próxima" e "Fechar" (na última). `onFechar` é chamado ao fechar ou terminar.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/projetos/Revelacao.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectCard } from "@ravenloft/content";
import { CartaFracassada } from "./CartaFracassada";
import { RevelacaoDoTurno } from "./RevelacaoDoTurno";

const efeitos = { attributeChanges: [], favors: [], assets: ["Balão de Vento"], qualitativeEffects: [], unlocks: [] };
const ok = { id: "ok", title: "Balões", status: "COMPLETED", outcomeNarrative: "Sobem e voltam.", completionEffects: efeitos } as unknown as ProjectCard;
const falhou = { id: "f", title: "Dispositivo", status: "FAILED", outcomeNarrative: "Estourou a bancada.", completionEffects: efeitos } as unknown as ProjectCard;

describe("CartaFracassada", () => {
  it("oferece tentar de novo", () => {
    const onTentarDeNovo = vi.fn();
    render(<CartaFracassada carta={falhou} semVaga={false} busy={false} onTentarDeNovo={onTentarDeNovo} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis/ }));
    expect(onTentarDeNovo).toHaveBeenCalled();
  });

  // Review Focus 5.
  it("sem vaga, desativa e diz o que fazer", () => {
    render(<CartaFracassada carta={falhou} semVaga busy={false} onTentarDeNovo={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeDisabled();
    expect(screen.getByText("Libere uma vaga primeiro")).toBeInTheDocument();
  });
});

describe("RevelacaoDoTurno", () => {
  it("revela uma carta por vez e fecha no fim", () => {
    const onFechar = vi.fn();
    render(<RevelacaoDoTurno cartas={[ok, falhou]} aberta semVaga={false} busy={false} onFechar={onFechar} onTentarDeNovo={vi.fn()} />);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText(/Recebido: .*Balão de Vento/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByText("Fracassou")).toBeInTheDocument();
    expect(screen.getByText("Estourou a bancada.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalled();
  });

  it("no fracasso, tentar de novo sai dali mesmo", () => {
    const onTentarDeNovo = vi.fn();
    render(<RevelacaoDoTurno cartas={[falhou]} aberta semVaga={false} busy={false} onFechar={vi.fn()} onTentarDeNovo={onTentarDeNovo} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis, sucesso garantido/ }));
    expect(onTentarDeNovo).toHaveBeenCalledWith("f");
  });

  it("sem cartas, não abre", () => {
    render(<RevelacaoDoTurno cartas={[]} aberta semVaga={false} busy={false} onFechar={vi.fn()} onTentarDeNovo={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/projetos/Revelacao.test.tsx`
Expected: FAIL, imports não resolvem.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/CartaFracassada.tsx`:

```tsx
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";

/** A carta que o juiz reprovou, no topo da aba, com a saída à vista. */
export function CartaFracassada({ carta, semVaga, busy, onTentarDeNovo }: {
  carta: ProjectCard; semVaga: boolean; busy: boolean; onTentarDeNovo: () => void;
}) {
  return (
    <Box sx={{ bgcolor: brand.raised, border: "1px solid #c05a5a", borderRadius: 3, p: 2 }}>
      <Typography sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{carta.title}</Typography>
      {carta.outcomeNarrative && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>{carta.outcomeNarrative}</Typography>
      )}
      <Button variant="contained" fullWidth disabled={busy || semVaga} onClick={onTentarDeNovo} sx={{ mt: 1.5, minHeight: 48 }}>
        Tentar de novo — grátis
      </Button>
      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
        {semVaga ? "Libere uma vaga primeiro" : "Volta com 1 turno e sucesso garantido."}
      </Typography>
    </Box>
  );
}
```

`frontend/src/components/projetos/RevelacaoDoTurno.tsx`:

```tsx
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { resumoDoGanho, type ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";
import { animacao, aparecer, brilhoSucesso, rachadura, virarCarta } from "./animacoes";

/**
 * O fechamento acontece com o jogador longe da tela. Esta é a hora em que ele
 * vê as cartas resolvidas: uma por vez, como quem vira cartas na mesa.
 */
export function RevelacaoDoTurno({ cartas, aberta, semVaga, busy, onFechar, onTentarDeNovo }: {
  cartas: ProjectCard[]; aberta: boolean; semVaga: boolean; busy: boolean;
  onFechar: () => void; onTentarDeNovo: (id: string) => void;
}) {
  const [i, setI] = useState(0);
  const celular = useMediaQuery("(max-width:600px)");
  useEffect(() => { if (aberta) setI(0); }, [aberta]);
  if (cartas.length === 0) return null;
  const carta = cartas[Math.min(i, cartas.length - 1)];
  const sucesso = carta.status === "COMPLETED";
  const ultima = i >= cartas.length - 1;

  return (
    <Dialog open={aberta} onClose={onFechar} fullScreen={celular} fullWidth maxWidth="xs"
      PaperProps={{ sx: { bgcolor: brand.base, backgroundImage: "none" } }}>
      <DialogContent>
        <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
          <Typography variant="overline" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>Fechamento do turno</Typography>
          <Typography color="text.secondary">{i + 1} de {cartas.length}</Typography>
          <Box
            key={carta.id}
            sx={{
              width: "100%", maxWidth: 340, bgcolor: brand.raised, borderRadius: 3, p: 3, textAlign: "center",
              border: `1px solid ${sucesso ? brand.accent : "#c05a5a"}`,
              animation: [
                animacao(virarCarta, "500ms"),
                sucesso ? animacao(brilhoSucesso, "1.2s", "500ms forwards") : animacao(rachadura, "900ms", "500ms forwards"),
              ].filter((a) => a !== "none").join(", ") || `${aparecer} 120ms ease-out`,
            }}
          >
            <Typography sx={{ color: sucesso ? brand.accent : "#c05a5a", fontWeight: 700, letterSpacing: "0.14em" }}>
              {sucesso ? "Concluída" : "Fracassou"}
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{carta.title}</Typography>
            {carta.outcomeNarrative && <Typography variant="body2" sx={{ mt: 1.5, fontStyle: "italic" }}>{carta.outcomeNarrative}</Typography>}
            {sucesso && (
              <Typography sx={{ mt: 1.5, color: brand.accent, animation: animacao(aparecer, "400ms", "900ms both") }}>
                Recebido: {resumoDoGanho(carta.completionEffects, carta.pagamentoNarrativo)}
              </Typography>
            )}
          </Box>
          {!sucesso && (
            <Box sx={{ width: "100%", maxWidth: 340 }}>
              <Button variant="contained" fullWidth disabled={busy || semVaga} onClick={() => onTentarDeNovo(carta.id)} sx={{ minHeight: 48 }}>
                Tentar de novo — grátis, sucesso garantido
              </Button>
              {semVaga && <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 0.5 }}>Libere uma vaga primeiro</Typography>}
            </Box>
          )}
          <Button variant={ultima ? "outlined" : "contained"} onClick={() => (ultima ? onFechar() : setI(i + 1))} sx={{ minHeight: 48, minWidth: 160 }}>
            {ultima ? "Fechar" : "Próxima"}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/Revelacao.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/CartaFracassada.tsx frontend/src/components/projetos/RevelacaoDoTurno.tsx frontend/src/components/projetos/Revelacao.test.tsx
git commit -m "feat(projetos): revelação do fechamento e carta fracassada com nova tentativa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Montar o painel novo

**Files:**
- Modify: `frontend/src/components/HouseProjectsPanel.tsx` (aba 0 inteira, linhas ~232–460; imports; remove `efeitoDaEnergia`, `Slider`, `LinearProgress`, estado `energia`/`reescrevendo`/`pedido`)
- Modify: `frontend/src/pages/GamePage.tsx` (passa `houseId` aos dois `<HouseProjectsPanel>`, ~linhas 415 e 432)
- Rewrite: `frontend/src/components/HouseProjectsPanel.energia.test.tsx`
- Modify: `frontend/src/components/HouseProjectsPanel.test.tsx` (testes de "Tentar de novo" e badges de concluído)
- Modify: `frontend/src/components/HouseProjectsPanel.ganho.test.tsx` (seletor da aba ativa)

**Interfaces:**
- Consumes: tudo das Tasks 2–7; `api.setEnergia`, `api.refazerProjeto`, `api.requestProjectRevision`, `api.cancelProject`, `api.acceptProject`.
- Produces: `HouseProjectsPanel` com a prop nova `houseId?: string` (sem ela, a revelação não aparece). Aba 0 com rótulo `Em andamento (${active.length})` (ou `Operações em curso (…)` com `categoria`).

- [ ] **Step 1: Write the failing test (rewrite do arquivo de Energia)**

Substitua o conteúdo de `frontend/src/components/HouseProjectsPanel.energia.test.tsx`, mantendo `semear` e `montar` (este último passa a aceitar `houseId`), e troque os `describe` por:

```tsx
function montar(client: MockApiClient, token: string, extra: { categoria?: string; excluirCategoria?: string; houseId?: string } = {}) {
  render(
    <ApiProvider client={client}>
      <HouseProjectsPanel playerToken={token} onChanged={() => {}} {...extra} />
    </ApiProvider>,
  );
}

async function comCartaAtiva(client: MockApiClient) {
  const token = await semear(client);
  montar(client, token);
  fireEvent.click(await screen.findByText("Biblioteca"));
  const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(iniciar[0]);
  fireEvent.click(await screen.findByText(/Em andamento \(1\)/i));
  return token;
}

describe("Energia no painel de cartas", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); vi.stubGlobal("confirm", () => true); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("mostra o cofre com a Energia do turno", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText("3 de 3 livres")).toBeInTheDocument();
  });

  it("tocar em + desconta do cofre na hora e grava sem botão", async () => {
    const gravar = vi.spyOn(client, "setEnergia");
    await comCartaAtiva(client);
    const mais = await screen.findByRole("button", { name: /^Pôr Energia em / });
    fireEvent.click(mais);
    expect(await screen.findByText("2 de 3 livres")).toBeInTheDocument();
    await waitFor(() => expect(gravar).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(screen.queryByRole("button", { name: /Distribuir Energia/i })).toBeNull();
  });

  it("sem Energia nenhuma, a carta ainda anda: a prévia mostra o passo grátis", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Fim do turno: → 1 de /)).toBeInTheDocument();
  });

  // Review Focus 1, no painel: Espiões grava sem apagar a Energia das obras.
  it("grava o mapa inteiro mesmo numa aba recortada", async () => {
    const token = await semear(client);
    // Duas cartas de 3 turnos: uma obra (Projetos) e uma rede de informantes (Espiões).
    const obra = await client.startProjectFromTemplate(token, { templateId: "recrutar-companhias-errantes" });
    await client.setEnergia(token, { porProjeto: { [obra.id]: 1 } });
    await client.startProjectFromTemplate(token, { templateId: "estabelecer-uma-rede-de-informantes" });
    const gravar = vi.spyOn(client, "setEnergia");
    montar(client, token, { categoria: "INTELLIGENCE" });
    fireEvent.click(await screen.findByRole("button", { name: /^Pôr Energia em / }));
    await waitFor(() => expect(gravar).toHaveBeenCalled(), { timeout: 2000 });
    expect(gravar.mock.calls[0][1].porProjeto[obra.id]).toBe(1);
  });

  it("avisa quando uma carta refeita torna a alocação gravada obsoleta, citando a carta e os números", async () => {
    const { token, carta } = await cartaReescritaPorRefazer(client);
    montar(client, token);
    // O título também aparece na carta; o aviso é achado pelo texto que só ele tem.
    const aviso = (await screen.findByText(/tinha 1 e agora aceita 0/)).closest('[role="alert"]');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain(carta.title);
  });
});
```

Mantenha também, acima do `describe`, o helper que já existe no arquivo:

```tsx
async function cartaReescritaPorRefazer(client: MockApiClient) {
  const token = await semear(client);
  await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
  const antes = await client.getProjects(token);
  const carta = antes.projects.find((p) => p.status === "ACTIVE")!;
  await client.setEnergia(token, { porProjeto: { [carta.id]: 1 } }); // válido: duração 2, teto 1
  await client.refazerProjeto(token, { projectId: carta.id }); // reescreve: duração 1 — teto cai para 0
  return { token, carta };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/HouseProjectsPanel.energia.test.tsx`
Expected: FAIL — "Em andamento (1)" e "3 de 3 livres" não existem na tela atual.

- [ ] **Step 3: Implement — imports e estado**

Em `HouseProjectsPanel.tsx`:

1. Remova `LinearProgress`, `Slider` e a função `efeitoDaEnergia`. Tire `PASSO_POR_TURNO` do import.
2. Acrescente:

```tsx
import { useRef } from "react";
import { CofreDeEnergia } from "./projetos/CofreDeEnergia";
import { CartaAtiva } from "./projetos/CartaAtiva";
import { CartaFracassada } from "./projetos/CartaFracassada";
import { RevelacaoDoTurno } from "./projetos/RevelacaoDoTurno";
import { useEnergiaAutoSave } from "./projetos/useEnergiaAutoSave";
import { voarOrbe } from "./projetos/animacoes";
import { cartasParaRevelar, gravarVistoEm, lerVistoEm } from "./projetos/previa";
```

3. Assinatura: acrescente `houseId?: string` às props.
4. Remova os estados `reescrevendo`, `pedido` e `energia`/`definirEnergia`, e o `useEffect` que copiava `data.energia.porProjeto`.
5. Depois do `run` e do `refazer`, acrescente:

```tsx
  const gravado = useMemo(() => data?.energia?.porProjeto ?? {}, [data]);
  const { energia, mudar, erro: erroEnergia } = useEnergiaAutoSave({
    gravado,
    gravar: (porProjeto) => api.setEnergia(playerToken, { porProjeto }),
  });
  const origemRef = useRef<HTMLDivElement>(null);
  const alvos = useRef(new Map<string, HTMLDivElement>());
  const [revelando, setRevelando] = useState(false);
  const [versaoVisto, setVersaoVisto] = useState(0);
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);

  const porEnergia = useCallback((id: string, delta: 1 | -1) => {
    mudar(id, delta);
    const carta = alvos.current.get(id) ?? null;
    void (delta === 1 ? voarOrbe(origemRef.current, carta) : voarOrbe(carta, origemRef.current));
  }, [mudar]);
```

6. Troque `finished` por três listas:

```tsx
  const fracassadas = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "FAILED" && noRecorte(p.category)), [data, noRecorte]);
  const concluidas = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "COMPLETED" && noRecorte(p.category)), [data, noRecorte]);
  const paraRevelar = useMemo(() => {
    if (!houseId) return [];
    const doRecorte = (data?.projects ?? []).filter((p) => noRecorte(p.category));
    return cartasParaRevelar(doRecorte, lerVistoEm(houseId));
    // versaoVisto força reler o storage depois de fechar a revelação.
  }, [data, noRecorte, houseId, versaoVisto]);

  const fecharRevelacao = useCallback(() => {
    const ultimo = paraRevelar[paraRevelar.length - 1]?.resolvedAt;
    if (houseId && ultimo) gravarVistoEm(houseId, ultimo);
    setRevelando(false);
    setVersaoVisto((v) => v + 1);
  }, [paraRevelar, houseId]);
```

7. `const semVaga = ativasDaCasa >= data.slotLimit;` junto de `slotFull`. Recalcule `energiaGasta` a partir de `energia` do hook, somando só cartas `ACTIVE` da Casa inteira:

```tsx
  const ativasIds = new Set((data.projects ?? []).filter((p) => p.status === "ACTIVE").map((p) => p.id));
  const energiaGasta = Object.entries(energia).reduce((n, [id, v]) => n + (ativasIds.has(id) ? v : 0), 0);
```

- [ ] **Step 4: Implement — a aba 0 na ordem da spec**

Troque o rótulo da aba: `categoria ? \`Operações em curso (${active.length})\` : \`Em andamento (${active.length})\``. Tire o `Chip` de Energia do cabeçalho (o cofre o substitui) e mova o botão "✍️ Propor um projeto próprio" para dentro da aba 1 (Biblioteca), no topo dela.

Substitua todo o bloco `{tab === 0 && ( ... )}` por:

```tsx
        {tab === 0 && (
          <Stack spacing={2}>
            {erroEnergia && <Alert severity="error">{erroEnergia}</Alert>}
            {temEnergia && active.some((p) => p.status === "ACTIVE") && (
              <CofreDeEnergia total={energiaTotal} livre={Math.max(0, energiaLivre)} origemRef={origemRef} />
            )}

            {paraRevelar.length > 0 && (
              <Button variant="outlined" fullWidth onClick={() => setRevelando(true)} sx={{ minHeight: 48, borderColor: "primary.main" }}>
                ✦ {paraRevelar.length === 1 ? "1 novidade" : `${paraRevelar.length} novidades`} do fechamento
              </Button>
            )}

            {fracassadas.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Pode tentar de novo</Typography>
                <Stack spacing={1.5}>
                  {fracassadas.map((p) => (
                    <CartaFracassada key={p.id} carta={p} semVaga={semVaga} busy={busy || refazendo === p.id} onTentarDeNovo={() => void refazer(p.id)} />
                  ))}
                </Stack>
              </Box>
            )}

            {temEnergia && data.energia?.ajustes && data.energia.ajustes.length > 0 && (
              <Alert severity="info">
                Uma carta mudou desde que você distribuiu Energia, e parte dela não valia mais o que valia:{" "}
                {data.energia.ajustes.map((a, i) => (
                  <span key={a.id}>{i > 0 && "; "}<strong>{a.title}</strong> tinha {a.de} e agora aceita {a.para}</span>
                ))}
                . A diferença está livre.
              </Alert>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Em andamento</Typography>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} title="Projetos e espionagem ocupam as mesmas vagas">
                Vagas {ativasDaCasa}/{data.slotLimit}
              </Typography>
            </Stack>
            {ativasDaCasa > data.slotLimit && (
              <Alert severity="warning">Sua Casa está com {ativasDaCasa} cartas ativas, acima do teto de {data.slotLimit}. Nenhuma carta nova começa até alguma terminar.</Alert>
            )}
            {active.length === 0 && recommended.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Projetos recomendados para sua Casa</Typography>
                <Stack spacing={2}>{recommended.map((t) => templateCard(t, true))}</Stack>
              </Box>
            )}
            {active.length === 0 && recommended.length === 0 && <Typography color="text.secondary">Nenhuma carta em andamento.</Typography>}
            {active.map((p) => (
              <CartaAtiva
                key={p.id}
                carta={p}
                energia={energia[p.id] ?? 0}
                teto={data.energia?.tetoPorProjeto[p.id] ?? 0}
                livre={energiaLivre}
                busy={busy}
                alvoRef={(el) => { if (el) alvos.current.set(p.id, el); else alvos.current.delete(p.id); }}
                onMudar={(d) => porEnergia(p.id, d)}
                onCancelar={() => { if (confirm("Cancelar a carta? O cancelamento não devolve o custo.")) void run(() => api.cancelProject(playerToken, { projectId: p.id })); }}
                onReescrever={(nota) => void run(() => api.requestProjectRevision(playerToken, { projectId: p.id, note: nota }))}
              />
            ))}

            {pending.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Esperando sua decisão</Typography>
                <Stack spacing={1}>
                  {pending.map((p) => (
                    <Alert key={p.id} severity="info" action={p.status === "PENDING_PLAYER" ? (
                      <Button size="small" disabled={busy || semVaga} onClick={() => void run(() => api.acceptProject(playerToken, { projectId: p.id }))}>Aceitar</Button>
                    ) : undefined}>
                      {p.title}{p.status === "PENDING_PLAYER" && semVaga ? " — sem vaga: libere uma" : ""}
                    </Alert>
                  ))}
                </Stack>
              </Box>
            )}

            <Button variant="contained" fullWidth onClick={() => setTab(1)} sx={{ minHeight: 48 }}>+ Nova carta</Button>

            {concluidas.length > 0 && (
              <Box>
                <Button onClick={() => setConcluidasAbertas((v) => !v)} sx={{ minHeight: 48 }}>
                  Concluídas ({concluidas.length}) {concluidasAbertas ? "▾" : "▸"}
                </Button>
                {concluidasAbertas && (
                  <Stack spacing={1.5}>
                    {concluidas.map((p) => (
                      <Card key={p.id} variant="outlined" sx={{ borderColor: "success.main" }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography fontWeight="bold">{p.title}</Typography>
                            <Chip size="small" color="success" label="Concluído com êxito" />
                          </Stack>
                          <Typography variant="caption" display="block" color="success.main" sx={{ mt: 1 }}>
                            Recebido: {resumoDoGanho(p.completionEffects, p.pagamentoNarrativo)}
                          </Typography>
                          {p.outcomeNarrative && <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>{p.outcomeNarrative}</Typography>}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            <RevelacaoDoTurno
              cartas={paraRevelar}
              aberta={revelando}
              semVaga={semVaga}
              busy={busy}
              onFechar={fecharRevelacao}
              onTentarDeNovo={(id) => void refazer(id)}
            />
          </Stack>
        )}
```

Em `frontend/src/pages/GamePage.tsx`, nos dois `<HouseProjectsPanel ...>`, acrescente `houseId={playerSession.houseId}`.

- [ ] **Step 5: Ajustar os testes antigos**

- `HouseProjectsPanel.ganho.test.tsx`: troque `/Projetos Ativos \(1\)/i` por `/Em andamento \(1\)/i` (duas ocorrências).
- `HouseProjectsPanel.test.tsx`:
  - "shows success and failure badges with the AI narrative": a carta com sucesso agora está dentro de "Concluídas (N) ▸". Clique em `screen.getByRole("button", { name: /Concluídas/ })` antes de procurar "Concluído com êxito". A fracassada aparece em "Pode tentar de novo": troque a espera por `"Fracassou"` por `screen.getByText("Pode tentar de novo")`, mantendo a checagem da narrativa `"O cerco interrompeu as obras."`.
  - "deixa o jogador refazer a carta que fracassou": o botão agora se chama `/Tentar de novo — grátis/`.
  - "não oferece nova tentativa à carta que deu certo": continua valendo como está (`queryByRole("button", { name: /Tentar de novo/ })` deve ser null).
  - Qualquer `findByText(/Projetos Ativos/i)` vira `/Em andamento/i`.
  - O teste que clica em "Propor um projeto próprio" precisa antes abrir a Biblioteca: `fireEvent.click(await screen.findByText("Biblioteca"))`.

- [ ] **Step 6: Run the panel tests**

Run: `cd frontend && npx vitest run src/components/HouseProjectsPanel`
Expected: PASS em `HouseProjectsPanel.test.tsx`, `.energia.test.tsx` e `.ganho.test.tsx`.

- [ ] **Step 7: Run everything and commit**

```bash
npm run typecheck
cd frontend && npx vitest run && cd ..
git add frontend/src/components/HouseProjectsPanel.tsx frontend/src/components/HouseProjectsPanel*.test.tsx frontend/src/pages/GamePage.tsx
git commit -m "feat(projetos): painel de cartas como jogo — cofre, trilha, revelação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: suíte do frontend inteira passando.

---

### Task 9: Selos de novidades nas abas de `/game`

**Files:**
- Create: `frontend/src/components/projetos/useNovidadesDasCartas.ts`
- Test: `frontend/src/components/projetos/useNovidadesDasCartas.test.ts`
- Modify: `frontend/src/pages/GamePage.tsx` (render das abas, ~linha 180)

**Interfaces:**
- Consumes: `api.getProjects`, `cartasParaRevelar`, `lerVistoEm`, `EVENTO_REVELACAO` (Task 2).
- Produces: `useNovidadesDasCartas(playerToken: string | null, houseId: string | null): { projetos: number; espioes: number }` — `espioes` conta só `INTELLIGENCE`, `projetos` o resto; relê ao receber `EVENTO_REVELACAO`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/projetos/useNovidadesDasCartas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import type { ApiClient } from "../../api/client";
import { gravarVistoEm } from "./previa";
import { useNovidadesDasCartas } from "./useNovidadesDasCartas";

const quando = "2026-09-23T14:06:03.000Z";
const projetos = [
  { id: "a", status: "COMPLETED", category: "ECONOMY", resolvedAt: quando },
  { id: "b", status: "FAILED", category: "INTELLIGENCE", resolvedAt: quando },
  { id: "c", status: "ACTIVE", category: "ECONOMY", resolvedAt: null },
];
const api = { getProjects: vi.fn().mockResolvedValue({ projects: projetos }) } as unknown as ApiClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(ApiProvider, { client: api, children });

beforeEach(() => localStorage.clear());

describe("useNovidadesDasCartas", () => {
  it("conta por aba e zera depois de visto", async () => {
    const { result } = renderHook(() => useNovidadesDasCartas("tok", "casa-x"), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ projetos: 1, espioes: 1 }));
    act(() => gravarVistoEm("casa-x", quando));
    await waitFor(() => expect(result.current).toEqual({ projetos: 0, espioes: 0 }));
  });

  it("sem sessão, zero e nenhuma chamada", () => {
    const { result } = renderHook(() => useNovidadesDasCartas(null, null), { wrapper });
    expect(result.current).toEqual({ projetos: 0, espioes: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/projetos/useNovidadesDasCartas.test.ts`
Expected: FAIL, import não resolve.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/projetos/useNovidadesDasCartas.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import type { ProjectCard } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { cartasParaRevelar, EVENTO_REVELACAO, lerVistoEm } from "./previa";

/**
 * Quantas cartas resolvidas cada aba ainda não revelou. O jogador costuma
 * abrir /game na aba Turnos; sem o selo, a revelação ficaria escondida.
 */
export function useNovidadesDasCartas(playerToken: string | null, houseId: string | null): { projetos: number; espioes: number } {
  const api = useApi();
  const [cartas, setCartas] = useState<ProjectCard[]>([]);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!playerToken) return;
    let vivo = true;
    api.getProjects(playerToken).then((v) => { if (vivo) setCartas(v.projects); }).catch(() => {});
    return () => { vivo = false; };
  }, [api, playerToken]);

  const reler = useCallback(() => setVersao((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener(EVENTO_REVELACAO, reler);
    return () => window.removeEventListener(EVENTO_REVELACAO, reler);
  }, [reler]);

  if (!playerToken || !houseId) return { projetos: 0, espioes: 0 };
  void versao;
  const novas = cartasParaRevelar(cartas, lerVistoEm(houseId));
  return {
    projetos: novas.filter((c) => c.category !== "INTELLIGENCE").length,
    espioes: novas.filter((c) => c.category === "INTELLIGENCE").length,
  };
}
```

Em `GamePage.tsx`, importe `Badge` de `@mui/material/Badge` e o hook, chame-o perto do topo do componente:

```tsx
  const novidades = useNovidadesDasCartas(playerSession?.playerToken ?? null, playerSession?.houseId ?? null);
```

e troque o render das abas:

```tsx
            {GAME_TABS.map((t) => {
              const n = t.value === "projetos" ? novidades.projetos : t.value === "espioes" ? novidades.espioes : 0;
              return (
                <Tab
                  key={t.value}
                  value={t.value}
                  label={n > 0 ? <Badge badgeContent={n} color="primary" sx={{ pr: 1.5 }} title={`${n} carta(s) resolvida(s) no fechamento`}>{t.label}</Badge> : t.label}
                />
              );
            })}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/projetos/useNovidadesDasCartas.test.ts src/pages`
Expected: PASS, incluindo os testes existentes de `GamePage`.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add frontend/src/components/projetos/useNovidadesDasCartas.ts frontend/src/components/projetos/useNovidadesDasCartas.test.ts frontend/src/pages/GamePage.tsx
git commit -m "feat(projetos): selo de novidades do fechamento nas abas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificar, documentar e publicar

**Files:**
- Modify: `CLAUDE.md` (seção "Cartas de projeto")

- [ ] **Step 1: Suítes completas**

```bash
npm run build:shared
npm run typecheck
npx vitest run --root backend | grep -E "Tests |FAIL"
npx vitest run --root shared  | grep -E "Tests |FAIL"
(cd frontend && npx vitest run | grep -E "Tests |FAIL")
```
Expected: zero erros de tipo, zero FAIL.

- [ ] **Step 2: Nota no CLAUDE.md**

Em "Cartas de projeto", acrescente:

```md
- **Tela do jogador** (`frontend/src/components/projetos/`): Energia grava a cada
  toque (`useEnergiaAutoSave`), sempre com o mapa INTEIRO da Casa — a aba
  Espiões é um recorte, e gravar só o recorte apagaria a Energia das obras. A
  revelação lembra o que já foi visto em localStorage por aparelho
  (`valdren.revelacao.<houseId>`). Cor turquesa `brand.energia` é só de Energia.
```

- [ ] **Step 3: Commit, push e deploy (skill `deploy` do repo)**

```bash
git add CLAUDE.md && git commit -m "docs: tela de cartas como jogo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
npm run deploy:backend
```
Depois o frontend pelo passo 4 da skill `deploy` (build, zip, `create-deployment`, PUT, `start-deployment`, esperar `SUCCEED`).

- [ ] **Step 4: Screenshots em produção, sem gravar nada**

Rode um script Playwright que entra como cada Casa de jogador (token assinado em memória com `TOKEN_SIGNING_SECRET` da Lambda, nunca gravado em arquivo), **aborta toda requisição que não seja GET** para a API, abre `/game?aba=projetos` e `/game?aba=espioes` em 390×844 e 1280×900, e salva screenshots no scratchpad. Confira:
- o cofre mostra o saldo certo;
- o Obelisco de Solarion mostra "Conclui sozinha no fim do turno";
- não há rolagem horizontal em 390px;
- nenhum erro no console.
