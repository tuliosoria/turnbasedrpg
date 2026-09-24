# Valdren — instruções do projeto

RPG político por correspondência, mundo autoral **Valdren**. Monorepo TypeScript:
`shared` (`@ravenloft/content`) · `backend` (Lambda + SAM + DynamoDB) · `frontend`
(React + Vite + MUI). **Interface e lore em português.**

- Produção: **valdrenrpg.com** (Amplify `d1emmrcvmpw55g`)
- API: `https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com`
- Tabela `ravenloft-game`, PK `CAMPAIGN#WINTER_DEAD`, região `us-east-1`
- Casas de jogador: `solarion-k0hc`, `khazdrun-wxey`, `do-ouro-g0gg`

## O que já aconteceu

`campaign-context/inverno-dos-mortos/` guarda a campanha em Markdown, gerada do
banco por `npm run contexto`. Uma pasta por audiência: `publico/`, `mestre/` e
`casas/<nome>/`, cada uma com `estado.md` (onde as coisas estão) e `cronica.md`
(como se chegou aqui).

**Leia `mestre/` antes de rascunhar turno ou responder sobre a campanha.** Sem
isso o hábito é escavar o DynamoDB item por item, que já custou uma sessão
inteira para achar um fio que atravessava quatro turnos.

Não edite os arquivos: a próxima execução sobrescreve. O metaplot não é gerado —
ele é autoral e vive em `valdren-context/MESTRE/`.

## Antes de mexer

- **`npm test` na raiz faz o typecheck.** O `tsc` de `build:shared` barra erro
  de tipo em `shared`; em seguida `tsc --noEmit` roda em `backend` e `frontend`,
  antes dos vitest. `vitest` sozinho não checa tipo. `npm run typecheck` continua
  sendo o atalho dos três pacotes.
- **Mudou `shared`? Rode `npm run build:shared`** antes de o backend enxergar o símbolo novo.
- Deploy é **manual e em dois passos** — veja a skill `deploy`.
- Segredos (chave da OpenAI, `DRAFT_INGEST_TOKEN`) **nunca** vão para arquivo nem commit.
  Puxe da config da Lambda como variável de ambiente em memória.
- O **metaplot é só do Mestre**. Nunca exponha no wiki público, na Bíblia do mundo,
  nem em resposta de NPC.

## As cartas

O coração do jogo. Dois caminhos, um pipeline.

```
dossiê (código, sem modelo) → escritor (1 chamada) → revisor (1 chamada) → grava
```

| Módulo | Papel |
|---|---|
| `ai/diplomacy/dossie.ts` | Monta em código o fio COMPLETO entre as duas Casas e o que já foi combinado. Determinístico de propósito: é a parte que não pode alucinar. |
| `ai/diplomacy/housePrompt.ts` | Prompt de RESPOSTA a carta de jogador. |
| `ai/diplomacy/outreachPrompt.ts` | Prompt da carta PROATIVA, que o mundo escreve sozinho. |
| `ai/diplomacy/revisor.ts` | Segunda leitura. Recebe o MESMO material do escritor. |
| `ai/diplomacy/estado.ts` | Quem escreve por dentro: humor, medo, cartas sem resposta, ressentimento. |
| `ai/diplomacy/estagio.ts` · `leitura.ts` · `crise.ts` · `voice.ts` · `escala.ts` · `lados.ts` | Blocos de regra, compartilhados pelos dois prompts. |
| `diplomacy/gerarResposta.ts` | Worker da resposta (900s). |
| `diplomacy/cartasDoMundo.ts` | Worker das cartas proativas (900s). |

### Regras que o sistema garante, e por que existem

Cada uma nasceu de uma falha real. Não remova sem entender qual.

- **O revisor falha para o lado seguro.** Vazio, JSON quebrado ou carta truncada
  e vale o rascunho. Ele pode melhorar uma carta; nunca pode fazê-la sumir.
- **A IA nunca responde por outro jogador.** Carta entre jogadores não dispara
  worker de resposta. Do outro lado há uma pessoa.
- **Fio entre jogadores usa chave canônica** (`playerPairKey`, as duas sedes em
  ordem). Um registro só, lido pelos dois — cópia que diverge é bug garantido.
- **Só assina quem existe no cânone**, ou "pela chancelaria de X" sem nome. Sem
  isso o modelo inventa personagens que a campanha passa a ter sem ficha.
- **`troca` é opcional.** Carta de aviso ou ameaça tem `troca: null`, e isso é o
  certo. Quando era obrigatório, toda carta virava nota de mercadoria.
- **Fatos privados nunca entram em carta.** `selectFactsForLetter` só devolve
  públicos; `WorldFact.visibility` guarda a sede dona do segredo.

### A armadilha principal: regra acumula

Este sistema já quebrou quatro vezes pelo mesmo motivo — **eu somei uma regra
para consertar uma falha, e a soma virou um formulário**. A cadeia real:

```
carta vazia  → "toda carta precisa de movimento concreto"
             → tudo virou escambo
             → "seja concreto no que o assunto pedir"
             → prazo em 17 de 18 cartas
             → o jogador disse que parecia robô

carta melosa → "cordial não é o padrão"
             → todo Valdren virou o mesmo diplomata rancoroso
```

**Antes de somar regra, tente tirar.** E se a regra é fiscalização — "isto não
pode faltar" — ela pertence ao **revisor**, que lê a carta pronta, e não ao
escritor, que só consegue adivinhar antes de existir texto.

Use a skill `mexer-em-prompt-de-carta`: ela obriga medir antes e depois. Linha de
base em 13/09/2026: **46 regras e 7 obrigações** no prompt de resposta. O pior
momento foram 52 e 9.

### Modelos e tetos

- Diplomacia: `gpt-5.5` com `reasoning_effort: "high"`. Resto: `gpt-4o-mini`.
- **Tokens de raciocínio saem do MESMO orçamento da resposta.** Teto baixo devolve
  **string vazia**, não erro — foi assim que cartas sumiram em silêncio três vezes.
  Piso atual: 4000 nas cartas. Sempre com uma repetição: vazio é aleatório.
- Timeout do cliente: **180s** para modelo de raciocínio. Com esforço alto uma
  carta leva de 25 a 70 segundos, e 60s cortava as mais pensadas — o erro chegava
  como "Falha ao contatar a IA", que parece rede e é relógio.
- Nada de IA na requisição do gateway: são 30s. Use os workers.

## Cartas de projeto

- `PASSO_POR_TURNO = 1`: a carta avança um passo por turno mesmo sem Energia.
- `refeita: true` pula o juiz de desfecho — é reparação de bug, não nova aposta.
  A reescrita mantém prazo de 1 turno, e prêmio maior desce para o Mestre.

## Rascunho de turno

`backend/scripts/push-turn-draft.mjs` manda o rascunho para o admin revisar.
**Texto de resultado vai em `resolution`, não em `publicEvent`** — o banner só
oferece resultado com o turno em `LOCKED`, e no slot errado ele se recolhe numa
linha cinza que parece "nada chegou".
