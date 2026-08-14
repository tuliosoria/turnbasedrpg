# Mecânica de NPC: cartas a indivíduos

Data: 2026-08-14

## O que se quer

Hoje um jogador escreve para "a Casa" e a chancelaria responde na voz do
líder. O pedido: poder escrever para uma **pessoa** específica — All Marifh,
Selma Karasoy — e receber a resposta na voz dela, com a agenda dela, lembrando
das cartas passadas e do que acontece no reino.

Decisões já tomadas com o autor:

- **Canal:** estende a correspondência que já existe (cartas, orçamento de
  mensageiros, memória entre turnos), não um chat novo.
- **Elenco:** todos os 87 personagens de `HOUSE_CHARACTERS`, encarnados a
  partir dos campos que já têm (`role`, `description`, `wants`, `hides`) mais a
  postura política da Casa. Sem autoria nova de persona.
- **Voz:** o indivíduo responde **por si** — puxa para o que ele quer, guarda o
  que esconde, e pode divergir da linha oficial da Casa. Isso finalmente usa o
  campo `hides`, hoje canon adormecido.
- **Contexto de turno:** o NPC precisa saber a situação atual da própria Casa
  (ex.: "decidimos nos rebelar contra Alic"), colhida automaticamente dos
  eventos do turno.
- **Ajuste do Mestre:** no painel de admin, poder editar por NPC o humor, os
  favores e a percepção das outras Casas.

## A ideia central: contexto em camadas

O contexto que vai ao modelo é montado em camadas, e é isso que deixa as três
fases se somarem sem reescrita:

1. **Identidade estática** — o personagem (`HOUSE_CHARACTERS`) ou a chancelaria
   (persona do líder). Sempre presente.
2. **Postura política da Casa** — `crownStance`, `interests`, e a
   confiança/desconfiança com a Casa que escreve. Já existe.
3. **Mundo e história** — relações, crônica pública, evento do turno, cartas
   passadas, conversa do turno. Já existe.
4. **[Fase 2] Situação atual da Casa** — derivada dos eventos do turno.
5. **[Fase 3] Estado dinâmico do NPC** — humor, favores, percepções, definidos
   pelo Mestre.

A Fase 1 constrói 1–3 com a encarnação do indivíduo. As Fases 2 e 3 acrescentam
as camadas 4 e 5.

## Fase 1 — o canal e a voz

**Identidade do personagem.** Os 87 personagens não têm id estável. Entra
`characterId(name)` em `shared`, um slug do nome, e `characterFor(houseKey, id)`
para resolver. O id é derivado, não armazenado no canon — o nome é a fonte.

**Modelo de dados.** `DiplomaticMessage` ganha `toCharacterId: string | null`
(nulo = a chancelaria, comportamento de hoje). **A chave da mensagem não muda:**
continua sob o prefixo do par de Casas. Assim o orçamento de mensageiros segue
por Casa — você tem N mensageiros para aquela Casa neste turno, escreva para a
Casa ou para uma pessoa dela — e `sendsRemaining` conta certo sem alteração. Os
fios por pessoa saem de agrupar a lista da Casa por `toCharacterId`.

**Envio.** `sendCorrespondence({ toHouseKey, toCharacterId?, body })`. O
servidor valida que o `toCharacterId`, quando presente, pertence à Casa;
inválido é 400. Grava a mensagem com o campo. Gera a resposta encarnando o
indivíduo quando há id, ou a Casa quando não há.

**Prompt do indivíduo.** `HouseReplyContext` ganha `character` opcional. Quando
presente, o bloco de persona passa a: "Você é {name}, {role} da Casa {toHouse}.
Quem você é: {description}. O que você quer, e vai puxar a conversa para isso:
{wants}. O que você esconde e nunca entrega de bandeja: {hides}. Você fala por
si, com a sua leitura — que pode divergir da linha oficial da Casa." As camadas
2 e 3 seguem iguais: o indivíduo herda a postura política da Casa e a memória.
A regra do sistema que impede revelar segredo suspeito passa a proteger também
o `hides` do personagem.

**Overview.** `getCorrespondence` passa a incluir, por Casa, um roster leve
(`{id, name, role}[]`) derivado de `HOUSE_CHARACTERS`, para o frontend oferecer
a seleção de pessoa a partir de uma fonte só. Orçamento continua por Casa.

**Frontend.** O `CorrespondencePanel` mostra a Casa e, sob ela, "A chancelaria"
mais cada pessoa. Escolher uma pessoa fixa o `toCharacterId`; o fio é filtrado
para aquele destinatário; o orçamento é exibido como compartilhado da Casa.

**Testes Fase 1.** id de personagem estável e resolúvel; envio a pessoa
inválida da Casa é recusado; a mensagem grava `toCharacterId`; o prompt do
indivíduo traz nome/wants/hides e a regra de falar por si; sem `character` o
prompt é idêntico ao de hoje (chancelaria); o orçamento conta todas as cartas à
Casa, de qualquer destinatário.

## Fase 2 — contexto automático de turno

**O que deriva.** `buildHouseSituation(houseKey, turns, house)` monta uma nota
curta da situação atual da Casa a partir do que já existe no turno: para Casas
de jogador, a info privada do turno corrente, as ordens submetidas e os deltas e
descobertas da resolução; para as 13 Casas-canon, as menções a ela na crônica
pública. Sem inventar: só reorganiza o que o Mestre já produziu.

**Injeção.** Entra como camada 4, rotulada como conhecimento **interno** da
Casa: "O que a sua Casa sabe e está fazendo agora (não é público): …". O NPC
sabe disso porque é da Casa, e a regra de sigilo já existente o faz guardar de
quem escreve — pode blefar, insinuar ou negar, não entrega.

**Testes Fase 2.** a situação de uma Casa de jogador reflete a ordem submetida e
a descoberta da resolução; uma Casa-canon reflete a crônica; a nota entra como
interna, não pública; NPC e chancelaria da mesma Casa recebem a mesma situação.

## Fase 3 — estado editável por NPC no Admin

**Estado.** Um item novo por NPC no DynamoDB, `NPCSTATE#<houseKey>#<charId>`,
com `{ mood, favors, perceptions: Record<houseKey,string>, note, updatedAt }`.
Tudo opcional; ausência = sem override. É estado desta partida, não canon do
mundo — mora ao lado dos fatos de campanha, não no wiki, pela mesma razão: uma
mágoa deste turno não pode virar verdade permanente de Valdren.

**Admin.** Uma aba "NPCs" no painel: escolher Casa → escolher pessoa → editar
humor, favores, a nota e a percepção de cada outra Casa. Rotas
`GET /api/admin/npc-state` e `POST /api/admin/npc-state/update`, no padrão das
outras rotas de admin.

**Injeção.** Entra como camada 5, a de cima: "Estado atual, definido pelo
Mestre: humor {mood}; favores {favors}; {note}." A percepção da Casa que
escreve entra específica, como a confiança/desconfiança da Fase das personas:
"A sua leitura de {Casa que escreve} agora: {perception}." É a camada que
colore ou contradiz as de baixo quando o Mestre quer.

**Testes Fase 3.** o estado grava e lê por NPC; a percepção injetada é só a da
Casa que escreve; sem estado o prompt é o da Fase 2; a nota entra como do
Mestre; a UI salva e relê.

## Fora do escopo

Cartas entre Casas de jogador (já bloqueadas hoje). Voz por cargo (o autor
escolheu que todo indivíduo fala por si). Chat em tempo real (o canal é carta).
Autoria de novas personas de líder (o elenco entra com o que tem).
