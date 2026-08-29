# O registro de fatos da campanha

Data: 2026-08-29

## O problema

O que aconteceu na campanha só existe como prosa. Quem escreve uma carta lê a crônica
— texto corrido — e quem escreve o turno lê a mesma coisa. Não há lugar onde esteja
escrito, em uma linha consultável, que Khazdrun enviou cem homens no Turno 6.

O custo disso foi medido: a afirmação errada de que Khazdrun não enviou tropa nenhuma
atravessou três turnos, apareceu no evento público, no resultado da Casa e em três
cartas já entregues. Corrigi-la exigiu varrer sete turnos à mão procurando
contradição.

`CampaignFact` já existe e resolve metade do problema — e não é lida por ninguém.
São 11 linhas gravadas pelas cartas, exibidas na aba Pactos e no admin, e **nenhum
prompt de IA as recebe**. É a mesma forma do problema das biografias: o dado existe,
é bom, e a IA não o vê.

Mas ela também não caberia "quem mandou tropa". O `betweenA` é a Casa do jogador por
desenho, documentado no próprio modelo depois do erro da promessa da Karasoy. Um fato
entre a Coroa e Khazdrun não é bilateral com jogador nenhum.

## O que não vamos fazer

**Destilar os fatos num resumo de "estado do mundo".** Seria mais barato por chamada,
mas é um artefato derivado que diverge da fonte em silêncio — a mesma forma já
rejeitada para as biografias, e o problema que já existe entre `defaultWiki.ts` e o
banco. Pior: destilar apaga os números ("cem homens", "300 lingotes") que são
exatamente o que faz a carta ser concreta.

**Uma ficha acumulada por Casa.** Um fato com três partes seria duplicado ou perdido,
e "o eclipse em 41 dias" não pertence a Casa nenhuma. Duplicação obriga a corrigir em
vários lugares — o bug da promessa da Karasoy.

**Migrar o `CampaignFact` existente.** Ele tem UI viva (os botões de aceitar e recusar
pacto) e comportamento de rota preso nele. Os fatos do mundo entram como tipo novo, e
a unificação acontece na LEITURA: quem monta o prompt junta os dois. O Mestre enxerga
um registro só; o código não paga uma migração arriscada para isso.

**Uma etapa de aprovação por fato.** Foi decisão do Mestre: a IA grava sozinha. As
defesas contra fato inventado são outras, e estão na seção 1.

## O desenho

### 1. O modelo

Em `shared/src/campaign/worldFacts.ts`, gravado sob `WFACT#`:

```ts
export interface WorldFact {
  id: string;
  campaignId: string;
  turnNumber: number;
  kind: "MILITAR" | "PACTO" | "DIVIDA" | "SUCESSAO" | "DECRETO";
  /** Chaves de sede que o fato envolve. VAZIO = vale para o reino inteiro. */
  parties: string[];
  /** "PUBLICO", ou a chave da sede dona do segredo. Ver o adendo no fim. */
  visibility: string;
  /** Uma frase, com número e prazo quando houver. */
  summary: string;
  /** O trecho do texto do turno que afirma isto. */
  quote: string;
  status: "ATIVO" | "REVOGADO";
  /** Id do fato que corrige este. */
  supersededBy: string | null;
  createdAt: string;
}
```

`quote` é a defesa contra invenção, e ela não é um pedido ao modelo. Um fato cuja
citação não aparece **textualmente** no texto de origem é descartado em código. O
modelo pode alucinar o resumo; não consegue alucinar uma citação que um `includes()`
vai conferir.

A comparação normaliza espaço em branco e acentuação antes de conferir, porque o
modelo reescreve reticências e quebras de linha sem querer. Não normaliza números nem
palavras: é isso que se está protegendo.

`parties: []` é o que permite guardar o edito da Coroa e a data do eclipse, que não
pertencem a Casa nenhuma.

### 2. Como o fato nasce

No `applyTurn` de `adminRoutes`, depois da resolução gravada — mesmo lugar e mesma
regra do Relationship Engine: roda no fim, e uma falha da IA nunca desfaz o turno.

