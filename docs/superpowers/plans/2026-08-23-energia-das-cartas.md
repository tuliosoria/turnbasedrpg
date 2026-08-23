# Energia das Cartas — Plano de Implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIO: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Dar a cada Casa 3 pontos de Energia por turno, gastos para avançar cartas — um ponto vale um turno de progresso —, para que o jogador escolha entre mover três cartas um passo ou uma carta três passos.

**Arquitetura:** A regra pura vive num arquivo novo em `shared` (`energia.ts`), dono único da mecânica. `projectEngine.ts` ganha um parâmetro de passos e sobe o teto de cartas ativas. O `backend` grava a alocação num item por turno e Casa, e a resolução do turno passa a ler dela. O `frontend` mostra o recurso e o seletor por carta.

**Stack:** TypeScript, Vitest, DynamoDB (`@aws-sdk/lib-dynamodb`), React + MUI.

---

## Antes de começar

**Rode isto uma vez.** Sem isso, tudo que importa `@ravenloft/content` falha, inclusive os testes de backend e frontend:

```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared
```

**Como rodar testes neste repositório** (`npm test` na raiz dá falsos vermelhos — não use):

| Workspace | Comando |
|---|---|
| shared | `npm test -w shared` |
| backend | `npm test -w backend` |
| frontend | `cd frontend && npx vitest run` |
| tipos do frontend | `npm run build -w frontend` (única coisa que faz typecheck do frontend) |

Não há linter nem formatter. Comentários, nomes de teste e mensagens de commit vão em **português**.

## Estrutura de arquivos

**Criar:**
- `shared/src/energia.ts` — a regra: a constante, o teto por carta, a validação e a alocação padrão. Dono único da mecânica.
- `shared/src/energia.test.ts` — testes da regra.
- `backend/src/db/energia.ts` — leitura e gravação do item de alocação.
- `backend/src/projects/processTurn.energia.test.ts` — testes da resolução com Energia.
- `frontend/src/components/HouseProjectsPanel.energia.test.tsx` — testes do seletor.

**Modificar:**
- `shared/src/index.ts` — exportar `energia.js`.
- `shared/src/projectEngine.ts:5-7` (`projectSlotLimit`) e a função `processProjectForTurn`.
- `shared/src/projectEngine.teto.test.ts` — não muda; serve de regressão.
- `backend/src/keys.ts` — a chave do item.
- `backend/src/projects/engine.ts` — reexportar o que `shared` passou a expor.
- `backend/src/projects/processTurn.ts` — ler a alocação e avançar por N.
- `backend/src/routes/projectRoutes.ts` — `energia` na resposta e a rota de gravação.
- `backend/src/routes/adminRoutes.ts:501-518` — passar as duas dependências novas.
- `backend/src/validation/schemas.ts` — o parser do corpo.
- `backend/src/router.ts` — registrar a rota.
- `frontend/src/types/api.ts` — `energia` na `ProjectsView` e a assinatura nova.
- `frontend/src/api/client.ts`, `httpClient.ts`, `mockClient.ts` — a rota nova.
- `frontend/src/components/HouseProjectsPanel.tsx` — o contador e o seletor.
- `frontend/src/pages/GamePage.tsx:122` — a Energia no bloco "Sua Casa".

---

### Task 1: A regra da Energia em `shared`

**Arquivos:**
- Criar: `shared/src/energia.ts`
- Criar: `shared/src/energia.test.ts`
- Modificar: `shared/src/index.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `shared/src/energia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ENERGIA_POR_TURNO,
  energiaMaximaPara,
  validarAlocacao,
  alocacaoPadrao,
} from "./energia.js";
import type { ProjectCard } from "./projects.js";

/** Uma carta ativa com o mínimo que a regra da Energia olha. */
function carta(id: string, durationTurns: number, turnsCompleted = 0, status: ProjectCard["status"] = "ACTIVE"): ProjectCard {
  return { id, durationTurns, turnsCompleted, status } as ProjectCard;
}

describe("ENERGIA_POR_TURNO", () => {
  it("é 3, como o Mestre definiu", () => {
    expect(ENERGIA_POR_TURNO).toBe(3);
  });
});

