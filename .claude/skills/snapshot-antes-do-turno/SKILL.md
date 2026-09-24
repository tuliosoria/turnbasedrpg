---
name: snapshot-antes-do-turno
description: Use before drafting a Valdren turn, writing private info, or reviewing NPC correspondence. Generates one snapshot per house plus a world file from the database and requires reading them first, because writing a turn from the chronicle alone has already produced repeated scenes, unanswered player orders and goods delivered while still on the road.
---

# Snapshot antes de escrever turno

**Rode isto antes de escrever qualquer coisa que um jogador vá ler.**

```bash
node backend/scripts/gerar-snapshot-turno.mjs 10    # o turno que acabou de resolver
```

Escreve em `campaign-context/snapshots/`:

| Arquivo | Para quê |
|---|---|
| `valdren-turn<N>-context.md` | O mundo: fatos públicos do turno, o que ainda estava de pé nos dois anteriores, o que cada potência quer, como elas se olham. |
| `<casa>-turn<N>-context.md` | Uma por Casa: **as ordens que ela deu**, o que o turno devolveu, o privado, as cartas do turno **na íntegra**, compromissos de pé, projetos, favores pendentes, atributos antes/depois. |
| `_conferencia-turn<N>.md` | Os trechos em que uma Casa fala de outra, lado a lado. |

Leia **todos**, nesta ordem: mundo, cada Casa, conferência. São gerados — não edite à mão, e não junte duas Casas num arquivo: a separação por audiência é a regra de sigilo do repo, não formatação.

## Por que existe

Quatro falhas do turno 10, todas no mesmo texto, todas por escrever lendo só `cronica.md` — que trunca carta em 110 caracteres e não mostra ordem nenhuma:

1. **A mesma cena duas vezes, na ordem errada.** O resultado contou Durgan descendo à cela e obtendo o nome, o lugar e a conta. O privado, impresso **abaixo**, ainda era o interrogatório pela metade do turno anterior, e prometia ao Patriarca como segredo exatamente aquelas três coisas. O jogador leu o fim antes do começo.
2. **Duas ordens sem resposta nenhuma, e duas respondidas errado.** Ficaram de fora a cremação dos mortos e o bloco inteiro dos acordos fechados por carta — três navios a Droskar, abrigo em Khar-Durak, patrulha com Karasoy, cavalaria de Auremont, tratado com Ferrumor, aliança dos Ulgar. Nada disso no texto dele.
3. **Estufas entregues enquanto ainda estavam na estrada.** O texto de Khazdrun deu a colheita por aumentada pelas estufas de Solarion; o texto de Solarion, no mesmo turno, dizia que o comboio acabara de partir. Só a comparação entre duas Casas pega isso — é o que o `_conferencia` serve.
4. **Um projeto falhou e o jogador nunca soube.** O trabuco de 600 mm falhou por sabotagem na resolução do turno 9, sem uma linha no texto. No turno 10 o jogador mandou guardar os moldes numa sala de duas chaves. O snapshot marca com ⚠ todo projeto que falhou num turno diferente do que está sendo escrito.

## O que conferir, item por item

- **Toda ordem tem resposta.** O arquivo põe um `- [ ] respondida?` por ordem, com as palavras da ordem que aparecem (ou não) no texto do turno. É heurística, não veredito: leia. Ordem que o turno **não** vai atender precisa dizer por que não — "o comboio ainda não chegou" é resposta; silêncio não é.
- **Compromisso de carta é fato.** O que o jogador fechou por carta aconteceu. Se três navios foram prometidos ao cais de Khar-Durak, o texto não pode ignorar os três navios.
- **Nada de recontar.** Antes de narrar uma descoberta, procure-a nos turnos anteriores. A moeda nova de cunho da Casa do Ouro foi descoberta no turno 6 e reapareceu como revelação no 10.
- **O privado não pede decisão.** Na tela o resultado aparece **acima** do privado (`GamePage`), então privado que termina em "ele espera a vossa palavra" envelhece no instante em que o turno fecha. Termine em fato.
- **Números da Casa.** O snapshot mostra o que mudou (ex.: recursos 2 → 5). Se um atributo saltou três pontos, o texto tem de dizer de onde veio.

## Correspondência

As cartas geradas **não** leem estes arquivos, e não devem: o material delas é montado em código por `ai/diplomacy/dossie.ts`, e o `CLAUDE.md` avisa que dois canais para a mesma coisa divergem — este repo já pagou por cópia que diverge.

O snapshot serve a duas coisas do lado das cartas:

- **Revisar ou reescrever** carta gravada (ver `reescrever-cartas-gravadas`): as cartas do turno vêm na íntegra, com autor `PLAYER` ou `AI`, e é ali que se vê o que a Casa prometeu.
- **Achar o que falta no dossiê.** Se uma carta de NPC ignora algo que o snapshot mostra, o defeito está no material do dossiê, não no modelo — e a correção vai no dossiê, nunca num segundo canal nem numa regra nova no prompt (ver `mexer-em-prompt-de-carta`).

## Antes de aplicar o turno

Releia do banco, não o que você gerou. O texto de resultado por Casa vive em
`TURN#0NN.result.houseResults[<houseId>]` e o privado em `TURN#0NN.privateInfo[<houseId>]`.
Guarde o texto anterior em `backups/turnos/` antes de sobrescrever, e regere o
contexto (`npm run contexto` e este script) depois.
