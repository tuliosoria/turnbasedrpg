---
title: "Contexto de Campanha — o que já aconteceu, legível por quem precisa"
setting: "Valdren"
status: "Design aprovado (brainstorming feito com o autor)"
date: 2026-09-18
visibility: "Engenharia + Mestre"
---

# O problema

A verdade da campanha está toda no DynamoDB e não é legível por ninguém sem
escavar. Em 18/09/2026, para responder "de onde vem esse prisioneiro?", foi
preciso varrer os 930 itens da partição, caçar a palavra em todos os campos de
todos os registros e remontar à mão a trilha das moedas pelos turnos 6 a 9.
Isso deveria ter sido uma leitura.

Três consumidores sofrem do mesmo buraco, de formas diferentes:

| Consumidor | O que tem hoje |
|---|---|
| Correspondências | `dossie.ts`, 76 linhas: o fio daquele par e os compromissos dele. Nada do mundo além dos fatos públicos que `selectFactsForLetter` injeta. |
| Turno novo | Nada montado. O Mestre escreve de memória. |
| Terminal (Claude) | Nada. Reconstrói do banco a cada sessão. |

E o lugar certo já existe, vazio. `campaign-context/inverno-dos-mortos/` não tem
um único arquivo, embora o README ao lado descreva exatamente esta separação:
cânone é verdade fixa, campanha é o que aconteceu, e quem monta contexto para IA
deve ler as duas sabendo qual é qual.

Pior: o arquivo que deveria cobrir esse buraco,
`valdren-context/CAMPANHA/14_ESTADO_ATUAL_E_TURNOS_PUBLICADOS.md`, chama-se
"Estado Atual da Campanha", **para no turno 2** e não é tocado desde 06/08.
Estamos no turno 10. Ele também viola a regra do próprio README, porque guarda
estado de partida dentro do cânone.

Esse envelhecimento silencioso é o que o desenho abaixo precisa impedir.

---

# Decisões tomadas com o autor

1. **Gerado do DynamoDB**, não escrito à mão. Um contexto que depende de
   disciplina humana é um contexto que envelhece oito turnos sem ninguém notar —
   já aconteceu, e é o arquivo citado acima.
2. **Um arquivo por audiência.** Público, um por Casa de jogador, e Mestre.
   Vazamento passa a ser erro de caminho de arquivo, não erro de julgamento de um
   modelo.
3. **Duas formas: estado e crônica.** `estado.md` é *onde as coisas estão
   agora*; `cronica.md` é *como se chegou aqui*. Consumidores diferentes têm
   apetites opostos, e ambos saem da mesma fonte.
4. **As cartas recebem um resumo curto do mundo**, não o estado inteiro.
5. **Script único** (`gerar-contexto.mjs`) com teste ao lado, na convenção que o
   repo já usa em `compile-book.mjs`, `export-book.mjs` e `replace-wiki.mjs`.

O autor considerou e recusou: manter a crônica à mão; um arquivo só com marcação
de visibilidade filtrada na hora; e gerar na resolução do turno dentro da Lambda.

---

# Parte A — Onde as coisas ficam

```
campaign-context/inverno-dos-mortos/
  publico/          estado.md   cronica.md
  mestre/           estado.md   cronica.md
  casas/khazdrun/   estado.md   cronica.md
  casas/solarion/   estado.md   cronica.md
  casas/do-ouro/    estado.md   cronica.md
```

Uma pasta por audiência. Não se lê a pasta errada por acidente, e um `grep` no
arquivo público nunca devolve segredo.

A pasta de cada Casa usa o **nome curto em slug** (`do-ouro`), decidido pelo
autor, e não o `houseId` (`do-ouro-g0gg`). Deriva de `house.name` pela mesma
normalização já usada em `seatKeyForHouseId`: minúsculas, sem acento, não
alfanumérico vira hífen.

As Casas são descobertas do banco (`HOUSE#`), nunca fixadas em código: uma Casa
nova aparece no contexto sem ninguém editar o script. Pastas de Casas que
deixaram de existir **não** são apagadas — histórico de partida não se apaga por
efeito colateral de um gerador.