describe("energiaMaximaPara", () => {
  it("é o que falta para concluir, não a duração inteira", () => {
    expect(energiaMaximaPara(carta("a", 3, 2))).toBe(1);
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("nunca passa dos 3 pontos do turno", () => {
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("é zero para carta pausada", () => {
    expect(energiaMaximaPara(carta("a", 5, 0, "PAUSED"))).toBe(0);
  });
});

describe("validarAlocacao", () => {
  const ativas = [carta("a", 3), carta("b", 3), carta("c", 3)];

  it("aceita espalhar um ponto em cada", () => {
    expect(validarAlocacao({ a: 1, b: 1, c: 1 }, ativas).ok).toBe(true);
  });

  it("aceita concentrar os três numa carta", () => {
    expect(validarAlocacao({ a: 3 }, ativas).ok).toBe(true);
  });

  it("recusa passar do total do turno", () => {
    const r = validarAlocacao({ a: 2, b: 2 }, ativas);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("3");
  });

  it("recusa dar a uma carta mais do que ela precisa", () => {
    const r = validarAlocacao({ a: 2 }, [carta("a", 3, 2)]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("precisa");
  });

  it("recusa carta que não está ativa", () => {
    const r = validarAlocacao({ z: 1 }, ativas);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("não está ativa");
  });

  it("recusa valor negativo", () => {
    expect(validarAlocacao({ a: -1 }, ativas).ok).toBe(false);
  });

  it("recusa valor quebrado", () => {
    expect(validarAlocacao({ a: 1.5 }, ativas).ok).toBe(false);
  });

  it("aceita alocação vazia", () => {
    expect(validarAlocacao({}, ativas).ok).toBe(true);
  });
});

describe("alocacaoPadrao", () => {
  it("dá um ponto por carta ativa, que é o ritmo de hoje", () => {
    expect(alocacaoPadrao([carta("a", 3), carta("b", 3)])).toEqual({ a: 1, b: 1 });
  });

  it("não acelera quem tem uma carta só — o resto da Energia se perde", () => {
    expect(alocacaoPadrao([carta("a", 5)])).toEqual({ a: 1 });
  });

  it("ignora carta pausada", () => {
    expect(alocacaoPadrao([carta("a", 3), carta("b", 3, 0, "PAUSED")])).toEqual({ a: 1 });
  });

  it("nunca distribui mais que o total do turno", () => {
    const cartas = [carta("a", 3), carta("b", 3), carta("c", 3), carta("d", 3)];
    const total = Object.values(alocacaoPadrao(cartas)).reduce((n, v) => n + v, 0);
    expect(total).toBeLessThanOrEqual(ENERGIA_POR_TURNO);
  });

  it("devolve vazio quando a Casa não tem carta ativa — os três pontos se perdem", () => {
    expect(alocacaoPadrao([])).toEqual({});
  });

  it("o que devolve passa na própria validação", () => {
    const cartas = [carta("a", 3), carta("b", 3)];
    expect(validarAlocacao(alocacaoPadrao(cartas), cartas).ok).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/energia.test.ts
```

Esperado: FALHA com `Failed to resolve import "./energia.js"`.

- [ ] **Passo 3: Escrever a implementação**

Crie `shared/src/energia.ts`:

```ts
import type { ProjectCard } from "./projects.js";

/**
 * A Energia é o que o jogador gasta para mover suas cartas. Cada Casa recebe
 * três pontos no início do turno e um ponto vale um turno de progresso, então a
 * mesma Energia compra três cartas andando um passo ou uma carta andando três.
 *
 * Este arquivo é o dono único da regra. Rota, tela e resolução de turno derivam
 * daqui e não repetem número nenhum.
 */
export const ENERGIA_POR_TURNO = 3;

/** A alocação de um turno: quantos pontos cada carta recebeu. */
export type AlocacaoEnergia = Record<string, number>;

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
}

function estaAtiva(carta: ProjectCard): boolean {
  return carta.status === "ACTIVE";
}

/**
 * Quanto de Energia esta carta ainda aceita.
 *
 * É o que falta para concluir, nunca a duração inteira: dar 3 pontos a uma
 * carta que precisa de 1 queimaria dois sem retorno, e a tela teria de explicar
 * por quê. O teto também não passa do total do turno.
 */
export function energiaMaximaPara(carta: ProjectCard): number {
  if (!estaAtiva(carta)) return 0;
  const falta = carta.durationTurns - carta.turnsCompleted;
  return Math.max(0, Math.min(falta, ENERGIA_POR_TURNO));
}

/** Confere uma alocação contra as cartas da Casa. Recusa em português. */
export function validarAlocacao(alocacao: AlocacaoEnergia, cartas: ProjectCard[]): ResultadoValidacao {
  const porId = new Map(cartas.map((c) => [c.id, c]));
  let soma = 0;

  for (const [id, pontos] of Object.entries(alocacao)) {
    if (!Number.isInteger(pontos)) {
      return { ok: false, motivo: `A Energia é contada em pontos inteiros; "${pontos}" não é.` };
    }
    if (pontos < 0) {
      return { ok: false, motivo: "Não dá para alocar Energia negativa." };
    }
    if (pontos === 0) continue;

    const carta = porId.get(id);
    if (!carta || !estaAtiva(carta)) {
      return { ok: false, motivo: "Uma das cartas escolhidas não está ativa." };
    }

    const teto = energiaMaximaPara(carta);
    if (pontos > teto) {
      return { ok: false, motivo: `"${carta.title}" precisa de ${teto} de Energia para concluir; ${pontos} desperdiçaria o resto.` };
    }

    soma += pontos;
  }

  if (soma > ENERGIA_POR_TURNO) {
    return { ok: false, motivo: `Sua Casa tem ${ENERGIA_POR_TURNO} de Energia por turno, e isso soma ${soma}.` };
  }

  return { ok: true };
}

/**
 * O que acontece quando o jogador não distribui nada.
 *
 * Dá exatamente um ponto por carta ativa — o ritmo de hoje — e deixa o resto se
 * perder. A tentação seria espalhar os três pontos pelas cartas ativas, mas cada
 * Casa tem hoje uma carta só: ela receberia os três e saltaria três turnos sem
 * ninguém pedir, atropelando os projetos que já estão em voo.
 *
 * O princípio é que inação não acelera nada. Só anda mais depressa quem escolher.
 */
export function alocacaoPadrao(cartas: ProjectCard[]): AlocacaoEnergia {
  const alocacao: AlocacaoEnergia = {};
  let restante = ENERGIA_POR_TURNO;

  for (const carta of cartas) {
    if (restante <= 0) break;
    if (energiaMaximaPara(carta) <= 0) continue;
    alocacao[carta.id] = 1;
    restante -= 1;
  }

  return alocacao;
}
```

- [ ] **Passo 4: Exportar do índice**

Em `shared/src/index.ts`, logo depois da linha `export * from "./projectBalance.js";`, acrescente:

```ts
export * from "./energia.js";
```

- [ ] **Passo 5: Rodar para ver passar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/energia.test.ts
```

Esperado: PASSA, 18 testes.

- [ ] **Passo 6: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/energia.ts shared/src/energia.test.ts shared/src/index.ts
git commit -m "A regra da Energia: tres pontos por turno, um ponto por turno de progresso

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: O motor avança por N passos e o teto de cartas sobe

**Arquivos:**
- Modificar: `shared/src/projectEngine.ts`
- Criar: `shared/src/projectEngine.energia.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `shared/src/projectEngine.energia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { processProjectForTurn, projectSlotLimit } from "./projectEngine.js";
import type { ProjectCard } from "./projects.js";
import type { House } from "./types.js";

function carta(durationTurns: number, turnsCompleted = 0): ProjectCard {
  return { id: "a", durationTurns, turnsCompleted, lastProcessedTurnId: null } as ProjectCard;
}

function casa(controle: number): House {
  return { attributes: { riqueza: 1, recursos: 1, soldados: 1, controle } } as House;
}

describe("processProjectForTurn com passos", () => {
  it("sem passos, avança um turno — o comportamento de sempre", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3), 1);
    expect(project.turnsCompleted).toBe(1);
    expect(justCompleted).toBe(false);
  });

  it("com três passos, conclui uma carta de três turnos num turno só", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3), 1, 3);
    expect(project.turnsCompleted).toBe(3);
    expect(justCompleted).toBe(true);
  });

  it("com zero passos, não toca na carta", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3, 1), 1, 0);
    expect(project.turnsCompleted).toBe(1);
    expect(justCompleted).toBe(false);
    expect(project.lastProcessedTurnId).toBe(null);
  });

  it("não avança duas vezes no mesmo turno", () => {
    const primeira = processProjectForTurn(carta(5), 7, 2).project;
    const segunda = processProjectForTurn(primeira, 7, 2).project;
    expect(segunda.turnsCompleted).toBe(2);
  });
});

