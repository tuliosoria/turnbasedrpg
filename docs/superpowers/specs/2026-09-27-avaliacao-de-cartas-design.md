---
title: "Avaliação de cartas — medir antes de mexer no prompt"
setting: "Valdren"
status: "Design aprovado"
date: 2026-09-27
visibility: "Engenharia + Mestre"
---

# O problema

Toda mudança nas cartas diplomáticas foi julgada no olho: ler duas ou três
respostas e decidir se melhorou. A skill `mexer-em-prompt-de-carta` manda medir
antes e depois, mas só existe instrumento para contar regras do prompt — nada
mede a carta que sai.

A consequência imediata: a memória de conversa (27/09) está commitada e não
deployada, e há propostas de somar um detector de repetição e novos itens ao
revisor. Sem medição, não dá para saber se a repetição sobreviveu à correção
da memória ou se a proposta conserta um problema que já não existe.

# Objetivo

Uma ferramenta permanente que roda o pipeline REAL de resposta (dossiê →
escritor → revisor → assinatura) sobre um estado congelado do banco, para um
conjunto fixo de cartas reais, e mede cada resposta em código.

Ela responde, com números:

1. a memória nova reduz repetição em relação ao código em produção?
2. depois dela, ainda vale criar detector de repetição ou ajustar o revisor?

E fica disponível para toda mudança futura de prompt.

# Abordagem

Replay do pipeline real sobre snapshot congelado (**A**), com as cartas
gravadas em produção medidas como linha de base (**C**). Rejeitada a
alternativa de congelar o prompt pronto: ela não mede mudança de memória,
porque a memória é justamente quem monta o prompt.

# Componentes

| Unidade | Arquivo | Papel |
|---|---|---|
| `snapshotNoMomento` | `backend/src/avaliacao/momento.ts` | Pura. Recebe itens do banco e o `sentId`; devolve os itens como estavam quando a carta chegou. |
| `docEmMemoria` | `backend/src/avaliacao/docEmMemoria.ts` | `DocumentClient` falso: `Query` (`PK = :pk AND begins_with(SK, :sk)`, com paginação), `Get` e `Put`. Escritas ficam capturadas em memória. Comando desconhecido **lança erro**. |
| `medirCarta` | `backend/scripts/medir-carta.mjs` | Pura, sem modelo. As métricas abaixo. Mora ao lado de `gerar-snapshot-turno.mjs` para reusar `extrairPrazo`, `conferirOrdem` e `MARCADOR_PEDIDO`. |
| runner | `backend/scripts/avaliar-cartas.mjs` | Cola: exporta snapshot, roda casos, grava resultados e relatório. |
| casos | `backend/avaliacao/casos.json` | Só ids e o porquê de cada caso. Versionado. |
| snapshot | `backend/avaliacao/snapshots/` | Export do banco. **Gitignored**: contém metaplot e segredos das Casas. |
| resultados | `backend/avaliacao/resultados/<rotulo>.json` e `relatorio.md` | Versionados. |

## `snapshotNoMomento`

- Localiza a carta `sentId` entre os `DIPLMSG#`; ausente → erro.
- Retira `DIPLMSG#`, `CFACT#` e `WFACT#` com `createdAt` posterior ao da carta,
  e todo `TURN#` de turno maior que o da carta. `TURN#` do próprio turno fica
  (é o turno ativo do momento).
- Mantém itens de estado sem história (`NPCDYN#`, `HRELATION#`, `HOUSE#`,
  `WIKI#`…). O relatório declara isso: o replay é aproximado como história,
  mas **idêntico entre rótulos**, que é o que um benchmark precisa.

## `docEmMemoria`

Suporta exatamente o que o pipeline usa. Um comando que ele não conhece aborta
a execução: devolver vazio em silêncio faria a carta ser gerada sem contexto e
a métrica parecer regressão.

## Métricas (`medirCarta`)

`morteAfirmada` usa um detector mais largo que o do cânone: aceita "caiu"/"cair" e não retira a posse ("de Thorgul"), porque o do cânone não pegava justamente o caso Thorgul. Falso positivo custa uma olhada no relatório. `nomesForaDoCanone` considera conhecido tudo o que estava no prompt do escritor: nome fora do material é invenção.

