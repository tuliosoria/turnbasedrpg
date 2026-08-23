# Energia das Cartas — Design

**Data:** 2026-08-23
**Estado:** aprovada — o Mestre mandou implementar em 23/08

## 0. O que o Mestre pediu

Nas palavras dele, em três mensagens:

> "Cada casa, cada turno, tem 3 de Energia. Essa energia seria usada para usar cartas. Jogador pode usar um de energia e ativar 3 cartas, OU usar 3 de energia em uma só carta, reduzindo seu efeito por turno."

> "Expandir o sistema existente de carta. Seria um jeito de usar mais cartas por turno ou acelerar efeito."

> "Assim jogadores podem, por exemplo, gastar 3 de energia para recrutar mais soldados em um turno. Essa mecânica seria para deixar jogadores evoluírem."

A primeira mensagem admitia duas leituras opostas de "reduzindo seu efeito por turno": concentrar podia acelerar a carta ou enfraquecê-la. As duas mensagens seguintes desfazem a dúvida — "acelerar efeito" e "deixar jogadores evoluírem". **Concentrar acelera.** O que a pressa reduz é o tempo, não a recompensa.

### 0.1 O problema que isso resolve

Hoje o jogador não decide nada sobre suas cartas. Ele inicia uma, e ela avança sozinha um turno por turno até concluir. Com o limite de **uma** carta ativa, uma Casa ganha +1 de atributo a cada três a cinco turnos. Num jogo play-by-post, onde um turno leva dias, isso é lento demais para o jogador sentir que evoluiu.

A Energia troca a espera por escolha.

## 1. A mecânica

Cada Casa recebe **3 de Energia no início de cada turno**. Não acumula: o que não for gasto se perde quando o turno vira.

**1 Energia = 1 turno de progresso** numa carta. O jogador distribui os três pontos entre as cartas ativas como quiser, e a escolha nasce dessa aritmética:

| Distribuição | Efeito |
|---|---|
| 1 + 1 + 1 | três cartas andam um passo cada |
| 2 + 1 | uma anda dois passos, outra um |
| 3 | uma carta anda três passos de uma vez |

A mesma Energia, jogos diferentes: largura ou profundidade.

### 1.1 O exemplo do Mestre, com a carta real

`Recrutar Companhias Errantes` custa 1 Riqueza e 1 Estabilidade, leva **3 turnos** e dá **+1 Soldado**. Com os 3 pontos de Energia num turno só, ela é iniciada e concluída no mesmo turno. É literalmente o "gastar 3 de energia para recrutar mais soldados em um turno" do pedido.

### 1.2 Iniciar e alimentar no mesmo turno

Permitido, e é o que faz o exemplo acima funcionar. Iniciar uma carta **não custa Energia** — ela já cobra os próprios custos de início em Riqueza, Recursos, Estabilidade. A Energia governa o avanço, não a entrada.

### 1.3 Não se desperdiça Energia

Uma carta não aceita mais Energia do que falta para concluí-la. Uma carta de 3 turnos com 2 já cumpridos aceita **1** ponto, não 3. Sem isso, o jogador queimaria pontos sem retorno e a tela teria de explicar por quê.

## 2. A regra que protege o jogo que já está rodando

**Quem não distribuir nada não trava, e não é acelerado.**

Se o turno fecha sem alocação, cada carta ativa recebe **exatamente 1 de Energia**, e o que sobra se perde.

Isto é deliberado e é a decisão mais importante desta spec. A tentação seria espalhar os 3 pontos pelas cartas ativas, mas hoje cada Casa tem **uma** carta em andamento — espalhar daria os 3 pontos a ela e a faria saltar três turnos de uma vez, sem ninguém pedir. Os três projetos em voo agora (`Fundar uma Academia de Oficiais` 5 turnos, `Construir um Aqueduto` 5 turnos, `Torre de Vigilância e Defesa Solarion` 4 turnos) pulariam quase até a conclusão no primeiro turno após o deploy.

O princípio, então: **inação não acelera nada**. Cada carta continua avançando exatamente um turno por turno, o ritmo de hoje, e só anda mais depressa quem escolher gastar Energia nela. O jogo de fato acelera quando a Casa passa a tocar três cartas em vez de uma — mas isso é um ato deliberado, iniciar cada uma delas, não algo que aconteça sozinho. Isso também honra a instrução que o Mestre já deu duas vezes — nunca bloquear o jogador por inércia.

## 3. O teto de cartas ativas precisa subir

