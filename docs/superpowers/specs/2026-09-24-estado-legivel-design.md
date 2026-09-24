---
title: "Estado legível — reconstruir o mundo sem ter estado na conversa"
setting: "Valdren"
status: "Design aprovado (brainstorming feito com o autor)"
date: 2026-09-24
visibility: "Engenharia + Mestre"
---

# O problema

Um agente ou uma pessoa sem nenhum contexto de conversa deve conseguir dizer o
estado atual do mundo lendo só o repo, o banco e os `.md`. Hoje não consegue —
e o motivo não é falta de máquina.

`npm run contexto`, `npm run snapshot` e `npm run validar` já existem, escrevem
102 arquivos versionados em `campaign-context/` e já pegam defeito de turno. O
que falta é o que eles deixam de fora.

Auditoria de 24/09/2026, feita contra a partição viva `CAMPAIGN#WINTER_DEAD`
(1096 itens):

| Categoria | Onde mora | O que não chega ao `.md` |
|---|---|---|
| Mundo | `TURN#0NN`, `WFACT#` 103 | Evento ativo não é entidade: cerco, coroação convocada e a fileira diante de Droskar só existem como prosa dentro do `publicResult` do T10 |
| Casas | `HOUSE#` ×3, `HATTR#` 12, `HRELATION#` 36 | **As 36 relações são carregadas e jogadas fora.** `separarPorAudiencia` as entrega às três audiências e `montarEstado` não tem bloco para elas |
| Projetos | `PROJECT#` ×24, tipo rico | Dono, progresso, prazo, efeito e id. "Estabelecer uma Rota de Caravanas" sai 3× com status diferentes e sem como distinguir |
| Correspondência | `DIPLMSG#` 321, `CFACT#` 142, `FAVOR#` 12 | Nenhum índice de fio aberto: 83 das 146 cartas de T≥10 não têm resposta registrada |
| Personagens | `NPCDYN#` 20, `WIKI#` 138, `VENTITY#` CHARACTER ×29 | Elenco e mortalidade. `lore/mortality.ts` deriva quem morreu e nunca é emitido |
| Energia | `ENERGY#` 12 | Tudo. E a alocação aponta para **id de projeto**, que não existe em `.md` nenhum |

Estado da campanha na data: turno 10 é o último com conteúdo publicado;
`TURN#011` está `OPEN` com `publicEvent` vazio e sem submissões.

# A decisão de arquitetura

Três caminhos foram considerados:

**A. Um pipeline só, do banco para fora.** `gerar-contexto.mjs` segue como
único produtor, ganha blocos e passa a emitir também JSON.

**B. Snapshot curado à mão** (`docs/WORLD_STATE.md` mantido pelo Mestre). Lê
melhor e cria uma segunda fonte que envelhece em silêncio — é o "contexto que só
existe na conversa" com outro nome e um arquivo em volta.

**C. Enriquecer o banco primeiro**, com entidades novas, e o gerador só reflete.
Correto no fim, caro no começo, e toca tipo que o frontend lê ao vivo.

**Escolhido: A.** O motivo está na linha de `HRELATION` da tabela acima —
metade do que falta não falta, só não está sendo escrita. Gastar primeiro em
curadoria manual ou em schema novo é pagar caro por algo que hoje custa um bloco
de `montarEstado`. C vem depois, no sub-projeto 3, só onde A não alcança. B está
descartado.

Esta spec cobre **o sub-projeto 1 de quatro**. Os outros três têm risco e
caminho próprios e ficam explicitamente fora (ver "Fora de escopo").

# O que muda

Tudo em `backend/scripts/gerar-contexto.mjs` e seu teste. As funções
`separarPorAudiencia`, `montarEstado` e `montarCronica` continuam puras: é o que
permite que sigilo seja asserção e não julgamento.

## Projetos — agrupados por Casa e por situação

Substitui a linha atual (`título — STATUS (outcome)`), que é o que torna três
projetos homônimos indistinguíveis. A forma (os turnos abaixo são ilustrativos,
menos os do Balões de Vento, que são reais):

```
### Solarion
**Em andamento**
- Estufas de Cogumelos: Produção Acelerada — 0/3 turnos · desde T11 · `8cc1vuj26u`
**Esperando decisão**
- Construção do Obelisco e do Observatório — PENDING_GM desde T10 · `…`
- Estabelecer uma Rota de Caravanas — PENDING_TARGET desde T6 · `…`
**Concluídos**
- Desenvolvimento dos Balões de Vento — T10, SUCCESS → ativo "Balão de Vento"
**Encerrados sem efeito**
- Estabelecer uma Rota de Caravanas — CANCELLED no T8
```

Mapa de `ProjectStatus` para grupo:

| Grupo | Status |
|---|---|
| Em andamento | `ACTIVE`, `APPROVED`, `PAUSED` |
| Esperando decisão | `PENDING_GM`, `PENDING_TARGET`, `PENDING_PLAYER`, `PENDING_AI`, `DRAFT` |
| Concluídos | `COMPLETED` |
| Encerrados sem efeito | `CANCELLED`, `FAILED`, `REJECTED` |

Progresso é `turnsCompleted/durationTurns`; "desde" é `createdAtTurn`; o efeito
vem de `completionEffects` (ativos, mudanças de atributo, favores, desbloqueios),
só para concluídos. O id vai em `código` no **fim** da linha: quem lê pula, quem
cruza com Energia acha.

## Energia — o turno corrente, com id resolvido

`ENERGY#0NN#<casa>` guarda `porProjeto: { "<projectId>": pontos }`. O bloco
resolve o id para o título usando os mesmos projetos já carregados:

```
- Khazdrun (T11) — 3 de 3 pontos: Projéteis Incendiários 1, Carroças de Cerco 1, Trabuco 1
- Solarion (T11) — 2 de 3 pontos: …
- Do Ouro (T11) — não alocou
```

Casa sem item `ENERGY#` sai como **"não alocou"**, nunca omitida. Ausência
silenciosa é indistinguível de bug de leitura, e Do Ouro não tem nenhum item de
Energia em turno nenhum.

Se um id de `porProjeto` não achar projeto correspondente, a linha sai com o id
cru e a marca `(projeto não encontrado)` — o gerador nunca engole referência
quebrada.

## Relações — e a régua de sigilo

Este é o único risco de correção da entrega. Hoje `separarPorAudiencia` entrega
`relacoes` às três audiências e nada vaza porque nada é renderizado. Escrever o
bloco sem mexer no recorte vazaria: o que Auremont sente pela Casa do Ouro
(`amizade 58, comercio 70, favores 55`) não é coisa que Solarion saiba.

A régua, igual à que já existe para ficha de atributo:

- **`mestre/`** — todas as 36 linhas.
- **`casas/<nome>/`** — só as linhas em que a Casa é o `fromKey`: o que ela
  sente, nunca o que sentem dela.
- **`publico/`** — nenhuma. `relacoes` passa a ser `[]` nessa fatia.

Formato: `casa-auremont → casa-do-ouro — amizade 58, comércio 70, favores 55`,
seguido da `note` quando houver.

## Elenco — vivo e morto

`shared/src/lore/mortality.ts` já deriva a morte da crônica pública, em código,
justamente para o modelo não decidir isso — a primeira versão gerada por IA matou
Lady Celene Valerius, que aparece viva e agindo no turno 3. A derivação existe e
nunca é emitida.

O bloco lista o elenco com vivo/morto e o turno da morte, e junta humor e
objetivo do `NPCDYN#` quando existir (hoje 20 NPCs).

**Custo de acoplamento, decidido:** `gerar-contexto.mjs` hoje não importa nada
além de `node:fs/promises` e `node:path`, e `npm run contexto` não roda
`build:shared`. Usar `mortality.ts` quebra as duas coisas. A alternativa era
portar a derivação para dentro do script, e ela está **descartada**: duplicar
essa regra específica é exatamente como o bug nasceu.

`package.json` passa a ter:

```json
"contexto": "npm run build:shared && node backend/scripts/gerar-contexto.mjs"
```

## Cartas abertas

Bloco por par, ordenado pela espera mais antiga. Derivado de `replyToId`, sem
campo novo no banco:

```
- Solarion → Vargen — 2 cartas sem resposta desde T9
```

Uma carta conta como aberta quando nenhum outro `DIPLMSG#` a cita em
`replyToId`. Hoje isso dá 83 fios em T≥10. A definição é deliberadamente
mecânica: "sem resposta registrada" não é o mesmo que "esperando resposta", e o
título do bloco diz isso em uma linha, porque o gerador não tem como saber a
diferença e não deve fingir que sabe.

O recorte por audiência segue o das cartas, que já existe: cada Casa vê os fios
em que ela é parte; o Mestre vê todos; o público não vê nenhum.

## `estado-atual.json`

Mesmo recorte, sem prosa, um arquivo por audiência ao lado do `.md`:

```
campaign-context/inverno-dos-mortos/mestre/estado-atual.json
campaign-context/inverno-dos-mortos/publico/estado-atual.json
campaign-context/inverno-dos-mortos/casas/<nome>/estado-atual.json
```

Forma:

