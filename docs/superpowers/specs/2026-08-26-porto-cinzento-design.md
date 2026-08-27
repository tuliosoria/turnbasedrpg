# O Porto Cinzento — comprar rumores nas docas

Data: 2026-08-26

## 1. O pedido

> "Comprar Informações no Porto. A Casa usa sua rede de espiões, informantes,
> marinheiros e contrabandistas para descobrir rumores trazidos por navios e
> caravanas. **Custo: 1 Riqueza.** Efeito: escolha um tipo de informação —
> Militar, Política, Comercial, Brumas. Quanto maior o Controle da Casa sobre o
> Porto, mais confiável e detalhada é a informação. E eu colocaria um detalhe
> interessante: nem toda informação comprada é verdadeira. Uma Casa inimiga com
> boa rede de espionagem pode plantar um rumor falso."

Para o turno 7, que está aberto.

## 2. O que o estado da partida obrigou a mudar

Antes de escrever uma linha, li o banco. Três coisas mudaram o desenho.

### 2.1 O custo em Riqueza mataria a feature no turno em que ela nasce

| Casa | Riqueza | Recursos | Controle | Cartas ativas |
|---|---|---|---|---|
| Do Ouro | **5** | 2 | 3 | 1 |
| Khazdrun | **0** | 1 | 1 | 2 |
| Solarion | **0** | 1 | 2 | 2 |

E o motor **barra na hora**, não é aviso:

```ts
if (house.attributes.riqueza < wealth) return { ok: false, reason: "Riqueza insuficiente." };
```

Com 1 Riqueza, **duas das três Casas receberiam "Riqueza insuficiente."** no
turno 7. A única que compraria é a Casa do Ouro — que é a **dona do Porto
Cinzento** e já lidera em tudo. A feature entregaria mais informação a quem está
na frente, dentro do território dela.

**Decisão: o custo é 1 Recurso.** Com ele, as três Casas compram no turno 7.
Tem sentido de ficção: nas docas se paga informante em carga, grão e favor, não
em moeda de tesouro. É uma linha para reverter (`r(1)` → `w(1)`) se você
discordar.

### 2.2 O Controle já produz três experiências diferentes

Do Ouro 3, Solarion 2, Khazdrun 1. A escala de confiabilidade cai em três
degraus distintos já no primeiro uso — a regra que você pediu se manifesta
imediatamente, sem afinação.

### 2.3 Todas têm espaço de carta

O teto é 3 ativas; nenhuma Casa está cheia. A feature é jogável já.

## 3. O que já existe e não vou reconstruir

- **O canal de entrega.** `Turn.privateInfo: Record<houseId, string>` é o
  segredo que cada Casa recebe. A crônica pública o exclui de propósito
  (`ai/diplomacy/chronicle.ts:14`) e o contexto de cada Casa o lê
  (`ai/diplomacy/situation.ts:45`). É exatamente o canal desta feature.
- **A redação.** `buildPrivateInfoPrompt` já faz a IA escrever a informação
  privada de cada Casa, e o painel já tem "Rascunhar informações (IA)".
- **A ação.** O sistema de cartas já tem custo, duração, teto por Casa,
  aprovação e alvo. O catálogo inteiro vai ao jogador
  (`projectRoutes.ts:77`), então carta nova aparece na hora.

A feature é **uma regra nova ligando três sistemas que já existem**, não um
sistema novo.

## 4. O desenho

### 4.1 Cinco cartas de Espionagem

Quatro de compra, uma de veneno. Todas 1 Recurso, 1 turno.

| Carta | Tipo |
|---|---|
| Rumores do Porto: Movimentos de Tropas | MILITAR |
| Rumores do Porto: Tratos e Traições | POLITICA |
| Rumores do Porto: Carregamentos e Escassez | COMERCIAL |
| Rumores do Porto: Vozes do Norte | BRUMAS |
| Plantar um Rumor Falso | — (tem alvo) |

**Por que quatro cartas e não uma com um seletor.** O sistema já sabe perguntar
*uma* coisa antes de começar: a Casa alvo. Ensiná-lo a perguntar um segundo
parâmetro custaria validação, cliente, mock, diálogo e testes. Num jogo de
cartas, *qual carta você joga* já é a escolha — é a mesma decisão que você
descreveu, dita no vocabulário do jogo. E cada carta ganha risco e sabor
próprios, o que uma carta genérica com menu não teria.

### 4.2 `shared/src/porto.ts` — a regra

```
confiabilidadeDoPorto(controle) -> "DUVIDOSA" | "PARCIAL" | "FIRME" | "CERTEIRA"
briefingsDoPorto(cartas, turnoResolvido) -> BriefingDoPorto[]
```

A escala, sobre `controle` (0 a 5):

| Controle | Grau | O que o Mestre deve escrever |
|---|---|---|
| 0–1 | DUVIDOSA | um boato solto, sem nomes nem números |
| 2 | PARCIAL | o fato, mas incompleto — falta quem, ou quando |
| 3 | FIRME | o fato com nome ou número, uma reserva |
| 4–5 | CERTEIRA | o fato com detalhe e procedência |

