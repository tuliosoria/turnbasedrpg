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

Em `MESTRE/` também ficam as **notas de turno** (`NOTAS_TURNO_<N>.md`: o que o Mestre
decidiu, o que foi aplicado, o que ficou pendente) e o cânone que nasce na mesa
(`18_A_FORJA_DA_LUA_E_OS_TRES_ARTEFATOS.md`: a coroa, o colar, o bracelete, Ithren, a
queda da Ordem dos Três). Leia a nota do último turno antes de escrever o próximo.

## Antes de mexer

- **`vitest` não faz typecheck.** Rode `tsc --noEmit` nos três pacotes, sempre.
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

**Medir é com a avaliação de cartas** (`backend/scripts/avaliar-cartas.mjs`, desenho em
`docs/superpowers/specs/2026-09-27-avaliacao-de-cartas-design.md`): roda o pipeline real
sobre o banco congelado, com escritas em memória, e mede cada resposta. Os números dizem
onde olhar; o texto lado a lado decide. O "eco" de perguntas é proxy lexical e já se
provou cego a paráfrase.

### Carta escrita pelo Mestre

Carta com id `gm-` é autoria do Mestre: os scripts de reescrita nunca a tocam. Vai no fio
onde a conversa do turno está (`toCharacterId` de quem o jogador escreveu); no fio
errado, o painel do jogador a esconde. O sino avisa de carta de NPC que ninguém pediu
(sem `replyToId`) chegada depois da última carta do jogador, e se cala quando ele
responde.

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
  A reescrita mantém prazo de 1 turno, e prêmio maior é descartado (fica o original).
- **Não há mesa de aprovação** (desde 24/09/2026): toda carta aceita começa na
  hora, pagando o custo — nem Mestre nem Casa alvo aprovam. `ativarCarta` em
  `routes/projectRoutes.ts` só confere teto de cartas e custo. Os campos
  `requiresGmApproval`/`requiresTargetApproval` ficaram como informação.
- **Custo de início se paga uma vez só.** `inicioPago` é gravado na cobrança, e
  `jaPagouInicio` (que também aceita `refeita`) guarda todo caminho de ativação.
  Reescrever uma carta a devolve para aceite; antes disso, o aceite cobrava de
  novo (Solarion pagou 4 Recursos a mais em 24/09/2026).
- **Tela do jogador** (`frontend/src/components/projetos/`): Energia grava a cada
  toque (`useEnergiaAutoSave`), sempre com o mapa INTEIRO da Casa — a aba
  Espiões é um recorte, e gravar só o recorte apagaria a Energia das obras. A
  revelação lembra o que já foi visto em localStorage por aparelho
  (`valdren.revelacao.<houseId>.<projetos|espioes>`, um "visto" por aba). Cor turquesa `brand.energia` é só de Energia.

## Rascunho de turno

`backend/scripts/push-turn-draft.mjs` manda o rascunho para o admin revisar.
**Texto de resultado vai em `resolution`, não em `publicEvent`** — o banner só
oferece resultado com o turno em `LOCKED`, e no slot errado ele se recolhe numa
linha cinza que parece "nada chegou".

### Onde cada texto mora

| Texto | Campo | Quando nasce |
|---|---|---|
| Evento público do turno N | `TURN#0NN.publicEvent` | na abertura de N |
| Privado do turno N | `TURN#0NN.privateInfo[houseId]` | na abertura de N; aparece **abaixo** do resultado de N |
| Resultado do turno N | `TURN#0NN.result.{publicResult, houseResults, discoveries}` | na resolução de N |
| Rascunho | `TURNDRAFT#CURRENT` | `resolution` serve ao turno LOCKED; `publicEvent`/`privateInfo` servem ao próximo turno, ainda em DRAFT |

Um rascunho carrega **as duas metades**: o resultado do turno que fecha e a abertura do
que vem. Quando o Mestre aplica antes de você atualizar o rascunho, a mudança tardia
fica fora do turno; confira o que foi gravado antes de reenviar.

### Validar e gravar

- `npm run validar N` só lê turno já resolvido. Para validar um rascunho, importe
  `CHECKS` de `validar-turno.mjs` e rode sobre o texto do rascunho e uma exportação do
  banco (`npm --prefix backend run avaliar-cartas -- exportar`).
- **Os atributos que o Mestre aplicou prevalecem:** se o texto diz outro número, ajuste
  o texto, não a ficha.
- Mexer em turno já gravado: backup em `backups/turnos/` antes, `update-item` com
  condição sobre o valor que você leu, releia do banco depois, e regere `npm run
  contexto` e `npm run snapshot N`.
- A exportação nomeia o arquivo pela data **UTC**: perto da meia-noite ele vira o dia
  seguinte, e comparar com o arquivo de ontem dá falso "não bateu".