```jsonc
{
  "geradoEm": "2026-09-24T…",
  "turno": { "atual": 11, "status": "OPEN", "ultimoPublicado": 10 },
  "casas": [{ "houseId", "nome", "atributos", "estabilidade", "ativos" }],
  "projetos": [{ "id", "houseId", "titulo", "status", "grupo",
                 "turnsCompleted", "durationTurns", "criadoNoTurno",
                 "efeitos", "outcome" }],
  "energia": [{ "turnId", "houseId", "porProjeto": [{ "id", "titulo", "pontos" }] }],
  "fatos": [{ "turnNumber", "visibility", "status", "summary" }],
  "pactos": [{ "kind", "betweenA", "betweenB", "status", "summary" }],
  "favores": [{ "status", "fromHouseId", "toHouseId", "reason" }],
  "relacoes": [{ "fromKey", "toKey", "amizade", "comercio", "favores", "note" }],
  "cartasAbertas": [{ "de", "para", "quantas", "desdeTurno" }],
  "elenco": [{ "id", "nome", "vivo", "morreuNoTurno", "humor", "objetivo" }]
}
```

Sai do mesmo `separarPorAudiencia`, no mesmo comando, com a mesma régua de
sigilo aplicada pela mesma função. É isso — e só isso — que garante que os dois
formatos não divirjam. O `.md` é para uma pessoa e para um modelo lendo
contexto; o `.json` é para um script que pergunta "quais projetos da Solarion
estão `ACTIVE`" sem parsear prosa.

Um cabeçalho novo no `.md` aponta para o irmão, para quem chegou pelo arquivo
errado.

# Testes

Em `backend/scripts/gerar-contexto.test.mjs`, que já cobre as funções puras.
Três asserções carregam o peso:

1. **Sigilo das relações** — dada uma partição com
   `HRELATION#casa-auremont#casa-do-ouro`, a fatia de Solarion não contém
   `auremont` nem os três números, e a fatia pública não contém relação nenhuma.
   É o teste que fecha o vazamento que o bloco novo abriu.
2. **Projeto homônimo** — dois projetos de mesmo título e status diferentes saem
   em grupos diferentes e distinguíveis. É o caso real da "Rota de Caravanas".
3. **JSON e MD concordam** — para a mesma partição, todo projeto do `.json`
   aparece no `.md` e vice-versa.

Mais duas, menores: Casa sem `ENERGY#` sai como "não alocou"; id de
`porProjeto` sem projeto correspondente sai marcado em vez de sumir.

E uma de fumaça, não unitária: rodar `npm run contexto` contra a partição viva e
ler o `git diff`, conferindo que nenhuma seção que existia foi apagada. O
gerador sobrescreve sem perguntar e o `git diff` é a única rede — se ele ficar
ilegível, a rede sumiu.

# Risco e migração

**Risco para o jogo ao vivo: nenhum, por construção.** Nada aqui toca Lambda,
rota, tabela ou frontend. `gerar-contexto.mjs` é script local que só lê a
partição por `QueryCommand`, e `campaign-context/` não é lido por nenhum código
de produção — só por pessoas e agentes. O pior caso é arquivo gerado feio,
corrigido com outro `npm run contexto`.

**Migração: não há.** Os arquivos são regenerados inteiros, e o commit que
trouxer o gerador novo traz a saída nova no mesmo diff — como nas viradas
anteriores.

O único efeito colateral é `npm run contexto` deixar de ser instantâneo, por
causa do `build:shared`. Aceito na Seção 2 do brainstorming.

# Fora de escopo

Os outros três sub-projetos, cada um com spec própria:

- **Cânone reconciliado** — 20 dos 21 itens `GM#` do banco vêm do seed
  `shared/src/defaultGm.ts`, onde o inimigo é *Othmar I, o Rei Pálido*.
  `valdren-context/MESTRE/15_SEGREDOS…md:31` diz que o nome canônico é **Rei
  Branco** e que nomes de trabalho antigos foram descartados. A Bíblia do Mestre
  servida no admin contradiz o cânone autoral. Risco médio: é reescrita de texto
  autoral, a operação mais perigosa do repo.
- **Estado queryável** — `House.territories[]`, registro de forças, evento ativo
  como entidade, promoção dos nomes que `validar` já acusa (22 no turno 10,
  incluindo *Vórtice Branco* e *Elira Vargen*). Toca tipo que o frontend lê.
- **Disciplina de virada** — skills `estado-do-mundo` e `virar-turno`,
  convenção em `campaign-context/README.md`, `diff-turno`, e a correção de
  `docs/campaign-spec.md` §4, que ainda promete turnos versionados em
  `src/content/turns/turn-001.ts`. Depende de 1 e 3: skill que aponta para
  arquivo inexistente é pior que skill nenhuma.

Sobre o caminho das skills: o pedido original falava em `.agent/skills/`, mas o
repo já usa `.claude/skills/` com cinco skills vivas citadas pelo nome no
`CLAUDE.md`. Duas árvores de skill divergindo é a duplicação que esta auditoria
existe para matar — fica em `.claude/skills/`.