| Métrica | Cálculo |
|---|---|
| `reciclagem` | Fração dos shingles de 5 palavras (dobradas, sem acento) da resposta que já aparecem nas cartas **anteriores da mesma Casa no mesmo fio**. |
| `termosBatidos` | Os 5 bigramas/palavras de conteúdo mais frequentes no fio anterior, e quantas vezes cada um aparece na resposta. |
| `eco` | Perguntas e pedidos da carta recebida (frases com `?` ou verbo de pedido); para cada um, `conferirOrdem` contra a resposta. Razão respondidas/total, com a lista das sem eco. Proxy lexical — o relatório mostra o texto. |
| `prazos` | Quantos prazos `extrairPrazo` encontra na resposta. |
| `escala` | `escalaAbsurda(resposta)`. |
| `nomesForaDoCanone` | Sequências capitalizadas que não estão no conjunto de nomes conhecidos (elenco, Codex, títulos do wiki, sedes, cidades e o próprio fio). |
| `morteAfirmada` | Pessoas vivas no material do momento que a resposta dá como mortas (`leaderIsDead`). |
| `motivosRevisor` | A lista `motivos` do JSON do revisor. |
| `tamanho` / `vazia` | Caracteres; vazia depois das duas tentativas. |

A coluna `producao` aplica as mesmas métricas à resposta gravada no banco para
aquela carta — custo zero, linha de base do que o jogador recebeu.

## Critério de decisão (fixado antes de medir)

Com base no rótulo `depois` (código com memória nova):

- **Criar detector de repetição** se a mediana de `reciclagem` for ≥ 0,15, ou
  se ≥ 2 casos tiverem um termo batido repetido ≥ 3 vezes.
- **Ajustar o revisor** (dobrar "pergunta ignorada" e "decisão reaberta" nos
  itens 2 e 1, sem criar itens novos) se `eco` < 0,7 em ≥ 2 casos, ou se houver
  `morteAfirmada`.
- **Caso contrário:** deployar a memória e parar.

O limiar 0,15 é chute inicial. Antes de medir `antes`/`depois`, ele é
calibrado na coluna `producao` e a calibração fica registrada no relatório.

# Casos iniciais

Oito cartas de jogador já respondidas (ids em `casos.json`):

1. Solarion × Mandíbula — a última carta (pergunta estratégica após o escambo longo)
2. Solarion × Mandíbula — mudança de assunto (pesquisadores ao Vau Negro): a Casa acompanha o assunto novo?
3. Khazdrun × Ferrumor — convite a conversar respondido com minuta
4. Solarion × Karasoy — encontro em capital de terceiro
5. Khazdrun × Ulgar — fio longo
6. Solarion × Euralune — fio longo
7. Do Ouro × Valerius — terceiro jogador, fio de desconfiança
8. Solarion × Ordem dos Três — NPC de organização (voz do Codex)

Cartas proativas ficam fora da v1.

# Antes e depois

O runner usa o código do diretório em que roda e grava o commit no resultado.
Para medir o código antigo, roda-se o mesmo runner num worktree em `cb673ac`
(commit anterior à memória), com `src/avaliacao/`, `scripts/medir-carta.mjs`,
`scripts/avaliar-cartas.mjs` e o `gerar-snapshot-turno.mjs` atual copiados para lá.

# Uso e custo

```
npm --prefix backend run avaliar-cartas -- exportar           # snapshot do banco (leitura)
npm --prefix backend run avaliar-cartas -- rodar --rotulo depois [--seco] [--casos 1,3] [--repeticoes 2]
npm --prefix backend run avaliar-cartas -- relatorio
```

- `--prompts` grava o que o escritor recebeu em `avaliacao/snapshots/prompts/` (ignorada).
- `--seco` roda o pipeline inteiro com `chat` falso: custo zero, serve de smoke
  e mostra o tamanho do prompt por caso.
- Execução paga: 8 casos × 2 repetições × 2 rótulos ≈ 32 gerações, 64–96
  chamadas ao modelo de diplomacia. O runner imprime o plano antes de chamar.
- A chave da OpenAI vem da configuração da Lambda, como variável de ambiente em
  memória, igual aos outros scripts. Nunca em arquivo.

# Falhas

- `sentId` ausente no snapshot → o caso aborta, visível no relatório.
- Comando desconhecido no doc falso → aborta tudo.
- Erro de OpenAI → uma repetição, depois `erro` no caso; a execução segue.
- Resposta vazia é resultado, não erro.
- Resultados são gravados caso a caso.

# Testes

- vitest: `snapshotNoMomento` (corta depois da carta, mantém estado, turno
  certo), `docEmMemoria` (`begins_with`, `Put` capturado, comando
  desconhecido lança), cada métrica de `medir-carta.mjs` com frases reais,
  `resumir` e `decidir` (o critério) em `avaliar-cartas.test.mjs`.
- Smoke: uma execução `--seco` com snapshot sintético.

# Handoff

A skill `mexer-em-prompt-de-carta` ganha o passo: rodar `avaliar-cartas`
antes e depois, e citar o relatório no commit.

# Fora de escopo

Juiz por IA, cartas proativas, automação em CI, deploy.
