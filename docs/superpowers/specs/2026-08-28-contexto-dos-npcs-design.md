# Contexto dos NPCs: o cânone que já existe chega até a IA

Data: 2026-08-28

## O problema

O jogo guarda o cânone em dois lugares. No código (`shared/src`, ~676 KB) fica o que
nasceu com o mundo; no DynamoDB (448 linhas, 827 KB) fica o que a campanha produziu.
Parte do que está no código nunca atravessa para a IA, e o motor que produz o estado
vivo dos NPCs escolhe sempre as mesmas pessoas.

Três lacunas medidas:

**1. As 88 biografias nunca chegam à IA.** `NPC_BIOGRAPHIES` tem 122 KB de prosa
autorada, mediana de 1.290 caracteres por pessoa. O único consumidor é
`frontend/src/pages/personagens/PersonagemPage.tsx:170`, que a exibe para o jogador
ler. Nenhum prompt a lê. A IA escreve a Dama Elara a partir das três linhas de
`speechStyle`, enquanto a biografia dela diz coisas que mudariam a carta:

> "Celene confia nela para portas difíceis; Aelric Roderic negocia recursos que ela
> sempre considera insuficientes; Nerys Thorne registra suas ordens com exatidão
> desconfortável; Alic passa por seus corredores sob escolta dobrada desde a morte de
> Edric."

Isso é estado de relação entre quatro NPCs, escrito à mão, que hoje não influencia
uma única carta.

**2. `HOUSE_CANON` não chega à IA.** População, contribuição sustentável e mobilização
de emergência das 16 Casas existem e vão para as páginas do front
(`frontend/src/pages/casa/dossier.ts`, `CasasPage.tsx`), mas nenhum prompt as recebe.
A Selma ofereceu "300 cavaleiras Ak-Boran" sem nada dizer que Karasoy sustenta 3.000 e
mobiliza 7.000. O número saiu plausível por sorte.

**3. O motor de estado vivo escolhe sempre as mesmas 20 pessoas.** `updateNpcWorld`
ordena os candidatos por quantos eventos cada um conhece:

```ts
.filter((x) => x.known.length > 0)
.sort((a, b) => b.known.length - a.known.length)
.slice(0, MAX_NPCS_POR_TURNO)   // 20
```

Simulação com os dados reais do turno 6: os 7 eventos derivados são todos `PUBLICO`, e
`inAudience` devolve `true` para todo mundo quando a visibilidade é pública.

```
candidatos: 90 de 90
distribuição de quantos eventos cada um sabe: {"7": 90}
```

Todos sabem de tudo, então o `sort` compara 7 com 7 noventa vezes e é um no-op. O
`slice(0,20)` pega os 20 primeiros na ordem fixa do codex. O comentário no código diz
que "o resto espera o turno em que for relevante", mas a relevância é calculada igual
todo turno: os outros 70 esperam para sempre.

Consequência medida: das 13 pessoas para quem os jogadores já escreveram cartas,
**uma** tem estado vivo (Selma Karasoy). Orven, Elara, Alic, Lyra e Mok'Thar respondem
sempre do zero, sem humor e sem memória.

## O que não vamos fazer

Destilar as biografias com IA numa ficha compacta armazenada. Seria mais barato por
carta, mas cria um artefato derivado que diverge da fonte em silêncio — o mesmo
problema que já existe entre `defaultWiki.ts` e o banco — e destilar prosa autoral com
IA é exatamente o que os jogadores reclamaram na aba Canônico.

Também não vamos reclassificar os eventos do mundo para deixarem de ser todos
`PUBLICO`. Seria mais fiel, mas exige o Mestre classificar cada evento por
público-alvo, e o ganho não justifica esse trabalho manual por turno.

## O desenho

### 1. A biografia chega a quem responde

`HouseReplyContext` ganha `biography: string | null`.

A rota resolve por um caminho só, `npcFor(seatKey, id)?.biography ?? null`, que já
cobre os três casos de quem responde:

- personagem de Casa (`ctx.character`) — o id vem de `characterId(nome)`. Verificado:
  82 de 82 resolvem para uma ficha com biografia, zero falhas;
- NPC do Codex (`ctx.codexIdentity`) — o campo `biography` já vem preenchido na ficha;
- a chancelaria com o líder vivo (`ctx.persona`) — o id vem de
  `characterId(persona.leaderName)`. Verificado: 14 dos 16 líderes resolvem para uma
  biografia. Os dois que faltam, Patriarca Durgan Khazdrun e Faraó Gloriandur, estão
  no codex mas não têm biografia autorada; caem no `?? null` e o bloco simplesmente
  não é escrito. Escrever as duas biografias que faltam é trabalho de cânone para o
  Mestre, não desta mudança.

