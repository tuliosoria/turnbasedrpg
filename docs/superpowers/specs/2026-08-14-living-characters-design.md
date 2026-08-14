# Living Characters

Data: 2026-08-14

## O que se quer

Transformar Valdren de um jogo de eventos escritos pelo GM num mundo onde 100 a
200 personagens mantêm opiniões, objetivos, memórias e relações próprias ao
longo da campanha. O jogador pode escrever para qualquer um deles — o Arquimago
Azul da Ordem dos Três, um general, a Rainha — e a IA o interpreta a partir de
quem ele é, do que aconteceu, e de como ele se sente agora.

O princípio que rege tudo: **nenhuma conversa depende só da última mensagem.**
Toda vez que a IA encarna um NPC, ela **reconstrói** o personagem a partir de
identidade + relações + objetivos + memórias + conhecimento atual.

## Quatro motores

1. **NPC Codex** — quem são. Identidade estável, canon.
2. **World Memory** — o que aconteceu, e quem sabe. Eventos com visibilidade e
   propagação, mais a memória que cada NPC carrega.
3. **Relationship Engine** — como o que aconteceu mudou as relações. Roda no
   fim do turno e atualiza estado, relações e objetivos.
4. **Roleplay Engine** — como agem e conversam agora. Reconstrói o personagem a
   cada interação e gera a resposta.

Dependência: Codex → World Memory → Relationship → Roleplay. World Memory é
fundação, não etapa final: alimenta tanto o Relationship (o que atualiza) quanto
o Roleplay (o que o NPC pode dizer).

## Decisões travadas com o autor

- **Relationship Engine roda automático ao aplicar o turno.** As mudanças de
  NPC são calculadas e gravadas junto com a resolução. (Consequência aceita: o
  apply fica mais caro e mais lento; ver "Custo e latência".)
- **Roster gerado do cânone, Tier 1 primeiro** (~40–50 Major NPCs), com revisão
  do GM. Tier 2 e 3 depois.
- **Conversa alcança qualquer Major NPC**, de Casa ou organização; orçamento de
  mensageiros pela localização do NPC.
- **Evoluir, não duplicar.** `HOUSE_CHARACTERS` e `LEADER_PERSONAS` viram a
  semente do Codex; `NpcState` (humor/favores/percepções, entregue hoje) vira a
  semente do Estado e das Relações. Nada de um segundo sistema de NPC em
  paralelo.

## Separar identidade de estado de história

O erro a evitar: uma tabela única que a IA reescreve a cada turno. Depois de 20
turnos, a personalidade original seria destruída pelas atualizações. Por isso as
camadas são separadas por *taxa de mudança* e por *dono*:

| Camada | Muda | Dono | Onde mora |
|---|---|---|---|
| Identidade (Codex) | quase nunca | autor/GM | canon em `shared` |
| Estado | todo turno | Relationship Engine + GM | DynamoDB |
| Relações | todo turno | Relationship Engine + GM | DynamoDB |
| Memória | acumula | Relationship Engine | DynamoDB |

Um ataque a Ninho Alto não torna alguém reservado em impulsivo. Muda a opinião
dele sobre quem atacou — Estado e Relações —, nunca a Identidade.

---

## Motor 1 — NPC Codex

**Identidade**, autorada como canon (evolui `HOUSE_CHARACTERS`). Campos:

- `id`, `name`, `role`, `tier` (`MAJOR` | `RELEVANT` | `MINOR`)
- `affiliation` — Casa, organização ou a Coroa (chave)
- `location` — onde costuma estar (para o orçamento de mensageiros)
- `personality`, `speechStyle`, `values`, `fears`, `ambitions`, `redLines`
- `secrets` — só GM, nunca entregue na conversa
- `roleplayGuidance` — como a IA deve interpretá-lo

