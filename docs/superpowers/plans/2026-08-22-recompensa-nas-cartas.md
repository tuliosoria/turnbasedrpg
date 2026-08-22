# Recompensa nas Cartas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda carta de projeto passa a ter uma recompensa garantida, calibrada por uma regra única, e o jogador vê o ganho ao lado do custo antes de escolher.

**Architecture:** Um módulo novo em `shared/` vira a fonte única da regra de troca (duração → custo permitido → ganho permitido). Três consumidores passam a derivar dela: um teste que audita as 65 cartas da biblioteca, o prompt da IA que hoje repete a regra em prosa três vezes, e a tela que escreve o ganho. O motor de conclusão ganha uma cascata que converte ganho que não cabe no teto (atributo → estabilidade → ativo), para que nenhuma conclusão termine em nada. Por último, um script migra as três cartas já ativas em produção.

**Tech Stack:** TypeScript, vitest, React + MUI, DynamoDB (AWS SDK v3), scripts `.mjs` em `backend/scripts/`.

**Spec:** `docs/superpowers/specs/2026-08-22-recompensa-nas-cartas-design.md`

---

## Contexto que o implementador precisa saber

O jogo é **Valdren**, um RPG político play-by-post por turnos, em **português brasileiro**. O usuário é o Mestre.

**Convenções obrigatórias do repositório:**

- **Todo comentário de código, nome de teste e mensagem de commit é em português.** O código (identificadores) segue o que já existe no arquivo: o `shared/` é majoritariamente em inglês para tipos existentes, mas **o módulo novo deste plano usa nomes em português**, como já fazem outros módulos de domínio.
- **Não há linter nem formatter. Não há logger.** Não instale nenhum.
- **`npm test` na raiz dá falsos vermelhos** (os três workspaces em paralelo estouram timeouts). Sempre isolar por workspace.

**Comandos de verificação (todos já validados):**

```bash
npm run build -w shared        # obrigatório antes de testar backend/frontend
npm test -w shared             # 166 testes hoje
npm test -w backend            # 732 testes hoje
cd frontend && npx vitest run  # 305 testes hoje
npm run build -w frontend      # única coisa que typechecka o frontend
```

**`shared/dist` é consumido pelo backend e pelo frontend via `@ravenloft/content`.** Depois de mexer em `shared/src`, rode `npm run build -w shared` antes de rodar testes dos outros workspaces, senão eles testam código velho.

**Escala do jogo:** os quatro atributos (`riqueza`, `recursos`, `soldados`, `controle`) vão de 0 a 5. Estabilidade vai de 0 a 5. Uma Casa nasce com 10 pontos distribuídos entre os quatro atributos.

**A tabela de troca decidida pelo Mestre** (seção 2.1 da spec):

| Turnos | Ganho de atributo permanente | Custo total |
|---:|---|---|
| 1 | nenhum | 0–1 |
| 2 | nenhum | 0–1 |
| 3 | +1 | 1–2 |
| 4 | +2 | 2–3 |
| 5 | +2 | 3–4 |

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `shared/src/projectBalance.ts` | A tabela de troca, a auditoria de uma carta e o resumo do ganho para a tela. Fonte única da regra |
| `shared/src/projectBalance.test.ts` | Testes da tabela e das funções puras |
| `shared/src/projectTemplates.balance.test.ts` | Auditoria das 65 cartas e a regra de alcance. **Separado** do teste de estrutura que já existe, porque falha de propósito na Task 3 |
| `backend/scripts/migrar-efeitos-cartas-ativas.mjs` | Migração das cartas ativas em produção |
| `backend/scripts/migrar-efeitos-cartas-ativas.test.mjs` | Teste irmão da migração |

**Modificar:**

| Arquivo | O que muda |
|---|---|
| `shared/src/index.ts` | Exporta o módulo novo |
| `shared/src/projectTemplates.ts` | As 65 cartas ganham efeito e custo dentro da faixa |
| `shared/src/projectEngine.ts:39-63` | `applyCompletion` ganha a cascata de teto |
| `backend/src/ai/projectPrompts.ts:26-31, 76-81, 119` | As três cópias da regra viram uma, derivada da tabela |
| `frontend/src/components/HouseProjectsPanel.tsx:96-104, 143-160, 184-190` | Mostra o ganho nos quatro momentos |
| `frontend/src/types/api.ts:44-51` | `ProjectsView` ganha `attributes`, que a tela precisa para o aviso de teto |
| `backend/src/routes/projectRoutes.ts:73` | A rota passa a devolver `attributes` |

**Ordem:** a Task 1 define os tipos que todas as outras usam. A Task 2 escreve a auditoria que fica vermelha até a Task 3 terminar. A Task 8 é a última porque depende da tabela e do retrofit.

---

## Task 1: A tabela de troca vira código

**Files:**
- Create: `shared/src/projectBalance.ts`
- Create: `shared/src/projectBalance.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `shared/src/projectBalance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TABELA_DE_TROCA, faixaPara, auditarCarta, resumoDoGanho } from "./projectBalance.js";
import type { ProjectTemplate } from "./projects.js";

/** Uma carta mínima e válida, para os testes mexerem só no que interessa. */
function carta(over: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    id: "carta-de-teste",
    title: "Carta de Teste",
    category: "MILITARY",
    durationTurns: 3,
    costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
    requirements: [],
    description: "Uma carta para testar.",
    completionEffects: {
      attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    },
    risks: ["um risco"],
    requiresTargetApproval: false,
    requiresGmApproval: false,
    ...over,
  };
}

describe("TABELA_DE_TROCA", () => {
  it("cobre de 1 a 5 turnos sem buraco", () => {
    expect(TABELA_DE_TROCA.map((f) => f.turnos)).toEqual([1, 2, 3, 4, 5]);
  });

  it("não dá atributo permanente abaixo de 3 turnos", () => {
    expect(faixaPara(1).atributoPermanenteMax).toBe(0);
    expect(faixaPara(2).atributoPermanenteMax).toBe(0);
  });

  it("segue a decisão do Mestre: +1 em 3 turnos, +2 em 4 e 5", () => {
    expect(faixaPara(3).atributoPermanenteMax).toBe(1);
    expect(faixaPara(4).atributoPermanenteMax).toBe(2);
    expect(faixaPara(5).atributoPermanenteMax).toBe(2);
  });

  it("a carta longa nunca oferece menos que a curta", () => {
    // Sem isto, o desempate da spec (2.1) se desfaz sem ninguém notar e as
    // cartas de 4 e 5 turnos viram lixo mecânico.
    for (let t = 2; t <= 5; t++) {
      expect(faixaPara(t).atributoPermanenteMax).toBeGreaterThanOrEqual(faixaPara(t - 1).atributoPermanenteMax);
      expect(faixaPara(t).custoMax).toBeGreaterThanOrEqual(faixaPara(t - 1).custoMax);
    }
  });

  it("trata duração acima de 5 como a faixa mais alta", () => {
    expect(faixaPara(9)).toBe(faixaPara(5));
  });
});