**O veneno.** Se uma Casa concluiu "Plantar um Rumor Falso" contra outra no
mesmo turno, o briefing da vítima sai `envenenadoPor` preenchido, e a instrução
ao Mestre inverte: escreva algo **falso e plausível**, no grau de confiabilidade
que a vítima merecia — porque um rumor plantado por profissionais chega com a
mesma cara de verdade. A vítima não é avisada. Quem plantou também não recebe
confirmação: saber que funcionou é outra jogada.

### 4.3 Quando a informação chega

Comprou no turno 7 → a carta conclui na resolução do turno 7 → a informação
entra na **informação privada do turno 8**. Um turno de espera, que é o tempo de
mandar gente às docas e ela voltar.

Na prática: ao compor o turno N, o sistema procura cartas do Porto concluídas
com `lastProcessedTurnId === N-1`. Sem estado novo, sem marca de "entregue" —
redesenhar o rascunho produz o mesmo resultado.

### 4.4 A injeção no prompt

`buildPrivateInfoPrompt` ganha os briefings e acrescenta, por Casa, o que
escrever. O Mestre continua dono do texto: a IA rascunha, ele edita, como já é.

## 5. Testes

- `shared/src/porto.test.ts` — a escala nos cinco valores de controle; briefing
  só para carta concluída no turno certo; carta de outro turno ignorada; carta
  ainda ativa ignorada; veneno casa plantador→vítima; veneno de outro turno não
  conta; duas compras da mesma Casa geram dois briefings.
- `backend/src/ai/prompts.porto.test.ts` — o prompt cita o tipo e o grau; o
  envenenado manda escrever falsidade plausível e **não** revela à vítima.
- `backend/src/routes/adminRoutes.porto.test.ts` — o rascunho de informação
  privada carrega os briefings do turno anterior.

## 6. Fora de escopo

- **Avisar quem plantou** se o veneno pegou.
- **Contra-espionagem** (descobrir que a informação era falsa).
- Controle *sobre o Porto* como atributo separado: uso o `controle` da Casa, que
  é o que existe. Se um dia houver controle por território, a regra troca de
  fonte sem mudar de forma.
- Escolher o alvo do rumor entre mais de uma Casa por carta.

## 7. Correções vindas da revisão

A revisão de código encontrou três defeitos no primeiro corte. Ficam registrados
porque cada um mudou o desenho.

### 7.1 A carta de veneno prometia o que não entrega

O primeiro corte marcava as cinco cartas com uma bandeira booleana,
`entregaInformacaoPrivada`. Mas "Plantar um Rumor Falso" não está em
`CARTAS_DO_PORTO` — ela estraga o briefing da vítima e não gera briefing nenhum
para quem a joga. A vitrine, mesmo assim, escrevia "Informação privada no
próximo turno" nela. O jogador pagaria 1 Recurso, leria a promessa e não
receberia nada — indistinguível de um defeito de entrega, e irrespondível.

A bandeira virou texto: `pagamentoNarrativo`, a frase que a carta é obrigada a
dizer sobre o que paga. As quatro de compra dizem "Informação privada no
próximo turno"; a de veneno diz "Envenena o que a Casa alvo comprar no Porto
neste turno". Frase vazia não vale — seria a mesma carta muda com uma dispensa
auto-assinada. E um teste da biblioteca exige que toda carta que prometa
briefing esteja registrada em `CARTAS_DO_PORTO`, senão a promessa não tem quem a
cumpra.

### 7.2 O pedido é coletivo, e o segredo era novo

`buildPrivateInfoPrompt` gera as três Casas numa chamada só. Antes do Porto, o
prompt só carregava material público. Agora carrega quem comprou o quê e qual
briefing é plantado — e a instrução de não avisar disciplinava apenas o texto da
vítima. Nada impedia a IA de escrever, no texto de uma terceira Casa, que
alguém andou comprando informação. Uma frase basta para queimar o comprador ou
desmontar o golpe de quem pagou por ele.

Duas cercas: o prompt passou a proibir explicitamente mencionar a mecânica em
qualquer Casa, e `findPrivateInfoLeaks` derruba o rascunho com 502 quando o
texto entregue denuncia a máquina — o mesmo tratamento que `findPublicEventLeaks`
já dava ao evento público. A cerca só age quando houve compra: sem briefing não
há segredo novo, e "rumor falso" numa frase de clima é linguagem do mundo.

### 7.3 A entrega podia sumir em silêncio

`briefingsDoPorto` é pura, o que torna o redesenho idempotente. O reverso é que
não existe marca de "entregue": o briefing do turno N-1 só existe na janela em
que o Mestre compõe o turno N. Existe um segundo caminho de composição em uso
(`saveTurnDraft`/`publishTurnDraft`) que grava `privateInfo` sem passar por
aqui. Por ele, ou escrevendo as informações à mão, o Mestre perderia a entrega
com o Recurso já debitado e a carta já concluída.

A dívida agora sai no painel: `getDashboard` devolve `portoPendente`, e a aba de
turnos abre um aviso listando quem pagou, sobre o quê, com que confiança e se
está envenenado. Não impede o erro, mas o torna visível antes de o turno abrir —
que é o que faltava.
