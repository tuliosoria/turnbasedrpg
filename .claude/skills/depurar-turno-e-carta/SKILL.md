---
name: depurar-turno-e-carta
description: Use when a Valdren turn text or NPC letter came out wrong — nonsense, contradictory, empty, absurd numbers, a scene told twice, an attribute that does not match the text, or a good draft that never reached the player. Triage table from symptom to where the defect actually lives, because in this repo it is almost never the model.
---

# Depurar turno e carta

O método geral é o da skill `superpowers:systematic-debugging`: **causa raiz antes de
qualquer conserto**. Esta skill não repete o método. Ela diz onde, neste repositório,
a causa raiz costuma estar de verdade.

## A lei local

**O modelo quase nunca é a causa. O material é.**

E o revisor não salva, porque **recebe o mesmo material** que o escritor. Premissa
falsa chega a ele com cara de fato e passa. Quem for depurar procurando prompt mal
escrito vai encontrar prompt mal escrito e consertar a coisa errada.

## Triagem por sintoma

| Sintoma | Olhe aqui PRIMEIRO | A falha que ensinou |
|---|---|---|
| Resposta de NPC sem sentido; encontro marcado na capital de um terceiro | o **bloco do dossiê** para o par exato | `buildGeographyBlock` listava as três sedes mais equidistantes sob o título "chão de ninguém entre as duas". Das 16 sedes, 15 são capital de alguém, e a lista chegava a oferecer Asterhall sitiada. |
| Número absurdo numa troca ("300 toneladas") | a **data do item `FAVOR#`**, antes de tocar em prompt | a regra de escala entrou em 01/09/2026 e funciona. Os absurdos eram de 30/08 e ficaram três semanas na tela do jogador, com botão de aceitar: parecia regressão e era dado velho. Favor `PENDING` não expira. |
| Carta sumiu; veio vazia | o **teto de tokens**, não a rede | tokens de raciocínio saem do MESMO orçamento da resposta, e teto baixo devolve **string vazia, não erro**. Foi assim que cartas sumiram em silêncio três vezes. Piso 4000, sempre com uma repetição: vazio é aleatório. |
| "Falha ao contatar a IA" | o **relógio**, não a rede | com esforço alto uma carta leva 25 a 70 segundos, e o timeout de 60s cortava justamente as mais pensadas. Hoje 180s para modelo de raciocínio. |
| O rascunho bom foi mostrado e o jogador continua vendo o ruim | **releia do banco** | aconteceu duas vezes seguidas com a mesma carta: gerei o texto certo, mostrei, e nunca gravei. Ver `reescrever-cartas-gravadas`. |
| Texto de turno com cena repetida, ordem sem resposta, entrega que ainda está na estrada | `npm run validar <N>` e os briefings | os quatro defeitos do turno 10. Ver `snapshot-antes-do-turno`. |
| Atributo que não fecha com o texto | a trilha `HATTR#`, **em ordem**, antes de suspeitar de bug | Solarion parecia divergir do histórico (ficha 3, turno terminou em 5). Não divergia: a aprovação de uma carta cobrou 5 → 3 **depois** da resolução. |
| O jogador reclama de algo que ele nunca leu | os textos dele, turno por turno, não a sua memória | o trabuco de 600 mm falhou por sabotagem no turno 9 e ninguém contou; no turno 10 o jogador mandou guardar moldes que não existiam. |

## O passo que resolve a maioria: imprimir o material

Não leia o log. **Rode o construtor do bloco suspeito para o par exato** e leia o que
o escritor recebeu:

- `buildGeographyBlock(aKey, bKey, aName, bName)` — quem é vizinho de quem, e de quem é cada cidade
- `buildHouseSituation(...)` — o que a Casa tem e está fazendo
- `buildPublicChronicle(turns)` — o mundo que a carta enxerga
- `buildOutreachUser(ctx)` / `buildHouseReplyUser(ctx)` — o prompt inteiro, montado
- `buildReviewUser(pedido)` — o que o revisor recebeu, que é o teste da tese "o revisor deveria ter pegado"

O defeito aparece no material. Se o material está certo e a saída está errada, só então
o problema é geração — e aí vale repetir a chamada antes de concluir, porque vazio e
truncado são aleatórios.

## O que NÃO fazer primeiro

- **Não some regra ao prompt.** Este sistema já quebrou quatro vezes pelo mesmo motivo:
  uma regra somada para consertar uma falha, e a soma virou formulário. O pior momento
  foram 52 regras e 9 obrigações. Antes de somar, tente tirar — e use
  `mexer-em-prompt-de-carta`, que obriga medir antes e depois.
- **Não culpe o revisor** sem antes ver o material que ele recebeu.
- **Não conclua "o modelo alucinou"** antes de imprimir o material. Quase toda vez que
  eu concluí isso, o material afirmava a coisa falsa.
- **Não conserte o texto antes de achar a causa.** Um texto consertado com a causa de pé
  volta a quebrar no turno seguinte, e agora com duas versões para conciliar.

## Onde a correção mora

| A causa é | A correção vai |
|---|---|
| mentira no material | tirar a mentira do material (cada cidade com seu dono; Raven's Cross é a única sob magistratura real) |
| falta de fiscalização | **dentro de um defeito que o revisor já tem**, ou em código determinístico — como `escalaAbsurda()` em `sendOutreach.ts`, que não grava o Favor fora de escala e deixa a carta sair igual. Nunca como regra nova no prompt. |
| texto já gravado | `reescrever-cartas-gravadas` — grava o novo **antes** de apagar o velho |
| dado velho na tela do jogador | o item no banco (`FAVOR#`, `CFACT#`), não o prompt |

## Refazer o que já foi gravado

- **Carta proativa:** `backend/scripts/refazer-cartas-do-turno.mjs`.
- **Resposta a carta de jogador:** o script acima **não serve**. Apague a resposta de IA
  (com backup) e invoque `ReplyWorkerFunction` com
  `{playerHouseId, ownKey: "casa-<sede>", toHouseKey, toCharacterId: null, sentId}` —
  roda o código deployado. `gerarResposta` se recusa se a resposta ainda existir.
- **Texto de turno:** backup em `backups/turnos/`, `update-item` em
  `TURN#0NN.result.houseResults[<houseId>]` ou `TURN#0NN.privateInfo[<houseId>]`, e
  depois `npm run contexto` e `npm run snapshot`.

## Encerrar

Só diga que está consertado depois de:

1. **reler do banco** o que ficou gravado — não relatar o que você gerou;
2. rodar `npm run validar <N>` e mostrar o resultado;
3. dizer o que ficou de fora e por quê.

Se o conserto nasceu de uma falha que vai voltar, escreva a regra onde ela é lida na
próxima vez: numa skill, não numa mensagem de commit.