Os dez arquivos são commitados. É o que permite ler contexto entre sessões e ver
o diff de um turno para o outro. Consequência aceita pelo autor:
`mestre/estado.md` põe segredo de campanha sob versionamento — o repositório é
privado e `valdren-context/MESTRE/` já vive assim.

---

# Parte B — O que cada arquivo contém

## `publico/estado.md`

O que o reino sabe agora.

- Turno corrente, status (`OPEN`/`LOCKED`/`RESOLVED`) e data de geração.
- O evento público do turno corrente e o resultado público do último resolvido.
- As dezesseis potências: quem está aliada a quem, a partir de `HRELATION#`.
- Pactos de pé: `CFACT#` com `kind` em `ALIANCA`/`ACORDO` e `status: ATIVO`.
- Fatos do mundo com `visibility: "PUBLICO"` e `status: ATIVO`, mais recentes
  primeiro.
- As Casas de jogador pelo que o reino enxerga delas: nome, sede e ativos
  nomeados. **Atributos e estabilidade não entram aqui** — são número de ficha,
  uma Casa não conhece os da outra, e o arquivo público é justamente o que não
  guarda o que alguém não deveria saber. Eles vivem no arquivo da própria Casa e
  no do Mestre.

## `casas/<casa>/estado.md`

Tudo do público, mais o que só aquela mesa viveu.

- O resultado privado dela (`turn.result.houseResults[houseId]`) do último turno
  resolvido, e a informação privada corrente (`turn.privateInfo[houseId]`).
- Correspondência: com quem falou, quantas cartas, e o que ficou prometido ou
  devido — de `CFACT#` onde `betweenA` é o `houseId` dela.
- Projetos ativos, falhados e concluídos; favores pendentes; energia do turno.
- Fatos do mundo cuja `visibility` é a **sede dela** (ex.: `casa-khazdrun`).

## `mestre/estado.md`

Tudo de todas as Casas somado, mais o que só o Mestre vê.

- As cartas que o mundo escreveu (`author: "AI"`, prefixo `out-` e `gm-`).
- Memórias vivas dos NPCs (`NPCDYN#`): humor, objetivo, lealdade, o que lembram.
- Fatos de **qualquer** visibilidade, com a visibilidade impressa ao lado.
- A trilha de atributos (`HATTR#`), que diz quem mexeu em número de Casa e por
  quê.

O **metaplot não é gerado aqui.** Ele é autoral e vive em
`valdren-context/MESTRE/`. Este arquivo apenas aponta para lá. Gerar segredo a
partir do banco seria inventar segredo, e o banco não sabe por que as coisas
acontecem.

## `cronica.md` (uma por audiência)

Do turno 1 ao corrente, em ordem. Para cada turno:

- Evento público e resultado público.
- O que a audiência daquela pasta viveu naquele turno — resultado privado e
  informação privada, quando houver.
- Uma linha por carta trocada: quem escreveu a quem, e a primeira linha útil.

É o arquivo que responde "de onde vem isso" sem escavação.

---

# Parte C — O resumo do mundo para as cartas

A mesma função que monta a seção de mundo do `publico/estado.md` produz um
resumo curto. Uma fonte só: o que o NPC sabe nunca diverge do que o arquivo diz.

**Gravação.** O script escreve um item na partição da campanha:

```
PK: CAMPAIGN#<id>
SK: CONTEXT#MUNDO
{ linhas: string[], geradoEm: string, turnNumber: number }
```

**Leitura.** Entra no **dossiê**, não no prompt do escritor. O `CLAUDE.md` define
o dossiê como "a parte que não pode alucinar" — montada em código,
determinística. Um resumo de fatos pertence ali. Somá-lo às regras de escrita
seria repetir a falha que o próprio `CLAUDE.md` documenta: regra e material
acumulando no prompt até a carta virar formulário.

**Teto travado em código: no máximo 10 linhas e 600 caracteres.** Não é limite de
bom senso, é asserção. O modo de falha documentado neste projeto é carta voltando
**string vazia** por orçamento de token estourado, e vazio não levanta erro — foi
assim que cartas sumiram em silêncio três vezes.

Se o resumo não existir no banco, o dossiê segue sem ele. Uma carta sem contexto
de mundo é pior que uma carta boa; uma carta que falha porque o contexto não foi
gerado é inaceitável.