No prompt, entra depois do bloco de identidade e antes das relações, sob o rótulo
"A sua vida até aqui — é isto que te fez pensar como pensa", com teto de 1.800
caracteres.

**Não entra quando `ctx.leaderDied` é verdadeiro.** A biografia fala no presente de
alguém que já morreu; o prompt trata a sucessão à parte, e a biografia o contradiria
na mesma carta.

Custo medido: +323 tokens sobre os 1.951 de um prompt de carta.

### 2. A força militar entra na negociação

O bloco de perfil existente (`ctx.houseProfile` e `ctx.writerProfile`) ganha, das duas
Casas, `sustainableTroops` e `emergencyTroops` de `HOUSE_CANON`, com a regra:

> Nunca ofereça mais do que a mobilização de emergência, e lembre que a contribuição
> sustentável é o que dá para manter sem quebrar a Casa.

`HouseReplyContext` ganha `houseForce` e `writerForce`, ambos
`{ sustainableTroops: number; emergencyTroops: number } | null`. São null para sede sem
entrada em `HOUSE_CANON`, e nesse caso nada é escrito no prompt.

Custo: ~100 tokens.

### 3. A seleção do motor de estado vivo

`updateNpcWorld` troca o `sort` que não discrimina por três faixas, nesta ordem:

1. quem foi procurado por carta nos dois turnos anteriores ao que está sendo aplicado;
2. quem está há mais turnos sem estado vivo atualizado;
3. o resto, na ordem do codex.

`WorldUpdateDeps` ganha `recentlyContacted: () => Promise<Set<string>>`, devolvendo
chaves `affiliation:id`. A origem é o par `toHouseKey` + `toCharacterId` das linhas
`DIPLMSG#`, que já existe e está preenchido em 22 das 39 cartas. Basta `toCharacterId`:
uma resposta da IA carrega o mesmo campo da carta que a originou, então quem escreveu e
quem respondeu caem os dois na mesma chave. A dep entra por injeção para que
`worldUpdate` continue sem acesso direto ao banco, como já é hoje.

A faixa 2 usa o maior `turnNumber` presente em `dynamic.memory`; quem nunca foi
processado conta como turno 0 e portanto entra antes de quem foi processado no turno
passado.

O teto de 20 (`MAX_NPCS_POR_TURNO`) e a idempotência por `(NPC, turno)` ficam como
estão. Os dois funcionam.

## Testes

Nada muda em `shared`: `HOUSE_CANON` e as biografias já estão exportados e só passam a
ser lidos. Os testes ficam todos em `backend`:

- a biografia aparece no prompt de um personagem de Casa, com o texto certo;
- a biografia NÃO aparece quando `leaderDied` é verdadeiro;
- a biografia é truncada em 1.800 caracteres;
- os números de tropa aparecem para as duas Casas, e somem quando `HOUSE_CANON` não
  tem a sede;
- a seleção põe quem recebeu carta na frente mesmo quando todos conhecem os mesmos
  eventos — o cenário que hoje falha;
- quem nunca foi processado entra antes de quem foi processado no turno anterior;
- o teto de 20 continua valendo mesmo com 90 candidatos empatados.

## Medição

Além dos testes, gerar cartas reais contra o modelo, antes e depois, para o capitão
Orven Geada e a Dama Elara Voss — os dois casos onde a biografia deve mudar mais —
usando a chave lida do config da Lambda, nunca escrita em arquivo. Comparar se a carta
passa a citar relações e fatos que só existiam na biografia.

## O que apareceu durante a implementação

Duas causas raiz que a análise não tinha visto, ambas do mesmo tipo: o teto de
tokens cobre **raciocínio + resposta**, e nesta família de modelos o raciocínio
sozinho consome de 400 a 1.400 tokens.

**A carta estava com teto de 700.** Medido em cinco chamadas reais: raciocínio de
512, 1024 e 1400. A 700, a maior parte das cartas voltava vazia — o jogador escrevia
e não recebia resposta. Subiu para 2.200; quatro chamadas seguidas, zero vazias.

**O motor de estado vivo estava com teto de 600, e o silêncio virava enredo.**
`parseImpact("")` devolve `{ affected: false }`, então um estouro de orçamento era
indistinguível de "este NPC não mudou". Medido: Lyra Euralune voltou `finish=length`
e vazia a 600, e afetada a 1.600. Esta é a segunda causa raiz do 6-de-90, ao lado da
seleção. Subiu para 1.600, e resposta vazia agora é contada e registrada em log em
vez de virar um NPC que "não mudou".

Fica pendente, e não foi tocado: `canonRoutes` chama o modelo com teto de 900 e tem
o mesmo risco. Não foi medido.