Hoje `projectSlotLimit` devolve **1**, ou **2** com Controle ≥ 4. Com teto 1, "usar 3 cartas por turno" é impossível: a escolha entre largura e profundidade não chega a existir, e a Energia vira só um acelerador.

**Decidido: 3 para toda Casa.** O Mestre não respondeu a esta pergunta em separado; disse "Implementar" com uma proposta de 3/4 na mesa, o que valeu como aval tácito. Durante a implementação a revisão final derrubou o 4 — veja abaixo.

O 3 vem dos números do próprio Mestre ("3 de Energia", "ativar 3 cartas"), e é o mínimo para a escolha existir.

O 4 para Controle ≥ 4 chegou a ser implementado, com o argumento de que preservava o prêmio de Controle e apertava melhor. **Estava errado, e a revisão final mostrou por quê:** com quatro cartas e três pontos, *toda* distribuição possível rende menos progresso do que não mexer em nada — a distribuição que empataria (1+1+1+1) soma 4 e é recusada. A inação virava a estratégia de maior vazão, o oposto do que o §2 promete, e o prêmio de Controle virava punição por usar a mecânica nova.

A saída tentada foi a Energia acompanhar o número de cartas ativas, mas isso amarra o orçamento a um atributo e faz Casas receberem números diferentes — as duas coisas que o §8 declarou fora de escopo citando o Mestre. Entre furar o número dele e abrir mão de um prêmio de Controle inventado nesta spec, **o número dele manda**.

O teto de cartas e o orçamento de Energia são hoje o mesmo 3, e há teste cobrando que continuem iguais. Se um subir, o outro sobe junto.

> Se o Mestre quiser rever depois, trocar o número é uma linha em `projectSlotLimit`, e nada mais no sistema depende dele.

## 4. O que isso faz com o equilíbrio das cartas

### 4.1 O ritmo triplica — e é esse o pedido

Com teto 1, uma Casa avança 1 turno-de-projeto por turno. Com teto 3 e 3 de Energia, avança 3. É um jogo três vezes mais rápido em progressão, que é exatamente o "deixar jogadores evoluírem" pedido.

### 4.2 A tabela de troca sobrevive intacta

Esta é a parte que dá sorte. A `TABELA_DE_TROCA` publicada em 22/08 precifica recompensa por **duração**: 3 turnos valem +1 de atributo, 4 e 5 turnos valem +2. Como o custo em Energia é igual à duração, uma carta de 5 turnos custa 5 de Energia e uma de 3 custa 3.

**A proporção não muda — muda a moeda, de tempo para Energia.** A tabela aprovada continua de pé sem uma linha de revisão.

### 4.3 A inflação já tem freio

Triplicar a velocidade de ganho de atributo assustaria, não fosse a cascata de teto que entrou em 22/08: ganho que não cabe no teto vira Estabilidade e depois **ativo nomeado**. Casas que chegam ao máximo param de crescer em número e passam a crescer em coisa narrativa, no terreno do Mestre. O freio contra corrida armamentista já está no ar.

## 5. Arquitetura

O desenho segue a divisão que o repositório já usa: a regra pura em `shared`, a persistência e o ciclo de turno em `backend`, a escolha em `frontend`.

### 5.1 `shared` — a regra

Arquivo novo `shared/src/energia.ts`, dono único da mecânica:

- `ENERGIA_POR_TURNO = 3` — a constante da qual todo o resto deriva.
- `energiaMaximaPara(carta)` — quanto falta para concluir, que é o teto por carta (§1.3).
- `validarAlocacao(alocacao, cartas)` — soma ≤ 3, nenhuma carta acima do próprio teto, nenhum id de carta inativa. Devolve motivo em português quando recusa.
- `alocacaoPadrao(cartas)` — 1 ponto por carta ativa, o comportamento de hoje (§2).

`projectEngine.ts` muda em dois pontos:

- `processProjectForTurn(project, turnId, passos = 1)` ganha o terceiro parâmetro. O padrão `1` mantém todos os chamadores e testes atuais funcionando.
- `projectSlotLimit` passa de 1/2 para 3, igual para toda Casa.

### 5.2 `backend` — persistência e resolução

Um registro de alocação por turno e Casa, na tabela `ravenloft-game`:

- `PK = CAMPAIGN#WINTER_DEAD`, `SK = ENERGY#<turnId>#<houseId>`
- corpo: `{ porProjeto: Record<projectId, number>, atualizadoEm }`

Rotas em `projectRoutes.ts`:

- `GET /api/player/projects` (**já existe**) passa a devolver também `energia: { total, porProjeto, tetoPorProjeto }`. A Energia viaja na `ProjectsView` que a tela já carrega, em vez de uma rota nova — menos ida e volta e nada a sincronizar entre duas chamadas.
- `POST /api/player/project/energia` (**nova**) grava a alocação depois de `validarAlocacao`. Exige turno `OPEN` e recusa com 423 fora dele, como `submitOrder` já faz.

`processProjectsForTurn` passa a ler a alocação do turno antes de avançar. Sem registro, usa `alocacaoPadrao`. Cada projeto avança pelos pontos que recebeu; um projeto com zero pontos não é tocado.

### 5.3 `frontend` — a escolha

- `HouseProjectsPanel`: um contador "Energia: 2/3" no topo e, em cada carta ativa, um seletor de 0 a N com o texto do que aquilo faz ("conclui neste turno", "faltam 2 turnos"). O botão de gravar desabilita só quando a soma passa de 3 — nunca escondendo a razão.
- `GamePage`, bloco "Sua Casa": a Energia do turno ao lado das barras de atributo, para o jogador ver o recurso antes de abrir a aba.
- `mockClient`: a rota nova e o campo `energia` na `ProjectsView`, para os testes de frontend continuarem rodando sem backend.

## 6. Casos de borda

| Situação | Comportamento |
|---|---|
| Carta pausada (`PAUSED`) | não recebe Energia; fora do seletor |
| Carta cancelada depois de alocada | a alocação dela é ignorada na resolução |
| Casa sem carta ativa | os 3 pontos se perdem, sem erro |
| Alocação acima de 3 | recusada na gravação, com o motivo |
| Alocação acima do que a carta precisa | recusada, com o motivo |
| Turno não está `OPEN` | a rota de gravação recusa com 423, como `submitOrder` já faz |
| Projeto conclui no meio da alocação | impossível: o teto por carta (§1.3) impede |

## 7. Testes

**`shared`** — `validarAlocacao` aceita 1+1+1 e 3+0+0, recusa 4, recusa 2 numa carta que só precisa de 1, recusa id de carta inativa; `alocacaoPadrao` devolve 1 por carta; `processProjectForTurn` com `passos = 3` conclui uma carta de 3 turnos; `projectSlotLimit` devolve 3 para qualquer Controle.

**`backend`** — a resolução aplica a alocação gravada; sem alocação, avança 1 por carta (o teste que trava a regra do §2, o mais importante da suíte); alocação de projeto cancelado é ignorada; a rota de gravação recusa turno fechado.

**`frontend`** — o seletor limita ao que a carta precisa; a soma acima de 3 desabilita a gravação e mostra por quê; "Energia: 0/3" aparece quando tudo foi distribuído.

**Regressão obrigatória:** as três suítes inteiras (`shared` 206, `backend` 757, `frontend` 310) precisam continuar verdes, porque o parâmetro `passos` toca o motor que resolve todos os projetos do jogo.

## 8. Fora de escopo

- **Energia variável por Casa.** O Mestre disse "cada casa, cada turno, tem 3". Fica flat. Amarrar Energia a atributo é uma feature própria.
- **Energia como custo de carta.** Cartas continuam custando Riqueza, Recursos e Estabilidade. Energia é só ritmo.
- **Acumular Energia entre turnos.** Guardar pontos para uma tacada de 6 é outro jogo, e desfaz o freio do §4.
- **A dívida herdada:** `SOLDIERS_COMMITTED` e `CONTROL_COMMITTED` são verificados por `canAffordStart` e nunca debitados por `applyStartCharges` (4 cartas, 1 ponto cada). Não é criado por esta feature e não é corrigido por ela.
- **A vitrine de ativos.** `house.assets` é gravado pelo backend, chega ao frontend em `PlayerGameView.house` e **não é desenhado em lugar nenhum**. Os três projetos em voo vão premiar "Academia de Oficiais", "Aqueduto" e "Torre de Vigilância" no vazio. Independente desta spec, mas fica registrado porque a Energia vai fazer cartas concluírem três vezes mais rápido — e portanto agravar o problema.

## 9. Estado das decisões

**Todas fechadas.** O teto de cartas ativas (§3) era o único ponto em aberto. O Mestre não o respondeu em separado, mas mandou implementar com a proposta na mesa. Acabou em **3 para toda Casa**, amarrado ao orçamento de Energia pelas razões do §3. Se ele quiser outro número depois, os dois têm de subir juntos.
