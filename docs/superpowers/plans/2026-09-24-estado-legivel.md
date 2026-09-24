# Estado Legível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `npm run contexto` emitir o estado atual do mundo inteiro — projetos com dono e progresso, Energia, relações entre Casas, elenco vivo/morto e fios de correspondência abertos — em Markdown e em JSON, para que ninguém precise ter estado na conversa.

**Architecture:** Toda a mudança vive em `backend/scripts/gerar-contexto.mjs`, que já é um script de leitura com funções puras (`separarPorAudiencia`, `montarEstado`, `montarCronica`) testadas em `gerar-contexto.test.mjs`. As funções continuam puras: é o que permite que sigilo entre audiências seja asserção de teste, e não julgamento. O script passa a importar `@ravenloft/content` (constante de Energia e derivação de mortalidade), então `npm run contexto` passa a rodar `build:shared` antes.

**Tech Stack:** Node ESM (`.mjs`), vitest, `@aws-sdk/lib-dynamodb` (só leitura), `@ravenloft/content` (workspace `shared`).

**Spec:** `docs/superpowers/specs/2026-09-24-estado-legivel-design.md`

## Global Constraints

- **Nada de produção é tocado.** Sem mudança em Lambda, rota, tabela, `shared/src` ou `frontend`. O único arquivo fora de `backend/scripts/` é `package.json`.
- **As funções exportadas continuam puras.** `separarPorAudiencia`, `montarEstado`, `montarCronica` e as novas não leem banco, não escrevem arquivo e não usam relógio. A casca (`lerParticao`, `escrever`, `main`) é a única parte com efeito.
- **Régua de sigilo, literal da spec:** relações vão inteiras para `mestre/`; para cada Casa, só as linhas em que ela é o `fromKey`; para `publico/`, nenhuma.
- **Ausência nunca é silêncio.** Casa sem alocação de Energia sai como `não alocou`; id de projeto sem projeto correspondente sai com o id cru mais `(projeto não encontrado)`.
- **O id de projeto vai em crase no FIM da linha**, nunca no começo.
- **Idioma:** todo texto gerado, comentário e mensagem de commit em português.
- **Commits:** um por tarefa, com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` na última linha.

## Review Focus

Cinco entradas que a spec implica e que nenhum bloco exercita por si só. Cada uma tem o teste apontado para a tarefa dona do código.

1. **Projeto com `status` fora dos doze conhecidos** — o mapa de grupos não pode fazer a carta sumir do arquivo; ela cai em "Esperando decisão" e aparece. → Tarefa 1.
2. **Projeto antigo sem `completionEffects`** — carta concluída antes do campo existir não pode derrubar o gerador. → Tarefa 1.
3. **Casa sem item `ENERGY#` no turno corrente** — Do Ouro não tem nenhum em turno nenhum; tem que sair como "não alocou", não desaparecer. → Tarefa 2.
4. **Elenco vazio para uma chave** — `HOUSE_CHARACTERS["casa-solarion"]` é `[]`; o bloco não pode quebrar nem emitir cabeçalho órfão. → Tarefa 4.
5. **Partição sem turno nenhum** — campanha recém-criada: `f.turnos` vazio faz Energia, Elenco e Cartas abertas serem pulados sem lançar. → Tarefa 6.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `backend/scripts/gerar-contexto.mjs` | Recorte por audiência + montagem de `estado.md`, `cronica.md` e `estado-atual.json` | Modificar |
| `backend/scripts/gerar-contexto.test.mjs` | Sigilo, formato e casos de borda das funções puras | Modificar |
| `package.json` | `npm run contexto` passa a rodar `build:shared` | Modificar (Tarefa 2) |
| `campaign-context/inverno-dos-mortos/**` | Saída regenerada | Regerar e commitar (Tarefa 7) |

O arquivo do gerador tem 285 linhas e ganha ~160. Fica em ~450, que é grande mas coeso: é uma função pura por bloco, todas do mesmo domínio, e quebrar em módulos separaria o recorte de audiência da renderização — que é exatamente o par que precisa ser lido junto para conferir sigilo. Fica num arquivo só.

---