**Tiers.** Tier 1 (~40–50): identidade completa, relações extensas, memórias,
objetivos, segredos. Tier 2 (~100): perfil intermediário. Tier 3: criados sob
demanda, poucos campos. Evita gastar geração e prompt onde não rende.

**Geração.** Um script gera as fichas do cânone (`valdren-context/`,
`HOUSE_CHARACTERS`, `LEADER_PERSONAS`), Tier 1 primeiro, com saída revisável em
diff antes de virar canon — mesmo padrão de `seed-leader-personas`. Os 16
líderes já têm persona rica; entram como Major NPCs sem reautorar.

## Motor 2 — World Memory

Duas partes: o registro do que aconteceu com visibilidade, e a memória de cada
NPC.

**Evento com visibilidade e propagação.** Hoje um turno tem `publicEvent`
(público) e `privateInfo` por Casa (secreto àquela Casa). World Memory
generaliza: cada fato de turno ganha

- `visibility` — `PUBLICO` | `CASA:<key>` | `ORG:<key>` | `NPC:<id>` | `GM`
- `propagation` — `IMEDIATO` | `RUMOR` | `MENSAGEIROS` | `CORVOS` | `DESCONHECIDO`

De `visibility` + `propagation` + a distância deriva-se **quem sabe do quê, e
quando**. Se Alic ataca Ninho Alto em segredo: os gnomos de lá sabem na hora;
Euralune logo; Asterhall dias depois; a população, uma versão incompleta. Sem
isto os NPCs viram uma hivemind — o sacerdote de Porto Cinzento passaria a odiar
Alic instantaneamente.

