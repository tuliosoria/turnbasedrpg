# Recompensa nas Cartas — o trato explícito

**Data:** 2026-08-22
**Status:** Rascunho, aguardando revisão do Mestre
**Pedido do Mestre:** *"as cartas, eu queria que tivesse recompensa não somente custo. Por exemplo, recrutar exército. Custo 1 recurso, 3 turnos, mas aumenta em 2 soldados."*

---

## 1. O que eu encontrei antes de desenhar

A carta que o Mestre descreveu **já existe**.

`Recrutar Companhias Errantes` (`shared/src/projectTemplates.ts:22`): custo 1 Riqueza + 1
Estabilidade, 3 turnos, **Soldados +1 permanente**. O motor aplica isso de verdade
(`shared/src/projectEngine.ts:44-63`).

O Mestre não sabia que ela existia. E não sabia porque **a tela nunca mostra a
recompensa**. Em `frontend/src/components/HouseProjectsPanel.tsx:99` a carta da biblioteca
imprime título, categoria, descrição, duração e custo. Nada mais. A caixa de confirmação
(`:101`) repete só o custo: *"Iniciar X? Custo: Y."* O projeto ativo mostra uma barra de
progresso. O concluído mostra a narrativa.

Em nenhum desses quatro momentos o jogador vê o que vai ganhar.

Esse é o problema de superfície. Embaixo dele há quatro problemas maiores.

### 1.1 Das 65 cartas, só 5 dão recompensa mecânica

| Categoria | Cartas | Com ganho de atributo |
|---|---:|---:|
| MILITARY | 12 | 1 |
| INFRASTRUCTURE | 8 | 0 |
| ECONOMY | 4 | 3 |
| DIPLOMACY | 12 | 0 |
| INTELLIGENCE | 11 | 0 |
| SOCIETY | 10 | 1 |
| EXPLORATION | 5 | 0 |
| MAGIC | 3 | 0 |
| **Total** | **65** | **5** |

As outras 60 prometem em prosa, no campo `qualitativeEffects`, coisas que nada executa:

- *Contratar uma Companhia Mercenária*: "+1 Soldados temporário por 2 turnos" — e
  `applyCompletion` descarta efeitos temporários de propósito (`projectEngine.ts:49`:
  `if (!ch.permanent) continue;`).
- *Construir um Arsenal Regional*: "A próxima mobilização militar custa -1 Recurso" — não
  existe mobilização mecânica onde descontar.
- *Construir um Aqueduto*: "+1 Recursos OU +1 Estabilidade (escolha na conclusão)" — não
  existe momento de escolha.
- *Fundar uma Academia de Oficiais*: "+1 Controle durante ações militares" — não existe
  contexto "ação militar".

Não é falta de recompensa. É **promessa que o motor não cumpre**.

### 1.2 A regra de balanceamento já existe, e só a IA a conhece

Em `backend/src/ai/projectPrompts.ts:26-37` há uma tabela de troca escrita em prosa, dentro
do prompt que gera cartas customizadas:

```
- 1 turno: efeito pequeno/temporário, custo 0-1.
- 2 turnos: um Favor, vantagem temporária ou ativo pequeno, custo ~1.
- 3 turnos: unidade/rota/rede/acordo, custo 1-2.
- 4 turnos: ativo permanente ou +1 atributo, custo 2-3.
- 5 turnos: +1 permanente em atributo ou transformação, custo 3-4.
- 6+ turnos: projeto épico, altos custos e aprovação do mestre.
- Nenhuma carta comum concede mais de +1 permanente num atributo,
  e um aumento de atributo exige >= 4 turnos.
```

A regra é boa. O problema é onde ela mora — e quantas vezes.

**Ela está três vezes no mesmo arquivo**, copiada à mão: em `:26-37`, de novo em `:75-80`, e
uma terceira versão resumida em `:119`. As duas primeiras concordam. A terceira **contradiz
as duas**: diz *"3-4 turnos: ativo permanente ou +1 atributo"*, enquanto a regra principal
exige 4 turnos ou mais para qualquer ganho de atributo. Dependendo de qual prompt roda, a
IA recebe regras diferentes.

E as 65 cartas escritas à mão não seguem nenhuma das três (`Recrutar Companhias Errantes` dá
+1 atributo em 3 turnos), o jogador nunca lê a regra, e o Mestre não a tinha em mãos ao
pedir esta mudança.