describe("projectSlotLimit", () => {
  it("dá três cartas, para a escolha entre largura e profundidade existir", () => {
    expect(projectSlotLimit(casa(1))).toBe(3);
  });

  it("dá quatro com Controle 4, mantendo o prêmio que já existia", () => {
    expect(projectSlotLimit(casa(4))).toBe(4);
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectEngine.energia.test.ts
```

Esperado: FALHA — `expected 1 to be 3` no teste dos três passos, e `expected 1 to be 3` no do teto.

- [ ] **Passo 3: Escrever a implementação**

Em `shared/src/projectEngine.ts`, troque a função `projectSlotLimit` (linhas 5-7) por:

```ts
/**
 * Quantas cartas a Casa pode ter em andamento.
 *
 * Era 1, ou 2 com Controle 4. Subiu com a Energia: com teto 1 o jogador não tem
 * o que escolher entre espalhar e concentrar, e a mecânica não existe. O 4 mantém
 * o prêmio do Controle e aperta melhor — quatro cartas para três pontos por turno
 * obrigam a deixar uma parada.
 */
export function projectSlotLimit(house: House): number {
  return house.attributes.controle >= 4 ? 4 : 3;
}
```

Depois troque a função `processProjectForTurn` inteira por:

```ts
/**
 * Avança a carta `passos` turnos. O padrão de 1 mantém quem chama sem saber da
 * Energia — inclusive os testes antigos — no comportamento de sempre.
 *
 * Com `passos` em zero a carta não é tocada, nem marcada como processada: é o
 * caso de quem não recebeu Energia neste turno e fica esperando, sem penalidade.
 */
export function processProjectForTurn(project: ProjectCard, turnId: number, passos = 1): ProcessResult {
  if (project.lastProcessedTurnId === turnId) return { project, justCompleted: false };
  if (passos <= 0) return { project, justCompleted: false };
  const turnsCompleted = Math.min(project.turnsCompleted + passos, project.durationTurns);
  const completed = turnsCompleted >= project.durationTurns;
  // Status/outcome on completion is decided by the backend after the AI verdict.
  const next: ProjectCard = {
    ...project,
    turnsCompleted,
    lastProcessedTurnId: turnId,
    updatedAt: new Date().toISOString(),
  };
  return { project: next, justCompleted: completed };
}
```

- [ ] **Passo 4: Rodar o teste novo e a suíte inteira**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm test -w shared
```

Esperado: PASSA. 206 testes de antes + 18 da Task 1 + 6 desta = **230**. Se algum dos 206 antigos ficar vermelho, o `passos = 1` não está preservando o comportamento — conserte antes de seguir.

- [ ] **Passo 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectEngine.ts shared/src/projectEngine.energia.test.ts
git commit -m "O motor avanca por N passos e o teto de cartas sobe para tres

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Guardar a alocação no banco

**Arquivos:**
- Modificar: `backend/src/keys.ts`
- Criar: `backend/src/db/energia.ts`
- Criar: `backend/src/keys.energia.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/src/keys.energia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { energiaSk } from "./keys";

describe("energiaSk", () => {
  it("separa por turno e por Casa", () => {
    expect(energiaSk(7, "casa-do-ouro")).toBe("ENERGY#007#casa-do-ouro");
  });

  it("preenche o turno com zeros, para ordenar como número", () => {
    expect(energiaSk(1, "x") < energiaSk(10, "x")).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/keys.energia.test.ts
```

Esperado: FALHA com `does not provide an export named 'energiaSk'`.

- [ ] **Passo 3: Escrever a chave**

Em `backend/src/keys.ts`, depois da função `favorHousePrefix`, acrescente:

```ts
/** A alocação de Energia de uma Casa num turno. Um item por turno e por Casa. */
export function energiaSk(turnId: number, houseId: string): string {
  return `ENERGY#${padTurn(turnId)}#${houseId}`;
}
```

- [ ] **Passo 4: Escrever o acesso ao banco**

Crie `backend/src/db/energia.ts`:

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, energiaSk } from "../keys";
import type { AlocacaoEnergia } from "@ravenloft/content";

export async function getAlocacaoEnergia(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnId: number, houseId: string,
): Promise<AlocacaoEnergia | null> {
  const res = await doc.send(new GetCommand({
    TableName: table,
    Key: { PK: campaignPk(campaignId), SK: energiaSk(turnId, houseId) },
  }));
  return res.Item ? ((res.Item as { porProjeto?: AlocacaoEnergia }).porProjeto ?? {}) : null;
}

export async function putAlocacaoEnergia(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnId: number, houseId: string,
  porProjeto: AlocacaoEnergia,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: {
      PK: campaignPk(campaignId),
      SK: energiaSk(turnId, houseId),
      turnId, houseId, porProjeto,
      atualizadoEm: new Date().toISOString(),
    },
  }));
}
```

- [ ] **Passo 5: Rodar para ver passar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/keys.energia.test.ts
```

Esperado: PASSA, 2 testes.

- [ ] **Passo 6: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/keys.ts backend/src/db/energia.ts backend/src/keys.energia.test.ts
git commit -m "Guarda a alocacao de Energia por turno e por Casa

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: A resolução do turno passa a gastar Energia

Esta é a tarefa que protege o jogo que já está rodando. O teste do padrão é o mais importante do plano.

**Arquivos:**
- Modificar: `backend/src/projects/engine.ts`
- Modificar: `backend/src/projects/processTurn.ts`
- Criar: `backend/src/projects/processTurn.energia.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/src/projects/processTurn.energia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { processProjectsForTurn, type ProcessTurnDeps } from "./processTurn";
import type { ProjectCard, House } from "@ravenloft/content";

function carta(id: string, durationTurns: number, turnsCompleted = 0): ProjectCard {
  return {
    id, campaignId: "c", houseId: "casa-1", title: `Carta ${id}`, durationTurns, turnsCompleted,
    status: "ACTIVE", lastProcessedTurnId: null, costs: [], requirements: [], risks: [], complications: [],
    completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
  } as unknown as ProjectCard;
}

const casa: House = {
  id: "casa-1", name: "Casa 1", stability: 3,
  attributes: { riqueza: 2, recursos: 2, soldados: 2, controle: 2 },
} as unknown as House;

/** Um cenário de resolução com os projetos e a alocação que o teste quiser. */
function cenario(projetos: ProjectCard[], alocacao: Record<string, number> | null) {
  const gravados: ProjectCard[] = [];
  const deps: ProcessTurnDeps = {
    listCampaignProjects: async () => projetos,
    getHouse: async () => casa,
    putProject: async (p) => { gravados.push(p); },
    updateHouseAttributes: async () => {},
    updateHouseStabilityAndAssets: async () => {},
    putFavor: async () => {},
    getAlocacaoEnergia: async () => alocacao,
  };
  return { deps, gravados };
}

describe("processProjectsForTurn com Energia", () => {
  it("sem alocação, cada carta avança exatamente um turno — o ritmo de hoje", async () => {
    // A regra que protege a partida em andamento: espalhar os três pontos numa
    // Casa de uma carta só a faria saltar três turnos sem ninguém pedir.
    const projetos = [carta("a", 5)];
    const { deps, gravados } = cenario(projetos, null);
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(1);
  });

  it("com três pontos numa carta, ela avança três turnos", async () => {
    const projetos = [carta("a", 5)];
    const { deps, gravados } = cenario(projetos, { a: 3 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(3);
  });

  it("com um ponto em cada, as três andam um passo", async () => {
    const projetos = [carta("a", 5), carta("b", 5), carta("c", 5)];
    const { deps, gravados } = cenario(projetos, { a: 1, b: 1, c: 1 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados.map((p) => p.turnsCompleted)).toEqual([1, 1, 1]);
  });

  it("carta sem Energia fica parada, sem penalidade", async () => {
    const projetos = [carta("a", 5), carta("b", 5)];
    const { deps, gravados } = cenario(projetos, { a: 2 });
    await processProjectsForTurn(deps, "c", 1);
    const b = gravados.find((p) => p.id === "b");
    expect(b?.turnsCompleted).toBe(0);
    expect(b?.status).toBe("ACTIVE");
  });

  it("iniciar e concluir no mesmo turno — o exemplo do Mestre", async () => {
    // "gastar 3 de energia para recrutar mais soldados em um turno": uma carta
    // recém-iniciada tem turnsCompleted 0 e lastProcessedTurnId null, então os
    // três pontos a levam de ponta a ponta sem esperar turno nenhum.
    const projetos = [carta("a", 3)];
    const { deps, gravados } = cenario(projetos, { a: 3 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(3);
    expect(gravados[0].status).toBe("COMPLETED");
  });

  it("Casa sem carta ativa não quebra a resolução", async () => {
    const { deps, gravados } = cenario([], null);
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados).toEqual([]);
  });

  it("alocação para carta que não está mais ativa é ignorada", async () => {
    const cancelada = { ...carta("z", 5), status: "CANCELLED" } as ProjectCard;
    const projetos = [carta("a", 5), cancelada];
    const { deps, gravados } = cenario(projetos, { z: 3, a: 1 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados.find((p) => p.id === "a")?.turnsCompleted).toBe(1);
    expect(gravados.find((p) => p.id === "z")).toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/projects/processTurn.energia.test.ts
```

Esperado: FALHA com erro de tipo em `getAlocacaoEnergia` (não existe em `ProcessTurnDeps`) e `expected 1 to be 3`.

- [ ] **Passo 3: Reexportar a regra no atalho do backend**

Em `backend/src/projects/engine.ts`, troque o arquivo inteiro por:

```ts
export {
  projectSlotLimit,
  activeProjectCount,
  canAffordStart,
  applyStartCharges,
  applyCompletion,
  processProjectForTurn,
  ENERGIA_POR_TURNO,
  energiaMaximaPara,
  validarAlocacao,
  alocacaoPadrao,
} from "@ravenloft/content";
export type { CompletionResult, ProcessResult, AlocacaoEnergia } from "@ravenloft/content";
```

- [ ] **Passo 4: Escrever a resolução**

Em `backend/src/projects/processTurn.ts`, troque a linha de import do topo por:

```ts
import { processProjectForTurn, applyCompletion, alocacaoPadrao } from "./engine";
import type { ProjectCard, House, Favor, AlocacaoEnergia } from "@ravenloft/content";
```

Acrescente ao final da interface `ProcessTurnDeps`, depois de `putFavor`:

```ts
  /**
   * A alocação de Energia daquela Casa naquele turno, ou null se o jogador não
   * distribuiu nada. Opcional para não quebrar quem monta as deps sem ela.
   */
  getAlocacaoEnergia?: (houseId: string, turnId: number) => Promise<AlocacaoEnergia | null>;
```

Troque o corpo de `processProjectsForTurn` por:

```ts
export async function processProjectsForTurn(deps: ProcessTurnDeps, campaignId: string, turnId: number): Promise<void> {
  const projects = await deps.listCampaignProjects(campaignId);
  const ativos = projects.filter((p) => p.status === "ACTIVE");

  // A Energia é por Casa, então a alocação é resolvida uma vez por Casa e não
  // uma vez por projeto — senão o banco seria lido de novo a cada carta.
  const passosPorProjeto = new Map<string, number>();
  const porCasa = new Map<string, ProjectCard[]>();
  for (const p of ativos) {
    porCasa.set(p.houseId, [...(porCasa.get(p.houseId) ?? []), p]);
  }
  for (const [houseId, cartas] of porCasa) {
    const gravada = deps.getAlocacaoEnergia ? await deps.getAlocacaoEnergia(houseId, turnId) : null;
    const alocacao = gravada ?? alocacaoPadrao(cartas);
    for (const carta of cartas) {
      passosPorProjeto.set(carta.id, alocacao[carta.id] ?? 0);
    }
  }

  for (const project of projects) {
    if (project.status !== "ACTIVE") continue;
    if (project.lastProcessedTurnId === turnId) continue;
    const passos = passosPorProjeto.get(project.id) ?? 0;
    // Sem Energia a carta espera. Não é gravada de volta porque nada nela mudou.
    if (passos <= 0) continue;
    const { project: advanced, justCompleted } = processProjectForTurn(project, turnId, passos);
    if (justCompleted) {
      const house = await deps.getHouse(advanced.houseId);
      if (house) {
        const verdict = deps.judgeOutcome
          ? await safeJudge(deps.judgeOutcome, advanced, house)
          : { success: true, narrative: "" };
        const now = new Date().toISOString();
        let conversoes: string[] = [];
        if (verdict.success) {
          const resultado = applyCompletion(house, advanced);
          conversoes = resultado.conversoes;
          await deps.updateHouseAttributes(advanced.houseId, resultado.house.attributes);
          await deps.updateHouseStabilityAndAssets(advanced.houseId, resultado.house.stability ?? 3, resultado.house.assets ?? []);
          for (const fe of resultado.favorsToCreate) {
            const favor: Favor = {
              id: `${advanced.id}-favor-${fe.targetHouseId}`, campaignId, fromHouseId: advanced.houseId,
              toHouseId: fe.targetHouseId, amount: fe.amount, status: "PENDING",
              reason: `Projeto: ${advanced.title}`, createdAt: now, updatedAt: now,
            };
            await deps.putFavor(favor);
          }
        }
        advanced.status = verdict.success ? "COMPLETED" : "FAILED";
        advanced.outcome = verdict.success ? "SUCCESS" : "FAILURE";
        // A conversão de teto precisa chegar ao jogador: um ganho que virou
        // outra coisa em silêncio é a mesma promessa quebrada de antes.
        advanced.outcomeNarrative = [verdict.narrative, conversoes.join(" ")].filter(Boolean).join("\n\n") || null;
        advanced.completedAt = now;
        advanced.resolvedAt = now;
      }
    }
    await deps.putProject(advanced);
  }
}
```

- [ ] **Passo 5: Rodar o teste novo e a suíte inteira**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm test -w backend
```

Esperado: PASSA. Os 7 novos entram; **nenhum dos 757 antigos pode ficar vermelho**. Se algum teste antigo de resolução quebrar, é porque montava `ProcessTurnDeps` sem `getAlocacaoEnergia` e esperava avanço automático — o `alocacaoPadrao` cobre esse caso e o teste deve passar sem alteração.

- [ ] **Passo 6: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/projects/engine.ts backend/src/projects/processTurn.ts backend/src/projects/processTurn.energia.test.ts
git commit -m "A resolucao do turno passa a gastar Energia, e a inacao nao acelera nada

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: A rota que grava a alocação

**Arquivos:**
- Modificar: `backend/src/validation/schemas.ts`
- Modificar: `backend/src/routes/projectRoutes.ts`
- Modificar: `backend/src/router.ts`
- Modificar: `backend/src/routes/adminRoutes.ts:501-518`
- Criar: `backend/src/validation/schemas.energia.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/src/validation/schemas.energia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnergiaBody } from "./schemas";

describe("parseEnergiaBody", () => {
  it("aceita um mapa de carta para pontos", () => {
    expect(parseEnergiaBody({ porProjeto: { abc: 2, def: 1 } })).toEqual({ porProjeto: { abc: 2, def: 1 } });
  });

  it("aceita mapa vazio", () => {
    expect(parseEnergiaBody({ porProjeto: {} })).toEqual({ porProjeto: {} });
  });

  it("recusa quando não é objeto", () => {
    expect(() => parseEnergiaBody({ porProjeto: "tudo" })).toThrow();
  });

  it("recusa pontos que não são número", () => {
    expect(() => parseEnergiaBody({ porProjeto: { abc: "dois" } })).toThrow();
  });

  it("recusa mais chaves do que uma Casa poderia ter", () => {
    const grande: Record<string, number> = {};
    for (let i = 0; i < 50; i++) grande[`p${i}`] = 1;
    expect(() => parseEnergiaBody({ porProjeto: grande })).toThrow();
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/validation/schemas.energia.test.ts
```

Esperado: FALHA com `does not provide an export named 'parseEnergiaBody'`.

- [ ] **Passo 3: Escrever o parser**

Em `backend/src/validation/schemas.ts`, depois de `parseProjectIdBody`, acrescente:

```ts
/**
 * O corpo da alocação de Energia. Confere só a forma; quanto vale cada número é
 * decisão de validarAlocacao, que conhece as cartas da Casa.
 */
export function parseEnergiaBody(body: unknown): { porProjeto: Record<string, number> } {
  const o = asObject(body);
  const bruto = o.porProjeto;
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new HttpError(400, "BAD_INPUT", "porProjeto deve ser um objeto.");
  }
  const entradas = Object.entries(bruto as Record<string, unknown>);
  if (entradas.length > 20) {
    throw new HttpError(400, "BAD_INPUT", "Cartas demais na alocação de Energia.");
  }
  const porProjeto: Record<string, number> = {};
  for (const [id, valor] of entradas) {
    if (id.length > 80) throw new HttpError(400, "BAD_INPUT", "Identificador de carta longo demais.");
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      throw new HttpError(400, "BAD_INPUT", "A Energia de cada carta deve ser um número.");
    }
    porProjeto[id] = valor;
  }
  return { porProjeto };
}
```

> `HttpError` já vem importado no topo de `schemas.ts` (linha 11), e `asObject` já lança `HttpError(400, "INVALID_BODY", ...)`. Não é preciso acrescentar import nenhum.

- [ ] **Passo 4: Rodar para ver passar**

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/validation/schemas.energia.test.ts
```

Esperado: PASSA, 5 testes.

- [ ] **Passo 5: Escrever a rota e pôr a Energia na resposta**

Em `backend/src/routes/projectRoutes.ts`, no import de `../projects/engine` (linha 11), acrescente os nomes novos:

```ts
import { projectSlotLimit, activeProjectCount, canAffordStart, applyStartCharges, ENERGIA_POR_TURNO, energiaMaximaPara, validarAlocacao } from "../projects/engine";
```

Acrescente os imports do banco e do parser:

```ts
import { getAlocacaoEnergia, putAlocacaoEnergia } from "../db/energia";
import { parseEnergiaBody } from "../validation/schemas";
```

> `parseEnergiaBody` pode entrar na lista de `parseStartTemplateBody, ...` que já vem de `../validation/schemas` na linha 14, em vez de um import novo.

Dentro de `getProjects`, troque o `return` por:

```ts
  const turnId = await currentTurnId(deps);
  const alocada = await getAlocacaoEnergia(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, player.houseId);
  const ativas = projects.filter((p) => p.status === "ACTIVE");
  const tetoPorProjeto: Record<string, number> = {};
  for (const p of ativas) tetoPorProjeto[p.id] = energiaMaximaPara(p);

  return {
    status: 200,
    body: {
      templates: DEFAULT_PROJECT_TEMPLATES,
      recommended: recommendStarterCards(house).map((t) => t.id),
      projects,
      favors: favors.filter((f) => f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
      attributes: house.attributes,
      energia: { total: ENERGIA_POR_TURNO, porProjeto: alocada ?? {}, tetoPorProjeto },
    },
  };
```

No fim do arquivo, acrescente a rota:

```ts
/**
 * Grava como a Casa distribuiu os pontos de Energia deste turno.
 *
 * Só com o turno aberto: depois de fechado o Mestre já está resolvendo, e mudar
 * a alocação ali mudaria o resultado por baixo dele.
 */
export async function setEnergia(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { porProjeto } = parseEnergiaBody(req.body);

  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "OPEN") {
    throw new HttpError(423, "TURN_LOCKED", "O turno não está aberto para distribuir Energia.");
  }

  const projects = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  const conferido = validarAlocacao(porProjeto, projects);
  if (!conferido.ok) throw new HttpError(409, "BAD_STATUS", conferido.motivo ?? "Alocação inválida.");

  await putAlocacaoEnergia(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, player.houseId, porProjeto);
  return { status: 200, body: { porProjeto } };
}
```

- [ ] **Passo 6: Registrar a rota**

Em `backend/src/router.ts`, acrescente `setEnergia` ao import da linha 6 e registre logo depois da linha do cancelamento:

```ts
  r("POST", "/api/player/project/energia", setEnergia),
```

- [ ] **Passo 7: Ligar a alocação na resolução do turno**

Em `backend/src/routes/adminRoutes.ts`, acrescente ao import do banco:

```ts
import { getAlocacaoEnergia } from "../db/energia";
```

E dentro do objeto passado a `processProjectsForTurn` (por volta da linha 508), depois de `putFavor`, acrescente:

```ts
      getAlocacaoEnergia: (h, t) => getAlocacaoEnergia(deps.doc, tableName, campaignId, t, h),
```

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm test -w backend
```

Esperado: PASSA, sem regressão.

- [ ] **Passo 9: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/validation/schemas.ts backend/src/validation/schemas.energia.test.ts backend/src/routes/projectRoutes.ts backend/src/routes/adminRoutes.ts backend/src/router.ts
git commit -m "Rota para o jogador distribuir a Energia do turno

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: O contrato no frontend

Sem tela ainda: só os tipos e os clientes, para a Task 7 ter em que se apoiar.

**Arquivos:**
- Modificar: `frontend/src/types/api.ts:44-52`
- Modificar: `frontend/src/api/client.ts`
- Modificar: `frontend/src/api/httpClient.ts`
- Modificar: `frontend/src/api/mockClient.ts`

- [ ] **Passo 1: Acrescentar o campo ao tipo**

Em `frontend/src/types/api.ts`, troque a interface `ProjectsView` por:

```ts
export interface ProjectsView {
  templates: ProjectTemplate[];
  recommended: string[];
  projects: ProjectCard[];
  favors: Favor[];
  slotLimit: number;
  stability: number;
  attributes: { riqueza: number; recursos: number; soldados: number; controle: number };
  /**
   * O recurso do turno. `porProjeto` é o que já foi distribuído e `tetoPorProjeto`
   * o quanto cada carta ativa ainda aceita — a tela não recalcula nenhum dos dois.
   */
  energia: { total: number; porProjeto: Record<string, number>; tetoPorProjeto: Record<string, number> };
}
```

- [ ] **Passo 2: Declarar no contrato do cliente**

Em `frontend/src/api/client.ts`, logo depois da linha de `cancelProject` (219), acrescente:

```ts
  setEnergia(playerToken: string, input: { porProjeto: Record<string, number> }): Promise<{ porProjeto: Record<string, number> }>;
```

- [ ] **Passo 3: Implementar no cliente HTTP**

Em `frontend/src/api/httpClient.ts`, depois do método `cancelProject`, acrescente:

```ts
  setEnergia(playerToken: string, input: { porProjeto: Record<string, number> }): Promise<{ porProjeto: Record<string, number> }> {
    return this.request<{ porProjeto: Record<string, number> }>("/api/player/project/energia", { method: "POST", body: input, token: playerToken });
  }
```

- [ ] **Passo 4: Implementar no mock**

Em `frontend/src/api/mockClient.ts`, acrescente `ENERGIA_POR_TURNO`, `energiaMaximaPara` e `validarAlocacao` ao import de `@ravenloft/content` que já traz `projectSlotLimit` (linha 20).

Acrescente um campo à classe, junto dos outros estados:

```ts
  private energia = new Map<string, Record<string, number>>();
```

Troque o método `getProjects` inteiro (por volta da linha 1128) por:

```ts
  async getProjects(playerToken: string): Promise<ProjectsView> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const cartas = this.projects.get(rec.houseId) ?? [];
    return {
      templates: DEFAULT_PROJECT_TEMPLATES,
      recommended: recommendStarterCards(house).map((t) => t.id),
      projects: cartas,
      favors: this.favors.filter((f) => f.toHouseId === rec.houseId && f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
      attributes: house.attributes,
      energia: {
        total: ENERGIA_POR_TURNO,
        porProjeto: this.energia.get(rec.houseId) ?? {},
        tetoPorProjeto: Object.fromEntries(
          cartas.filter((p) => p.status === "ACTIVE").map((p) => [p.id, energiaMaximaPara(p)]),
        ),
      },
    };
  }
```

E depois de `cancelProject`, acrescente:

```ts
  async setEnergia(playerToken: string, input: { porProjeto: Record<string, number> }): Promise<{ porProjeto: Record<string, number> }> {
    const rec = this.requirePlayer(playerToken);
    const cartas = this.projects.get(rec.houseId) ?? [];
    const conferido = validarAlocacao(input.porProjeto, cartas);
    if (!conferido.ok) throw new ApiError("BAD_STATUS", conferido.motivo ?? "Alocação inválida.");
    this.energia.set(rec.houseId, input.porProjeto);
    return { porProjeto: input.porProjeto };
  }
```

- [ ] **Passo 5: Conferir tipos e rodar os testes**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w frontend && cd frontend && npx vitest run
```

Esperado: build sem erro e os 310 testes verdes. Um erro de tipo aqui quer dizer que algum teste monta uma `ProjectsView` à mão e agora precisa do campo `energia` — acrescente `energia: { total: 3, porProjeto: {}, tetoPorProjeto: {} }` a esses objetos.

- [ ] **Passo 6: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add frontend/src/types/api.ts frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts
git commit -m "A Energia chega ao frontend pelo contrato da ProjectsView

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: O seletor de Energia na tela

**Arquivos:**
- Modificar: `frontend/src/components/HouseProjectsPanel.tsx`
- Criar: `frontend/src/components/HouseProjectsPanel.energia.test.tsx`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `frontend/src/components/HouseProjectsPanel.energia.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockApiClient } from "../api/mockClient";
import { ApiProvider } from "../api/ApiProvider";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

async function semear(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as never);
  return acc.playerToken;
}

function montar(client: MockApiClient, token: string) {
  render(
    <ApiProvider client={client}>
      <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
    </ApiProvider>,
  );
}

/** Inicia a primeira carta da biblioteca e abre a aba de ativos. */
async function comCartaAtiva(client: MockApiClient) {
  const token = await semear(client);
  montar(client, token);
  fireEvent.click(await screen.findByText("Biblioteca"));
  const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(iniciar[0]);
  await waitFor(() => expect(screen.getByText(/Projetos Ativos \(1\//i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Projetos Ativos \(1\//i));
  return token;
}

describe("Energia no painel de projetos", () => {
  let client: MockApiClient;
  beforeEach(() => {
    client = new MockApiClient();
    // O jsdom não implementa window.confirm, e o botão Iniciar passa por ele.
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("mostra a Energia do turno assim que a tela abre", async () => {
    const token = await semear(client);
    montar(client, token);
    expect(await screen.findByText(/Energia: 3\/3/)).toBeInTheDocument();
  });

  it("deixa o jogador pôr Energia numa carta ativa", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Energia nesta carta: 0/)).toBeInTheDocument();
    expect(screen.getByText(/a carta espera/i)).toBeInTheDocument();
  });

  it("grava a alocação e desconta do saldo do turno", async () => {
    const token = await comCartaAtiva(client);
    const ativos = await client.getProjects(token);
    const carta = ativos.projects.find((p) => p.status === "ACTIVE")!;

    await client.setEnergia(token, { porProjeto: { [carta.id]: 2 } });
    const depois = await client.getProjects(token);
    expect(depois.energia.porProjeto[carta.id]).toBe(2);
  });

  it("o botão de distribuir aparece quando há carta ativa", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByRole("button", { name: /Distribuir Energia/i })).toBeInTheDocument();
  });

  it("recusa alocação acima dos três pontos do turno", async () => {
    const token = await comCartaAtiva(client);
    const ativos = await client.getProjects(token);
    const carta = ativos.projects.find((p) => p.status === "ACTIVE")!;
    await expect(client.setEnergia(token, { porProjeto: { [carta.id]: 9 } })).rejects.toThrow();
  });
});
```

- [ ] **Passo 2: Rodar para ver falhar**

```bash
cd /Users/jessicarosa/turnbasedrpg/frontend && npx vitest run src/components/HouseProjectsPanel.energia.test.tsx
```

Esperado: FALHA — `Unable to find an element with the text: /Energia: 3\/3/`.
- [ ] **Passo 3: Escrever a tela**

Em `frontend/src/components/HouseProjectsPanel.tsx`, acrescente ao import do MUI:

```tsx
import Slider from "@mui/material/Slider";
```

Depois da função `atributosNoTeto`, acrescente:

```tsx
/** O que N pontos de Energia fazem com esta carta, em palavras. */
function efeitoDaEnergia(pontos: number, turnsCompleted: number, durationTurns: number): string {
  if (pontos <= 0) return "Sem Energia neste turno: a carta espera.";
  const depois = Math.min(turnsCompleted + pontos, durationTurns);
  if (depois >= durationTurns) return `Com ${pontos} de Energia, conclui neste turno.`;
  return `Com ${pontos} de Energia, chega a ${depois} de ${durationTurns}; faltam ${durationTurns - depois} turnos.`;
}
```

Dentro do componente, junto dos outros `useState`, acrescente. O nome é `definirEnergia` de propósito: `setEnergia` já é o método do cliente de API, e usar o mesmo nome para o setter do React tornaria as duas chamadas indistinguíveis à leitura.

```tsx
  const [energia, definirEnergia] = useState<Record<string, number>>({});
```

Logo depois do `useEffect` que chama `load`, acrescente outro para acompanhar o que o servidor devolveu:

```tsx
  useEffect(() => { if (data) definirEnergia(data.energia.porProjeto); }, [data]);
```

Depois da linha `const slotFull = ...`, acrescente:

```tsx
  const energiaGasta = Object.values(energia).reduce((n, v) => n + v, 0);
  const energiaLivre = data.energia.total - energiaGasta;
```

No `Stack` do cabeçalho, ao lado do `Chip` de Estabilidade, acrescente:

```tsx
          <Chip label={`Energia: ${energiaLivre}/${data.energia.total}`} color={energiaLivre === 0 ? "default" : "primary"} size="small" />
```

Dentro do `CardContent` de cada carta ativa, logo depois do `Typography` de "Ao concluir", acrescente:

```tsx
                  {p.status === "ACTIVE" && (data.energia.tetoPorProjeto[p.id] ?? 0) > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">Energia nesta carta: {energia[p.id] ?? 0}</Typography>
                      <Slider
                        size="small"
                        value={energia[p.id] ?? 0}
                        min={0}
                        max={data.energia.tetoPorProjeto[p.id] ?? 0}
                        step={1}
                        marks
                        disabled={busy}
                        aria-label={`Energia em ${p.title}`}
                        onChange={(_e, v) => definirEnergia((atual) => ({ ...atual, [p.id]: Array.isArray(v) ? v[0] : v }))}
                      />
                      <Typography variant="caption" display="block" color="text.secondary">
                        {efeitoDaEnergia(energia[p.id] ?? 0, p.turnsCompleted, p.durationTurns)}
                      </Typography>
                    </Box>
                  )}
```

Depois do bloco `{active.map(...)}`, antes de `{pending.map(...)}`, acrescente o botão de gravar:

```tsx
            {active.some((p) => p.status === "ACTIVE") && (
              <Box>
                {energiaLivre < 0 && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Sua Casa tem {data.energia.total} de Energia por turno, e você distribuiu {energiaGasta}.
                  </Alert>
                )}
                <Button variant="contained" disabled={busy || energiaLivre < 0}
                  onClick={() => void run(() => api.setEnergia(playerToken, { porProjeto: energia }))}>
                  Distribuir Energia
                </Button>
              </Box>
            )}
```

- [ ] **Passo 4: Rodar o teste novo e a suíte inteira**

```bash
cd /Users/jessicarosa/turnbasedrpg/frontend && npx vitest run
```

Esperado: PASSA, 310 antigos + 5 novos = **315**.

- [ ] **Passo 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add frontend/src/components/HouseProjectsPanel.tsx frontend/src/components/HouseProjectsPanel.energia.test.tsx
git commit -m "O jogador distribui a Energia do turno carta a carta

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: A Energia no bloco "Sua Casa"

Para o jogador ver o recurso antes de abrir a aba de projetos.

**Arquivos:**
- Modificar: `frontend/src/pages/GamePage.tsx`

- [ ] **Passo 1: Carregar a Energia junto do jogo**

Em `frontend/src/pages/GamePage.tsx`, junto dos outros `useState` (por volta da linha 33), acrescente:

```tsx
  const [energiaLivre, setEnergiaLivre] = useState<number | null>(null);
```

Dentro do `useCallback` `refresh`, que já é `async`, acrescente logo depois de `setOrderText(view.submission?.orderText ?? "");`:

```tsx
      try {
        const vista = await api.getProjects(session.playerToken);
        const gasta = Object.values(vista.energia.porProjeto).reduce((n, v) => n + v, 0);
        setEnergiaLivre(vista.energia.total - gasta);
      } catch {
        // A Energia é informação de apoio: se falhar, a página do jogo segue.
        setEnergiaLivre(null);
      }
```

Ele fica dentro do `try` que já existe, depois do `setOrderText` e antes do `catch (err)`. A `session` já está em escopo, vinda do `loadPlayerSession()` no topo de `refresh`.

- [ ] **Passo 2: Mostrar ao lado dos atributos**

Logo depois de `<AttributeBars attributes={game.house.attributes} />` (linha 122), acrescente:

```tsx
                {energiaLivre !== null && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                    Energia deste turno: {energiaLivre} de 3 — cada ponto move uma carta um turno.
                  </Typography>
                )}
```

- [ ] **Passo 3: Conferir tipos e rodar os testes**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w frontend && cd frontend && npx vitest run
```

Esperado: build sem erro, 315 testes verdes.

- [ ] **Passo 4: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add frontend/src/pages/GamePage.tsx
git commit -m "A Energia do turno aparece no bloco Sua Casa

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Verificação e publicação

- [ ] **Passo 1: As três suítes, isoladas**

```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && npm test -w shared && npm test -w backend && npm run build -w frontend && cd frontend && npx vitest run
```

Esperado: **230 shared · 771 backend · 315 frontend**, todas verdes, e o build do frontend sem erro de tipo.

- [ ] **Passo 2: Conferir que a partida em andamento não foi atropelada**

Este é o teste de fumaça da regra do §2 da spec. Rode:

```bash
cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/projects/processTurn.energia.test.ts -t "sem alocação"
```

Esperado: PASSA. Se este falhar, **não publique**: os três projetos em voo saltariam turnos sem ninguém pedir.

- [ ] **Passo 3: Publicar o backend**

```bash
cd /Users/jessicarosa/turnbasedrpg && git push origin HEAD
```

O backend sai por CI. Confirme que a rota nova responde (fora do turno aberto, 423 já prova que ela existe e valida):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/player/project/energia"
```

Esperado: **401** (sem token) — e nunca 404, que significaria rota não registrada.

- [ ] **Passo 4: Publicar o frontend**

Duas armadilhas que quebram em silêncio: `frontend/.env.production` é gitignored (sem ele o site cai no mock sem avisar), e o worktree não isola o `shared`.

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build -w shared
git worktree add -q --detach /tmp/deploy-energia HEAD
ln -s /Users/jessicarosa/turnbasedrpg/node_modules /tmp/deploy-energia/node_modules
cp frontend/.env.production /tmp/deploy-energia/frontend/.env.production
cd /tmp/deploy-energia/frontend && npx vite build
grep -c "kzmeheg8d4" dist/assets/*.js
grep -c "Distribuir Energia" dist/assets/*.js
```

Esperado: os dois `grep` devolvem **1**. Se o primeiro der 0, o `.env.production` não foi copiado e o site iria ao ar falando com o mock.

Depois:

```bash
cd /tmp/deploy-energia/frontend/dist && zip -qr /tmp/energia.zip . && \
aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main
```

Suba o zip na URL devolvida com `curl -X PUT --upload-file /tmp/energia.zip "<url>"`, chame `aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id <id>` e acompanhe com `aws amplify get-job` até `SUCCEED`.

- [ ] **Passo 5: Limpar**

```bash
cd /Users/jessicarosa/turnbasedrpg && git worktree remove --force /tmp/deploy-energia && rm -f /tmp/energia.zip
```

- [ ] **Passo 6: Conferir no ar**

```bash
curl -s "https://main.d1emmrcvmpw55g.amplifyapp.com/" | grep -o 'assets/index-[A-Za-z0-9]*\.js' | head -1
```

Pegue o nome do bundle e confirme que o texto novo está nele:

```bash
curl -s "https://main.d1emmrcvmpw55g.amplifyapp.com/assets/<bundle>.js" | grep -c "Distribuir Energia"
```

Esperado: **1**.

---

## Notas para quem executa

**A ordem importa.** As tarefas 1 e 2 são a fundação; 3 a 5 são o backend; 6 a 8 o frontend. Não pule para a tela antes do contrato da Task 6 existir.

**O teste que não pode ficar vermelho** é o `"sem alocação, cada carta avança exatamente um turno"` da Task 4. Ele é o que garante que a partida do Mestre, com três projetos em voo, não salte turnos no primeiro turno depois do deploy.

**Se um teste antigo quebrar**, o culpado quase sempre é um objeto `ProjectsView` montado à mão num teste que agora precisa do campo `energia`. Acrescente `energia: { total: 3, porProjeto: {}, tetoPorProjeto: {} }` e siga.

**Nada de migração de dados.** Casas e projetos que já existem funcionam sem tocar no banco: sem item de alocação, `alocacaoPadrao` reproduz exatamente o comportamento de hoje.