### Task 1: Projetos agrupados por Casa e por situação

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs` (bloco de projetos em `montarEstado`, hoje nas linhas 143-145)
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `bloco(titulo, corpo)`, `lista(xs)`, e a fatia `f` com `f.projetos` e `f.casas`, todos já existentes.
- Produces: `GRUPO_DE_STATUS`, `ORDEM_DOS_GRUPOS`, `efeitosDaCarta(p)`, `linhaDeProjeto(p)`, `blocoDeProjetos(f)`. Só `linhaDeProjeto` e `blocoDeProjetos` são exportados; as tarefas seguintes não dependem deles.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `backend/scripts/gerar-contexto.test.mjs`:

```javascript
const PROJETOS = [
  { SK: "PROJECT#khazdrun-wxey#p-ativo", id: "p-ativo", houseId: "khazdrun-wxey",
    title: "Estabelecer uma Rota de Caravanas", status: "ACTIVE",
    turnsCompleted: 1, durationTurns: 3, createdAtTurn: 7, lastProcessedTurnId: 9,
    completionEffects: { assets: [], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
  { SK: "PROJECT#khazdrun-wxey#p-morto", id: "p-morto", houseId: "khazdrun-wxey",
    title: "Estabelecer uma Rota de Caravanas", status: "CANCELLED",
    turnsCompleted: 0, durationTurns: 3, createdAtTurn: 5, lastProcessedTurnId: 8,
    completionEffects: { assets: [], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
  { SK: "PROJECT#solarion-k0hc#p-feito", id: "p-feito", houseId: "solarion-k0hc",
    title: "Desenvolvimento dos Balões de Vento", status: "COMPLETED", outcome: "SUCCESS",
    turnsCompleted: 1, durationTurns: 1, createdAtTurn: 9, lastProcessedTurnId: 9,
    completionEffects: { assets: ["Balão de Vento"], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
];

describe("projetos", () => {
  function comProjetos() {
    return separarPorAudiencia([...itens(), ...PROJETOS], CASAS);
  }

  // O caso real: três "Rota de Caravanas" saíam em três linhas idênticas menos
  // o status, e não havia como dizer qual era qual.
  it("separa cartas homônimas por situação e por id", () => {
    const texto = montarEstado(comProjetos().casas["khazdrun"]);
    expect(texto).toContain("**Em andamento**");
    expect(texto).toContain("**Encerrados sem efeito**");
    expect(texto).toContain("1/3 turnos");
    expect(texto).toContain("`p-ativo`");
    expect(texto).toContain("`p-morto`");
  });

  it("agrupa por Casa e diz o efeito de uma carta concluída", () => {
    const texto = montarEstado(comProjetos().mestre);
    expect(texto).toContain("### Khazdrun");
    expect(texto).toContain("### Solarion");
    expect(texto).toMatch(/Balões de Vento — T9, SUCCESS → ativo "Balão de Vento"/);
  });

  // Review Focus 1: status desconhecido não pode engolir a carta.
  it("não some com carta de status desconhecido", () => {
    const estranha = { ...PROJETOS[0], id: "p-raro", status: "INVENTADO" };
    const f = separarPorAudiencia([...itens(), estranha], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    expect(texto).toContain("`p-raro`");
    expect(texto).toContain("**Esperando decisão**");
  });

  // Review Focus 2: carta gravada antes do campo existir.
  it("não quebra com carta sem completionEffects", () => {
    const velha = { SK: "PROJECT#khazdrun-wxey#p-velho", id: "p-velho", houseId: "khazdrun-wxey",
      title: "Carta antiga", status: "COMPLETED", outcome: "SUCCESS", lastProcessedTurnId: 4 };
    const f = separarPorAudiencia([...itens(), velha], CASAS);
    expect(() => montarEstado(f.casas["khazdrun"])).not.toThrow();
    expect(montarEstado(f.casas["khazdrun"])).toContain("`p-velho`");
  });
});
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t projetos`
Expected: FAIL — `expect(texto).toContain("**Em andamento**")` não encontra, porque o bloco atual emite só `título — STATUS`.

- [ ] **Step 3: Implementar**

Em `backend/scripts/gerar-contexto.mjs`, logo depois de `const lista = ...` (linha 124), acrescentar:

```javascript
/**
 * A situação de uma carta, que é como o Mestre pensa nelas.
 *
 * O status cru tem doze valores e não ordena nada: "Estabelecer uma Rota de
 * Caravanas" saía três vezes, em três linhas iguais menos a última palavra, e
 * não havia como dizer qual estava andando e qual tinha sido cancelada.
 */
const GRUPO_DE_STATUS = {
  ACTIVE: "Em andamento", APPROVED: "Em andamento", PAUSED: "Em andamento",
  PENDING_GM: "Esperando decisão", PENDING_TARGET: "Esperando decisão",
  PENDING_PLAYER: "Esperando decisão", PENDING_AI: "Esperando decisão",
  DRAFT: "Esperando decisão",
  COMPLETED: "Concluídos",
  CANCELLED: "Encerrados sem efeito", FAILED: "Encerrados sem efeito",
  REJECTED: "Encerrados sem efeito",
};

const ORDEM_DOS_GRUPOS = ["Em andamento", "Esperando decisão", "Concluídos", "Encerrados sem efeito"];

/**
 * Status que o mapa não conhece cai em "Esperando decisão", nunca fora do
 * arquivo: uma carta invisível é pior que uma carta no grupo errado.
 */
const grupoDe = (p) => GRUPO_DE_STATUS[p.status] ?? "Esperando decisão";

/** O que uma carta concluída deixou no mundo, em uma linha. */
function efeitosDaCarta(p) {
  const e = p.completionEffects ?? {};
  const partes = [
    ...(e.assets ?? []).map((a) => `ativo "${a}"`),
    ...(e.attributeChanges ?? []).map((c) => `${c.attribute} ${c.amount >= 0 ? "+" : ""}${c.amount}`),
    ...(e.favors ?? []).map((x) => `favor com ${x.targetHouseId}`),
    ...(e.unlocks ?? []),
  ];
  return partes.length ? ` → ${partes.join(", ")}` : "";
}

/**
 * Uma carta em uma linha. O id vai em crase no FIM: quem lê pula, e quem
 * precisa cruzar com a alocação de Energia acha.
 */
export function linhaDeProjeto(p) {
  const id = ` · \`${p.id}\``;
  const desde = p.createdAtTurn != null ? ` · desde T${p.createdAtTurn}` : "";
  const quando = p.lastProcessedTurnId != null ? `T${p.lastProcessedTurnId}` : "turno não registrado";
  switch (grupoDe(p)) {
    case "Em andamento":
      return `${p.title} — ${p.turnsCompleted ?? 0}/${p.durationTurns ?? "?"} turnos${desde}${id}`;
    case "Concluídos":
      return `${p.title} — ${quando}, ${p.outcome ?? "SEM DESFECHO"}${efeitosDaCarta(p)}${id}`;
    case "Encerrados sem efeito":
      return `${p.title} — ${p.status}${p.lastProcessedTurnId != null ? ` no ${quando}` : ""}${id}`;
    default:
      return `${p.title} — ${p.status}${desde}${id}`;
  }
}

export function blocoDeProjetos(f) {
  if (!f.projetos.length) return "";
  const nomeDaCasa = new Map(f.casas.map((c) => [c.houseId, c.name]));
  const porCasa = new Map();
  for (const p of f.projetos) {
    const nome = nomeDaCasa.get(p.houseId) ?? p.houseId;
    if (!porCasa.has(nome)) porCasa.set(nome, []);
    porCasa.get(nome).push(p);
  }
  const corpo = [...porCasa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nome, cartas]) => {
      const linhas = [`### ${nome}`, ""];
      for (const grupo of ORDEM_DOS_GRUPOS) {
        const doGrupo = cartas.filter((p) => grupoDe(p) === grupo);
        if (!doGrupo.length) continue;
        linhas.push(`**${grupo}**`, "", lista(doGrupo.map(linhaDeProjeto)), "");
      }
      return linhas.join("\n");
    })
    .join("\n");
  return bloco("Projetos", corpo);
}
```

E substituir o bloco antigo em `montarEstado` — trocar

```javascript
  if (f.projetos.length) {
    partes.push(bloco("Projetos", lista(f.projetos.map((p) => `${p.title} — ${p.status}${p.outcome ? ` (${p.outcome})` : ""}`))));
  }
```

por

```javascript
  partes.push(blocoDeProjetos(f));
```

(`partes.filter(Boolean)` no fim de `montarEstado` já descarta a string vazia.)

- [ ] **Step 4: Rodar o teste e conferir que passa**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS, inclusive os testes que já existiam.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs
git commit -F - <<'EOF'
feat(contexto): carta com dono, progresso e efeito

"Estabelecer uma Rota de Caravanas" saía três vezes em linhas iguais menos
o status. Agora agrupa por Casa e por situação, e o id fecha a linha.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Energia do turno corrente, com id resolvido

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs` (`separarPorAudiencia` e `montarEstado`)
- Modify: `package.json` (script `contexto`)
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `linhaDeProjeto` não; usa `f.projetos` (Tarefa 1 não mudou a forma da fatia), `f.casas`, `f.turnos`, `bloco`, `lista`.
- Produces: campo novo `energia` em toda fatia de `separarPorAudiencia`; `blocoDeEnergia(f)` exportado.

Esta tarefa é a primeira que importa de `@ravenloft/content`, então carrega a mudança do `package.json`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `gerar-contexto.test.mjs`:

```javascript
const ENERGIA = [
  { SK: "ENERGY#009#khazdrun-wxey", turnId: 9, houseId: "khazdrun-wxey",
    porProjeto: { "p-ativo": 2, "p-sumido": 1 } },
];

describe("energia", () => {
  function comEnergia() {
    return separarPorAudiencia([...itens(), ...PROJETOS, ...ENERGIA], CASAS);
  }

  it("resolve o id do projeto para o título e soma os pontos", () => {
    const texto = montarEstado(comEnergia().casas["khazdrun"]);
    expect(texto).toContain("3 de 3 pontos");
    expect(texto).toContain("Estabelecer uma Rota de Caravanas 2");
  });

  // Ausência silenciosa é indistinguível de bug de leitura.
  it("diz que a Casa não alocou em vez de omitir a linha", () => {
    const texto = montarEstado(comEnergia().mestre);
    expect(texto).toContain("**Solarion** (T9) — não alocou");
  });

  it("marca id de projeto que não existe em vez de sumir com ele", () => {
    const texto = montarEstado(comEnergia().mestre);
    expect(texto).toContain("p-sumido (projeto não encontrado) 1");
  });

  it("não põe alocação de uma Casa no arquivo da vizinha nem no público", () => {
    const f = comEnergia();
    expect(montarEstado(f.casas["solarion"])).not.toContain("Rota de Caravanas 2");
    expect(montarEstado(f.publico)).not.toMatch(/Energia do turno/);
  });
});
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t energia`
Expected: FAIL — `3 de 3 pontos` não encontrado; não existe bloco de Energia.

- [ ] **Step 3: Implementar**

No topo de `gerar-contexto.mjs`, depois dos imports de `node:`:

```javascript
import { ENERGIA_POR_TURNO } from "@ravenloft/content";
```

Em `separarPorAudiencia`, junto das outras coletas (depois de `const trilha = ...`):

```javascript
  const energia = de(itens, "ENERGY#");
```

E acrescentar o campo em cada fatia:

- em `publico`: `energia: [],` (junto de `npcs: []`)
- em `porCasa[...]`: `energia: energia.filter((e) => e.houseId === casa.houseId),`
- em `mestre`: incluir `energia` na lista de campos (`cartas, fatos, pactos, relacoes, npcs, projetos, favores, trilha, energia, casas`)

Depois de `blocoDeProjetos`, acrescentar:

```javascript
/**
 * A alocação de Energia do turno corrente.
 *
 * `ENERGY#` guarda `porProjeto: { <id>: pontos }`, e id de projeto não existia
 * em `.md` nenhum — era o motivo de este bloco não poder existir antes da
 * Tarefa 1. Casa sem item sai como "não alocou": ausência silenciosa é
 * indistinguível de bug de leitura, e Do Ouro nunca alocou em turno nenhum.
 */
export function blocoDeEnergia(f) {
  const corrente = f.turnos[f.turnos.length - 1];
  if (!corrente || !f.casas.length || !f.energia.length) return "";
  const titulo = new Map(f.projetos.map((p) => [p.id, p.title]));
  const doTurno = f.energia.filter((e) => e.turnId === corrente.turnId);
  const linhas = f.casas.map((c) => {
    const entradas = Object.entries(doTurno.find((e) => e.houseId === c.houseId)?.porProjeto ?? {});
    if (!entradas.length) return `**${c.name}** (T${corrente.turnId}) — não alocou`;
    const total = entradas.reduce((s, [, n]) => s + n, 0);
    const detalhe = entradas
      .map(([id, n]) => `${titulo.get(id) ?? `${id} (projeto não encontrado)`} ${n}`)
      .join(", ");
    return `**${c.name}** (T${corrente.turnId}) — ${total} de ${ENERGIA_POR_TURNO} pontos: ${detalhe}`;
  });
  return bloco("Energia do turno", lista(linhas));
}
```

Em `montarEstado`, logo depois de `partes.push(blocoDeProjetos(f));`:

```javascript
  partes.push(blocoDeEnergia(f));
```

Em `package.json`, trocar

```json
    "contexto": "node backend/scripts/gerar-contexto.mjs",
```

por

```json
    "contexto": "npm run build:shared && node backend/scripts/gerar-contexto.mjs",
```

- [ ] **Step 4: Rodar os testes e conferir que passam**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build:shared && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS em tudo. (`build:shared` é necessário aqui pela primeira vez: sem `shared/dist`, o import de `@ravenloft/content` falha.)

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs package.json
git commit -F - <<'EOF'
feat(contexto): a Energia do turno, com o id virando título

A alocação aponta para id de projeto, que não existia em .md nenhum. Casa
sem item sai como "não alocou" — omitir parece falha de leitura.

`npm run contexto` passa a rodar build:shared: o teto de Energia tem um
dono só, shared/src/energia.ts, e repetir o número aqui seria a segunda
cópia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Relações entre Casas, com a régua de sigilo

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs` (`separarPorAudiencia` e `montarEstado`)
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `relacoes`, já coletado na linha 55 e hoje entregue às três audiências sem ser renderizado.
- Produces: `blocoDeRelacoes(f)` exportado; o campo `relacoes` de cada fatia passa a ser filtrado.

Esta é a única tarefa que pode causar vazamento: os 36 registros hoje são inertes porque nada os escreve.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
const RELACOES = [
  { SK: "HRELATION#casa-khazdrun#casa-solarion", fromKey: "casa-khazdrun", toKey: "casa-solarion",
    amizade: 58, comercio: 70, favores: 55, note: "SENTIMENTO-ANAO: pagaram o ferro." },
  { SK: "HRELATION#casa-solarion#casa-khazdrun", fromKey: "casa-solarion", toKey: "casa-khazdrun",
    amizade: 40, comercio: 30, favores: 20, note: "SENTIMENTO-ELFO: demoraram a responder." },
];

describe("relações entre Casas", () => {
  function comRelacoes() {
    return separarPorAudiencia([...itens(), ...RELACOES], CASAS);
  }

  it("o Mestre vê as duas direções", () => {
    const texto = montarEstado(comRelacoes().mestre);
    expect(texto).toContain("SENTIMENTO-ANAO");
    expect(texto).toContain("SENTIMENTO-ELFO");
    expect(texto).toContain("amizade 58");
  });

  // O que sentem de você não é coisa que você saiba.
  it("uma Casa vê o que sente, nunca o que sentem dela", () => {
    const texto = montarEstado(comRelacoes().casas["khazdrun"]);
    expect(texto).toContain("SENTIMENTO-ANAO");
    expect(texto).not.toContain("SENTIMENTO-ELFO");
  });

  it("o arquivo público não tem relação nenhuma", () => {
    const texto = montarEstado(comRelacoes().publico);
    expect(texto).not.toContain("SENTIMENTO-ANAO");
    expect(texto).not.toContain("SENTIMENTO-ELFO");
    expect(texto).not.toMatch(/Relações entre Casas/);
  });
});
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t "relações"`
Expected: FAIL — `SENTIMENTO-ANAO` não aparece em lugar nenhum, porque nada renderiza relações.

- [ ] **Step 3: Implementar**

Em `separarPorAudiencia`, trocar os três pontos onde `relacoes` é entregue:

- em `publico`, trocar `relacoes, npcs: [], ...` por `relacoes: [], npcs: [], ...`
- em `porCasa[...]`, trocar `relacoes,` por `relacoes: relacoes.filter((r) => r.fromKey === sede),`
- em `mestre`, deixar `relacoes` como está (todas)

Depois de `blocoDeEnergia`, acrescentar:

```javascript
/**
 * O que cada Casa sente pelas outras.
 *
 * Os registros já existiam e eram entregues às três audiências sem nunca serem
 * escritos — inertes, e por isso inofensivos. Escrevê-los muda isso: o que
 * Auremont sente pela Casa do Ouro não é coisa que Solarion saiba. A régua é a
 * mesma da ficha de atributo, e o recorte mora em `separarPorAudiencia` para
 * que o teste de sigilo alcance.
 */
export function blocoDeRelacoes(f) {
  if (!f.relacoes.length) return "";
  const linhas = [...f.relacoes]
    .sort((a, b) => String(a.fromKey).localeCompare(String(b.fromKey))
      || String(a.toKey).localeCompare(String(b.toKey)))
    .map((r) => {
      const nums = `amizade ${r.amizade ?? "?"}, comércio ${r.comercio ?? "?"}, favores ${r.favores ?? "?"}`;
      return `${r.fromKey} → ${r.toKey} — ${nums}${r.note ? ` · ${r.note}` : ""}`;
    });
  return bloco("Relações entre Casas", lista(linhas));
}
```

Em `montarEstado`, logo depois de `partes.push(blocoDeEnergia(f));`:

```javascript
  partes.push(blocoDeRelacoes(f));
```

- [ ] **Step 4: Rodar os testes e conferir que passam**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS, incluindo os quatro testes de "sigilo entre audiências" que já existiam.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs
git commit -F - <<'EOF'
feat(contexto): as relações saíam do banco e morriam na função

Trinta e seis registros eram carregados e nunca escritos. Escrevê-los pede
régua: o Mestre vê tudo, a Casa vê o que sente, o público não vê nada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Elenco vivo e morto

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs`
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `HOUSE_CHARACTERS`, `characterId`, `isDeadInChronicle` de `@ravenloft/content` (todos reexportados pelo `index.ts`); `f.turnos`, `f.npcs`.
- Produces: `turnosCumulativos(turnos)` e `blocoDeElenco(f)` exportados.

`buildPublicChronicle` **não serve aqui**: corta em 4500 caracteres para caber num prompt e, com onze turnos, o corte come o começo — quem morreu no turno 3 voltaria a aparecer vivo. Além disso mora em `backend/src`, não em `shared`.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
describe("elenco", () => {
  // Lady Celene Valerius está no elenco canônico de casa-valerius.
  const MORTE = {
    SK: "TURN#010", turnId: 10, status: "RESOLVED",
    publicEvent: "As máquinas chegaram ao alcance.",
    privateInfo: {},
    result: { publicResult: "Lady Celene Valerius foi encontrada morta no castelo.",
      houseResults: {}, attributeDeltas: {}, discoveries: [] },
  };

  it("marca quem morreu, com o turno, e deixa os outros vivos", () => {
    const f = separarPorAudiencia([...itens(), MORTE], CASAS);
    const texto = montarEstado(f.mestre);
    expect(texto).toContain("Lady Celene Valerius");
    expect(texto).toMatch(/Lady Celene Valerius.*morto no T10/);
  });

  it("junta humor e objetivo só no arquivo do Mestre", () => {
    const f = separarPorAudiencia([...itens(), MORTE], CASAS);
    expect(montarEstado(f.mestre)).toContain("SEGREDO-NPC");
    expect(montarEstado(f.casas["khazdrun"])).not.toContain("SEGREDO-NPC");
    expect(montarEstado(f.casas["khazdrun"])).toContain("Lady Celene Valerius");
  });

  // Review Focus 4: casa-solarion tem elenco canônico vazio.
  it("não emite cabeçalho órfão para chave de elenco vazia", () => {
    const texto = montarEstado(separarPorAudiencia(itens(), CASAS).mestre);
    expect(texto).not.toMatch(/casa-solarion\)\s*—\s*;/);
  });
});
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t elenco`
Expected: FAIL — `Lady Celene Valerius` não aparece; não existe bloco de Elenco.

- [ ] **Step 3: Implementar**

Ampliar o import no topo:

```javascript
import { ENERGIA_POR_TURNO, HOUSE_CHARACTERS, characterId, isDeadInChronicle } from "@ravenloft/content";
```

Depois de `blocoDeRelacoes`, acrescentar:

```javascript
/**
 * O texto público acumulado até cada turno.
 *
 * NÃO usa `buildPublicChronicle`: aquele corta em 4500 caracteres para caber
 * num prompt, e com onze turnos o corte come o começo — quem morreu no turno 3
 * voltaria a aparecer vivo. Aqui não há orçamento de token para respeitar.
 */
export function turnosCumulativos(turnos) {
  const saida = [];
  let acumulado = "";
  for (const t of turnos) {
    acumulado += [t.publicEvent, t.publicResult].filter(Boolean).join("\n") + "\n\n";
    saida.push({ turnId: t.turnId, texto: acumulado });
  }
  return saida;
}

/** O primeiro turno em cujo texto público a pessoa já aparece morta. */
function turnoDaMorte(nome, cumulativos) {
  for (const c of cumulativos) if (isDeadInChronicle(nome, c.texto)) return c.turnId;
  return null;
}

/**
 * Quem existe e quem já morreu.
 *
 * A morte é derivada em código a partir da crônica pública, nunca decidida por
 * modelo: a primeira versão gerada por IA matou Lady Celene Valerius, que
 * aparece viva e agindo no turno 3. `mortality.ts` já fazia essa conta e nunca
 * era emitida em lugar nenhum.
 *
 * Humor e objetivo vêm de `NPCDYN#`, que é material do Mestre — em fatia sem
 * NPC, o elenco sai só com vivo/morto, que é derivado de texto público.
 */
export function blocoDeElenco(f) {
  if (!f.turnos.length) return "";
  const cumulativos = turnosCumulativos(f.turnos);
  const humor = new Map(f.npcs.map((n) => [n.id, n]));
  const linhas = [];
  for (const [chave, figuras] of Object.entries(HOUSE_CHARACTERS)) {
    for (const fig of figuras) {
      const morte = turnoDaMorte(fig.name, cumulativos);
      const n = humor.get(characterId(fig.name));
      const extra = n ? ` · humor: ${n.mood ?? "?"}; objetivo: ${n.objective ?? "?"}` : "";
      linhas.push(`**${fig.name}** (${chave}) — ${fig.role}; ${morte == null ? "vivo" : `morto no T${morte}`}${extra}`);
    }
  }
  return linhas.length ? bloco("Elenco", lista(linhas)) : "";
}
```

Em `montarEstado`, logo depois de `partes.push(blocoDeRelacoes(f));`:

```javascript
  partes.push(blocoDeElenco(f));
```

- [ ] **Step 4: Rodar os testes e conferir que passam**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build:shared && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS. O teste antigo "memória viva de NPC só existe no arquivo do Mestre" continua verde porque `f.npcs` é vazio fora do Mestre.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs
git commit -F - <<'EOF'
feat(contexto): o elenco, e quem já morreu

mortality.ts derivava a morte da crônica pública e nunca emitia. Monta a
crônica sem corte: buildPublicChronicle para em 4500 caracteres e, com onze
turnos, ressuscitaria quem morreu no turno 3.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Fios de correspondência abertos

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs`
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `f.cartas`, já recortado por audiência.
- Produces: `cartasAbertas(cartas)` e `blocoDeCartasAbertas(f)` exportados. `cartasAbertas` devolve `[{ de, para, quantas, desdeTurno }]` — a Tarefa 6 consome essa forma no JSON.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
describe("cartas abertas", () => {
  const FIO = [
    { SK: "DIPLMSG#0007#khazdrun-wxey~casa-vargen#a1", id: "a1", turnNumber: 7, author: "PLAYER",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Primeira.", createdAt: "2026-09-01T10:00:00.000Z" },
    { SK: "DIPLMSG#0008#khazdrun-wxey~casa-vargen#a2", id: "a2", turnNumber: 8, author: "PLAYER",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Segunda.", createdAt: "2026-09-02T10:00:00.000Z" },
    { SK: "DIPLMSG#0009#khazdrun-wxey~casa-vargen#r1", id: "r1", turnNumber: 9, author: "AI", replyToId: "a1",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Resposta à primeira.", createdAt: "2026-09-03T10:00:00.000Z" },
  ];

  it("conta só a carta que ninguém citou, e data pelo fio mais antigo", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    expect(texto).toContain("casa-vargen");
    expect(texto).toMatch(/2 cartas sem resposta registrada desde T8/);
  });

  it("não conta a carta que já foi respondida", () => {
    const abertas = cartasAbertas(FIO);
    const vargen = abertas.find((x) => x.para === "casa-vargen");
    expect(vargen.quantas).toBe(2);
    expect(vargen.desdeTurno).toBe(8);
  });

  it("não expõe fio de uma Casa no arquivo da vizinha", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    expect(montarEstado(f.casas["solarion"])).not.toContain("casa-vargen");
  });
});
```

O import do teste precisa ganhar `cartasAbertas`:

```javascript
import { pastaDaCasa, separarPorAudiencia, montarEstado, montarCronica, cartasAbertas } from "./gerar-contexto.mjs";
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t "cartas abertas"`
Expected: FAIL — `cartasAbertas is not a function`.

- [ ] **Step 3: Implementar**

Depois de `blocoDeElenco`, acrescentar:

```javascript
/**
 * Fio aberto: carta que nenhuma outra cita em `replyToId`.
 *
 * A definição é mecanicamente honesta e o título do bloco diz isso: "sem
 * resposta registrada" não é o mesmo que "esperando resposta". Uma carta pode
 * ter sido respondida em pessoa, ou ter encerrado o assunto. O gerador não tem
 * como saber a diferença e não deve fingir que sabe.
 */
export function cartasAbertas(cartas) {
  const respondidas = new Set(cartas.map((m) => m.replyToId).filter(Boolean));
  const porPar = new Map();
  for (const m of cartas.filter((m) => !respondidas.has(m.id))) {
    const chave = `${m.fromHouseId}→${m.toHouseKey}`;
    const atual = porPar.get(chave)
      ?? { de: m.fromHouseId, para: m.toHouseKey, quantas: 0, desdeTurno: Infinity };
    atual.quantas += 1;
    atual.desdeTurno = Math.min(atual.desdeTurno, m.turnNumber ?? Infinity);
    porPar.set(chave, atual);
  }
  return [...porPar.values()].sort((a, b) => a.desdeTurno - b.desdeTurno);
}

export function blocoDeCartasAbertas(f) {
  const abertas = cartasAbertas(f.cartas);
  if (!abertas.length) return "";
  const linhas = abertas.map((x) =>
    `${x.de} → ${x.para} — ${x.quantas} ${x.quantas === 1 ? "carta" : "cartas"} sem resposta registrada desde T${x.desdeTurno}`);
  return bloco("Cartas abertas", lista(linhas));
}
```

Em `montarEstado`, logo depois de `partes.push(blocoDeElenco(f));`:

```javascript
  partes.push(blocoDeCartasAbertas(f));
```

- [ ] **Step 4: Rodar os testes e conferir que passam**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs
git commit -F - <<'EOF'
feat(contexto): quem está esperando resposta, e desde quando

Oitenta e três fios de T>=10 não têm resposta registrada e descobrir isso
exigia varrer trezentas e vinte e uma cartas. O título diz "sem resposta
registrada", não "esperando": o gerador não sabe a diferença.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: `estado-atual.json` e o cabeçalho que aponta para o irmão

**Files:**
- Modify: `backend/scripts/gerar-contexto.mjs` (`montarEstado`, `escrever`, `main`)
- Test: `backend/scripts/gerar-contexto.test.mjs`

**Interfaces:**
- Consumes: `cartasAbertas` (Tarefa 5), `grupoDe` (Tarefa 1), `turnosCumulativos` (Tarefa 4), e a fatia inteira.
- Produces: `montarJson(f)` exportado, devolvendo o objeto descrito na spec.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
describe("estado-atual.json", () => {
  function tudo() {
    return separarPorAudiencia([...itens(), ...PROJETOS, ...ENERGIA, ...RELACOES], CASAS);
  }

  it("traz o turno, as casas e os projetos sem prosa", () => {
    const j = montarJson(tudo().mestre);
    expect(j.turno.atual).toBe(9);
    expect(j.turno.status).toBe("RESOLVED");
    expect(j.casas.map((c) => c.houseId)).toContain("khazdrun-wxey");
    expect(j.projetos.find((p) => p.id === "p-ativo").grupo).toBe("Em andamento");
  });

  // O formato duplo só se justifica se os dois não puderem divergir.
  it("todo projeto do JSON aparece no MD e vice-versa", () => {
    const f = tudo().mestre;
    const j = montarJson(f);
    const md = montarEstado(f);
    for (const p of j.projetos) expect(md).toContain(`\`${p.id}\``);
    const idsNoMd = [...md.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
    for (const id of j.projetos.map((p) => p.id)) expect(idsNoMd).toContain(id);
  });

  it("obedece a mesma régua de sigilo do markdown", () => {
    const j = montarJson(tudo().publico);
    expect(j.relacoes).toEqual([]);
    expect(j.casas[0].atributos).toBeUndefined();
  });

  // Review Focus 5: campanha sem turno nenhum.
  it("não quebra com partição sem turno", () => {
    const f = separarPorAudiencia(CASAS.map((c) => ({ ...c, SK: `HOUSE#${c.houseId}` })), CASAS);
    expect(() => montarJson(f.mestre)).not.toThrow();
    expect(() => montarEstado(f.mestre)).not.toThrow();
    expect(montarJson(f.mestre).turno.atual).toBe(null);
  });
});
```

O import do teste ganha `montarJson`:

```javascript
import { pastaDaCasa, separarPorAudiencia, montarEstado, montarCronica, cartasAbertas, montarJson } from "./gerar-contexto.mjs";
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd /Users/jessicarosa/turnbasedrpg && npx vitest run backend/scripts/gerar-contexto.test.mjs -t "estado-atual"`
Expected: FAIL — `montarJson is not a function`.

- [ ] **Step 3: Implementar**

Depois de `montarCronica`, acrescentar:

```javascript
/**
 * A mesma fatia, sem prosa.
 *
 * `estado.md` é para uma pessoa e para um modelo lendo contexto; isto é para um
 * script que pergunta "quais cartas da Solarion estão ACTIVE" sem parsear
 * texto. Sai da MESMA fatia, no mesmo comando, com a mesma régua de sigilo
 * aplicada pela mesma função — é o único jeito de os dois não divergirem.
 */
export function montarJson(f) {
  const corrente = f.turnos[f.turnos.length - 1] ?? null;
  const ultimo = [...f.turnos].reverse().find((t) => t.publicResult) ?? null;
  const cumulativos = turnosCumulativos(f.turnos);
  const titulo = new Map(f.projetos.map((p) => [p.id, p.title]));
  return {
    audiencia: f.audiencia,
    turno: {
      atual: corrente?.turnId ?? null,
      status: corrente?.status ?? null,
      ultimoPublicado: ultimo?.turnId ?? null,
    },
    casas: f.casas.map((c) => ({
      houseId: c.houseId,
      nome: c.name,
      // Número de ficha não é coisa que uma Casa saiba da outra: mesma régua do markdown.
      ...(f.audiencia === "publico" ? {} : { atributos: c.attributes ?? {}, estabilidade: c.stability ?? null }),
      ativos: c.assets ?? [],
    })),
    projetos: f.projetos.map((p) => ({
      id: p.id, houseId: p.houseId, titulo: p.title, status: p.status, grupo: grupoDe(p),
      turnsCompleted: p.turnsCompleted ?? 0, durationTurns: p.durationTurns ?? null,
      criadoNoTurno: p.createdAtTurn ?? null, outcome: p.outcome ?? null,
      efeitos: p.completionEffects ?? null,
    })),
    energia: f.energia.map((e) => ({
      turnId: e.turnId, houseId: e.houseId,
      porProjeto: Object.entries(e.porProjeto ?? {}).map(([id, pontos]) => ({
        id, titulo: titulo.get(id) ?? null, pontos,
      })),
    })),
    fatos: f.fatos.map((x) => ({
      turnNumber: x.turnNumber, visibility: x.visibility, status: x.status, summary: x.summary,
    })),
    pactos: f.pactos.map((p) => ({
      kind: p.kind, betweenA: p.betweenA, betweenB: p.betweenB, status: p.status, summary: p.summary,
    })),
    favores: f.favores.map((x) => ({
      status: x.status, fromHouseId: x.fromHouseId, toHouseId: x.toHouseId, reason: x.reason,
    })),
    relacoes: f.relacoes.map((r) => ({
      fromKey: r.fromKey, toKey: r.toKey,
      amizade: r.amizade ?? null, comercio: r.comercio ?? null, favores: r.favores ?? null,
      note: r.note ?? null,
    })),
    cartasAbertas: cartasAbertas(f.cartas),
    elenco: Object.entries(HOUSE_CHARACTERS).flatMap(([chave, figuras]) => figuras.map((fig) => {
      const n = f.npcs.find((x) => x.id === characterId(fig.name));
      const morte = cumulativos.find((c) => isDeadInChronicle(fig.name, c.texto))?.turnId ?? null;
      return {
        id: characterId(fig.name), nome: fig.name, afiliacao: chave, papel: fig.role,
        vivo: morte == null, morreuNoTurno: morte,
        humor: n?.mood ?? null, objetivo: n?.objective ?? null,
      };
    })),
  };
}
```

No cabeçalho de `montarEstado`, trocar a linha do aviso por duas:

```javascript
    "> Gerado por `npm run contexto`. Não edite à mão: a próxima execução sobrescreve.",
    "> Para consultar por script em vez de ler, use `estado-atual.json` nesta mesma pasta.",
```

Em `escrever`, acrescentar o terceiro arquivo:

```javascript
async function escrever(pasta, estado, cronica, json) {
  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, "estado.md"), estado, "utf8");
  await writeFile(join(pasta, "cronica.md"), cronica, "utf8");
  await writeFile(join(pasta, "estado-atual.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  ${pasta}/{estado,cronica}.md + estado-atual.json`);
}
```

E as três chamadas em `main`:

```javascript
  await escrever(join(RAIZ, "publico"), montarEstado(f.publico), montarCronica(f.publico), montarJson(f.publico));
  await escrever(join(RAIZ, "mestre"), montarEstado(f.mestre), montarCronica(f.mestre), montarJson(f.mestre));
  for (const [slug, fatia] of Object.entries(f.casas)) {
    await escrever(join(RAIZ, "casas", slug), montarEstado(fatia), montarCronica(fatia), montarJson(fatia));
  }
```

- [ ] **Step 4: Rodar os testes e conferir que passam**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build:shared && npx vitest run backend/scripts/gerar-contexto.test.mjs`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/gerar-contexto.mjs backend/scripts/gerar-contexto.test.mjs
git commit -F - <<'EOF'
feat(contexto): o mesmo estado, legível por script

estado.md é para quem lê; estado-atual.json é para quem consulta. Sai da
mesma fatia e da mesma régua de sigilo — duas fontes divergiriam, e este
repo já pagou por cópia que diverge.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Rodar contra a partição viva e commitar a saída

**Files:**
- Modify: `campaign-context/inverno-dos-mortos/**` (regerado)

Esta tarefa não tem teste unitário: ela é a verificação de fumaça que nenhum teste cobre. O gerador sobrescreve sem perguntar e o `git diff` é a única rede — se ele ficar ilegível, a rede sumiu.

- [ ] **Step 1: Rodar a suíte inteira antes de encostar no banco**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test`
Expected: PASS. Se falhar algo fora de `gerar-contexto`, pare: não é desta entrega. (`CreateHousePage.test.tsx` tem flake conhecido sob carga paralela — rode sozinho para confirmar antes de culpar esta mudança.)

- [ ] **Step 2: Gerar contra a partição viva**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run contexto`
Expected: `1096 itens, 3 Casas de jogador.` (o número de itens sobe com o tempo), seguido de cinco linhas de pasta escrita.

- [ ] **Step 3: Ler o diff e conferir que nada sumiu**

Run: `cd /Users/jessicarosa/turnbasedrpg && git diff --stat campaign-context/ && git diff campaign-context/inverno-dos-mortos/mestre/estado.md | head -120`

Conferir, no arquivo do Mestre:
- as seções que já existiam continuam lá: "Fatos do mundo", "Pactos de pé", "Casas", "Favores", "Memória viva dos NPCs", "Trilha de atributos", "Metaplot";
- "Projetos" agora tem `### Do Ouro`, `### Khazdrun`, `### Solarion` e as três "Estabelecer uma Rota de Caravanas" saem distinguíveis;
- "Energia do turno" mostra Do Ouro como `não alocou`;
- "Relações entre Casas" tem linhas, e o `publico/estado.md` **não** tem essa seção;
- `campaign-context/inverno-dos-mortos/publico/estado-atual.json` tem `"relacoes": []` e nenhuma casa com `atributos`.

Se qualquer seção antiga tiver sumido, pare e conserte antes de commitar.

- [ ] **Step 4: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add campaign-context/
git commit -F - <<'EOF'
chore(contexto): regerar do banco com os blocos novos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Verificação final

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run typecheck && npm test`

`typecheck` não cobre `.mjs`, mas cobre o `shared` que a Tarefa 2 passou a exigir construído. Se `tsc` reclamar de `shared`, o `build:shared` dentro de `npm run contexto` estava mascarando um erro anterior.
