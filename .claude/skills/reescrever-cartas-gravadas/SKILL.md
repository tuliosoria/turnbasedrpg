---
name: reescrever-cartas-gravadas
description: Use when regenerating or replacing NPC letters already stored in DynamoDB for a Valdren turn. Enforces write-then-verify-from-the-database, because showing a good draft and leaving the bad one stored has already happened twice.
---

# Reescrever cartas que já estão gravadas

Duas falhas reais, as duas em sequência, as duas minhas:

1. **Gerei o texto bom, mostrei ao Mestre, e nunca gravei.** Rodei em modo ensaio,
   a conversa seguiu, e o jogador continuou vendo a carta ruim. Aconteceu **duas
   vezes seguidas** com a mesma carta.
2. **Filtrei `DIPLMSG#0009` e a carta ruim estava em `#0008`.** Duas rodadas de
   reescrita passaram por cima dela sem tocá-la.

O que essas duas têm em comum: eu relatei o que **gerei**, não o que **ficou no
banco**. A regra desta skill é uma só — **releia do banco antes de dizer que está
pronto**.

## Antes: decidir o que PODE ser reescrito

Nem toda carta pode. Mapeie o fio de cada par e olhe a sequência:

```bash
aws dynamodb query --region us-east-1 --table-name ravenloft-game \
  --key-condition-expression "PK = :p AND begins_with(SK, :s)" \
  --expression-attribute-values '{":p":{"S":"CAMPAIGN#WINTER_DEAD"},":s":{"S":"DIPLMSG#"}}' \
  --output json > /tmp/msgs.json
```

| Situação | Pode? |
|---|---|
| Carta de IA sem resposta do jogador depois | **Sim** |
| Jogador já respondeu (`...APA...`) | **Não.** Reescrever desmancha a resposta dele. |
| `id` começa com `gm-` | **Não.** Foi escrita à mão pelo Mestre — é lore, não geração. |
| Está num turno anterior ao corrente | **Sim**, e é justamente a que se esquece. |

**Não filtre por turno.** Filtre por par e por autor. A carta que originou toda a
reforma estava num turno que meus dois scripts ignoraram.

## Ordem importa quando o fio tem várias

Se você vai refazer a carta do turno 8 **e** a do 9 do mesmo par, faça a do 8
primeiro e monte o dossiê de novo antes da do 9. Fora de ordem, a segunda fala de
coisas que a primeira não disse mais — pedra que ninguém pediu, encontro que nunca
foi marcado.

## Gerar

Use o pipeline real, e não um prompt improvisado:

- Resposta a carta de jogador → `HOUSE_REPLY_SYSTEM_PROMPT` + `buildHouseReplyUser`
- Carta proativa → `OUTREACH_SYSTEM_PROMPT` + `buildOutreachUser` **com dossiê**
- Sempre passe pelo revisor: `REVIEW_SYSTEM_PROMPT` + `buildReviewUser` + `parseRevisao`
- Sempre com repetição: `for (let i=0;i<4 && !raw.trim();i++)`. Vazio é aleatório.

## Gravar — e nunca esquecer desta parte

Grave a nova **antes** de apagar a velha. Uma falha no meio deixa a carta antiga de
pé, e não um fio vazio.

```js
await doc.send(new PutCommand({ TableName: TABLE, Item: {
  ...velha, SK: novaSK, id: novoId, body: texto, createdAt: velha.createdAt,
}}));
await doc.send(new DeleteCommand({ TableName: TABLE, Key: { PK, SK: velha.SK } }));
```

`createdAt` da carta antiga se mantém: a ordem do fio na tela do jogador vem dele.

Se o `SK` não muda (mesmo id), basta o `PutCommand` — **não** apague depois, senão
você acabou de deletar o que gravou.

## Verificar: reler do banco

Não relate o texto que você gerou. Consulte de novo e mostre **o que está lá**:

```bash
aws dynamodb query --region us-east-1 --table-name ravenloft-game \
  --key-condition-expression "PK = :p AND begins_with(SK, :s)" \
  --expression-attribute-values '{":p":{"S":"CAMPAIGN#WINTER_DEAD"},":s":{"S":"DIPLMSG#0009#casa-x~casa-y"}}' \
  --output json
```

Confira: o número de cartas do par não mudou, o corpo é o novo, e nenhuma carta com
`id` começando em `gm-` sumiu.

## Ao relatar ao Mestre

Diga quantas foram trocadas, **quais ficaram de fora e por quê**, e cole o texto
que veio do banco. Se o revisor consertou algo, mostre os motivos — é assim que o
Mestre percebe quando o revisor está errando (uma vez ele cortou "Rainha-Dragã"
achando que era título inventado, e era cânone).