describe("auditarCarta", () => {
  it("aprova uma carta dentro da faixa", () => {
    expect(auditarCarta(carta())).toEqual([]);
  });

  it("reprova carta sem ganho nenhum", () => {
    const muda = carta({
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["só sabor"], unlocks: [] },
    });
    expect(auditarCarta(muda)).toContain("não concede ganho nenhum");
  });

  it("reprova atributo permanente acima do que a duração permite", () => {
    const forte = carta({
      durationTurns: 3,
      completionEffects: {
        attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(auditarCarta(forte)).toContain("concede +2 em soldados, mas 3 turnos permitem no máximo +1");
  });

  it("reprova atributo permanente em carta curta demais", () => {
    const cedo = carta({ durationTurns: 2 });
    expect(auditarCarta(cedo)).toContain("concede +1 em soldados, mas 2 turnos permitem no máximo +0");
  });

  it("reprova custo fora da faixa", () => {
    const cara = carta({ durationTurns: 3, costs: [{ type: "WEALTH", amount: 4, timing: "ON_START" }] });
    expect(auditarCarta(cara)).toContain("custa 4 no total, mas 3 turnos pedem entre 1 e 2");
  });

  it("reprova efeito temporário, que o motor descarta em silêncio", () => {
    const temp = carta({
      completionEffects: {
        attributeChanges: [{ attribute: "soldados", amount: 1, permanent: false }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(temp && auditarCarta(temp)).toContain("promete efeito temporário em soldados, e o motor só aplica permanentes");
  });

  it("aceita carta curta que paga em ativo e desbloqueio", () => {
    const curta = carta({
      durationTurns: 2,
      costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
      completionEffects: {
        attributeChanges: [], favors: [], assets: ["Rede de Batedores"],
        qualitativeEffects: [], unlocks: ["criar-uma-rede-de-espioes"],
      },
    });
    expect(auditarCarta(curta)).toEqual([]);
  });
});

describe("resumoDoGanho", () => {
  it("escreve o atributo com sinal", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Soldados +2 permanente");
  });

  it("junta as moedas com separador", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "riqueza", amount: 1, permanent: true }],
      favors: [], assets: ["Estaleiro"], qualitativeEffects: [], unlocks: ["expandir-a-frota"],
    })).toBe("Riqueza +1 permanente · Ativo: Estaleiro · Abre 1 carta nova");
  });

  it("nunca devolve vazio, porque a tela precisa escrever alguma coisa", () => {
    expect(resumoDoGanho({
      attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Sem ganho mecânico");
  });

  it("escreve estabilidade negativa sem inventar sinal", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "stability", amount: -1, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Estabilidade -1 permanente");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectBalance.test.ts`
Expected: FAIL — `Failed to resolve import "./projectBalance.js"`

- [ ] **Step 3: Escrever o módulo**

Crie `shared/src/projectBalance.ts`:

```ts
import type { CompletionEffects, ProjectCard, ProjectTemplate } from "./projects.js";

/**
 * A regra de troca do jogo: o que uma carta pode cobrar e conceder, pela sua
 * duração. Antes disto a regra existia três vezes em prosa dentro dos prompts
 * de IA, e as três discordavam entre si. Este arquivo é a única cópia.
 *
 * Os números vêm da decisão do Mestre registrada na seção 2.1 da spec:
 * ganho de atributo a partir de 3 turnos, +2 a partir de 4, sem portão de
 * aprovação. A carta longa precisa oferecer sempre pelo menos o que a curta
 * oferece, senão ninguém escolhe a longa.
 */
export interface FaixaDeTroca {
  turnos: number;
  custoMin: number;
  custoMax: number;
  atributoPermanenteMax: number;
  resumo: string;
}

export const TABELA_DE_TROCA: FaixaDeTroca[] = [
  { turnos: 1, custoMin: 0, custoMax: 1, atributoPermanenteMax: 0, resumo: "efeito imediato pequeno: Estabilidade, um Favor ou um desbloqueio" },
  { turnos: 2, custoMin: 0, custoMax: 1, atributoPermanenteMax: 0, resumo: "um desbloqueio, um Favor ou um ativo pequeno" },
  { turnos: 3, custoMin: 1, custoMax: 2, atributoPermanenteMax: 1, resumo: "+1 permanente num atributo, ou um ativo nomeado com desbloqueio" },
  { turnos: 4, custoMin: 2, custoMax: 3, atributoPermanenteMax: 2, resumo: "+2 permanente num atributo, ou +1 com um ativo forte" },
  { turnos: 5, custoMin: 3, custoMax: 4, atributoPermanenteMax: 2, resumo: "+2 permanente num atributo, mais um ativo ou desbloqueio" },
];

/** Cartas mais longas que a tabela caem na faixa mais alta. */
export function faixaPara(turnos: number): FaixaDeTroca {
  const exata = TABELA_DE_TROCA.find((f) => f.turnos === turnos);
  if (exata) return exata;
  if (turnos < TABELA_DE_TROCA[0].turnos) return TABELA_DE_TROCA[0];
  return TABELA_DE_TROCA[TABELA_DE_TROCA.length - 1];
}

const NOMES: Record<string, string> = {
  riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados",
  controle: "Controle", stability: "Estabilidade",
};

function custoTotal(carta: ProjectTemplate | ProjectCard): number {
  return carta.costs.reduce((n, c) => n + c.amount, 0);
}

function temGanho(e: CompletionEffects): boolean {
  return e.attributeChanges.length > 0 || e.favors.length > 0 || e.assets.length > 0 || e.unlocks.length > 0;
}

/**
 * Devolve a lista de problemas de uma carta. Lista vazia quer dizer que a
 * carta respeita o trato. Usado pelo teste de auditoria da biblioteca e pelo
 * painel do Mestre.
 */
export function auditarCarta(carta: ProjectTemplate | ProjectCard): string[] {
  const problemas: string[] = [];
  const faixa = faixaPara(carta.durationTurns);
  const e = carta.completionEffects;

  if (!temGanho(e)) problemas.push("não concede ganho nenhum");

  for (const ch of e.attributeChanges) {
    if (!ch.permanent) {
      problemas.push(`promete efeito temporário em ${ch.attribute}, e o motor só aplica permanentes`);
      continue;
    }
    if (ch.amount > faixa.atributoPermanenteMax) {
      problemas.push(`concede +${ch.amount} em ${ch.attribute}, mas ${carta.durationTurns} turnos permitem no máximo +${faixa.atributoPermanenteMax}`);
    }
  }

  const total = custoTotal(carta);
  if (total < faixa.custoMin || total > faixa.custoMax) {
    problemas.push(`custa ${total} no total, mas ${carta.durationTurns} turnos pedem entre ${faixa.custoMin} e ${faixa.custoMax}`);
  }

  return problemas;
}

/**
 * O ganho da carta em uma linha, para a tela. Nunca devolve string vazia: uma
 * carta sem ganho precisa dizer isso em voz alta, que é o problema que este
 * trabalho inteiro ataca.
 */
export function resumoDoGanho(e: CompletionEffects): string {
  const partes: string[] = [];

  for (const ch of e.attributeChanges) {
    const nome = NOMES[ch.attribute] ?? ch.attribute;
    const sinal = ch.amount >= 0 ? "+" : "";
    partes.push(`${nome} ${sinal}${ch.amount} ${ch.permanent ? "permanente" : "temporário"}`);
  }
  for (const a of e.assets) partes.push(`Ativo: ${a}`);
  if (e.favors.length) partes.push(`${e.favors.length} Favor${e.favors.length > 1 ? "es" : ""}`);
  if (e.unlocks.length) partes.push(`Abre ${e.unlocks.length} carta${e.unlocks.length > 1 ? "s" : ""} nova${e.unlocks.length > 1 ? "s" : ""}`);

  return partes.length ? partes.join(" · ") : "Sem ganho mecânico";
}
```

- [ ] **Step 4: Exportar do índice**

Em `shared/src/index.ts`, logo depois da linha `export * from "./projectEngine.js";`, acrescente:

```ts
export * from "./projectBalance.js";
```

- [ ] **Step 5: Rodar os testes**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectBalance.test.ts`
Expected: PASS, 14 testes

- [ ] **Step 6: Conferir que nada quebrou e commitar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && npm test -w shared`
Expected: PASS, 180 testes (166 + 14)

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectBalance.ts shared/src/projectBalance.test.ts shared/src/index.ts
git commit -m "Cria a tabela de troca das cartas como fonte única

A regra que diz o que uma carta pode cobrar e conceder existia três vezes
em prosa dentro dos prompts de IA, e a terceira cópia contradizia as duas
primeiras sobre quantos turnos um ganho de atributo exige.

Agora é código, com teste, e um teste guarda a progressão: a carta longa
nunca pode oferecer menos que a curta.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: A auditoria das 65 cartas, vermelha de propósito

Esta task **termina com o teste falhando**, e isso é o esperado. Ela mede o tamanho do trabalho da Task 3. Não conserte as cartas aqui.

**Files:**
- Create: `shared/src/projectTemplates.balance.test.ts`

- [ ] **Step 1: Escrever a auditoria**

Crie `shared/src/projectTemplates.balance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES } from "./projectTemplates.js";
import { auditarCarta, faixaPara } from "./projectBalance.js";
import { ATTRIBUTE_KEYS } from "./types.js";

describe("a biblioteca respeita o trato", () => {
  it("nenhuma carta foge da sua faixa", () => {
    const ruins = DEFAULT_PROJECT_TEMPLATES
      .map((t) => ({ id: t.id, problemas: auditarCarta(t) }))
      .filter((r) => r.problemas.length > 0);
    const relatorio = ruins.map((r) => `  ${r.id}: ${r.problemas.join("; ")}`).join("\n");
    expect(relatorio).toBe("");
  });

  it("toda carta concede alguma coisa", () => {
    const mudas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const e = t.completionEffects;
      return !e.attributeChanges.length && !e.favors.length && !e.assets.length && !e.unlocks.length;
    });
    expect(mudas.map((t) => t.id)).toEqual([]);
  });

  it("todo desbloqueio aponta para uma carta que existe", () => {
    const ids = new Set(DEFAULT_PROJECT_TEMPLATES.map((t) => t.id));
    const quebrados: string[] = [];
    for (const t of DEFAULT_PROJECT_TEMPLATES) {
      for (const u of t.completionEffects.unlocks) {
        if (!ids.has(u)) quebrados.push(`${t.id} -> ${u}`);
      }
    }
    expect(quebrados).toEqual([]);
  });

  it("nenhuma carta desbloqueia a si mesma", () => {
    const bobas = DEFAULT_PROJECT_TEMPLATES.filter((t) => t.completionEffects.unlocks.includes(t.id));
    expect(bobas.map((t) => t.id)).toEqual([]);
  });
});

describe("o trato é alcançável de qualquer canto do mapa", () => {
  // Uma Casa que zera um atributo não pode ficar presa nele. Se toda carta que
  // concede Riqueza também custa Riqueza, quem chega a zero nunca mais sobe.
  // Foi exatamente o que aconteceu com a Casa Solarion.
  it.each(ATTRIBUTE_KEYS)("existe carta que dá %s sem cobrar %s", (attr) => {
    const saidas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const da = t.completionEffects.attributeChanges.some((c) => c.permanent && c.attribute === attr && c.amount > 0);
      const cobra = t.costs.some((c) => custoTocaAtributo(c.type, attr) && c.amount > 0);
      return da && !cobra && faixaPara(t.durationTurns).atributoPermanenteMax > 0;
    });
    expect(saidas.map((t) => t.id).length).toBeGreaterThan(0);
  });
});

/**
 * Os estados reais das três Casas em produção, colhidos do DynamoDB. Não é
 * fixture inventada: é o jogo como está. A Solarion com Riqueza 0 é a razão
 * deste bloco existir — ela conseguia iniciar 19 das 65 cartas e nenhuma delas
 * dava recompensa mecânica.
 */
const CASAS_REAIS = [
  { nome: "Do Ouro", attrs: { riqueza: 5, recursos: 1, soldados: 4, controle: 3 }, stability: 3 },
  { nome: "Khazdrun", attrs: { riqueza: 1, recursos: 1, soldados: 3, controle: 1 }, stability: 3 },
  { nome: "Solarion", attrs: { riqueza: 0, recursos: 3, soldados: 1, controle: 2 }, stability: 3 },
];

describe("nenhuma Casa em produção fica sem saída", () => {
  it.each(CASAS_REAIS)("$nome consegue iniciar alguma carta com recompensa", (casa) => {
    const alcancaveis = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const paga = t.costs.every((c) => {
        if (c.type === "STABILITY") return casa.stability >= c.amount;
        const attr = ATRIBUTO_DO_CUSTO[c.type];
        return attr ? (casa.attrs as Record<string, number>)[attr] >= c.amount : true;
      });
      const daGanho = t.completionEffects.attributeChanges.some((c) => c.permanent && c.amount > 0)
        || t.completionEffects.assets.length > 0;
      return paga && daGanho;
    });
    expect(alcancaveis.map((t) => t.id).length).toBeGreaterThan(0);
  });

  it.each(CASAS_REAIS)("$nome tem caminho para subir cada atributo que está em zero", (casa) => {
    const zerados = ATTRIBUTE_KEYS.filter((a) => (casa.attrs as Record<string, number>)[a] === 0);
    for (const attr of zerados) {
      const saidas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
        const da = t.completionEffects.attributeChanges.some((c) => c.permanent && c.attribute === attr && c.amount > 0);
        const paga = t.costs.every((c) => {
          if (c.type === "STABILITY") return casa.stability >= c.amount;
          const a = ATRIBUTO_DO_CUSTO[c.type];
          return a ? (casa.attrs as Record<string, number>)[a] >= c.amount : true;
        });
        return da && paga;
      });
      expect(saidas.map((t) => t.id), `${casa.nome} preso em ${attr}`).not.toEqual([]);
    }
  });
});

/** Qual atributo cada tipo de custo debita. */
const ATRIBUTO_DO_CUSTO: Record<string, string> = {
  WEALTH: "riqueza", RESOURCES: "recursos",
  SOLDIERS_COMMITTED: "soldados", CONTROL_COMMITTED: "controle",
};

function custoTocaAtributo(tipo: string, attr: string): boolean {
  return ATRIBUTO_DO_CUSTO[tipo] === attr;
}
```

- [ ] **Step 2: Rodar e registrar o estrago**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectTemplates.balance.test.ts`
Expected: **FAIL.** O primeiro teste imprime a lista de cartas fora da faixa (deve passar de 60 linhas), e o teste de alcance falha para pelo menos `riqueza`.

Guarde essa saída: é a lista de trabalho da Task 3.

- [ ] **Step 3: Commitar o teste vermelho**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectTemplates.balance.test.ts
git commit -m "Acrescenta a auditoria da biblioteca de cartas, vermelha de propósito

Das 65 cartas, 60 prometem em prosa efeitos que o motor não executa, e
nenhuma Casa que zera Riqueza consegue voltar a subir, porque toda carta
que concede Riqueza também cobra Riqueza.

O teste falha de propósito neste commit. A Task 3 do plano é o que o deixa
verde, e daí em diante ele impede a volta ao estado de hoje.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Retrofit das 65 cartas

O trabalho maior, e é curadoria. Trabalhe **por categoria**, commitando cada uma, para que a revisão seja possível.

**Files:**
- Modify: `shared/src/projectTemplates.ts`
- Modify: `shared/src/projectTemplates.test.ts` (o teste que fixa o efeito de `abrir-uma-nova-mina` pode precisar de ajuste)

**Regras de edição, para não estragar o que já está escrito:**

1. **Não mude `title`, `description` nem `category`.** O texto é do Mestre.
2. **`durationTurns` só muda se o custo não couber na faixa de jeito nenhum.** Prefira ajustar o custo.
3. **`qualitativeEffects` deixa de carregar promessa mecânica.** Uma promessa como "+1 Soldados temporário por 2 turnos" vira uma de três coisas: efeito real, texto de sabor sem número, ou some.
4. **`Recrutar Companhias Errantes` fica em 3 turnos com +1 Soldados** (decisão 2 do Mestre). É a carta de referência da faixa de 3.
5. **Desbloqueios formam corrente dentro da mesma categoria.** Carta curta abre carta longa.

- [ ] **Step 1: Rodar a auditoria e listar o trabalho por categoria**

Run:
```bash
cd /Users/jessicarosa/turnbasedrpg && node --input-type=module -e '
const { DEFAULT_PROJECT_TEMPLATES: T } = await import("./shared/dist/projectTemplates.js");
const { auditarCarta } = await import("./shared/dist/projectBalance.js");
const porCat = {};
for (const t of T) {
  const p = auditarCarta(t);
  if (!p.length) continue;
  (porCat[t.category] ??= []).push(`${t.id} (${t.durationTurns}t): ${p.join("; ")}`);
}
for (const [c, l] of Object.entries(porCat)) console.log(`\n### ${c} (${l.length})\n` + l.join("\n"));
'
```
Expected: a lista por categoria. É o roteiro dos passos seguintes.

- [ ] **Step 2: MILITARY (12 cartas)**

Exemplo de como uma carta muda. `treinar-a-milicia-popular` hoje:

```ts
  {
    id: "treinar-a-milicia-popular",
    title: "Treinar a Milícia Popular",
    category: "MILITARY",
    durationTurns: 2,
    costs: [r(1)],
    requirements: [],
    description: "…",
    completionEffects: ce({
      assets: ["Milícia Local"],
      qualitativeEffects: [
        "Concede o ativo 'Milícia Local': bônus defensivo no território.",
        "Não aumenta Soldados permanentemente.",
      ],
    }),
    risks: [...],
    requiresTargetApproval: false,
    requiresGmApproval: false,
  },
```

Vira:

```ts
  {
    id: "treinar-a-milicia-popular",
    title: "Treinar a Milícia Popular",
    category: "MILITARY",
    durationTurns: 2,
    costs: [r(1)],
    requirements: [],
    description: "…",
    completionEffects: ce({
      assets: ["Milícia Local"],
      unlocks: ["formar-uma-guarda-de-elite"],
      qualitativeEffects: ["Gente da terra, armada e treinada o bastante para segurar uma porta."],
    }),
    risks: [...],
    requiresTargetApproval: false,
    requiresGmApproval: false,
  },
```

O que mudou: ganhou `unlocks`, e o `qualitativeEffects` perdeu a promessa mecânica ("bônus defensivo", "não aumenta Soldados") e virou sabor.

E `contratar-uma-companhia-mercenaria`, que promete efeito temporário que o motor descarta, passa a pagar em ativo:

```ts
    completionEffects: ce({
      assets: ["Companhia Mercenária"],
      qualitativeEffects: ["Lanças pagas, leais enquanto o cofre estiver aberto."],
    }),
```

Aplique o mesmo raciocínio nas 12. Cartas de 4 e 5 turnos ganham `attributeChanges` de até +2.

**Uma carta militar de 4+ turnos precisa conceder `soldados` sem custar `sol(...)`** — é o que o teste de alcance cobra. `expandir-a-frota` (5 turnos) é a candidata natural, custeada em `r()` e `w()`.

- [ ] **Step 3: Rodar a auditoria só de MILITARY**

Run:
```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && node --input-type=module -e '
const { DEFAULT_PROJECT_TEMPLATES: T } = await import("./shared/dist/projectTemplates.js");
const { auditarCarta } = await import("./shared/dist/projectBalance.js");
const m = T.filter((t) => t.category === "MILITARY").map((t) => [t.id, auditarCarta(t)]).filter(([, p]) => p.length);
console.log(m.length ? m.map(([i, p]) => `${i}: ${p.join("; ")}`).join("\n") : "MILITARY limpa");
'
```
Expected: `MILITARY limpa`

- [ ] **Step 4: Commitar MILITARY**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectTemplates.ts
git commit -m "Dá recompensa real às 12 cartas militares

As promessas em prosa que o motor não cumpria viram efeito de verdade ou
sabor sem número. As cartas curtas passam a abrir as longas, e Expandir a
Frota concede soldados sem cobrar soldados, para que uma Casa sem exército
tenha por onde começar.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 5: Repetir para as outras sete categorias**

Uma de cada vez, com a mesma sequência editar → auditar → commitar. A ordem sugerida, da mais quebrada para a menos:

1. `DIPLOMACY` (12 cartas, 0 com atributo) — categoria natural para `favors`
2. `INTELLIGENCE` (11) — categoria natural para `unlocks`, informação abre porta
3. `SOCIETY` (10) — categoria natural para `stability`
4. `INFRASTRUCTURE` (8) — as longas concedem `recursos` e `controle`
5. `EXPLORATION` (5) — `unlocks` e ativos
6. `ECONOMY` (4) — já tem 3 das 5 cartas com atributo; a que falta precisa conceder `riqueza` **sem custar `w()`**, que é o que destrava Solarion
7. `MAGIC` (3) — ativos nomeados

A mensagem de commit de cada uma segue o padrão do Step 4: o que mudou e por quê, em português.

- [ ] **Step 6: A auditoria inteira fica verde**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && npx vitest run --root shared src/projectTemplates.balance.test.ts`
Expected: PASS, 8 testes

- [ ] **Step 7: A suíte do shared inteira**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test -w shared`
Expected: PASS. Se `projectTemplates.test.ts` falhar no teste que fixa `abrir-uma-nova-mina`, atualize a expectativa para o efeito novo — é um teste de fixação, não de regra.

- [ ] **Step 8: Commitar o fechamento**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectTemplates.ts shared/src/projectTemplates.test.ts
git commit -m "Fecha o retrofit: as 65 cartas cumprem o trato

A auditoria da Task 2 fica verde. Daqui em diante nenhuma carta nova entra
na biblioteca sem dizer o que dá.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: A cascata de teto no motor

Hoje `applyCompletion` faz `clamp` e joga fora o excedente sem avisar. A Casa do Ouro, com Riqueza 5, concluiria uma carta de cinco turnos e não receberia nada.

**Files:**
- Modify: `shared/src/projectEngine.ts:39-63`
- Create: `shared/src/projectEngine.teto.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `shared/src/projectEngine.teto.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyCompletion } from "./projectEngine.js";
import type { House } from "./types.js";
import type { ProjectCard } from "./projects.js";

function casa(over: Partial<House> = {}): House {
  return {
    id: "casa-teste", campaignId: "winter-dead", name: "Casa de Teste",
    leaderName: "Alguém", castleName: "Algum Lugar",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
    stability: 3,
    ...over,
  } as House;
}

function projeto(attribute: string, amount: number): ProjectCard {
  return {
    id: "p1", title: "Projeto de Teste", durationTurns: 4, turnsCompleted: 4,
    costs: [],
    completionEffects: {
      attributeChanges: [{ attribute, amount, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    },
  } as unknown as ProjectCard;
}

describe("applyCompletion no teto", () => {
  it("aplica normalmente quando cabe", () => {
    const r = applyCompletion(casa(), projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(3);
    expect(r.conversoes).toEqual([]);
  });

  it("converte em Estabilidade o que não cabe no atributo", () => {
    const r = applyCompletion(casa({ attributes: { riqueza: 4, recursos: 3, soldados: 2, controle: 2 } }), projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(4); // 1 ponto sobrou e virou Estabilidade
    expect(r.conversoes).toEqual(["Riqueza já estava no teto: 1 ponto virou Estabilidade."]);
  });

  it("converte em ativo quando Estabilidade também está no teto", () => {
    const cheia = casa({ attributes: { riqueza: 5, recursos: 3, soldados: 2, controle: 2 }, stability: 5 });
    const r = applyCompletion(cheia, projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(5);
    expect(r.assetsAdded).toEqual(["Projeto de Teste"]);
    expect(r.conversoes).toEqual(["Riqueza e Estabilidade já estavam no teto: o ganho virou o ativo 'Projeto de Teste'."]);
  });

  it("nunca devolve conclusão vazia quando a carta prometia ganho", () => {
    const cheia = casa({ attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 }, stability: 5 });
    const r = applyCompletion(cheia, projeto("soldados", 2));
    const mudouAlgo = r.assetsAdded.length > 0 || r.favorsToCreate.length > 0;
    expect(mudouAlgo).toBe(true);
  });

  it("perda de Estabilidade continua funcionando e não vira conversão", () => {
    const r = applyCompletion(casa(), projeto("stability", -1));
    expect(r.house.stability).toBe(2);
    expect(r.conversoes).toEqual([]);
  });

  it("segue ignorando efeito temporário, que é o que a auditoria já proíbe", () => {
    const p = projeto("riqueza", 2);
    p.completionEffects.attributeChanges[0].permanent = false;
    const r = applyCompletion(casa(), p);
    expect(r.house.attributes.riqueza).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectEngine.teto.test.ts`
Expected: FAIL — `r.conversoes` é `undefined`

- [ ] **Step 3: Implementar a cascata**

Em `shared/src/projectEngine.ts`, substitua as linhas 39 a 63 por:

```ts
export interface CompletionResult {
  house: House;
  favorsToCreate: FavorEffect[];
  assetsAdded: string[];
  /** O que não coube no teto e para onde foi. Vazio quando tudo coube. */
  conversoes: string[];
}

const NOMES_ATRIBUTO: Record<string, string> = {
  riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados",
  controle: "Controle", stability: "Estabilidade",
};

/**
 * Aplica o ganho da carta, convertendo o que não couber em vez de descartar.
 *
 * Antes, um ganho que batia no teto sumia num clamp silencioso: a Casa do Ouro,
 * com Riqueza 5, concluía um projeto de cinco turnos e não recebia nada. Como o
 * Mestre tirou o portão de aprovação do +2, esta cascata passou a ser o freio de
 * inflação do jogo: quem chega ao teto para de crescer em número e passa a
 * crescer em ativo nomeado, que é onde o Mestre tem controle narrativo.
 *
 * A ordem é atributo → estabilidade → ativo, e o ativo não tem teto, então
 * sempre sobra para onde ir.
 */
export function applyCompletion(house: House, project: ProjectCard): CompletionResult {
  const attrs: Attributes = { ...house.attributes };
  let stability = houseStability(house);
  const conversoes: string[] = [];
  const assetsAdded = [...project.completionEffects.assets];

  for (const ch of project.completionEffects.attributeChanges) {
    if (!ch.permanent) continue;

    if (ch.attribute === "stability") {
      stability = clamp(stability + ch.amount, STABILITY_MIN, STABILITY_MAX);
      continue;
    }

    const antes = attrs[ch.attribute];
    attrs[ch.attribute] = clamp(antes + ch.amount, ATTR_MIN, ATTR_MAX);
    let sobra = ch.amount - (attrs[ch.attribute] - antes);
    if (sobra <= 0) continue;

    const nome = NOMES_ATRIBUTO[ch.attribute] ?? ch.attribute;
    const estAntes = stability;
    stability = clamp(stability + sobra, STABILITY_MIN, STABILITY_MAX);
    const absorvido = stability - estAntes;
    sobra -= absorvido;

    if (absorvido > 0) {
      conversoes.push(`${nome} já estava no teto: ${absorvido} ponto${absorvido > 1 ? "s" : ""} virou Estabilidade.`);
    }
    if (sobra > 0) {
      assetsAdded.push(project.title);
      conversoes.push(`${nome} e Estabilidade já estavam no teto: o ganho virou o ativo '${project.title}'.`);
    }
  }

  const assets = [...(house.assets ?? []), ...assetsAdded];
  return {
    house: { ...house, attributes: attrs, stability, assets },
    favorsToCreate: project.completionEffects.favors,
    assetsAdded,
    conversoes,
  };
}
```

- [ ] **Step 4: Rodar os testes do teto**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root shared src/projectEngine.teto.test.ts`
Expected: PASS, 6 testes

- [ ] **Step 5: Conferir que o backend não quebrou**

`CompletionResult` ganhou um campo, o que é aditivo, mas `processTurn.ts:35` desestrutura o retorno.

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && npm test -w backend`
Expected: PASS, 732 testes

- [ ] **Step 6: Commitar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/projectEngine.ts shared/src/projectEngine.teto.test.ts
git commit -m "Converte o ganho que não cabe no teto em vez de descartar

A Casa do Ouro está com Riqueza 5. Do jeito que estava, ela concluiria um
projeto de cinco turnos e o ganho sumiria num clamp silencioso, que é a
mesma promessa quebrada que este trabalho inteiro ataca.

Agora a ordem é atributo, estabilidade, ativo. Como o Mestre tirou o portão
de aprovação do +2, esta cascata virou o freio de inflação do jogo: quem
chega ao teto passa a crescer em ativo nomeado em vez de número.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: O jogador vê a conversão na conclusão

De nada adianta converter se ninguém contar ao jogador.

**Files:**
- Modify: `backend/src/projects/processTurn.ts:34-46`
- Modify: `backend/src/projects/processTurn.test.ts`

- [ ] **Step 1: Escrever o teste**

Acrescente ao fim de `backend/src/projects/processTurn.test.ts` (dentro do `describe` existente, ou num novo `describe` no fim do arquivo):

```ts
describe("conversão de teto na narrativa", () => {
  it("conta ao jogador quando o ganho não coube", async () => {
    // Casa com Riqueza no teto concluindo carta que dá Riqueza: o ganho vira
    // Estabilidade, e o jogador precisa ler isso.
    const casaCheia = { ...casaBase, attributes: { ...casaBase.attributes, riqueza: 5 }, stability: 3 };
    const carta = {
      ...cartaBase,
      durationTurns: 1, turnsCompleted: 0, status: "ACTIVE" as const,
      title: "Expandir o Porto",
      completionEffects: {
        attributeChanges: [{ attribute: "riqueza" as const, amount: 2, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    };
    const gravados: ProjectCard[] = [];
    await processProjectsForTurn({
      ...depsBase,
      listCampaignProjects: async () => [carta],
      getHouse: async () => casaCheia,
      putProject: async (p) => { gravados.push(p); },
    }, "winter-dead", 7);

    expect(gravados[0].outcomeNarrative).toContain("Riqueza já estava no teto");
  });

  it("não polui a narrativa quando o ganho coube inteiro", async () => {
    const carta = {
      ...cartaBase,
      durationTurns: 1, turnsCompleted: 0, status: "ACTIVE" as const,
      completionEffects: {
        attributeChanges: [{ attribute: "riqueza" as const, amount: 1, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    };
    const gravados: ProjectCard[] = [];
    await processProjectsForTurn({
      ...depsBase,
      listCampaignProjects: async () => [carta],
      getHouse: async () => casaBase,
      putProject: async (p) => { gravados.push(p); },
    }, "winter-dead", 7);

    expect(gravados[0].outcomeNarrative ?? "").not.toContain("teto");
  });

  it("não aplica o ganho duas vezes se o mesmo turno for processado de novo", async () => {
    // `processProjectForTurn` já é idempotente por `lastProcessedTurnId`, mas
    // agora a conclusão mexe em ativos além de atributos. Um ativo duplicado
    // não é revertível pelo clamp, então vale prender o comportamento.
    const carta = {
      ...cartaBase,
      durationTurns: 1, turnsCompleted: 0, status: "ACTIVE" as const,
      completionEffects: {
        attributeChanges: [{ attribute: "riqueza" as const, amount: 1, permanent: true }],
        favors: [], assets: ["Porto Novo"], qualitativeEffects: [], unlocks: [],
      },
    };
    const attrsGravados: unknown[] = [];
    const ativosGravados: string[][] = [];
    let estado = carta;
    const deps = {
      ...depsBase,
      listCampaignProjects: async () => [estado],
      getHouse: async () => casaBase,
      putProject: async (p: ProjectCard) => { estado = p as typeof carta; },
      updateHouseAttributes: async (_id: string, a: unknown) => { attrsGravados.push(a); },
      updateHouseStabilityAndAssets: async (_id: string, _s: number, a: string[]) => { ativosGravados.push(a); },
    };

    await processProjectsForTurn(deps, "winter-dead", 7);
    await processProjectsForTurn(deps, "winter-dead", 7);

    expect(attrsGravados).toHaveLength(1);
    expect(ativosGravados).toEqual([["Porto Novo"]]);
  });
});
```

Se `casaBase`, `cartaBase` ou `depsBase` não existirem com esses nomes no arquivo, use os helpers que já estiverem lá — o teste depende do comportamento, não dos nomes.

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/projects/processTurn.test.ts -t "teto"`
Expected: FAIL — a narrativa não menciona o teto

- [ ] **Step 3: Implementar**

Em `backend/src/projects/processTurn.ts`, na linha 35, troque:

```ts
          const { house: nextHouse, favorsToCreate } = applyCompletion(house, advanced);
```

por:

```ts
          const { house: nextHouse, favorsToCreate, conversoes } = applyCompletion(house, advanced);
```

E na linha 49, troque:

```ts
        advanced.outcomeNarrative = verdict.narrative || null;
```

por:

```ts
        // A conversão de teto precisa chegar ao jogador: um ganho que virou
        // outra coisa em silêncio é a mesma promessa quebrada de antes.
        const aviso = verdict.success && conversoes.length ? conversoes.join(" ") : "";
        const narrativa = [verdict.narrative, aviso].filter(Boolean).join("\n\n");
        advanced.outcomeNarrative = narrativa || null;
```

`conversoes` só existe dentro do `if (verdict.success)`. Declare-a antes, junto de `now`:

```ts
        const now = new Date().toISOString();
        let conversoes: string[] = [];
        if (verdict.success) {
          const r = applyCompletion(house, advanced);
          conversoes = r.conversoes;
          await deps.updateHouseAttributes(advanced.houseId, r.house.attributes);
          await deps.updateHouseStabilityAndAssets(advanced.houseId, r.house.stability ?? 3, r.house.assets ?? []);
          for (const fe of r.favorsToCreate) {
```

Ajuste o corpo do `for` para usar `fe` como já usa.

- [ ] **Step 4: Rodar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test -w backend`
Expected: PASS, 734 testes

- [ ] **Step 5: Commitar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/projects/processTurn.ts backend/src/projects/processTurn.test.ts
git commit -m "Conta ao jogador quando o ganho não coube no teto

Converter em silêncio seria trocar uma promessa quebrada por outra. A
conclusão passa a dizer para onde o ganho foi.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: A regra da IA passa a vir da tabela

Hoje a regra está três vezes em `projectPrompts.ts`, e a terceira contradiz as duas primeiras.

**Files:**
- Modify: `backend/src/ai/projectPrompts.ts:26-31, 76-81, 119`
- Modify: `backend/src/ai/projectPrompts.test.ts`

- [ ] **Step 1: Escrever o teste**

Acrescente a `backend/src/ai/projectPrompts.test.ts`:

```ts
import { TABELA_DE_TROCA } from "@ravenloft/content";

describe("a regra de balanceamento vem da tabela", () => {
  it("o prompt cita cada faixa da tabela", () => {
    const { system } = buildProjectCardPrompt(casaExemplo, "cânone", { request: "quero um exército" });
    for (const f of TABELA_DE_TROCA) {
      expect(system).toContain(`${f.turnos} turno`);
      expect(system).toContain(f.resumo);
    }
  });

  it("não sobrou nenhuma cópia da regra escrita à mão", async () => {
    // Havia três cópias em prosa neste arquivo, e a terceira discordava das
    // outras duas sobre quantos turnos um ganho de atributo exige.
    const fonte = await readFile(new URL("./projectPrompts.ts", import.meta.url), "utf8");
    expect(fonte).not.toContain("ativo permanente ou +1 atributo");
  });

  it("o teto do prompt bate com o da tabela", () => {
    const { system } = buildProjectCardPrompt(casaExemplo, "cânone", { request: "quero um exército" });
    const maior = Math.max(...TABELA_DE_TROCA.map((f) => f.atributoPermanenteMax));
    expect(system).toContain(`Nenhuma carta concede mais de +${maior} permanente num atributo`);
  });
});
```

Acrescente `import { readFile } from "node:fs/promises";` no topo. Use o helper de Casa que o arquivo já tiver; se não houver, monte um objeto `House` mínimo como no teste da Task 4.

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run --root backend src/ai/projectPrompts.test.ts -t "tabela"`
Expected: FAIL

- [ ] **Step 3: Implementar**

No topo de `backend/src/ai/projectPrompts.ts`, junto dos outros imports de `@ravenloft/content`, acrescente `TABELA_DE_TROCA`. Depois dos imports, acrescente:

```ts
/**
 * A regra de troca escrita para a IA, gerada da tabela de `@ravenloft/content`.
 * Antes havia três cópias em prosa neste arquivo, e a terceira contradizia as
 * outras duas. Agora a regra muda num lugar só.
 */
const REGRAS_DE_BALANCEAMENTO = [
  "Regras de balanceamento:",
  ...TABELA_DE_TROCA.map(
    (f) => `- ${f.turnos} turno${f.turnos > 1 ? "s" : ""}: ${f.resumo}, custo ${f.custoMin}-${f.custoMax}.`,
  ),
  `- Nenhuma carta concede mais de +${Math.max(...TABELA_DE_TROCA.map((f) => f.atributoPermanenteMax))} permanente num atributo.`,
  "- Um aumento de atributo permanente exige pelo menos " +
    `${TABELA_DE_TROCA.find((f) => f.atributoPermanenteMax > 0)?.turnos ?? 3} turnos.`,
  "- Toda carta precisa conceder alguma coisa: atributo, Estabilidade, ativo nomeado, Favor ou desbloqueio de outra carta.",
  "- Efeitos temporários não são aplicados pelo motor. Não prometa nenhum.",
].join("\n");
```

Nos três lugares (`:26-31`, `:76-81`, `:119`), apague as linhas de regra escritas à mão e interpole `${REGRAS_DE_BALANCEAMENTO}` no template literal. As três cópias hoje são:

- `:26-31` e `:76-81` — a lista de "1 turno / 2 turnos / … / 6+ turnos", idênticas entre si
- `:119` — a versão resumida numa linha só, que diz "3-4 turnos: ativo permanente ou +1 atributo" e **contradiz** as outras duas, que exigem 4 turnos

As linhas vizinhas que **não** são a tabela de troca — a de aprovação do Mestre, a de Favores, a de riscos, a de slots — ficam como estão.

- [ ] **Step 4: Rodar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test -w backend`
Expected: PASS

- [ ] **Step 5: Commitar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/ai/projectPrompts.ts backend/src/ai/projectPrompts.test.ts
git commit -m "A regra que a IA recebe passa a vir da tabela de troca

Eram três cópias em prosa no mesmo arquivo, e a terceira dizia que ganho de
atributo cabe em 3 turnos enquanto as outras duas exigiam 4. Dependendo de
qual prompt rodasse, a IA recebia regras diferentes.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: A tela mostra o trato inteiro

**Files:**
- Modify: `frontend/src/components/HouseProjectsPanel.tsx`
- Create: `frontend/src/components/HouseProjectsPanel.ganho.test.tsx`

- [ ] **Step 1: Escrever o teste**

Crie `frontend/src/components/HouseProjectsPanel.ganho.test.tsx`. Siga o padrão de montagem dos outros testes de componente da pasta (provider de API mockada + `render`). O teste precisa cobrir:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

describe("HouseProjectsPanel mostra o ganho", () => {
  it("escreve o ganho ao lado do custo na biblioteca", async () => {
    // A carta da biblioteca precisa dizer o que dá, senão o jogador escolhe
    // às cegas — que era o estado antes deste trabalho.
    renderComCartas([cartaComGanho({ title: "Abrir uma Nova Mina", ganho: "Recursos +1 permanente" })]);
    expect(await screen.findByText(/Ganho: Recursos \+1 permanente/)).toBeInTheDocument();
  });

  it("separa o que o motor garante do que o Mestre honra narrando", async () => {
    renderComCartas([cartaComGanho({
      title: "Criar uma Rede de Batedores",
      ganho: "Ativo: Rede de Batedores",
      sabor: ["Informação antecipada sobre movimentos de tropa."],
    })]);
    expect(await screen.findByText(/Garantido:/)).toBeInTheDocument();
    expect(await screen.findByText(/O Mestre honra na narrativa:/)).toBeInTheDocument();
  });

  it("mostra no projeto ativo o que está sendo construído", async () => {
    renderComProjetoAtivo({ title: "Construir um Aqueduto", ganho: "Recursos +2 permanente" });
    expect(await screen.findByText(/Ao concluir: Recursos \+2 permanente/)).toBeInTheDocument();
  });

  it("avisa do teto sem desabilitar o botão", async () => {
    // Decisão 4 do Mestre: o jogador nunca é impedido de usar a carta.
    renderComCartas([cartaComGanho({ title: "Expandir o Porto", ganho: "Riqueza +2 permanente" })], { riqueza: 5 });
    expect(await screen.findByText(/já está no teto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeEnabled();
  });
});
```

Escreva os helpers `renderComCartas`, `cartaComGanho` e `renderComProjetoAtivo` seguindo o que os testes vizinhos já fazem para mockar `useApi`.

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg/frontend && npx vitest run src/components/HouseProjectsPanel.ganho.test.tsx`
Expected: FAIL

- [ ] **Step 3: A rota passa a mandar os atributos**

O aviso de teto precisa saber quanto a Casa tem, e o `ProjectsView` de hoje não carrega isso — só `slotLimit` e `stability`.

Em `frontend/src/types/api.ts`, dentro de `interface ProjectsView` (linha 44), acrescente depois de `stability: number;`:

```ts
  attributes: { riqueza: number; recursos: number; soldados: number; controle: number };
```

Em `backend/src/routes/projectRoutes.ts`, na resposta que já devolve `slotLimit` e `stability` (por volta da linha 73), acrescente ao mesmo objeto:

```ts
    attributes: house.attributes,
```

`house` já está em mãos naquele escopo — é o mesmo objeto de onde `stability` sai. Ajuste também os mocks de `ProjectsView` que os testes de frontend montarem, senão o typecheck da Step 6 reclama.

- [ ] **Step 4: Implementar a tela**

Em `frontend/src/components/HouseProjectsPanel.tsx`, no topo, importe da lib compartilhada:

```tsx
import { resumoDoGanho } from "@ravenloft/content";
```

Depois de `costLabel` (linha 34), acrescente:

```tsx
/** Quais atributos desta carta a Casa já não consegue absorver. */
function atributosNoTeto(efeitos: ProjectTemplate["completionEffects"], attrs: Record<string, number> | undefined): string[] {
  if (!attrs) return [];
  const nomes: Record<string, string> = { riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados", controle: "Controle" };
  return efeitos.attributeChanges
    .filter((c) => c.permanent && c.amount > 0 && c.attribute !== "stability" && (attrs[c.attribute] ?? 0) >= 5)
    .map((c) => nomes[c.attribute] ?? c.attribute);
}
```

Troque a linha 99 por:

```tsx
        <Typography variant="caption" display="block">Duração: {t.durationTurns} turnos · Custo: {costLabel(t.costs)}</Typography>
        <Typography variant="caption" display="block" color="success.main">Ganho: {resumoDoGanho(t.completionEffects)}</Typography>
        {t.completionEffects.qualitativeEffects.length > 0 && (
          <Typography variant="caption" display="block" color="text.secondary">
            O Mestre honra na narrativa: {t.completionEffects.qualitativeEffects.join(" ")}
          </Typography>
        )}
        {atributosNoTeto(t.completionEffects, data?.attributes).map((nome) => (
          <Typography key={nome} variant="caption" display="block" color="warning.main">
            Sua {nome} já está no teto; este ganho virá como Estabilidade.
          </Typography>
        ))}
```

Troque a linha 101 (o `confirm`) por:

```tsx
          onClick={() => { if (confirm(`Iniciar "${t.title}"?\n\nCusto: ${costLabel(t.costs)}\nGanho ao concluir: ${resumoDoGanho(t.completionEffects)}`)) void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id })); }}>
```

No bloco do projeto ativo, logo abaixo de `<Typography variant="caption">{p.turnsCompleted} de {p.durationTurns} turnos</Typography>`, acrescente:

```tsx
                  <Typography variant="caption" display="block" color="success.main">
                    Ao concluir: {resumoDoGanho(p.completionEffects)}
                  </Typography>
```

No bloco dos concluídos, junto de `outcomeNarrative`, acrescente a mesma linha com o rótulo `Recebido:` — mas só quando `p.outcome === "SUCCESS"`, porque um projeto que fracassou não entregou nada:

```tsx
                  {p.outcome === "SUCCESS" && (
                    <Typography variant="caption" display="block" color="success.main">
                      Recebido: {resumoDoGanho(p.completionEffects)}
                    </Typography>
                  )}
```

Agora que a Step 3 acrescentou `attributes` ao `ProjectsView`, `data?.attributes` está tipado. É o mesmo objeto `house.attributes` que a rota tem em mãos.

- [ ] **Step 5: Rodar**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && cd frontend && npx vitest run`
Expected: PASS, 309 testes

- [ ] **Step 6: Typecheck**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w frontend`
Expected: sem erro

- [ ] **Step 7: Commitar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add frontend/src/components/HouseProjectsPanel.tsx frontend/src/components/HouseProjectsPanel.ganho.test.tsx frontend/src/types/api.ts backend/src/routes/projectRoutes.ts
git commit -m "Mostra o ganho da carta ao lado do custo

O jogador via título, descrição, duração e custo, e nada sobre o que ia
ganhar. Foi por isso que o Mestre pediu uma carta de recrutar exército que
já existia há meses.

O ganho garantido pelo motor aparece separado do que o Mestre honra na
narrativa, e o aviso de teto informa sem desabilitar o botão.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Migrar as três cartas já em jogo

Decisão 5 do Mestre. São linhas `PROJECT#` no DynamoDB de produção, com progresso já andado.

**Files:**
- Create: `backend/scripts/migrar-efeitos-cartas-ativas.mjs`
- Create: `backend/scripts/migrar-efeitos-cartas-ativas.test.mjs`

**Convenções de script deste repositório (todas obrigatórias):**

- Exportar os helpers, para o teste irmão importar
- Ensaio por padrão, `--confirm` para gravar
- Backup **com a hora no nome** (nome fixo faz a segunda rodada apagar o desfazer da primeira)
- Idempotente: rodar duas vezes não muda nada na segunda
- Guarda de execução: `process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`
- Rodar de dentro de `backend/`, senão o `@aws-sdk` não resolve
- Tabela `ravenloft-game`, chaves **`PK`/`SK` maiúsculas**, PK `CAMPAIGN#WINTER_DEAD`

- [ ] **Step 1: Ver o estado real antes de escrever**

Run:
```bash
cd /Users/jessicarosa/turnbasedrpg/backend && cat > /tmp/ver.cjs <<'EOF'
const {DynamoDBClient}=require("@aws-sdk/client-dynamodb");
const {DynamoDBDocumentClient,QueryCommand}=require("@aws-sdk/lib-dynamodb");
const d=DynamoDBDocumentClient.from(new DynamoDBClient({region:"us-east-1"}));
d.send(new QueryCommand({TableName:"ravenloft-game",KeyConditionExpression:"PK = :p AND begins_with(SK, :s)",ExpressionAttributeValues:{":p":"CAMPAIGN#WINTER_DEAD",":s":"PROJECT#"}})).then(r=>{
 for(const p of r.Items) console.log(JSON.stringify({SK:p.SK,title:p.title,status:p.status,turnos:`${p.turnsCompleted}/${p.durationTurns}`,templateId:p.templateId,efeitos:p.completionEffects},null,1));
});
EOF
cp /tmp/ver.cjs ./ver-tmp.cjs && node ver-tmp.cjs; rm -f ver-tmp.cjs /tmp/ver.cjs
```
Expected: quatro projetos, três `ACTIVE`. Anote o `SK` e o `templateId` de cada.

- [ ] **Step 2: Escrever o teste**

Crie `backend/scripts/migrar-efeitos-cartas-ativas.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES, auditarCarta } from "../../shared/dist/index.js";
import { EFEITOS_NOVOS, migrarProjeto } from "./migrar-efeitos-cartas-ativas.mjs";

/** Um projeto como o banco o guarda hoje: sem ganho nenhum. */
function projetoAntigo(over = {}) {
  return {
    SK: "PROJECT#p1", title: "Fundar uma Academia de Oficiais",
    templateId: "fundar-uma-academia-de-oficiais",
    status: "ACTIVE", durationTurns: 5, turnsCompleted: 3,
    costs: [{ type: "WEALTH", amount: 2, timing: "ON_START" }],
    completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["texto antigo"], unlocks: [] },
    ...over,
  };
}

describe("migrarProjeto", () => {
  it("dá ao projeto o efeito novo", () => {
    const novo = migrarProjeto(projetoAntigo());
    expect(novo.completionEffects.attributeChanges.length).toBeGreaterThan(0);
  });

  it("não encosta no custo, na duração nem no progresso", () => {
    // O jogador já pagou o custo antigo e planejou em cima da duração antiga.
    // Mudar o preço de algo já comprado é quebra de contrato.
    const antes = projetoAntigo();
    const novo = migrarProjeto(antes);
    expect(novo.costs).toEqual(antes.costs);
    expect(novo.durationTurns).toBe(antes.durationTurns);
    expect(novo.turnsCompleted).toBe(antes.turnsCompleted);
  });

  it("é idempotente", () => {
    const uma = migrarProjeto(projetoAntigo());
    expect(migrarProjeto(uma)).toEqual(uma);
  });

  it("recusa projeto que não está no plano, em vez de inventar efeito", () => {
    expect(() => migrarProjeto(projetoAntigo({ SK: "PROJECT#desconhecido", templateId: "nao-existe", title: "Outra Coisa" })))
      .toThrow(/não está no plano de migração/);
  });

  it("cada efeito novo respeita a faixa da duração do projeto", () => {
    for (const [sk, def] of Object.entries(EFEITOS_NOVOS)) {
      const problemas = auditarCarta({
        durationTurns: def.durationTurns,
        costs: def.costs,
        completionEffects: def.completionEffects,
      });
      // O custo é o que o jogador já pagou e não muda; só o ganho é auditado.
      const soDoGanho = problemas.filter((p) => !p.startsWith("custa "));
      expect(soDoGanho, `${sk}`).toEqual([]);
    }
  });

  it("o efeito da carta de biblioteca bate com o do template", () => {
    // Quem tem templateId deve receber exatamente o que a biblioteca passou a
    // oferecer, senão o mesmo projeto vale coisas diferentes para pessoas
    // diferentes.
    for (const def of Object.values(EFEITOS_NOVOS)) {
      if (!def.templateId) continue;
      const t = DEFAULT_PROJECT_TEMPLATES.find((x) => x.id === def.templateId);
      expect(def.completionEffects).toEqual(t.completionEffects);
    }
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `cd /Users/jessicarosa/turnbasedrpg/backend && npx vitest run scripts/migrar-efeitos-cartas-ativas.test.mjs`
Expected: FAIL — módulo não existe

- [ ] **Step 4: Escrever o script**

Crie `backend/scripts/migrar-efeitos-cartas-ativas.mjs`. Preencha `EFEITOS_NOVOS` com os `SK` reais do Step 1:

```js
/**
 * Dá recompensa às cartas que já estavam em jogo quando a regra mudou.
 *
 * As três cartas ativas em produção foram criadas antes de a biblioteca passar
 * a prometer ganho, e terminariam entregando só narrativa. O Mestre pediu que
 * elas fossem reescritas junto com o resto (decisão 5 da spec).
 *
 * Só o `completionEffects` muda. Custo, duração e progresso ficam: o jogador já
 * pagou o preço antigo e planejou em cima do prazo antigo.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_PROJECT_TEMPLATES } from "../../shared/dist/index.js";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;

const doTemplate = (id) => {
  const t = DEFAULT_PROJECT_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Template ${id} não existe mais na biblioteca.`);
  return { templateId: id, durationTurns: t.durationTurns, costs: t.costs, completionEffects: t.completionEffects };
};

/**
 * Os projetos que este script sabe migrar, pela chave do banco. Deliberadamente
 * uma lista fechada: um projeto fora dela faz o script parar, em vez de inventar
 * recompensa para uma carta que ninguém revisou.
 */
export const EFEITOS_NOVOS = {
  // PREENCHER com os SK reais do Step 1. Exemplo das duas de biblioteca:
  // "PROJECT#<id-real>": doTemplate("fundar-uma-academia-de-oficiais"),
  // "PROJECT#<id-real>": doTemplate("construir-um-aqueduto"),

  // A Torre de Vigilância é carta customizada da Solarion, feita pela IA, e não
  // tem template de onde herdar. Faixa de 4 turnos: até +2 permanente.
  // "PROJECT#<id-real>": {
  //   templateId: null,
  //   durationTurns: 4,
  //   costs: [],
  //   completionEffects: {
  //     attributeChanges: [{ attribute: "controle", amount: 2, permanent: true }],
  //     favors: [],
  //     assets: ["Torre de Vigilância"],
  //     qualitativeEffects: ["Do alto dela, o deserto deixa de esconder quem se aproxima."],
  //     unlocks: [],
  //   },
  // },
};

/** Devolve o projeto com o efeito novo. Erro se não estiver no plano. */
export function migrarProjeto(projeto) {
  const def = EFEITOS_NOVOS[projeto.SK];
  if (!def) throw new Error(`${projeto.SK} ("${projeto.title}") não está no plano de migração.`);
  return { ...projeto, completionEffects: def.completionEffects };
}

/** Se este projeto ainda tem o que mudar. */
export function precisaMigrar(projeto) {
  const def = EFEITOS_NOVOS[projeto.SK];
  if (!def) return false;
  return JSON.stringify(projeto.completionEffects) !== JSON.stringify(def.completionEffects);
}

async function main() {
  const gravar = process.argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const { Items = [] } = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
    ExpressionAttributeValues: { ":p": PK, ":s": "PROJECT#" },
  }));

  const ativos = Items.filter((p) => p.status === "ACTIVE");
  const foraDoPlano = ativos.filter((p) => !EFEITOS_NOVOS[p.SK]);
  if (foraDoPlano.length) {
    throw new Error(`Projetos ativos fora do plano: ${foraDoPlano.map((p) => `${p.SK} ("${p.title}")`).join(", ")}. Acrescente-os a EFEITOS_NOVOS antes de rodar.`);
  }

  const marca = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = new URL("../../backups/projetos/efeitos/", import.meta.url);
  let mexidos = 0;

  for (const projeto of ativos) {
    if (!precisaMigrar(projeto)) {
      console.log(`${projeto.title}: nada a alterar.`);
      continue;
    }
    const novo = migrarProjeto(projeto);
    mexidos++;
    console.log(`\n${projeto.title} (${projeto.turnsCompleted}/${projeto.durationTurns})`);
    console.log(`  Antes: ${JSON.stringify(projeto.completionEffects)}`);
    console.log(`  Depois: ${JSON.stringify(novo.completionEffects)}`);

    if (!gravar) continue;

    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL(`${projeto.SK.replace(/^PROJECT#/, "")}-${marca}.json`, dir), JSON.stringify(projeto, null, 2));
    await doc.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...novo, updatedAt: new Date().toISOString() },
    }));
    console.log("  Gravado.");
  }

  if (!gravar && mexidos) console.log("\nEnsaio. Rode com --confirm para gravar.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 5: Rodar os testes**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && cd backend && npx vitest run scripts/migrar-efeitos-cartas-ativas.test.mjs`
Expected: PASS, 6 testes

- [ ] **Step 6: Ensaio contra produção**

Run: `cd /Users/jessicarosa/turnbasedrpg/backend && node scripts/migrar-efeitos-cartas-ativas.mjs`
Expected: três projetos listados com antes e depois, terminando em "Ensaio."

**Leia o antes e o depois com atenção.** É produção, com jogadores esperando.

- [ ] **Step 7: Gravar e conferir a idempotência**

Run:
```bash
cd /Users/jessicarosa/turnbasedrpg/backend && node scripts/migrar-efeitos-cartas-ativas.mjs --confirm && echo "=== segunda rodada ===" && node scripts/migrar-efeitos-cartas-ativas.mjs
```
Expected: primeira grava os três com backup; segunda diz "nada a alterar" para os três.

- [ ] **Step 8: Commitar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/migrar-efeitos-cartas-ativas.mjs backend/scripts/migrar-efeitos-cartas-ativas.test.mjs backups/projetos/efeitos/
git commit -m "Dá recompensa às três cartas que já estavam em jogo

Elas foram criadas antes de a biblioteca prometer ganho e terminariam
entregando só narrativa, duas delas depois de cinco turnos. O Mestre pediu
que fossem reescritas junto com o resto.

Só o efeito muda. O custo já foi pago e o prazo já foi planejado em cima do
número antigo; mexer neles seria mudar o preço de algo já comprado.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: Verificação e deploy

**Files:** nenhum

- [ ] **Step 1: As três suítes, isoladas**

Run:
```bash
cd /Users/jessicarosa/turnbasedrpg && npm run build -w shared && npm test -w shared && npm test -w backend && cd frontend && npx vitest run
```
Expected: shared ~186, backend ~736, frontend ~309. Todas verdes.

Não rode `npm test` na raiz: os três workspaces em paralelo estouram timeouts e dão falso vermelho.

- [ ] **Step 2: Typecheck do frontend**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build -w frontend`
Expected: sem erro

- [ ] **Step 3: Push**

```bash
cd /Users/jessicarosa/turnbasedrpg && git push origin HEAD
```

- [ ] **Step 4: Build de deploy**

Duas armadilhas conhecidas, e as duas fazem o site quebrar em silêncio:

1. **`frontend/.env.production` é gitignored.** Build em worktree limpo sai sem `VITE_API_BASE_URL` e o site cai no `MockApiClient` sem avisar.
2. **O worktree não isola o `shared`.** O `node_modules` é symlink para a raiz, então `@ravenloft/content` resolve para o `shared/dist` **da raiz**. Rode o build do shared na raiz antes.

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build -w shared
git worktree add -q --detach /tmp/deploy-cartas HEAD
ln -s /Users/jessicarosa/turnbasedrpg/node_modules /tmp/deploy-cartas/node_modules
cp frontend/.env.production /tmp/deploy-cartas/frontend/.env.production
cd /tmp/deploy-cartas && npm run build -w frontend
```

- [ ] **Step 5: Conferir o bundle antes de publicar**

Run:
```bash
cd /tmp/deploy-cartas/frontend/dist
echo "API: $(grep -o 'kzmeheg8d4' assets/*.js | wc -l)"
echo "Ganho: $(grep -o 'Ganho: ' assets/*.js | wc -l)"
echo "resumoDoGanho: $(grep -o 'Sem ganho mecânico' assets/*.js | wc -l)"
```
Expected: API 1, e os outros dois maiores que zero. **Se API for 0, pare**: o `.env.production` não entrou e o site vai para o mock.

- [ ] **Step 6: Publicar**

```bash
cd /tmp/deploy-cartas/frontend/dist && zip -qr /tmp/deploy-cartas.zip .
cd /Users/jessicarosa/turnbasedrpg
aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --output json > /tmp/dep.json
python3 -c "import json;d=json.load(open('/tmp/dep.json'));print(d['jobId']);open('/tmp/url','w').write(d['zipUploadUrl'])"
curl -s -X PUT --upload-file /tmp/deploy-cartas.zip "$(cat /tmp/url)"
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id <JOB_ID>
```

Acompanhe até `SUCCEED`:

```bash
aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id <JOB_ID> --output json | python3 -c "import json,sys;print(json.load(sys.stdin)['job']['summary']['status'])"
```

- [ ] **Step 7: Conferir no ar**

Abra `https://main.d1emmrcvmpw55g.amplifyapp.com`, entre como jogador e confira, na aba de Projetos da Casa:

- a biblioteca mostra `Ganho:` em toda carta;
- o que o motor garante aparece separado do que o Mestre honra narrando;
- os três projetos ativos mostram `Ao concluir:`;
- a Casa do Ouro vê o aviso de teto de Riqueza, **com o botão Iniciar ainda clicável**.

- [ ] **Step 8: Limpar**

```bash
cd /Users/jessicarosa/turnbasedrpg
git worktree remove --force /tmp/deploy-cartas
git worktree prune
rm -f /tmp/deploy-cartas.zip /tmp/dep.json /tmp/url
```

---

## O que dizer ao Mestre no fim

Três coisas que são decisões minhas dentro da liberdade que ele deu, e que ele pode querer rever:

1. **O +2 ficou em 4 e 5 turnos, não em 3.** Ele liberou o +2 sem aprovação e aprovou +1 em 3 turnos; ao pé da letra as duas juntas tornariam o exemplo original legal (+2 em 3 turnos por custo 1), mas isso esvazia as 23 cartas de 4 e 5 turnos. O lugar de mudar é `TABELA_DE_TROCA`, num arquivo só.
2. **A conversão de teto virou o freio de inflação do jogo.** Sem o portão de aprovação, é o que impede as Casas de estourarem a escala. Quem chega a 5 passa a receber ativo nomeado em vez de número.
3. **O efeito da Torre de Vigilância da Solarion foi escrito à mão**, porque é carta customizada e não tem template de onde herdar. Ficou em +2 Controle mais o ativo, dentro da faixa de 4 turnos.
