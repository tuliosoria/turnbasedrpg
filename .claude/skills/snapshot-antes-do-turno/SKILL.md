---
name: snapshot-antes-do-turno
description: Use before drafting a Valdren turn, writing private info, or reviewing NPC correspondence. Generates one snapshot per house plus a world file from the database and requires reading them first, because writing a turn from the chronicle alone has already produced repeated scenes, unanswered player orders and goods delivered while still on the road.
---

# Snapshot antes de escrever turno

**Rode isto antes de escrever qualquer coisa que um jogador vá ler.**

```bash
npm run snapshot          # o último turno resolvido
npm run snapshot 10       # um turno específico
npm run snapshot todos    # todos os turnos resolvidos, numa leitura só do banco
```

Escreve em `campaign-context/snapshots/` duas camadas:

**O que você LÊ** — os cinco briefings, ~11 mil tokens no total:

| Arquivo | Para quê |
|---|---|
| `valdren-turn<N>-briefing.md` | O mundo: o que mudou neste turno, o que segue de pé dos dois anteriores, os números das Casas, o que cada potência quer. |
| `<casa>-turn<N>-briefing.md` | Por Casa: onde está (com há quantos turnos cada atributo não muda), **o relógio** dos compromissos com o prazo que o texto declara, os que estão de pé sem prazo reconhecido, pedido de NPC esperando resposta, as ordens do turno com `eco`/`SEM ECO`, feridas abertas, favores na tela do jogador, segredos que a Casa já tem, e o **índice de primeira menção**. |
| `_conferencia-turn<N>.md` | Os trechos em que uma Casa fala de outra, lado a lado. |

**O que você CONSULTA** — os `-context.md`, 331 KB por turno, ~84 mil tokens, 80% carta na íntegra. Abra um quando o briefing apontar para algo específico: o texto integral de uma carta, uma ordem completa, um compromisso cortado em 200 caracteres.

Leia os **cinco briefings** antes de escrever, nesta ordem: mundo, cada Casa, conferência. São gerados — não edite à mão, e não junte duas Casas num arquivo: a separação por audiência é a regra de sigilo do repo, não formatação.

**Nunca escreva o turno tendo lido o briefing de uma Casa só.** Foi assim que o Perdão Real de Emergência de Do Ouro e a investigação de Raven's Cross de Solarion passaram batidos: eu li Khazdrun inteiro e folheei os outros dois. Agora os três mais o mundo cabem juntos no orçamento, e não há desculpa.

### O que o briefing não sabe

- **Prazo que o extrator não reconheceu** cai na lista "sem prazo reconhecido", com o texto do compromisso. A lista existe para o relógio não dar falsa segurança — leia-a, não conclua que não há prazo.
- **O índice de primeira menção** é tabela para consultar, não regra. Ele diz que "Vell" apareceu primeiro no turno 10 e "Borin" no 6; não diz se recontar é errado ali.
- **Pedido marcado `(sem verbo de pedido)`** é palpite de posição: a frase foi escolhida por ser a primeira substancial, não por conter "pedimos". Abra a carta.
- **Tom, motivo e nuance** não estão aqui. O briefing diz o que está de pé e onde olhar; a cena se escreve lendo o texto.

**Turno encerrado mostra menos, de propósito.** Ordens, textos, privados e cartas são exatamente os daquele turno. Mas o banco guarda **um** estado de projeto, de favor, de atributo e de humor de NPC — o de hoje —, então o arquivo de um turno antigo diz em voz alta que aqueles números não valem como número daquele turno, e omite humor e relação de NPC em vez de apresentar o de hoje como se fosse o de então. Pactos, fatos e projetos são cortados no turno pedido: pacto de turno posterior não existia quando aquele turno fechou.

## Por que existe

Quatro falhas do turno 10, todas no mesmo texto, todas por escrever lendo só `cronica.md` — que trunca carta em 110 caracteres e não mostra ordem nenhuma:

0. **O contexto grande virou desculpa para folhear.** A primeira versão desta skill mandava ler 331 KB por turno. Quem recebe isso folheia, e folhear um arquivo desse tamanho é como se perde o prazo que importava. Daí a camada de briefing.
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

## A validação, e o que ela bloqueia

```bash
npm run validar -- 10                       # sai 1 se houver ERRO
npm run validar -- 10 --ignorar ordem-sem-eco
npm run validar -- 10 --erro ordem-sem-eco  # promove um aviso a erro
npm run validar -- 10 --aviso ordem-sem-eco # rebaixa um erro a aviso
```

O `--` depois de `validar` é obrigatório quando há flag. Sem ele o npm come
`--ignorar`, `--erro` e `--aviso` como config dele: o script não vê a isenção
e o portão continua saindo 1.

**Não aplique turno com ERRO aberto.** O relatório vai para o terminal e para
`campaign-context/snapshots/_validacao-turn<N>.md`, inclusive o que foi ignorado
por decisão do Mestre — a decisão fica no git, não só no terminal de quem rodou.

O bloqueio alcança scripts e quem lê. O Mestre aplica o turno pela tela do admin,
e nenhum script impede isso; amarrar a validação na rota é outro assunto.

**A severidade vem da confiabilidade da checagem, não da importância do defeito.**
Portão que trava por engano é portão que se aprende a contornar.

| ERRO — verdadeiro por construção e sem ambiguidade |
|---|
| `privado-vazio` — Casa sem informação privada (foi o turno 9) |
| `privado-pede-decisao` — o privado termina em pergunta ou em fórmula de espera |
| `numero-contradito` — o texto afirma mudança de atributo que a trilha contradiz |
| `projeto-falhado-nao-contado` — projeto falhou em turno anterior e nenhuma palavra do título aparece nos textos desde então |

| AVISO — heurístico, leia e julgue |
|---|
| `repeticao-literal` — 10+ palavras repetidas de turno anterior da mesma Casa |
| `ordem-sem-eco` — nenhuma palavra da ordem aparece no texto |
| `nome-sem-registro` — nome próprio novo sem verbete, entidade visual ou NPC |

`compromisso-sem-prazo` é NOTA: recusa e prática permanente não têm prazo por natureza.

### Por que `repeticao-literal` não é ERRO, mesmo tendo pegado defeito de verdade

Na primeira execução real ela pegou uma recontagem minha: a emenda do turno 10 de
Do Ouro contava o bloqueio da Estrada Branca que o turno 9 já tinha contado. Acerto
limpo. E na mesma execução acendeu para "o caderno velho da biblioteca, aquele em
que...", que é retomada deliberada em Khazdrun — ofício, não descuido. Ela não
distingue as duas, então não pode ser portão. Um aviso que se lê vale mais que um
erro que se aprende a ignorar.

### Nome novo não vira entidade sozinho

`nome-sem-registro` só **aponta**. Promover Vell, Ordwin ou o Vau Seco a verbete
passa pela fila de cânone que já existe (`CANONSUB`, plano
`2026-08-16-adicionar-canonico`), onde a IA propõe e **o Mestre aprova** — a regra
escrita lá é que a IA nunca publica.

## Antes de aplicar o turno

Releia do banco, não o que você gerou. O texto de resultado por Casa vive em
`TURN#0NN.result.houseResults[<houseId>]` e o privado em `TURN#0NN.privateInfo[<houseId>]`.
Guarde o texto anterior em `backups/turnos/` antes de sobrescrever, e regere o
contexto (`npm run contexto` e este script) depois.