### 1.3 O que é concedido não é exibido

Nove cartas concedem um ativo (`Milícia Local`, `Guarda de Elite`, `Fronteira
Fortificada`, `Animais de Guerra`, `Estaleiro`...). O ativo entra em `house.assets`
(`projectEngine.ts:56`) e é gravado no banco. **Nenhuma tela do jogador lê esse campo.**
As três Casas em produção têm zero ativos, e mesmo quando tiverem, ninguém verá.

O campo `unlocks: string[]` (`shared/src/projects.ts:55`) é escrito pela IA e por nenhum
código lido. É uma moeda de recompensa inteira sem consumidor.

### 1.4 A urgência

Estado real da produção hoje:

| Casa | Riqueza | Recursos | Soldados | Controle | Estabilidade | Cartas que consegue iniciar |
|---|---:|---:|---:|---:|---:|---|
| Do Ouro | 5 | 1 | 4 | 3 | 3 | 47 de 65 |
| Khazdrun | 1 | 1 | 3 | 1 | 3 | 40 de 65 |
| Solarion | 0 | 3 | 1 | 2 | 3 | **19 de 65** |

Projetos em andamento:

| Projeto | Progresso | Recompensa mecânica |
|---|---|---|
| Fundar uma Academia de Oficiais | 3/5 | **nenhuma** |
| Construir um Aqueduto | 3/5 | **nenhuma** |
| Torre de Vigilância e Defesa Solarion | 3/4 | **nenhuma** |

Em um ou dois turnos, três jogadores vão concluir projetos de quatro e cinco turnos e
receber uma narrativa e mais nada. É agora que isso precisa ser resolvido.

Duas observações que saem da mesma tabela:

- **Solarion está travada.** Tem Riqueza 0, e Riqueza é o custo mais comum da biblioteca
  (46 das 83 linhas de custo). Das 19 cartas que consegue pagar, **zero** têm recompensa
  mecânica hoje.
- **Do Ouro está no teto de Riqueza.** Qualquer carta que dê "+1 Riqueza" para ela é
  desperdiçada em silêncio, porque `applyCompletion` faz `clamp(…, 0, 5)`.

---

## 2. A restrição que mais importa: a escala é 0–5

`shared/src/types.ts:5-11`: os quatro atributos vão de **0 a 5**, e uma Casa nasce com
**10 pontos** para distribuir entre eles.

Isso muda o pedido do Mestre. "Custo 1 recurso, 3 turnos, aumenta em 2 soldados" significa,
nessa escala:

- gastar **1 ponto** e ganhar **2** — lucro líquido de +1 ponto por carta, e o custo se
  recupera sozinho;
- +2 soldados é **20% de tudo o que uma Casa tem** ao nascer;
- numa Casa como Solarion (Soldados 1), a carta **triplica** o exército em 3 turnos;
- com o limite de 1 slot e cartas de 1 a 5 turnos, uma Casa conclui algo a cada ~3 turnos.
  Numa campanha de 20 turnos são ~7 conclusões. A +2 por carta, toda Casa bate o teto de
  todos os atributos antes do fim.

O motor já tem uma trava para isso: `enforceGmTriggers` (`projectPrompts.ts:257-266`) marca
`requiresGmApproval = true` sempre que uma carta concede mais de +1 permanente. Ou seja, o
+2 **já é possível** — só que passa pela mesa do Mestre em vez de virar rotina.

**Recomendo manter +1 como o teto das cartas comuns e reservar +2 para cartas que o Mestre
aprova uma a uma.** É a regra que o próprio sistema já escreveu. Se o Mestre quiser subir o
teto, o lugar de mexer é a tabela da seção 4, e a consequência é a inflação descrita acima.

---

## 3. As três abordagens que considerei

### A) Só a vitrine

Mostrar na tela o que já existe. Um arquivo, meia hora.

Resolve o mal-entendido que gerou este pedido: o Mestre veria que sua carta existe. Mas
deixa 60 cartas exibindo "Ganho: nada", o que torna o problema **mais** visível sem
resolvê-lo. E os três projetos em andamento continuariam terminando em nada.

### B) Recompensa mecânica em todas as 65

Dar a cada carta um ganho de atributo.

Quebra a economia pela razão da seção 2: com teto 5 e orçamento 10, sete conclusões por
campanha já levam uma Casa ao limite. Vira um jogo de subir números, e a escassez — que é o
que dá peso às decisões numa campanha política — desaparece.