Uma chamada por bloco do turno — o público, e depois o resultado de cada Casa —, com
teto de 4.000 tokens e uma repetição em caso de resposta vazia. O porquê de não ser
uma chamada só está no adendo no fim.

Idempotente por turno: reaplicar um turno apaga os fatos daquele turno antes de
gravar os novos, em vez de empilhar.

### 3. Como o fato chega à IA

A seleção é função pura em `shared`, testável sem modelo:

- `selectFactsForLetter(facts, { seats, limit })` — só os PÚBLICOS, cujo `parties`
  intersecta as sedes envolvidas ou está vazio, mais recentes primeiro. Teto de 15.
- `selectFactsForTurn(facts, limit)` — tudo que está ativo, mais recentes primeiro.
  Teto de 60.

Fato `REVOGADO` nunca é selecionado, em nenhum dos dois.

Consumidores: `buildHouseReplyUser`, `buildCodexNpcReply`, `buildOutreachUser`,
`buildPublicEventPrompt` e `buildResolutionPrompt`.

Custo na carta: ~500 tokens sobre os ~2.000 atuais.

### 4. Como um fato errado morre

Uma aba no admin lista os fatos com filtro por turno e por tipo, e um botão revoga.
Revogar nunca apaga: `status` vira `REVOGADO` e o registro continua auditável, como já
é para `CampaignFact`.

`supersededBy` serve à correção: quando um turno é reescrito, o fato novo aponta para
o velho e o velho é revogado. A história de que houve correção fica preservada.

## Testes

Em `shared`:

- um fato do reino (`parties: []`) entra em toda seleção de carta;
- um fato entre A e B não entra numa carta entre C e D;
- fato revogado não entra em seleção nenhuma;
- o teto é respeitado, e o que sobra é o mais recente.

Em `backend`:

- um fato cuja citação não existe no texto de origem é descartado;
- a citação confere mesmo com espaço em branco e acentuação diferentes;
- reaplicar um turno não duplica fatos;
- falha da IA na extração não derruba o turno;
- o bloco de fatos aparece no prompt da carta e some quando não há fato.

O caso dos anões é o teste de aceitação: dado o texto do Turno 6, a extração produz um
fato MILITAR sobre Khazdrun; revogado e substituído, a carta seguinte passa a receber
o substituto e não o original.

## O que mudou durante a implementação

**Extração bloco a bloco, não o turno inteiro numa chamada.** Com o turno todo
(3.071 tokens de entrada) o modelo gastou 3.584 tokens de raciocínio numa tentativa e
estourou 5.000 em duas outras, devolvendo nada. Fatiado por audiência — o público, e
depois o resultado de cada Casa —, os quatro blocos do Turno 6 terminaram todos na
primeira tentativa, com raciocínio entre 512 e 2.048. Subir o teto não era a saída: a
8.000 o modelo gastou os 8.000 inteiros e não respondeu.

**Um campo de visibilidade, que a spec original não previa.** A primeira extração
real produziu este fato: *"A investigação sigilosa de Durgan encontrou três homens
ligados a Borin que receberam pagamento em moeda cunhada pela Casa do Ouro"*, com
partes `[casa-khazdrun, casa-do-ouro]`. Ele saiu do resultado PRIVADO de Khazdrun, e
do jeito desenhado teria entrado no prompt de qualquer carta envolvendo a Casa do
Ouro — entregando a um NPC o segredo que o jogador de Khazdrun pagou para descobrir.

`WorldFact.visibility` guarda `"PUBLICO"` ou a chave da sede dona do segredo.
`selectFactsForLetter` só devolve os públicos; `selectFactsForTurn` devolve tudo,
porque quem escreve o turno é o Mestre e ele já sabe.

A visibilidade não é perguntada ao modelo: cada chamada lê um bloco só, e o fato
herda a audiência daquele bloco. Confiar o sigilo de um jogador a um campo que o
modelo preenche seria o mesmo erro por outro caminho.
