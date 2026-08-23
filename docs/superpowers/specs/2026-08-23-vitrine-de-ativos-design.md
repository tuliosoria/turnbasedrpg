# Vitrine de Ativos da Casa

## 0. De onde veio

O Mestre, depois de a Energia das Cartas entrar no ar:

> "Entao vamos desenhar isso na UI"

O "isso" é o que eu havia acabado de registrar como pendência: `house.assets` é gravado no banco e enviado ao jogador, mas **não é desenhado em tela nenhuma**.

O Mestre não estava disponível para as perguntas de escopo. As decisões abaixo são minhas, e a §7 lista o que ele pode querer mudar.

## 1. O que é um ativo hoje

`house.assets` é uma lista de nomes: `["Milícia Local", "Aqueduto", "Frota de Guerra"]`. São coisas permanentes que a Casa passa a ter. Vêm de duas fontes, e a segunda é bem menos óbvia:

1. **O ganho declarado da carta.** `completionEffects.assets` da carta concluída (`shared/src/projectTemplates.ts`).
2. **O transbordo do teto.** Quando um atributo já está em `ATTR_MAX` (5) e a Estabilidade também, o ganho não se perde: vira um ativo **com o nome da carta** (`shared/src/projectEngine.ts:106`).

A segunda fonte não é teórica. A Casa **Do Ouro está com Riqueza 5** neste momento, que é o teto. A próxima carta dela que dê Riqueza vai produzir um ativo por transbordo.

O jogador *é* avisado no momento em que isso acontece: as frases de `conversoes` entram no `outcomeNarrative` da carta e aparecem no painel de projetos concluídos. O que não existe é o **acumulado** — a resposta para "o que minha Casa tem hoje".

## 2. O que esta feature faz, e o que ela não faz

**Faz:** mostra a lista de ativos da Casa para o próprio jogador.

**Não faz:** dar efeito mecânico a ativo nenhum. Hoje um ativo não dá bônus, não desbloqueia carta e não entra em conta nenhuma — é um nome guardado, matéria-prima para a narrativa do Mestre.

O pedido foi "desenhar na UI". Transformar ativos em mecânica é uma feature própria, mexe no equilíbrio de uma partida em andamento, e o Mestre não pediu. Fica fora.

**Consequência:** esta feature não altera nada no backend. `game.house.assets` já chega ao frontend inteiro (`playerRoutes.ts:46` manda o objeto `house` sem filtrar). É só desenho.

## 3. Onde entra

No bloco **"Sua Casa"** da `GamePage`, logo depois da linha de Energia que a feature anterior acrescentou.

É o lugar certo porque ativo é estado da **Casa**, não estado de projeto: fica ao lado dos atributos e da Estabilidade, que são a mesma categoria de informação. O painel de projetos conta a história de cada carta; o bloco da Casa responde "o que eu sou hoje".

**Só na visão do próprio jogador.** Não vai para a enciclopédia pública, por dois motivos: alguns ativos são segredo por natureza ("Rede de Batedores", "Rede de Torres de Sinalização"), e o Mestre já mandou antes tirar informação de Casa da visão pública ("Para cada casa, retire o quer e esconde. Essa informacao deveria ser do metre somente").

## 4. O desenho

Uma seção com o título **"Ativos da Casa"** e um `Chip` por ativo, seguindo o padrão que a tela já usa para Estabilidade e Energia.

**Repetidos são agrupados com contagem.** Nada impede o jogador de rodar a mesma carta duas vezes — não há bloqueio de repetição em `projectRoutes.ts` — e duas conversões por transbordo da mesma carta produzem o mesmo nome. Dois chips idênticos lado a lado pareceriam bug. Então: `Milícia Local ×2`.

A ordem é a de chegada, que é a ordem em que o banco guarda. É a ordem cronológica de conquista, que é a que conta uma história.

## 5. O estado vazio é o principal

**As três Casas da partida têm zero ativos neste momento.** Nenhuma carta concluiu ainda. Ou seja: o estado vazio não é um caso de canto, é o que todo jogador vai ver quando isto entrar no ar.

Por isso ele não pode ser uma seção em branco nem sumir da tela. Ele explica de onde vêm os ativos, para o jogador saber que a coisa existe e ter motivo para concluir cartas:

> Sua Casa ainda não tem ativos. Cartas concluídas deixam construções e instituições permanentes.

Com a Energia das Cartas no ar, as cartas passam a concluir até três vezes mais rápido, então esse estado deve durar pouco.

## 6. Testes

Na `GamePage`, com o `MockApiClient` real:

- Casa sem ativos mostra a frase que explica de onde eles vêm, e **não** mostra a lista.
- Casa com ativos mostra um chip por ativo.
- Ativo repetido vira um chip só, com `×2`.

## 7. O que o Mestre pode querer mudar

- **Ativo continua sem efeito mecânico.** Se ele quiser que "Aqueduto" dê alguma coisa, é outra feature.
- **Não aparece na enciclopédia pública.** Decidi por segredo; se ele achar que construções deveriam ser públicas, é uma linha — mas aí vale separar quais ativos são públicos e quais não.
- **Não há como o Mestre conceder um ativo à mão.** Só se ganha concluindo carta ou por transbordo.
- **Não há data nem origem no ativo.** É só o nome; não dá para saber de qual carta veio nem em que turno chegou.