### C) O trato explícito — **recomendada**

Três movimentos:

1. **Uma fonte única para a regra de troca.** A tabela que hoje só a IA lê vira código
   compartilhado, testado, e passa a valer para as três origens de carta: a biblioteca
   estática, a IA e o Mestre.
2. **Toda carta declara um ganho garantido**, tirado de cinco moedas que o tipo já suporta,
   escolhidas de modo que só as cartas longas inflacionem atributos.
3. **A tela mostra o trato inteiro** — custo e ganho, lado a lado, nos quatro momentos em
   que a carta aparece. E separa o que o motor garante do que o Mestre honra na narrativa.

O ponto de C é que a recompensa **não precisa ser sempre atributo**. Precisa ser sempre
**visível, concreta e cumprida**.

---

## 4. Desenho

### 4.1 As cinco moedas de recompensa

Todas já existem em `CompletionEffects` (`shared/src/projects.ts:50-56`). Estão ordenadas da
mais inflacionária para a menos:

| Moeda | Campo | Inflaciona? | Quando usar |
|---|---|---|---|
| **Atributo permanente** | `attributeChanges` (`permanent: true`) | Sim, muito | Só em cartas de 4+ turnos. +1, nunca mais |
| **Estabilidade** | `attributeChanges` (`stability`) | Sim, mas se gasta | Cartas sociais curtas; sobe e desce com a campanha |
| **Ativo nomeado** | `assets` | Não | A alavanca narrativa do Mestre. Precisa virar visível |
| **Favor** | `favors` | Não | Cartas diplomáticas; já implementado |
| **Desbloqueio** | `unlocks` | Não | Cartas curtas: concluir abre cartas antes indisponíveis |

**`unlocks` é a peça que resolve o meio da tabela.** Cartas de 2 e 3 turnos são 31 das 65 e
não podem dar atributo (a regra exige 4+) nem devem dar ativo toda vez. Fazer com que
concluí-las **abra outras cartas** dá progressão real sem inflar número nenhum, e transforma
a biblioteca de um catálogo plano numa árvore.

### 4.2 O trato precisa ser alcançável de qualquer canto do mapa

Solarion tem Riqueza 0, e Riqueza é o custo de 46 das 83 linhas de custo da biblioteca. Ela
consegue pagar 19 cartas, e nenhuma dá recompensa mecânica. Desbloqueio nenhum resolve isso:
abrir uma carta que ela não pode pagar não a tira do lugar.

O que resolve é uma regra sobre a **forma dos custos**, não sobre a recompensa:

> Para cada atributo, a biblioteca precisa conter pelo menos uma carta de 4+ turnos que
> conceda ganho permanente e **não** cobre naquele atributo.

Sem isso, uma Casa que zera Riqueza fica presa em Riqueza 0 para sempre, porque toda saída
custa aquilo que ela não tem. Hoje é exatamente a situação de Solarion, e é uma armadilha
que o jogador não causou e não consegue desfazer.

Na prática: cartas econômicas de 4-5 turnos precisam ter uma versão custeada em Recursos, e
cartas militares uma versão custeada em Riqueza. É trabalho de curadoria, não de código, e
o teste da seção 5 é quem cobra.

### 4.3 A tabela de troca vira código

Novo módulo `shared/src/projectBalance.ts`, fonte única:

```ts
/** O que uma carta pode conceder, pela sua duração. */
export interface FaixaDeTroca {
  turnos: number;
  custoMin: number;
  custoMax: number;
  atributoPermanenteMax: number;  // 0 abaixo de 4 turnos
  moedasPermitidas: MoedaDeRecompensa[];
  resumo: string;                 // texto que a IA e a tela reaproveitam
}

export const TABELA_DE_TROCA: FaixaDeTroca[];

/** Zero problemas = a carta respeita o trato. Usado por teste e pelo painel do Mestre. */
export function auditarCarta(carta: ProjectTemplate | ProjectCard): ProblemaDeBalanco[];

/** "Soldados +1 permanente · Ativo: Guarda de Elite" — para a tela. */
export function resumoDoGanho(efeitos: CompletionEffects): string;

/** O que o jogador perde do ganho por já estar no teto. Ver 4.6. */
export function ganhoDesperdicado(casa: House, efeitos: CompletionEffects): Desperdicio[];
```

Três consumidores, um só lugar para mudar a regra:

- `backend/src/ai/projectPrompts.ts` monta seu `SYSTEM` a partir de `TABELA_DE_TROCA` em vez
  da prosa duplicada de hoje.
- Um teste percorre as 65 cartas com `auditarCarta` e falha se alguma escapar do trato. Esse
  teste **falha hoje** — é a rede que garante que o item 4.4 foi feito de verdade e que
  ninguém acrescenta uma carta muda no futuro.
- A tela usa `resumoDoGanho` para escrever o ganho.

### 4.4 As 65 cartas passam a cumprir o trato

Cada carta ganha um efeito conforme a duração:

| Turnos | Cartas | Ganho garantido |
|---:|---:|---|
| 1 | 11 | Estabilidade ±1, ou um Favor, ou um desbloqueio |
| 2 | 12 | Um desbloqueio, ou um Favor, ou um ativo pequeno |
| 3 | 19 | Um ativo nomeado **e** um desbloqueio |
| 4 | 13 | **+1 permanente** num atributo, ou um ativo forte |
| 5 | 10 | **+1 permanente** num atributo, mais um ativo ou desbloqueio |

`Recrutar Companhias Errantes` é a exceção que já existe: dá +1 atributo em 3 turnos. Duas
saídas, e prefiro a primeira: **subir a carta para 4 turnos**, que é o que a regra pede e o
que o nome sugere (recrutar e treinar leva tempo). A alternativa é abrir uma exceção
declarada na tabela. Decisão do Mestre.

`qualitativeEffects` deixa de ser onde a promessa mora e passa a ser **sabor**. As promessas
mecânicas de hoje que o motor não cumpre (seção 1.1) viram uma de três coisas: efeito real
numa das cinco moedas, texto sob o rótulo "o Mestre honra isto na narrativa" (4.5), ou são
apagadas por não significarem nada.

### 4.5 A tela mostra o trato inteiro

Em `HouseProjectsPanel.tsx`, nos quatro momentos:

1. **Biblioteca** — abaixo da linha de custo, uma linha `Ganho:` com o mesmo peso visual.
   Sem ela, o jogador escolhe às cegas, que é o estado de hoje.
2. **Confirmação** — *"Iniciar X? Custo: A. Ganho ao concluir: B."* Uma frase, o trato todo.
3. **Projeto ativo** — junto da barra de progresso, o que está sendo construído.
4. **Concluído** — o que de fato entrou, ao lado da narrativa. É o momento da recompensa e
   hoje ele é mudo.

E a separação que dá honestidade ao sistema: **duas seções distintas na carta**.

> **Garantido pelo motor:** Soldados +1 permanente
> **O Mestre honra na narrativa:** informação antecipada sobre movimentos de tropa

O jogador passa a saber o que é contrato e o que é confiança. Hoje as duas coisas estão
misturadas no mesmo parágrafo, e é por isso que a promessa não cumprida passa despercebida.

Os ativos da Casa também precisam aparecer na página da Casa. Um ativo que ninguém vê não é
recompensa; é uma linha no banco.

### 4.6 O teto, e o que fazer quando a recompensa não cabe

`applyCompletion` faz `clamp(…, 0, 5)` e não avisa ninguém. Do Ouro, com Riqueza 5, ganharia
"nada" de uma carta que promete Riqueza. Isso é uma promessa quebrada em silêncio, que é o
problema que esta spec inteira ataca.

Regra: **quando um ganho de atributo bate no teto, ele vira +1 Estabilidade**, e a conclusão
diz isso em texto. Estabilidade é a moeda certa para isso porque sobe e desce ao longo da
campanha e nunca fica presa no teto por muito tempo.

Estabilidade também vai só até 5 (`types.ts:10-11`), então a conversão pode esbarrar no
mesmo problema. Quando as duas estiverem no teto, a recompensa vira **um ativo nomeado**,
que não tem limite. A ordem é: atributo → estabilidade → ativo. Sempre sobra para onde ir, e
o jogador nunca conclui um projeto de cinco turnos e recebe nada.

A tela também avisa **antes**: uma carta cujo ganho a Casa não consegue absorver aparece
marcada na biblioteca. Melhor o jogador escolher outra do que descobrir depois de 5 turnos.

### 4.7 O que fica de fora, e por quê