---

# Parte D — O script

`backend/scripts/gerar-contexto.mjs`, chamado por `npm run contexto`.

1. Lê a partição da campanha inteira, uma vez.
2. Descobre as Casas de jogador a partir de `HOUSE#`.
3. Monta os textos com funções puras exportadas do próprio script.
4. Escreve os dez arquivos, sobrescrevendo.
5. Grava `CONTEXT#MUNDO`.

**Sem `--confirm`.** A convenção de confirmação neste repositório existe para
proteger *texto autoral* — `rewrite-house-wiki.mjs`, `replace-wiki.mjs`. Aqui
nada é autoral: os arquivos são artefato gerado e o `git diff` é a rede de
segurança.

O script **nunca escreve em `valdren-context/`**, que é cânone, nem em nenhum
caminho fora de `campaign-context/inverno-dos-mortos/`.

## Funções puras (exportadas para teste)

| Função | Responsabilidade |
|---|---|
| `separarPorAudiencia(itens, casas)` | Recorta os registros do banco em fatias por audiência. É onde mora a regra de sigilo. |
| `montarEstado(fatia)` | Fatia → `estado.md`. |
| `montarCronica(fatia)` | Fatia → `cronica.md`. |
| `resumirMundo(fatos, turno)` | Fatos públicos → até 10 linhas, até 600 caracteres. |
| `pastaDaCasa(nome)` | `"Do Ouro"` → `"do-ouro"`. |

---

# Parte E — Testes

`backend/scripts/gerar-contexto.test.mjs`, ao lado do script, sem AWS: as funções
puras recebem registros de mentira.

Três garantias que justificam o desenho inteiro:

1. **Fato de uma Casa não aparece no arquivo de outra Casa nem no público.**
   Um `WFACT` com `visibility: "casa-khazdrun"` sai no arquivo de Khazdrun e em
   nenhum outro.
2. **O privado do Mestre não vaza para arquivo de Casa.** `NPCDYN`, cartas do
   mundo e fatos de outra visibilidade ficam só em `mestre/`.
3. **O resumo respeita o teto com cinquenta fatos ativos** — 10 linhas, 600
   caracteres, medido e não estimado.

Mais os casos de forma: Casa sem turno resolvido não quebra a crônica; Casa nova
ganha pasta sem edição de código; nome com acento vira slug correto.

---

# Parte F — Como o contexto passa a ser usado

Uma linha no `CLAUDE.md` mandando ler
`campaign-context/inverno-dos-mortos/mestre/` antes de rascunhar turno ou
responder sobre a campanha. Sem isso, o hábito de escavar o banco continua.

O arquivo obsoleto `valdren-context/CAMPANHA/14_ESTADO_ATUAL_E_TURNOS_PUBLICADOS.md`
é **removido** na mesma entrega. Deixá-lo no lugar significa ter dois "estados
atuais", um deles oito turnos atrasado — e o errado é o que tem nome de certo.
O conteúdo dele já está no banco, nos turnos 1 e 2.

---

# Fora de escopo

- Gerar o contexto dentro da Lambda na resolução do turno.
- Interface no site para ler o contexto.
- Gerar metaplot ou qualquer interpretação a partir do banco.
- Alterar o prompt do escritor ou do revisor de cartas.

---

# Critérios de aceitação

- `npm run contexto` gera `estado.md` e `cronica.md` para o público, para o
  Mestre e para cada Casa de jogador encontrada no banco — dez arquivos com as
  três Casas de hoje, doze no dia em que nascer uma quarta, sem editar código —
  e nada fora de `campaign-context/inverno-dos-mortos/`.
- O arquivo público não contém nenhuma string presente apenas em registro
  privado — verificado por teste, não por leitura.
- `CONTEXT#MUNDO` existe no banco com no máximo 10 linhas e 600 caracteres.
- O dossiê inclui o resumo quando ele existe e segue funcionando quando não
  existe.
- `tsc --noEmit` limpo nos três pacotes; suíte existente continua verde.
- Rodar o script duas vezes seguidas produz o mesmo resultado (idempotente).
- `14_ESTADO_ATUAL_E_TURNOS_PUBLICADOS.md` removido.