**Memória do NPC.** Cada NPC acumula entradas `{ turnNumber, description,
impact }`. A memória é *por que* ele pensa como pensa, e é o que deixa a IA
referenciar o passado numa conversa no turno 15 ("Solarion já mostrou que
reconhece uma ameaça antes dos outros, como na crise de Véspera").

`npcKnows(npcId, event, turn)` é a função central: resolve se um evento já
chegou a um NPC. Governa tanto o que o Relationship Engine pode usar para
atualizar aquele NPC quanto o que o Roleplay Engine deixa ele saber.

## Motor 3 — Relationship Engine

Roda automático no apply do turno. Fluxo:

1. **Candidatos.** Não são os 200. A partir de World Memory, seleciona os NPCs
   que tomaram conhecimento de algum fato deste turno (`npcKnows`). Tipicamente
   dezenas, não centenas.
2. **Impacto por NPC.** Para cada candidato, a IA recebe *evento + identidade +
   relações + conhecimento + objetivos* e responde de forma **estruturada**:

   ```
   affected: true
   relationshipChanges:
     alic-valerius: { trust: -35, respect: -15, fear: +40, resentment: +55 }
   newMemory: "Forças do rei atacaram Ninho Alto."
   objectiveChanges: "Buscar garantias militares para Euralune."
   attitudeChanges: "Hostil à Coroa."
   ```

3. **Validação e gravação.** O backend valida (dimensões existem, deltas em
   faixa, clamp 0–100) e grava. Cada mudança guarda o evento e o turno de
   origem — **auditável**.

O mesmo evento produz reações opostas porque passa pela identidade de cada um:
o líder gnomo desaba em confiança no Alic; um comandante Vargen pode subir
("finalmente um rei disposto a usar força"). Isso é o objetivo, não um bug.

**Relações são multidimensionais.** Não `gosta: 57`. Por entidade (Casa, NPC,
Coroa, organização): `trust`, `respect`, `fear`, `resentment`, `obligation`
(0–100), mais um `summary` em prosa gerado, que é o que serve ao roleplay. O
Estado também carrega números de atitude perante a Coroa (confiança/respeito/
medo no Rei) e campos de humor, localização, objetivo imediato, preocupações,
lealdade.

**Custo e latência.** Automático no apply significa que aplicar um turno dispara
uma chamada de IA por candidato. Com o filtro de candidatos isso é dezenas de
chamadas, não 200 — mas ainda é o passo mais caro do jogo. Implementação: rodar
o fan-out após a resolução já estar gravada, para que uma falha de IA não desfaça
o turno, e para poder reprocessar. Cada impacto é idempotente por (NPC, turno).

## Motor 4 — Roleplay Engine

Reconstrói o personagem a cada interação — nunca responde só do histórico da
conversa. Monta o contexto a partir de:

- **Identidade** (Codex): personalidade, forma de falar, valores, linhas
  vermelhas, roleplayGuidance.
- **Relações** com quem escreve: as cinco dimensões + o resumo.
- **Objetivos e humor** atuais (Estado).
- **Memórias** relevantes que este NPC *conhece* (World Memory + `npcKnows`).
- **Conhecimento**: só o que chegou até ele; segredos GM nunca saem.

É a evolução direta do `buildHouseReplyUser` que já existe — hoje ele monta
identidade + postura + história + situação + estado do Mestre em camadas; aqui
as camadas ficam mais ricas e passam a valer para qualquer NPC, não só as 16
chancelarias.

**Conversa.** A correspondência a indivíduos (entregue hoje) passa a alcançar
qualquer Major NPC, inclusive de organização e da Coroa. O destinatário deixa de
ser só "pessoa dentro de uma Casa": o orçamento de mensageiros passa a vir da
`location` do NPC no Codex, não só da sede da Casa. O jogador escolhe o
destinatário, escreve, e o Roleplay Engine responde na voz dele.

---

## Como isso evolui o que já existe

- `HOUSE_CHARACTERS` (87, com name/role/description/wants/hides) → semente do
  **Codex**, expandida com os campos de identidade e o tier.
- `LEADER_PERSONAS` (16, com temperament/speechStyle/crownStance/distrusts/
  trusts) → Major NPCs do Codex; `distrusts`/`trusts` viram o ponto de partida
  das **Relações** multidimensionais.
- `NpcState` (humor/favores/percepções, DynamoDB) → semente do **Estado** e das
  **Relações**; `perceptions[casa]` (hoje uma string) vira a relação
  multidimensional com resumo.
- `buildHouseSituation` (Fase 2 do NPC) → alimenta World Memory: a fatia do
  turno que menciona um alvo é um caso particular de "quem sabe do quê".
- `buildHouseReplyUser` → o **Roleplay Engine**.
- O painel Admin de NPC (aba NPCs) → cresce para editar Identidade, Estado,
  Relações e Memória, e para revisar/reverter o que o Relationship Engine gravou.

## Testes (por motor)

- **Codex:** toda ficha tem tier e afiliação válida; ids sem colisão; Major NPCs
  têm os campos ricos, Minor não são exigidos a tê-los.
- **World Memory:** `npcKnows` respeita visibilidade e propagação — um segredo
  GM nunca é conhecido; um evento `MENSAGEIROS` chega depois de um `IMEDIATO`;
  um NPC de Casa distante não sabe de um ataque secreto no mesmo turno.
- **Relationship Engine:** o mesmo evento move dois NPCs em direções opostas
  conforme a identidade; deltas fazem clamp em 0–100; cada mudança guarda origem;
  reprocessar o mesmo turno é idempotente; um NPC que não conhece o evento não é
  tocado.
- **Roleplay Engine:** a resposta reconstrói a partir das camadas, não do último
  texto; um segredo GM não vaza; uma memória conhecida pode ser citada, uma
  desconhecida não; a relação com quem escreve entra, a com outra Casa não.

## Fora do escopo (por ora)

- Diálogo em tempo real (o canal continua sendo carta, com orçamento de viagem).
- Tier 3 povoado em massa (criado sob demanda).
- NPC iniciando conversa com o jogador (só o jogador inicia).
- Propagação como simulação física fina; começa como regra por faixa
  (imediato/rumor/mensageiros/corvos + distância), não um modelo contínuo.