- **Efeitos temporários de verdade.** O tipo já os prevê (`AttributeChange.durationTurns`) e
  o motor os descarta. Fazê-los funcionar exige guardar modificadores ativos na Casa, com
  turno de expiração, e um `atributosEfetivos(casa)` que todo leitor de atributo passe a
  usar. É um projeto próprio, e não é o que destrava a situação de agora. **Fase 2.**
  Enquanto isso, nenhuma carta promete efeito temporário.
- **Bônus condicionais** ("+1 Controle em defesa"). Não há resolução mecânica de combate
  onde ancorá-los — o turno é narrado pelo Mestre. Esses viram texto sob o rótulo de 4.5.
- **Custos `PER_TURN` e `ON_COMPLETION`.** Existem no tipo, nenhuma das 65 cartas os usa, e
  `applyStartCharges` só cobra `ON_START`. Fora de escopo.
- **`SOLDIERS_COMMITTED` e `CONTROL_COMMITTED` nunca são debitados.** `canAffordStart`
  **verifica** os dois (`projectEngine.ts:26-27`) e `applyStartCharges` **não cobra nenhum
  deles**. Três cartas pedem esses custos e as três saem de graça. É um bug do lado do
  custo, não do ganho; anoto aqui porque encontrei, mas comprometer tropas e devolvê-las na
  conclusão é outro desenho. **Dívida registrada.**

---

## 5. Como se testa

- **Auditoria da biblioteca.** Um teste roda `auditarCarta` nas 65 cartas e falha se alguma
  ficar sem ganho ou fugir da faixa da sua duração. É o teste que impede a regressão para o
  estado de hoje.
- **A regra é uma só.** Um teste garante que o prompt da IA é derivado de `TABELA_DE_TROCA`,
  para que a prosa não volte a divergir do código.
- **O teto.** Casa com atributo em 5 conclui carta que dá aquele atributo: recebe
  Estabilidade e o texto explica. Casa com atributo **e** Estabilidade em 5 recebe um ativo.
  Nenhum caminho termina em nada.
- **O chão.** Para cada atributo, existe pelo menos uma carta de 4+ turnos que dá ganho
  permanente sem cobrar naquele atributo (regra de 4.2). O teste roda contra os estados
  reais das Casas em produção, incluindo Solarion com Riqueza 0, e falha se alguma Casa não
  tiver saída. É o teste que impede a armadilha de hoje.
- **Efeito aplicado uma vez só.** `processProjectForTurn` já é idempotente por
  `lastProcessedTurnId`; o teste cobre a conclusão junto.
- **Na tela.** Os quatro momentos mostram o ganho, e o garantido aparece separado do
  narrativo.

## 6. Decisões que preciso do Mestre

1. **O teto de +1 continua?** A regra que o sistema já escreveu diz que carta comum não
   passa de +1, e que atributo exige 4+ turnos. O pedido original (+2 em 3 turnos) rompe as
   duas. Recomendo manter, com +2 disponível via aprovação do Mestre, que é como
   `enforceGmTriggers` já trata o caso.
2. **`Recrutar Companhias Errantes` sobe para 4 turnos** ou vira exceção declarada?
3. **`unlocks` como moeda central das cartas de 2–3 turnos** — é a ideia mais nova desta
   spec e a que mais muda a sensação da biblioteca. Vale?
4. **Ganho no teto vira Estabilidade** (e depois ativo) — ou o Mestre prefere que o jogador
   seja impedido de iniciar a carta?
5. **Como destravar Solarion.** A regra de 4.2 exige cartas de 4+ turnos custeadas fora do
   atributo que concedem. Dá para conseguir isso **recusteando cartas que já existem** ou
   **escrevendo cartas novas**. A primeira é menos trabalho e mexe em cartas que o Mestre já
   revisou; a segunda preserva o que está escrito. Prefiro a primeira, mas o texto é dele.

## 7. Ordem de implementação

1. `shared/src/projectBalance.ts` com a tabela, `auditarCarta` e `resumoDoGanho`, com testes.
2. Testes de auditoria — o do trato (4.4) e o do alcance (4.2) — vermelhos de propósito,
   marcando o tamanho do trabalho.
3. Retrofit das 65 cartas até os dois testes ficarem verdes.
4. Regra do teto em `applyCompletion`: atributo → estabilidade → ativo.
5. `projectPrompts.ts` passa a derivar o `SYSTEM` da tabela, e as três cópias da regra viram
   uma.
6. Tela: ganho nos quatro momentos, garantido separado de narrativo.
7. Ativos da Casa visíveis na página da Casa.
