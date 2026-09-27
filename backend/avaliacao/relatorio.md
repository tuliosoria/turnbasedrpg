# Avaliação de cartas

> Gerado por `npm run avaliar-cartas -- relatorio`. Métricas são sinais para decidir onde olhar, não notas.
> Limiar de reciclagem: 0.15. Replay aproximado como história (NPC, relação e wiki no estado do snapshot), idêntico entre rótulos.

## Resumo

| rótulo | commit | casos | reciclagem (mediana) | termo martelado | eco < 0,7 | mortes | prazos/carta | escala | nomes fora | revisor corrigiu | vazias | erros |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| producao | b06040e | 8 | 5% | 1 | 4 | 0 | 0.4 | 0 | 6 | 0 | 0 | 0 |
| antes | cb673ac | 16 | 3% | 0 | 9 | 0 | 0.5 | 0 | 26 | 8 | 0 | 0 |
| depois | 06ce51b | 16 | 1% | 0 | 8 | 0 | 0.6 | 0 | 16 | 7 | 1 | 0 |

## Decisão (critério do spec, sobre `depois`)

- Detector de repetição: **não**
- Ajuste no revisor: **não**
- Nenhum sinal: deployar a memória e parar.

## Caso 1 — Solarion × Mandíbula de Osso

_Alerta estratégico depois de 20+ cartas de escambo: a resposta precisa tratar do alerta, não recitar o trato do tecido._

### producao #1

reciclagem 4% · eco 1/5 · prazos 0 · 1115 car. · prompt 36985 car.
termos do fio: tecido (24→0), vau negro (19→1), carrocas (19→0), quatro (16→0), miemar (15→1)
sem eco: «Mas peço que olhe além da batalha que está diante de vocês.» «Você será um líder sentado na cadeira do rei, governando seu próprio povo, ou será apenas um líder submetido às vontades dos Dragões?» «Por isso, peço que reconsidere seus próximos passos.» «E não quero que a ignorância dos Dragões acabe condenando o seu povo.»

```text
Não recuarei de Asterhall porque Solarion pede. Eu ouvi seu aviso sobre trinta mil marchando rumo a Vargen; não os vi, então trato isso como perigo possível, não como ordem.

Você pergunta se serei rei ou servo dos Dragões. Serei Garok do Trovão, de Na’usca. Krythos luta ao nosso lado contra a Coroa; se algum dragão achar que isso compra mando sobre Gor-Kirius, encontrará a mesma mandíbula. Meu povo não saiu do Tempo sem Nomes para trocar senhor de areia por senhor de escama.

Penso nas crianças, sim. Penso nelas quando os nossos mortos levantam no pé da muralha e quando as tendas rasgam no frio. Por isso não largo esta guerra de mãos vazias: precisamos de reconhecimento, passagem segura e voz de povo livre antes que Asterhall decida outra vez que nossa vida vale menos que decreto.

A palavra de Solarion sobre seu voto contra pôr um garoto no trono foi ouvida. O reconhecimento de Gor-Kirius e Na’usca também foi ouvido. Agora respondam limpo ao trato novo: Miemar trará o selo para noventa rolos grossos e dez finos por vinte toras e cem peles no Vau Negro, quinze dias depois da entrega atual, ou não?
```

### antes #1

reciclagem 0% · eco 1/5 · prazos 0 · 1246 car. · prompt 46903 car.
termos do fio: tecido (24→0), vau negro (19→2), carrocas (19→0), quatro (16→0), miemar (15→2)
sem eco: «Mas peço que olhe além da batalha que está diante de vocês.» «Você será um líder sentado na cadeira do rei, governando seu próprio povo, ou será apenas um líder submetido às vontades dos Dragões?» «Por isso, peço que reconsidere seus próximos passos.» «E não quero que a ignorância dos Dragões acabe condenando o seu povo.»

nomes fora do material: Droskar e Vargen

revisor: Reescrevi a justificativa sobre Asterhall para não afirmar como fato fechado um reconhecimento que não aparece de forma direta no registro.

```text
Não recuaremos de Asterhall por conselho de Solarion, Faraó. Também não sentarei na cadeira de Alic, nem de joelhos diante de dragão nenhum.

Krythos é nosso aliado porque a Coroa matou draconatos em praça pública e porque Na’usca não voltará a esperar que Asterhall lhe conceda dignidade. Aliança não é corrente. Se Kaelen esquecer isso, ouvirá de mim primeiro, e dos nossos machados depois.

Recebo seu aviso sobre os mortos indo a Vargen, mas não tenho olho naquela estrada. Se Solarion viu essa marcha, mande a Miemar, no Vau Negro, o mapa do caminho, de onde saiu a contagem dos trinta mil e quantos dias faltam até Droskar e Vargen. Isso salva vidas de verdade.

Você pergunta o que sobrará para meu povo. Essa pergunta também me morde. Meus capitães não falam a mesma coisa: uns querem quebrar Asterhall antes que os mortos cresçam, outros querem puxar metade dos nossos de volta para Na’usca. Eu não entregarei dez mil vidas só para parecer forte. Se a fileira dos mortos virar contra nossa retaguarda, eu chamarei recuo para proteger Gor-Kirius, as aldeias e as crianças.

Mas não confunda cuidado com submissão. Nós nascemos livres tarde demais para aceitar coleira com nome bonito.

Mande o mapa e a contagem pelo Vau Negro com Miemar.
```

### antes #2

reciclagem 0% · eco 1/5 · prazos 0 · 1162 car. · prompt 46903 car.
termos do fio: tecido (24→0), vau negro (19→2), carrocas (19→0), quatro (16→0), miemar (15→1)
sem eco: «Mas peço que olhe além da batalha que está diante de vocês.» «Você será um líder sentado na cadeira do rei, governando seu próprio povo, ou será apenas um líder submetido às vontades dos Dragões?» «Por isso, peço que reconsidere seus próximos passos.» «E não quero que a ignorância dos Dragões acabe condenando o seu povo.»

revisor: Transformei a retirada já ordenada em posição a defender no conselho, porque o material não sustentava que essa ordem já tivesse sido dada. | Cortei a afirmação de que os mortos “não cansam” e deixei apenas o que foi observado: levantam, juntam fileira e andam contra os vivos. | Removi conselho tático específico contra mortos que não estava sustentado pelo registro. | Mantive os trinta mil rumo a Vargen como informação não confirmada, em resposta correta à carta de Solarion.

```text
Não recuaremos de Asterhall agora. Mas seu aviso será levado ao conselho esta noite, e eu defenderei que os feridos e quem não precisa ficar diante da muralha sejam puxados para mais perto de Gor-Kirius.

Gloriandur, aceito a preocupação como coisa limpa. Não aceito a pergunta como se os Dragões segurassem nossa coleira. Krythos é aliado porque a Coroa matou draconatos em praça pública e porque Valdren sempre achou fácil mandar outros povos esperar justiça. Se Kaelen tentar mandar em Na’usca como dono, encontrará a mesma resposta que qualquer rei encontraria.

Sobre os trinta mil indo a Vargen: não temos essa conta diante de nós. O que sabemos é pior que número redondo: morto levanta, junta fileira e anda contra quem estiver vivo. Se essa marcha existe, Vargen precisa saber depressa.

Não vou gastar o Clã para sentar em cadeira de rei. Meu pai não criou filho para trocar floresta por salão. Se Asterhall cair, nossa linha será Na’usca, Rio Bravio e as pontes de madeira. Manteremos o comércio do Vau Negro, porque manta e atadura agora valem tanto quanto lança.

Se Solarion souber rota certa dessa marcha, mande por Miemar no Vau Negro. Eu ouvirei.
```

### depois #1

reciclagem 1% · eco 2/5 · prazos 0 · 998 car. · prompt 36985 car.
termos do fio: tecido (24→0), vau negro (19→1), carrocas (19→0), quatro (16→0), miemar (15→1)
sem eco: «Você será um líder sentado na cadeira do rei, governando seu próprio povo, ou será apenas um líder submetido às vontades dos Dragões?» «Por isso, peço que reconsidere seus próximos passos.» «E não quero que a ignorância dos Dragões acabe condenando o seu povo.»

revisor: Removi a afirmação de que Garok já mandou recolher crianças e proibiu patrulhas pequenas, pois essas ordens não constavam do material disponível. | Mantive a recusa ao recuo, o pedido de informação sobre os trinta mil e a linha vermelha contra submissão.

```text
Não recuaremos agora de Asterhall, Faraó Gloriandur. Também não seremos homens de cadeira alheia: Krythos é aliado escolhido, não dono do Clã.

Seu aviso sobre os trinta mil não cai em chão surdo. Eu vi morto nosso levantar e entrar na fileira muda. Estou com medo bastante para guardar Na’usca com os olhos abertos, não para entregar nossa palavra.

Se eu retirar dez mil de uma vez sem falar com Kaelen, deixo meus guerreiros entre Asterhall, as máquinas e os mortos, e ainda planto desconfiança com quem hoje segura a mesma lança. Isso não protege Na’usca; só muda o lado de onde vem a lâmina.

Vocês dizem que trinta mil marcham para Vargen. Mandem ao Vau Negro, com Miemar ou cavaleiro mais rápido, o caminho visto, quem contou e quantos dias de marcha têm. Se essa maré virar para o sul, eu quero saber antes de ouvir grito na primeira aldeia.

Guardo o reconhecimento de Solarion sobre Gor-Kirius e Na’usca. Guardem também isto: nenhum rei, faraó ou dragão vai pôr coleira no povo de Kirius.
```

### depois #2

reciclagem 0% · eco 1/5 · prazos 0 · 1250 car. · prompt 36985 car.
termos do fio: tecido (24→0), vau negro (19→1), carrocas (19→0), quatro (16→0), miemar (15→0)
sem eco: «Mas peço que olhe além da batalha que está diante de vocês.» «Você será um líder sentado na cadeira do rei, governando seu próprio povo, ou será apenas um líder submetido às vontades dos Dragões?» «Por isso, peço que reconsidere seus próximos passos.» «E não quero que a ignorância dos Dragões acabe condenando o seu povo.»

revisor: Tratei a marcha de trinta mil rumo a Vargen como informação não confirmada, não como fato estabelecido. | Reescrevi a cobrança sobre o selo de Solarion para não afirmar que eles prometeram explicitamente negar homem, grão, ouro e passagem; mantive apenas o que ficou registrado: não se pôr no caminho de Krythos e não enviar forças contra o Clã.

```text
Não recuarei de Asterhall por esta carta. Recuarei apenas se Thorgul e os conselhos decidirem que ficar ali mata mais Na’usca do que protege.

Seu aviso foi recebido. Não temos confirmação desses trinta mil rumando a Vargen; temos a folha de Rimewatch, os mortos em nossa frente e nossos próprios caídos levantando. Isso basta para eu não tratar você como homem que inventa medo.

Mas ouça claro: Krythos não se senta no pescoço do Clã. Kaelen é aliado contra a Coroa que matou draconatos em praça e contra Asterhall; não é dono de Gor-Kirius. Se qualquer dragão pedir terra, criança, corrente ou joelho, ouvirá de nós a mesma resposta que os senhores do deserto ouviram tarde demais.

Na’usca não ficará esquecida enquanto parte dos nossos permanece diante de Asterhall. Olhamos para as aldeias, para as pontes e para as crianças, porque a queda da capital também decide se a Coroa volta a chamar nossa liberdade de favor. Não confunda isso com cegueira por causa de dragão algum.

Não precisamos que Solarion diga ao reino que somos sábios. Precisamos que cumpra o que selou: não se pôr no caminho de Krythos, nem enviar forças contra nós. E agora peço mais: se você souber rota, número e dia dessa marcha para Vargen, mande por corvo ao Vau Negro.
```

## Caso 2 — Solarion × Mandíbula de Osso

_Mudança de assunto (pesquisadores ao Vau Negro): mede se a Casa acompanha o assunto novo._

### producao #1

reciclagem 8% · eco 0/0 · prazos 0 · 1191 car. · prompt 39746 car.
termos do fio: tecido (24→2), asterhall (20→0), carrocas (19→1), contra (16→0), quatro (16→2)

```text
Os dois pesquisadores e quatro soldados de Solarion serão recebidos no Vau Negro, sem estandarte, junto de Miemar. Eles examinarão a criatura somente se prendermos uma inteira; até lá, ninguém de Gor-Kirius promete arrastar morto-vivo por estrada de aldeia para satisfazer mesa de estudo.

Garok do Trovão manterá seis guardas na margem e Grava Dente-Partido anotará o que for visto: se a coisa obedece som, fogo, ferro, corte ou amarra. O que Solarion descobrir será dito ali mesmo ao Clã e levado a Krythos; o que sobrar da criatura será queimado antes da noite seguinte. Depois de vermos nossos mortos se levantarem, não brincamos com cadáver que aprende a andar.

Falta a resposta que pedi: Solarion aceita ou recusa o trato de tecido novo? Noventa rolos grossos e dez finos, em quatro carroças cobertas, no Vau Negro, quinze dias depois da entrega atual de Miemar; em troca, vinte toras de pinho seco e cem peles curtidas descem em uma barcaça pelo Rio Bravio. Se Miemar trouxer o selo, a carga segue. Se não trouxer, guardamos madeira e pele para Na’usca.

Há caminho entre nossos povos agora. Quero mantê-lo aberto, limpo e sem coleira. Que Miemar traga o selo do tecido ao Vau Negro.
```

### antes #1

reciclagem 10% · eco 0/0 · prazos 0 · 1008 car. · prompt 49549 car.
termos do fio: tecido (24→0), asterhall (20→1), carrocas (19→0), contra (16→0), quatro (16→1)

nomes fora do material: Krythos e Na’usca

```text
Aceitamos os dois pesquisadores e quatro soldados de Solarion no Vau Negro, sem estandarte, se prendermos uma criatura inteira. Miemar venha com eles e traga o selo do trato novo: noventa rolos grossos e dez finos por vinte toras de pinho seco e cem peles curtidas, quinze dias depois da entrega atual.

Na terceira semana do escuro, diante de Asterhall, não temos morto preso. Temos mortos andando. Se pegarmos um, ficará amarrado na nossa margem, guardado por guerreiros nossos. Ninguém levará essa coisa para estrada de aldeia. Ninguém tocará corda, estaca ou boca sem ordem de Garok do Trovão.

O que seus estudiosos virem será escrito em duas cópias: uma para Solarion, uma para Krythos e Na’usca. Se acharem ponto fraco, arma útil ou modo de impedir que levantem, saberemos no mesmo dia. Se a prisão falhar, queimamos antes de aprender. Nosso povo não será cobaia de sábio nenhum.

O comércio segue. A aliança que nos serve é esta: cada povo em pé, cada palavra selada, cada carga contada no Vau Negro.
```

### antes #2

reciclagem 9% · eco 0/0 · prazos 1 · 1145 car. · prompt 49549 car.
termos do fio: tecido (24→0), asterhall (20→2), carrocas (19→0), contra (16→0), quatro (16→1)

nomes fora do material: Solarion e Krythos

revisor: Reescrevi como exigência o trecho que afirmava que Miemar traria o selo, pois a última carta de Solarion não prometeu esse selo de modo claro. | Corrigi a localização do perigo dos mortos: o rascunho sugeria mortos se levantando em Na’usca, mas o material sustenta isso diante de Asterhall.

```text
Aceitamos os dois pesquisadores e quatro soldados de Solarion no Vau Negro. Serão recebidos sem estandarte, junto de Miemar, no décimo dia; se vier mais gente, fica do outro lado da água.

Eles não seguirão para Asterhall. Se prendermos uma dessas coisas inteira, Garok mandará cavaleiro ao Vau e o exame será feito na nossa margem, com nossos guerreiros em roda e fogo preparado. Ninguém corta amarra, tira corrente ou leva pedaço escondido. O que aprenderem será dito a nós na mesma hora e posto por escrito para Solarion e Krythos. Depois, a coisa será queimada até virar cinza.

Miemar deve trazer também o selo do trato novo: noventa rolos grossos e dez finos por vinte toras de pinho seco e cem peles curtidas, quinze dias depois da entrega atual. A palavra antiga já nos cobriu; a nova precisa de marca para que nenhum feitor discuta no escuro.

Agradecemos o envio dos sábios. Digo isso sem baixar a cabeça: conhecimento que não vira coleira pode salvar gente. Em Na’usca há crianças dormindo com manta curta; diante de Asterhall há guerreiro morto tentando levantar. Vamos aprender depressa.

Garok do Trovão, pelo Clã Mandíbula de Osso
```

### depois #1

reciclagem 8% · eco 0/0 · prazos 0 · 1038 car. · prompt 39746 car.
termos do fio: tecido (24→0), asterhall (20→0), carrocas (19→1), contra (16→0), quatro (16→2)

```text
Aceitamos os dois pesquisadores e os quatro soldados de Solarion no Vau Negro, sem estandarte, quando houver criatura presa para olhar.

Não mandem gente para esperar morte em barraca vazia. Primeiro Garok avisará Miemar por mensageiro. Depois vocês terão três dias para chegar ao Vau Negro com os dois estudiosos, quatro guardas e Miemar. Mais gente que isso fica do lado das carroças, sem atravessar para nossa margem.

O exame será feito ali. Corrente, estaca, fogo e machado ficam sob mão orc. Se a coisa se soltar, nós a derrubamos. Se seus estudiosos acharem fraqueza, falarão a Garok antes de escreverem para Solythar. Nós faremos o mesmo com vocês e com Krythos. O que sobrar da criatura será queimado no Vau Negro.

A parceria fica de pé porque Solarion reconheceu Na’usca livre e porque, desta vez, vocês perguntaram para aprender, não para mandar. Isso pesa.

Miemar deve trazer também o selo do trato já fechado: noventa rolos grossos e dez finos por vinte toras e cem peles, quinze dias depois da entrega atual, no Vau Negro.
```

### depois #2

reciclagem 0% · eco 0/0 · prazos 0 · 1028 car. · prompt 39746 car.
termos do fio: tecido (24→1), asterhall (20→1), carrocas (19→0), contra (16→1), quatro (16→1)

revisor: Troquei o nome próprio de Ghorak Dente-Partido por cargo, pois ele não consta entre as pessoas listadas da sede no material de base.

```text
Aceitamos: dois pesquisadores e quatro soldados de Solarion, sem estandarte, serão recebidos no Vau Negro para examinar a criatura se a prendermos inteira.

Miemar pode vir com eles e falar por Solarion. Não tragam mais estudiosos sem nova palavra nossa. O Vau Negro não virará feira de curiosos enquanto nossos mortos ainda andam contra nós.

Garok do Trovão mandará sinal quando houver coisa presa. Até lá, esses homens ficam na margem marcada, com armas embainhadas, e ouvirão o que nossos guerreiros viram na muralha de Asterhall. Se houver exame, um escriba do Clã ficará junto e anotará tudo. O que Solarion descobrir será dito a nós no mesmo dia; o que nós virmos será levado a vocês e a Krythos. Depois, o resto será queimado.

A parceria serve quando ela salva gente viva. Nossos filhos precisam de mantas, nossas tendas precisam de remendo, e nossos guerreiros precisam saber onde bater antes que outro irmão morto entre na fileira.

Que Miemar traga também o selo e a conta do trato de tecido já fechado no Vau Negro.
```

## Caso 3 — Khazdrun × Ferrumor

_Convite a encontro formal: o caso que já voltou como minuta de contrato._

### producao #1

reciclagem 0% · eco 0/0 · prazos 1 · 1133 car. · prompt 21464 car.

```text
Aceito o encontro na Pirâmide de Cristal, em Solarion. Irei pessoalmente, com dois escribas de Ferrum e um mestre de liga; tragam quem possa assinar por Khazdrun, não apenas ouvir.

O fato é simples: Asterhall está fechada, nenhum selo real sai de lá há três semanas, e a estrada que ontem era segura hoje vale como costa sem farol. Isso obriga nossas Casas a saber quanto ferro, carvão e frete cada uma ainda pode mover sem depender de boatos da capital.

Não irei à Pirâmide para ouvir que Ferrumor deve comprar tradição como se fosse favor. Também não espero que Khazdrun compre novidade por cortesia. Levem barras marcadas por guilda, relação dos fornos que ainda trabalham e custo de transporte até seu porto. Eu levarei os padrões de liga de Ferrum, contas de estaleiro e a lista de encomendas que podem ser desviadas sem ferir contrato da Coroa.

Se houver contrato, ele nascerá de números limpos: peso, preço, rota e garantia. Se não houver, ao menos sairemos sabendo que o outro não afundou o convés por vaidade.

Encontramo-nos na Pirâmide de Cristal, na sala que Solarion nos conceder, ao primeiro sino depois do meio-dia.
```

### antes #1

reciclagem 0% · eco 0/0 · prazos 0 · 1221 car. · prompt 21435 car.

nomes fora do material: Kaelen Drakorys

revisor: Condicionei o encontro em território de Solarion à licença escrita da própria Solarion, em vez de tratar a autorização como fato concedido por Khazdrun. | Removi o nome próprio inventado do mestre de fundição e deixei apenas o cargo. | Tirei data, porta e sino fixos antes da confirmação do local, mantendo a logística para depois da licença.

```text
Aceitamos o encontro para tratar do ferro entre nossas Casas, mas não farei Ferrumor atravessar portas que Solarion não tenha aberto por escrito. Se a licença para a Pirâmide de Cristal existe, enviem-na antes; recebida a confirmação, eu irei por Ferrumor a Solythar.

Levarei dois escribas, um mestre de fundição e seis guardas de casa. O assunto principal será ferro: preço, prioridade de venda e a maneira como nossas Casas deixam de ferir uma à outra no mesmo mercado. Se a conversa mostrar chão firme, abrirei uma segunda pauta, curta, sobre escolta de cargas e socorro de porto; a coroação de Kaelen Drakorys tornou caro demais fingir que aço e segurança andam separados.

Não esperem de mim uma mesa dócil. Khazdrun é concorrente digno e rival antigo; quando vocês baixam preço, nossos fornos sentem. Mas justamente por isso prefiro ouvi-los diante de escribas, com números limpos, a descobrir por terceiros que anões e caladrianos estão sangrando o mesmo mercado enquanto outros colhem a margem.

Tragam também uma lista do ferro que desejam pôr sob regra comum. Eu levarei os contratos de Ferrum que podem mudar sem ferir encomenda real. O resto — dia, entrada e sino — ficará para depois da licença de Solarion.
```

### antes #2

reciclagem 0% · eco 0/0 · prazos 1 · 1445 car. · prompt 21435 car.

nomes fora do material: Kaelen Drakorys

revisor: Condicionei o encontro em Solythar à confirmação escrita da Casa Solarion, pois Khazdrun não pode conceder sala ou passagem em território que não é seu. | Transformei o prazo do trigésimo dia em proposta de Ferrumor, já que Khazdrun não havia indicado data.

```text
Aceitamos o convite para conversar na Pirâmide de Cristal, em Solythar, desde que o alinhamento que dizeis ter feito com a Casa Solarion esteja de fato concedido e possa ser mostrado por escrito. Proponho o trigésimo dia após esta resposta chegar a Khar-Durak. Irei pessoalmente por Ferrumor, com dois escribas, quatro guardas de casa e poderes para ouvir uma proposta de ferro e frete, não para vender a dignidade de Ferrum em troca de pressa.

Reconheço o valor de Khazdrun: quando uma ponte anã fica de pé, até nossos engenheiros param para medir. Também reconheço a disputa entre nós. Ela é antiga demais para ser apagada por uma frase sobre benefícios mútuos, mas não tão tola a ponto de impedir que duas Casas de forja conversem enquanto Asterhall caiu e Kaelen Drakorys coroa a própria ambição.

Ferrumor quer segurança para oficinas, cais e comboios. Se sua proposta muda a maneira como compramos, vendemos ou marcamos o ferro, traga números, marcas de guilda e a rota de entrega. Eu levarei os registros de nossas fundições e os preços pagos pela Coroa antes da queda da capital.

Não iremos como clientes menores, nem como pedintes. Iremos como herdeiros de Caladris e concorrentes dignos de vocês. Quanto à sala, cabe à Casa Solarion consentir e guardá-la; peço apenas que ela esteja fechada a curiosos e aberta às testemunhas nomeadas. Se essa condição for atendida, encontramo-nos na Pirâmide de Cristal, Solythar, no trigésimo dia.
```

### depois #1

reciclagem 0% · eco 0/0 · prazos 1 · 1169 car. · prompt 21464 car.

nomes fora do material: Kaelen Drakorys

```text
Aceitamos o encontro na Pirâmide de Cristal, em Solythar. Irei pessoalmente por Ferrumor, com dois escribas e um mestre de balança, no décimo segundo dia após esta resposta chegar a Khar-Durak.

Esta será a primeira conversa formal entre nossas chancelarias, e convém que comece limpa. Se houve alinhamento anterior com Solarion, tragam o salvo-conduto selado por eles aos portões; nós faremos o mesmo no caminho desde Ferrum.

Falaremos de ferro. Não de sujeição, nem de tabelas que façam a estrela de Ferrum parecer marca menor que o martelo de Khar-Durak. Vocês sabem fundir, medir e cumprir prazo; nós também. Justamente por isso vale sentar antes que outros comprem nossa rivalidade pelo preço de um desconto.

A queda de Asterhall e a coroação de Kaelen Drakorys tornaram cada contrato também uma muralha. Ferrumor não fingirá que comércio é só comércio quando navios somem sem estandarte e reis mudam ao som de aço. Se Khazdrun quer melhores condições, traga números, rotas e garantias de entrega. Eu levarei nossas marcas de barra, nossos preços de cais e a lista do que Ferrum não aceitará.

Na Pirâmide de Cristal, décimo segundo dia, sob licença de Solarion.
```

### depois #2

reciclagem 0% · eco 0/0 · prazos 0 · 1311 car. · prompt 21464 car.

revisor: Removi o prazo fixo no vigésimo dia, que Khazdrun não propôs e não era essencial. | Condicionei o encontro em Solythar à confirmação escrita de Solarion, pois a cidade pertence a terceiro. | Troquei o nome próprio inexistente mestre Ilaren por cargo genérico. | Marquei a carta como primeiro contato formal, conforme o material. | Ajustei o tom para maior cautela e orgulho de Ferrumor, sem transformar o convite em contrato fechado.

```text
Recebo esta primeira carta formal de Khazdrun sem fingir que Ferrumor esqueceu a rivalidade entre nossas forjas. Aceitamos conversar na Pirâmide de Cristal, em Solythar, desde que a licença de Solarion venha confirmada por escrito por quem governa a sala.

Irei por Ferrumor, acompanhada de dois escribas e de um mestre das forjas do Porto Profundo. Khazdrun é rival digno, não vizinho dócil. Talvez por isso mesmo uma conversa sobre ferro valha mais agora: se nossas Casas continuarem disputando cada barra diante de compradores que jogam um contra o outro, ambos sangraremos preço enquanto outros escolhem reis e rotas por nós.

Quero ouvir a proposta de vocês antes de fixar números. Levarei as marcas de liga aceitas por Ferrumor, nossos prazos de fundição e as rotas de cabotagem que ainda podemos proteger. Peço que tragam o mesmo: padrão de barras, capacidade de entrega e nomes das guildas que responderão pelo contrato.

Não confundam nossa presença com submissão. Ferrumor não vende sua memória, nem aceita aliança que trate Caladris como ornamento de cais. Nesta hora, comércio sem segurança vira dependência, e dependência é palavra que Ferrumor não assina.

Se Solarion já concedeu licença para a Pirâmide de Cristal, confirmem o nome do oficial que abrirá a sala e guardará o registro do encontro.
```

## Caso 4 — Solarion × Karasoy

_Parceria antiga e cerco: o caso do encontro marcado em capital de terceiro._

### producao #1

reciclagem 8% · eco 2/4 · prazos 1 · 1124 car. · prompt 31565 car.
termos do fio: embarcacao (7→0), dificil (6→0), seguranca (5→0), desta lua (4→0), dia desta (4→0)
sem eco: «Por isso, peço que prepare suas forças com suas melhores armaduras, lanças de justa e cavalos, para que estejam prontas para defender nossas terras caso o conflito alcance nossos territórios.» «Este é um momento em que precisamos confiar uns nos outros e permanecer unidos.»

```text
Pode contar comigo para defender nossas terras; não conte comigo para marchar ao Norte nem para pôr cavaleiras Karasoy sob comando de Kasdrun, Solarion ou da Coroa.

A aliança do Oásis do Sol continua de pé. A partir desta noite, deixo 300 cavaleiras Ak-Boran e 40 arqueiras de sela prontas em Ordu-Yildiz. Se Solythar ou o Oásis forem atacados, elas saem pela Rota das Planícies e chegam ao poço oriental em até quatro dias após o sinal. Que o sinal seja luz, não fumaça: duas lanternas no poço oriental. Fumaça já não serve num céu morto.

Não tomo como certo o número que você atribui aos Euralune até ver a folha deles. Não sei se Alic vive. Sei que nenhum selo real limpo chega a mim, e que a Coroa cobrou ouro de Karasoy depois de Aylin morrer sob guarda dela.

A defesa está dada. A investigação não. Solarion prometeu vir com registros de passagem entre Asterhall, Porto Cinzento e Solythar: nomes, selos, cavalos, carros cobertos e a ordem que retirou a patrulha do rio. Traga também quem viu essa ordem.

No Oásis, guardem água de poço e cevada para três noites; carne e couro Karasoy levam consigo.

Selma Karasoy
```

### antes #1

reciclagem 5% · eco 2/4 · prazos 3 · 1136 car. · prompt 31272 car.
termos do fio: embarcacao (7→1), dificil (6→0), seguranca (5→0), desta lua (4→0), dia desta (4→0)
sem eco: «Por isso, peço que prepare suas forças com suas melhores armaduras, lanças de justa e cavalos, para que estejam prontas para defender nossas terras caso o conflito alcance nossos territórios.» «Este é um momento em que precisamos confiar uns nos outros e permanecer unidos.»

```text
Sim, pode contar comigo para defender nossas terras, o Oásis do Sol e a rota até Solythar. Não conte comigo para enviar cavalaria ao Norte, reconhecer tributo agravado como justo ou pôr uma filha de Karasoy sob comando de Kaelen, da Coroa, de Kasdrun ou de qualquer outra Casa.

Por noventa dias manterei 300 cavaleiras Ak-Boran e 40 arqueiras de sela prontas nas rotas de Ordu-Yildiz. Ao sinal da fita branca com oito nós no poço oriental do Oásis do Sol, elas partirão em até quatro dias. O resto das lanças fica nas planícies; a cidade móvel não será deixada nua enquanto reis mudam de nome em Asterhall.

A notícia dos quarenta mil indo a Vargen é grande demais para ser repetida sem pegada. Envie Elara Voss ao Oásis do Sol no 8º dia da próxima lua, com os nomes dos batedores de Euralune que viram a coluna, o rumo tomado e quantos carros de mantimento contaram. Quero saber se é exército, migração armada ou pânico com pernas.

Tragam também as cópias dos registros prometidos sobre a embarcação de Aylin e a retirada da patrulha. Ainda não tenho prova bastante para acusar em praça, mas já não aceito coincidência como resposta.
```

### antes #2

reciclagem 5% · eco 2/4 · prazos 1 · 1290 car. · prompt 31272 car.
termos do fio: embarcacao (7→0), dificil (6→0), seguranca (5→0), desta lua (4→0), dia desta (4→0)
sem eco: «Por isso, peço que prepare suas forças com suas melhores armaduras, lanças de justa e cavalos, para que estejam prontas para defender nossas terras caso o conflito alcance nossos territórios.» «Este é um momento em que precisamos confiar uns nos outros e permanecer unidos.»

revisor: Corrigi a afirmação sobre Kasdrun para atribuí-la ao que Solarion diz ter, sem tratar como fato independente confirmado. | Troquei “300 Ak-Boran” por “300 cavaleiras Ak-Boran”, conforme o compromisso militar descrito no material. | Corrigi o trecho final para não alterar o acordo vigente: não eram “duas últimas carroças”, e a escolta Solarion do Oásis até Solythar continuava sendo parte já pedida.

```text
Você pode contar comigo para defender Karasoy, Solarion e as rotas entre nós; não pode contar com cavaleiras Karasoy para marchar ao Norte nem para servir sob comando de outra Casa.

A partir desta noite, deixo 300 cavaleiras Ak-Boran e 40 arqueiras de sela destacadas no anel sul de Ordu-Yildiz, com arreios prontos. Se Solythar ou o Oásis do Sol forem atacados, acenda três fogos no poço oriental do Oásis e mande um mensageiro com selo solariano. Minhas cavaleiras chegarão ao Oásis em até quatro dias, se a estrada ainda puder ser cavalgada.

Não confirmei os quarenta mil que dizem marchar para Vargen. Se Euralune viu isso do alto, peço a cópia do relato com dia, direção e bandeiras vistas. Com mortos levantando no escuro, número errado mata tanto quanto emboscada.

A aliança que dizeis ter com Kasdrun é notícia útil. Karasoy falará com quem resiste ao novo regime, mas minha lança não passa para a mão de Kasdrun, de Solarion ou de Kaelen. Lutaremos lado a lado, não uma Casa montada sobre a outra.

Mantenham água, remédio de ferida e ração de cavalo no Oásis do Sol. Carne seca, couro e cavalos de remonta seguem pelo acordo já firmado; a parte restante sairá pela Rota das Planícies com escolta Karasoy até o Oásis. Do Oásis até Solythar, espero a escolta solariana já pedida.
```

### depois #1

reciclagem 2% · eco 3/4 · prazos 1 · 1230 car. · prompt 31565 car.
termos do fio: embarcacao (7→0), dificil (6→0), seguranca (5→0), desta lua (4→0), dia desta (4→0)
sem eco: «Este é um momento em que precisamos confiar uns nos outros e permanecer unidos.»

```text
Você pode contar comigo para defender Solythar, o Oásis do Sol e as rotas das Planícies. Karasoy já pôs cavaleiras em sela: 300 Ak-Boran e 40 arqueiras de sela ficarão prontas para partir ao Oásis do Sol em quatro dias, como pactuado; outras patrulhas fecharão as passagens de Ordu-Yildiz.

Asterhall, pelos relatos que chegaram a mim, não está mais apenas à beira: caiu, e Kaelen Drakorys se fez coroar. Quanto a Alic, não afirmo mais do que sei: nenhuma ordem dele chegou às minhas mãos.

Se Euralune viu quarenta mil marchando para Vargen, envie a cópia com rota, dia e sinal de estandartes. Não vou mover sete mil pessoas por rumor, mas também não vou esperar os cascos na porta. Minhas melhores lanças ficam preparadas; elas não marcharão para a Marcha do Norte, nem ficarão sob comando de Kasdrun, Solarion ou Coroa. Lutaremos lado a lado, cada estandarte com sua própria voz.

A aliança de vocês com Kasdrun não me ofende. Se eles quiserem tratar passagem por nossas planícies, que mandem um representante com selo ao Oásis do Sol; sem isso, nenhuma coluna armada cruza.

Mantenham no Oásis do Sol sal, óleo, panos limpos e água de poço para quatro dias. Meu sinal continua sendo a fita branca de oito nós no poço oriental.
```

### depois #2

reciclagem 3% · eco 2/4 · prazos 2 · 1139 car. · prompt 31565 car.
termos do fio: embarcacao (7→0), dificil (6→0), seguranca (5→0), desta lua (4→0), dia desta (4→0)
sem eco: «Por isso, peço que prepare suas forças com suas melhores armaduras, lanças de justa e cavalos, para que estejam prontas para defender nossas terras caso o conflito alcance nossos territórios.» «Este é um momento em que precisamos confiar uns nos outros e permanecer unidos.»

```text
Você pode contar comigo para defender nossas fronteiras e rotas, Gloriandur. Não contará comigo para mandar cavalaria à Marcha do Norte nem para pôr Karasoy sob estandarte alheio.

A partir desta noite, deixarei 500 Ak-Boran prontos entre Ordu-Yildiz e o Oásis do Sol, com lanças leves, arcos e ferraduras de inverno. Se Solythar ou o Oásis forem atacados, vale o pacto já firmado: 300 cavaleiras e 40 arqueiras de sela partem em até quatro dias. Se a ameaça cruzar a planície em massa, mandarei mais 200 como reforço, enquanto houver capim e água para os animais.

Sobre os 40 mil que Euralune diz ter visto: mande-me a cópia do relato, com a rota do voo e o dia da contagem. Meus batedores ainda não confirmaram esse número; não chamo isso de mentira, só não movo Ordu-Yildiz por número sem pegada.

Mantenha seus mantimentos junto aos poços, não em depósito só. Água decide defesa em Solythar. Eu manterei carne seca e couro nas carroças do oásis; vocês guardem sal, remédio e flechas.

Recebo a notícia de Kasdrun como boa, se eles trouxerem ferro e não correntes. Envie o relato Euralune ao poço oriental do Oásis do Sol em seis dias.
```

## Caso 5 — Khazdrun × Ulgar

_Fio longo (20 cartas) com Vórtice Branco e coroação no meio._

### producao #1

reciclagem 1% · eco 1/1 · prazos 0 · 1379 car. · prompt 33804 car.
termos do fio: ysmarr (17→3), porque (14→0), depois (11→1), senhor (11→0), nah korah (10→1)

```text
Não enviem comboio para buscar Ysmarr; ela já está na estrada, e tropa saindo ao encontro dela no escuro pode espalhar os bois. Ponham seus soldados na boca sul de Khar-Durak, com fogo coberto e sino baixo, e deixem nossas doze carroças chegarem inteiras.

Recebo a notícia dos mais de trinta mil mortos como quem recebe fumaça dentro da tenda. Em Asterhall, os homens que caíram no adarve se levantaram contra os próprios companheiros; os orcs mortos também entraram na fileira. Em Nah’Korah vimos a mesma fome deixar a forma de pé depois que a vida já tinha sido tomada. Não façam muralha de cadáver. Tratem cada caído como inimigo que ainda não recebeu ordem de andar.

Sobre o Rei, nós não sabemos. Em Rok’thar chegam folhas, não chegam olhos. Sei apenas que a Coroa está muda, a Casa do Ouro fala demais por ela, e isso não me acalma.

Mok’Thar irá ao encontro com Solarion quando o lugar for nomeado por quem manda naquele chão. Não mandarei ancião meu a terra de terceiro sem nome e sem salvo-conduto. Se for na Torre de Véspera e a Ordem abrir a porta, ele irá com dois guardas e uma caixa das tábuas de osso.

Mande antes de Ysmarr chegar uma resposta curta: de onde veio a conta dos trinta mil, por qual estrada descem, e se o resíduo apagou chama ou gelou água quando tocado. Isso decide o rito que Mok’Thar tentará levantar e o que Ysmarr deve procurar em Khar-Durak.
```

### antes #1

reciclagem 1% · eco 0/1 · prazos 0 · 1152 car. · prompt 41305 car.
termos do fio: ysmarr (17→1), porque (14→1), depois (11→1), senhor (11→0), nah korah (10→1)
sem eco: «Precisamos encontrar uma forma de lutar contra esse mal, e precisamos fazê-lo rapidamente.»

nomes fora do material: Urum, Rainha

```text
Não mandem comboio para buscar Ysmarr; deixem dez soldados e dois guias na boca sul de Khar-Durak, com lanternas baixas, até ela chegar.

Seu aviso dos trinta mil mortos chegou antes do pior. Em Nah’Korah, no vau de Urum, meu irmão segurou uma passagem contra menos de mil Valgor. Vencemos a primeira carga e perdemos a segunda porque deixamos nossos mortos inteiros atrás de nós. Queimem os caídos antes de contar vitória. Se não houver tempo, quebrem joelhos e mandíbula. É trabalho feio; é trabalho vivo.

Ulgar quer estar no encontro com Solarion, mas ainda não recebi o nome do posto. Se o lugar não estiver fechado, proponho a Torre de Véspera, com licença da Ordem dos Três; há arquivos ali, e olhos que já mediram esta escuridão. Mok’Thar irá com seis guardas e as tábuas seladas.

Quanto à aliança: aceito falar dela agora, não depois que a fileira bater na montanha. Ulgar não se ajoelhará à nova Rainha, a Kaelen Drakorys ou a qualquer coroa marcada. Se Khazdrun aceita isso, seus engenheiros e nossos guerreiros acertarão muralha, fogo e retirada no mesmo mapa.

As trinta barras e nossa carga seguem como combinado: boca sul de Khar-Durak.
```

### antes #2

reciclagem 4% · eco 0/1 · prazos 0 · 1168 car. · prompt 41305 car.
termos do fio: ysmarr (17→1), porque (14→0), depois (11→1), senhor (11→0), nah korah (10→0)
sem eco: «Precisamos encontrar uma forma de lutar contra esse mal, e precisamos fazê-lo rapidamente.»

nomes fora do material: Khazdrun e Solarion, Rainha Kaelen Drakorys

```text
Não mande comboio atrás de Ysmarr; ela já está na estrada, e seus soldados devem esperá-la na boca sul de Khar-Durak.

Ulgar irá ao encontro com Solarion em Solythar. Mando Varka Chifre Rubro com doze guardas e palavra para firmar guerra ao lado de Khazdrun, se vocês a firmarem como Casa livre.

Asterhall caiu. A ordem da Ordem dos Três sobre os mortos já está sendo cumprida em Rok’thar; ontem Rokan queimou o corpo de um carreteiro nosso antes que a mãe pudesse lavar os chifres dele. Ela me odiou por uma hora, e depois me agradeceu. É isso que a noite virou.

Se são trinta mil mortos descendo do Norte, madeira e ferro sozinhos não seguram. Proponho que Ulgar, Khazdrun e Solarion declarem em Solythar uma aliança contra os mortos e contra a Rainha Kaelen Drakorys enquanto ela marchar com máquinas, coroas ou ordens que ponham nossos povos de joelhos. Nenhuma Casa manda na outra. Cada uma guarda seu chão e abre caminho para mensageiros, feridos e ferreiros.

Também preciso que seus mestres respondam a pergunta simples: o resíduo escureceu prata, enfraqueceu ferro, apagou chama ou gelou água? Mande isso à boca sul com as 30 barras.

Thorgar Crina de Ferro
```

### depois #1

reciclagem 0% · eco 0/1 · prazos 0 · 0 car. · prompt 33804 car.
termos do fio: ysmarr (17→0), porque (14→0), depois (11→0), senhor (11→0), nah korah (10→0)
sem eco: «Precisamos encontrar uma forma de lutar contra esse mal, e precisamos fazê-lo rapidamente.»

```text

```

### depois #2

reciclagem 1% · eco 0/1 · prazos 0 · 1172 car. · prompt 33804 car.
termos do fio: ysmarr (17→2), porque (14→0), depois (11→0), senhor (11→0), nah korah (10→0)
sem eco: «Precisamos encontrar uma forma de lutar contra esse mal, e precisamos fazê-lo rapidamente.»

nomes fora do material: Khazdrun e Solarion

```text
Não mandem comboio a Rok’thar; Ysmarr já está na estrada, e aceito escolta de Khazdrun apenas na boca sul de Khar-Durak.

Eu também irei ao encontro com Solarion. Se o lugar ainda não foi gravado em pedra, proponho a Torre de Véspera, pedida à Ordem dos Três; se Solarion já marcou outro lugar, mande o nome pelo portador. Levarei Mok’Thar e Varka Chifre Rubro, para que o rito e a lança ouçam a mesma coisa.

Trinta mil mortos descendo do Norte é número que muda conselho. Em Rok’thar mandei fechar as trilhas de caça, contar óleo de lamparina e queimar nossos mortos antes que a noite os tome. Meu povo já viu uma terra morrer. Conhece o cheiro de quem espera demais.

Ainda falta a resposta que Mok’Thar pediu: prata escureceu, ferro enfraqueceu, chama apagou, água gelou? Se nada disso aconteceu, escreva “nada”. Esse nada ainda serve.

No encontro, pedirei a Khazdrun e Solarion um pacto claro: contra os mortos, e contra qualquer coroa ou rainha que queira nos pôr de joelhos enquanto eles avançam. Ulgar ficará ao lado de aliados. Ulgar não será ferramenta de Kaelen Drakorys nem de trono nenhum.

Ponham seus homens na boca sul para as doze carroças e para Ysmarr.
```

## Caso 6 — Solarion × Euralune

_Fio longo (21 cartas) sobre aviso do céu; voz de Lyra Euralune._

### producao #1

reciclagem 0% · eco 1/12 · prazos 0 · 1126 car. · prompt 35117 car.
termos do fio: ninho alto (24→0), leitores (8→0), proposta (8→0), lentes (8→0), confianca (7→0)
sem eco: «Preciso, porém, saber mais.» «Entre os mortos que suas águias observaram, havia alguém que parecesse liderá-los?» «Alguma figura diferente dos demais?» «Alguém dando ordens ou conduzindo a marcha?» «Eles ainda se comportam como soldados comuns, apesar de estarem mortos?» «Mantêm formação, obedecem comandos, protegem uns aos outros ou demonstram algum tipo de disciplina militar?» «E, se puderem responder: vocês viram alguém conhecido entre eles?» «Também precisamos descobrir como detê-los.» «Vocês observaram se eles evitam rios, grandes cursos de água ou fogo?» «Demonstraram medo ou alguma reação diante dessas coisas?» «Precisamos começar a criar resistência contra eles agora, antes que cheguem às nossas estradas.»

```text
Não vimos líder. Não vimos estandarte erguido, corneta, tambor nem mão que desse ordem.

A coluna anda como tropa que esqueceu o comandante: larga demais para uma só conta, estrada mantida, passo igual. Não se abriu na neve, não brigou consigo mesma e não parou. Isso é pior que disciplina, porque não precisa de coragem.

Não reconhecemos rosto. De cima, no escuro, rosto é mentira. Nossos cavaleiros não viram brasão limpo, símbolo seguro nem armadura que permita juramento. Se há ali homens da Marcha ou de outra hoste, eu não porei selo nessa suspeita.

Sobre água e fogo, sei menos do que gostaria. Não vimos rio grande, nem prova de que água detenha a coluna. Também não vimos fogo bastante para chamar isso de teste. Quem quiser atrasá-los deve pensar em ponte derrubada, garganta estreita e pedra rolada; tochas são esperança pequena demais para trinta mil mortos.

Manteremos patrulhas altas sobre a estrada de Droskar enquanto as aves aceitarem o vento, e mandaremos aviso por Raven’s Cross. Não entregarei essa rede à Casa do Ouro nem à Coroa sob pretexto de ordem. Neutralidade ainda salva mais vidas que bandeira.
```

### antes #1

reciclagem 8% · eco 2/12 · prazos 0 · 1258 car. · prompt 41984 car.
termos do fio: ninho alto (24→0), leitores (8→0), proposta (8→0), lentes (8→0), confianca (7→0)
sem eco: «Preciso, porém, saber mais.» «Entre os mortos que suas águias observaram, havia alguém que parecesse liderá-los?» «Alguma figura diferente dos demais?» «Alguém dando ordens ou conduzindo a marcha?» «Eles ainda se comportam como soldados comuns, apesar de estarem mortos?» «Mantêm formação, obedecem comandos, protegem uns aos outros ou demonstram algum tipo de disciplina militar?» «E, se puderem responder: vocês viram alguém conhecido entre eles?» «Também precisamos descobrir como detê-los.» «Demonstraram medo ou alguma reação diante dessas coisas?» «Precisamos começar a criar resistência contra eles agora, antes que cheguem às nossas estradas.»

revisor: Cortei observações específicas sobre cotas, escudos, roupas, armas e riachos que não estavam sustentadas no material. | Troquei a garantia de que Solarion saberia antes de qualquer caravana por uma promessa mais cautelosa de aviso. | Ajustei a frase sobre a Casa do Ouro e a Coroa para ficar fiel ao registro: eles chamam de traição o que não aprovam, não necessariamente tudo o que não comandam.

```text
Não vimos comandante, estandarte erguido nem voz de comando na coluna. Marcham como tropa treinada, mas sem gesto visível: mantêm a estrada, não se abrem na neve, não brigam entre si e não param; já não há escuro nem claro para eles.

De cima não reconhecemos rostos. Também não vimos estandarte, armadura ou símbolo claro bastante para dar nome à origem. Não jurarei Casa Rimerberg, Casa do Ouro ou Vargen por sombra vista de lombo de águia.

Água: não vimos rio largo, nem temos prova de que evitem ou enfrentem cursos de água. Fogo, não testamos. Meus cavaleiros tinham ordem de ver e voltar, não de acender um farol sobre trinta mil mortos. A terceira patrulha não voltou; não gastarei outra em experiência.

Faremos mais um reconhecimento alto nas próximas horas. A primeira ave levará mudança de rumo a Droskar; a segunda, a vocês em Raven's Cross. Se houver desvio para estrada solariana, avisaremos; não prometo o que o céu fechado pode nos tomar.

Recebo sua palavra de ajuda; ela não muda nossa neutralidade. Podem repetir número, rumo e prazo para retirar aldeias da estrada. Não repitam nomes de cavaleiros nem pontos de pouso. A Casa do Ouro e a Coroa já chamam de traição o que não aprovam.

Tobren Penhasco, por ordem de Lorde Brannic Euralune
```

### antes #2

reciclagem 0% · eco 4/12 · prazos 0 · 1409 car. · prompt 41984 car.
termos do fio: ninho alto (24→1), leitores (8→0), proposta (8→0), lentes (8→0), confianca (7→0)
sem eco: «Preciso, porém, saber mais.» «Alguém dando ordens ou conduzindo a marcha?» «Mantêm formação, obedecem comandos, protegem uns aos outros ou demonstram algum tipo de disciplina militar?» «E, se puderem responder: vocês viram alguém conhecido entre eles?» «Também precisamos descobrir como detê-los.» «Vocês observaram se eles evitam rios, grandes cursos de água ou fogo?» «Demonstraram medo ou alguma reação diante dessas coisas?» «Precisamos começar a criar resistência contra eles agora, antes que cheguem às nossas estradas.»

```text
Não vimos líder. Não havia cavaleiro à frente, estandarte inteiro, tambor, corneta ou figura separada dos demais; ainda assim a coluna mantinha estrada como tropa que recebeu uma ordem antes de morrer.

Eles não se comportam como soldados vivos. Não protegem flanco, não recolhem ferido, não procuram abrigo. Marcham juntos, sem fala e sem briga. Quando a estrada estreita, afunilam. Quando alarga, voltam a ocupar toda a largura. Isso é disciplina de enxame, não de capitão.

Não reconhecemos rosto. De cima, no escuro, quem disser nome mente. Vimos elmos do norte, couro de patrulha, cotas velhas e escudos sem pintura bastante para juramento. Pode haver homens de mais de uma Casa ali. Não assinarei acusação contra mortos sem marca clara.

Água: atravessaram dois regatos sem desviar o passo. Rio grande, não vimos. Fogo: não testamos. Perdi uma patrulha para trazer este aviso; não gastarei outra para satisfazer curiosidade.

Manterei duas patrulhas de altura sobre a rota de Droskar enquanto as aves aceitarem subir. O que virem seguirá por Raven’s Cross e por ave direta a Solythar, no preço urgente já acertado.

Quanto ao sul: avisem os que fogem de que Porto Cinzento já recebeu navios sem estandarte. Mandar pobres para uma costa cega pode só trocar dentes por facas.

E deixem isto claro aos seus: nossas aves levam aviso, não bandeira. Nem a Casa do Ouro nem a Coroa mandam no céu de Ninho Alto.
```

### depois #1

reciclagem 0% · eco 4/12 · prazos 1 · 1332 car. · prompt 35117 car.
termos do fio: ninho alto (24→0), leitores (8→0), proposta (8→0), lentes (8→0), confianca (7→0)
sem eco: «Preciso, porém, saber mais.» «Eles ainda se comportam como soldados comuns, apesar de estarem mortos?» «Mantêm formação, obedecem comandos, protegem uns aos outros ou demonstram algum tipo de disciplina militar?» «E, se puderem responder: vocês viram alguém conhecido entre eles?» «Também precisamos descobrir como detê-los.» «Vocês observaram se eles evitam rios, grandes cursos de água ou fogo?» «Demonstraram medo ou alguma reação diante dessas coisas?» «Precisamos começar a criar resistência contra eles agora, antes que cheguem às nossas estradas.»

```text
Não vimos líder entre os mortos. Vimos marcha, não comando: nenhuma figura adiante, nenhum tambor, nenhum braço erguido dando ordem.

Eles mantêm a estrada e uma largura constante. Quando pedras e neve estreitam o caminho, apertam a fileira sem briga e depois se abrem outra vez. Isso parece disciplina vista de cima, mas não posso jurar que seja memória de soldado. Pode ser outra coisa movendo todos pelo mesmo fio.

Não reconhecemos rostos. A escuridão, a altura e a sujeira dos corpos não deixam esse luxo. Também não vimos estandarte erguido. Havia escudos partidos, elmos de tipos diferentes e panos de muitas cores, misturados demais para chamar aquilo de tropa de uma Casa.

Sobre água e fogo: não sabemos o bastante. Não cruzaram rio grande diante dos nossos cavaleiros. Passaram por regatos sem hesitar. Não testamos fogo. Não vou mandar ave e cavaleiro descerem baixo para provocar uma reação que talvez custe os dois.

Agradeço sua intenção de avisar os indefesos. Só cuidado com Porto Cinzento: navios sem estandarte já entraram ali uma vez. Mandar todos para um só porto pode salvar muitos ou empilhar medo no mesmo cais.

Continuaremos a vigiar a coluna. Até ela tocar Droskar ou mudar de rumo, enviaremos aviso por Raven’s Cross a cada dois dias; se virar para sul ou se dividir, mando voo urgente direto a Solythar.
```

### depois #2

reciclagem 3% · eco 3/12 · prazos 0 · 1468 car. · prompt 35117 car.
termos do fio: ninho alto (24→2), leitores (8→1), proposta (8→0), lentes (8→1), confianca (7→0)
sem eco: «Preciso, porém, saber mais.» «Entre os mortos que suas águias observaram, havia alguém que parecesse liderá-los?» «Alguma figura diferente dos demais?» «Alguém dando ordens ou conduzindo a marcha?» «Mantêm formação, obedecem comandos, protegem uns aos outros ou demonstram algum tipo de disciplina militar?» «E, se puderem responder: vocês viram alguém conhecido entre eles?» «Vocês observaram se eles evitam rios, grandes cursos de água ou fogo?» «Demonstraram medo ou alguma reação diante dessas coisas?» «Precisamos começar a criar resistência contra eles agora, antes que cheguem às nossas estradas.»

nomes fora do material: Raven’s Cross e Solythar

revisor: Cortei ou reescrevi como limite de observação detalhes que não estavam sustentados no material: arroios, fogueiras abandonadas, roupas específicas, elmos e comportamento minucioso de flanco ou retaguarda. | Evitei transformar a palavra de Solarion sobre ser aliado em aliança formal, preservando a neutralidade de Euralune. | Mantive a resposta direta às perguntas recebidas e a voz cautelosa de Brannic, sem prometer mais do que as aves e a rede livre podem cumprir.

```text
Recebemos suas perguntas. Respondo só o que os olhos das aves puderam jurar.

Não há, nos relatos das duas patrulhas que voltaram, comandante que eu possa nomear ou descrever. A coluna mantém estrada e passo, mas não recebemos sinal de ordem dada por corneta, estandarte ou capitão. Se há vontade guiando aquilo, não se mostrou como tropa viva se mostra.

Não os chamaria de soldados comuns. Marcham, não vagam; não se abrem na neve; não brigam entre si; não param. Mais que isso eu não assino. Da altura e neste escuro, ninguém em Ninho Alto reconhecerá um rosto para depois descobrir que condenou o morto errado.

Também não assinarei origem. O que vimos foi massa de mortos descendo das terras altas para Droskar. Sem símbolo limpo, sem rosto certo, sem estandarte que valha juramento.

Sobre água e fogo, nada sabemos que preste. Não vimos prova de rio largo, nem testamos chama. Uma águia já não voltou; não queimarei outra por experiência feita para acalmar escriba. Se as suas lentes souberem mais, mandem depressa.

Continuaremos seguindo a coluna enquanto as aves aceitarem o voo. O próximo aviso seguirá por Raven’s Cross e Solythar, pela rede livre de Ninho Alto, não por bandeira da União, da Coroa ou da Casa do Ouro.

Agradeço a mão estendida ao sul. Euralune aceita amizade; posse, nunca. Mandem o que seus leitores virem de Droskar e da estrada do Porto Cinzento por Raven’s Cross. E não vendam o sul como seguro antes que o próprio caminho o confirme.
```

## Caso 7 — Do Ouro × Valerius

_Terceiro jogador, fio de desconfiança com a Coroa e o protocolo do fogo._

### producao #1

reciclagem 13% · eco 0/1 · prazos 1 · 1212 car. · prompt 30283 car.
termos do fio: asterhall (12→1), mortos (6→0), principe (5→0), valdren (5→0), contra (5→1)
sem eco: «Se a Coroa exige ser a voz que ordena a salvação do reino, que assim seja.»

```text
A leitura proposta não basta. Lereis a correção da Coroa com o nome de Alic Valerius inteiro, sem a vossa condição sobre se vive ou reina.

O protocolo do fogo vigora por ordem da Coroa. Sétimo do Ouro permanece responsável perante Alic Valerius por comprar o pez e o óleo, distribuí-los e fazê-lo cumprir onde vossos homens alcançam. A frase “trono de papel” será retirada da boca dos pregoeiros, porque cargo dado pelo rei volta ao rei, e medo algum divide coroa, mando ou território da Casa Valerius.

A vossa mão estendida aos vivos é aceita onde sustenta a lei real. Orc livre sob lei real recebe proteção. Homem de Thorgul, orc ou não, que subir contra Asterhall será morto, decapitado e queimado. Não autorizamos trégua, passagem nem trato com Kaelen Drakorys, Krythos ou qualquer força que sirva às máquinas que sobem o rio.

Quanto ao pez e ao óleo, cumprireis a ordem já dada: quarenta barris de pez e vinte de óleo comprados em Porto Cinzento, carregados em vinte carroças, escoltados por vossos guardas e enviados ao portão norte de Solythar. O oficial real receberá recibo da entrega.

A correção será lida em Porto Cinzento, Raven’s Cross e nas estradas de Solarion antes do segundo sino de amanhã.
```

### antes #1

reciclagem 13% · eco 0/1 · prazos 1 · 1184 car. · prompt 30118 car.
termos do fio: asterhall (12→1), mortos (6→1), principe (5→0), valdren (5→0), contra (5→0)
sem eco: «Se a Coroa exige ser a voz que ordena a salvação do reino, que assim seja.»

```text
A Coroa registra vossa aceitação do pez e do óleo; cumpri a carga sem mudar conta, rota ou destino. A correção pública, porém, sairá com as palavras da Coroa, não com fórmula que faça do rei uma hipótese: “o protocolo dos mortos vigora por ordem da Coroa, e Sétimo do Ouro permanece responsável perante Alic Valerius por sua execução”.

Não vos peço vaidade, Sétimo. Peço que não transformeis socorro em plebiscito. Asterhall sangra, e já há Casas esperando uma palavra frouxa para chamar usurpação de prudência. Vossa folha correu longe com “esqueçam os reis”; a emenda deve correr pelo mesmo caminho.

Lede-a em Porto Cinzento, Raven’s Cross e nos marcos das estradas de Solarion antes do segundo sino de amanhã, e mandai três cópias seladas à nossa chancelaria em Solythar. Se alguém vos perguntar por Alic, respondereis apenas isto: o trono não caduca por cerco, escuro ou boato.

Quanto à mão estendida, mantende-a aos vivos sob lei real. A quem serve Krythos, Thorgul ou qualquer rainha levantada sobre a ruína da capital, oferecei fogo ou prisão, não abrigo. Os quarenta barris de pez e vinte de óleo seguirão em vinte carroças com escolta vossa até o portão norte de Solythar.
```

### antes #2

reciclagem 8% · eco 1/1 · prazos 1 · 1284 car. · prompt 30118 car.
termos do fio: asterhall (12→1), mortos (6→1), principe (5→0), valdren (5→2), contra (5→1)

nomes fora do material: Rei de Valdren, Rainha

revisor: Reescrevi a referência à promessa de Do Ouro para não tratar como aceitos o prazo de oito dias e as vinte carroças, que a resposta deles não confirmou; deixei esses pontos como ordem reiterada da Coroa. | Ajustei a convocação das Casas para não afirmar como fato que Casas específicas dobraram o joelho a Krythos, aos orcs ou à nova Rainha sem registro no material.

```text
Alic Valerius é Rei de Valdren, Sétimo; a queda de Asterhall não vos autoriza a trocar juramento por fórmula de sobreviventes.

Recebemos vossa anuência quanto aos quarenta barris de pez e vinte de óleo. Não recebemos a mesma clareza quanto ao prazo e às carroças; por isso a ordem fica repetida, não presumida: oito dias até o portão norte de Solythar, em vinte carroças com vossos guardas, ou carta de perda assinada por vosso capitão.

A correção pública será lida com as palavras que a Coroa ordenou: o protocolo do fogo vigora por ordem da Coroa, e Sétimo do Ouro permanece responsável perante Alic Valerius por sua execução. Não acrescenteis “se”, nem substituais Coroa por “vivos”. Os vivos precisam de uma ordem que os capitães reconheçam quando a primeira fogueira falhar.

Agora usai o que tendes. Porto Cinzento deve reunir, no terceiro dia após esta carta, procuradores com selo das Casas que ainda reconhecem Valdren contra Krythos, Thorgul, os mortos e a mulher que se nomeia Rainha. Vireis vós, ou mandareis Enoque com poder para assinar crédito, correio e compra de pez.

Não vos ofereço pedaço algum do Vale. Peço serviço devido ao reino que vossa própria folha disse querer salvar: Porto Cinzento, terceiro dia, antes do sino vespertino.

Celene Valerius, pela Coroa
```

### depois #1

reciclagem 10% · eco 0/1 · prazos 2 · 1123 car. · prompt 30283 car.
termos do fio: asterhall (12→0), mortos (6→1), principe (5→0), valdren (5→0), contra (5→1)
sem eco: «Se a Coroa exige ser a voz que ordena a salvação do reino, que assim seja.»

nomes fora do material: Estrada de Solythar

```text
Aceitamos vossa execução do protocolo do fogo; recusamos a fórmula que omite a Coroa ou põe o Rei Alic em dúvida. A leitura pública terá estas palavras: o protocolo dos mortos vigora por ordem da Coroa, sob execução de Sétimo do Ouro e dos capitães fiéis à Coroa e à vida.

Não vos peço que gasteis ouro com vaidade. Peço que gasteis ouro para que mulheres no cais e filhos nas muralhas não vejam o pai levantar de novo. Nisto, vossa folha foi útil, e a Coroa o registra.

Os quarenta barris de pez e vinte de óleo ficam confirmados. Pela urgência, não espereis as vinte carroças cheias: em dois dias, dez barris de pez e cinco de óleo seguirão de Porto Cinzento pela Estrada de Solythar em mulas, com vossos guardas. O restante seguirá nas vinte carroças até o oitavo dia da compra, e o oficial real receberá os dois recibos no portão norte de Solythar.

Orc livre sob lei será defendido. Guerreiro de Thorgul, mercenário de Krythos ou capitão que suba contra a Coroa será morto, decapitado e queimado.

Cumpri a correção pública antes do segundo sino de amanhã em Porto Cinzento, Raven's Cross e nas estradas de Solarion.
```

### depois #2

reciclagem 12% · eco 1/1 · prazos 2 · 1023 car. · prompt 30283 car.
termos do fio: asterhall (12→1), mortos (6→1), principe (5→1), valdren (5→0), contra (5→0)

```text
A Coroa aceita vosso envio de pez e óleo; não aceita a fórmula que omite a ordem régia. A leitura será feita com estas palavras: o protocolo dos mortos vigora por ordem da Coroa, sob execução de Sétimo do Ouro e dos capitães fiéis à vida.

Não vos peço que discutais títulos no escuro. Peço que não os desfaçais em praça pública. Alic Valerius não perdeu a Coroa porque as estradas se partiram, e nenhum príncipe, por zelo ou pavor, recebe autoridade bastante para reescrever o reino.

Quanto aos vivos, estamos de acordo no que importa: orc livre sob lei real será protegido, anão e elfo terão o mesmo fogo e a mesma muralha que um homem de Asterhall. Guerreiro de Thorgul, agente de Krythos ou capitão que usar esta calamidade para erguer outra soberania será tratado como inimigo.

Mandai a correção a Porto Cinzento, Raven’s Cross e às estradas de Solarion antes do segundo sino de amanhã. Os quarenta barris de pez e vinte de óleo seguirão em vinte carroças vossas, com recibo no portão norte de Solythar em oito dias.
```

## Caso 8 — Solarion × Ordem dos Três

_NPC de organização (voz do Codex) e lista de exigências já cumpridas._

### producao #1

reciclagem 5% · eco 0/0 · prazos 0 · 1198 car. · prompt 33507 car.
termos do fio: diante (9→0), correcao (5→0), mandai (5→0), numero (5→0), velas carrocas (4→0)

nomes fora do material: L-I, T-I, R, G-I, I e C, V

```text
Recebo e aceito Eol, Belegue e Ritolun como os únicos olhos de Solarion dentro da sala de conta em Raven’s Cross. Também ficam registrados Capitão Arven Solkar, Marek Thalen, Iram Velkor e os quatro lacres: SOL-I, AST-II, REG-III e CAL-IV.

Vossa duplicata chegou com os mesmos termos; isso basta. Arven Solkar responderá pelos doze guardas no pátio. Marek entregará as caixas sem abri-las. Iram mostrará o registro dos lacres antes que a primeira faca toque a cera. Se algum selo vier rompido ou diverso do que declarastes, a caixa ficará fechada, à vista da testemunha da Irmandade dos Corvos, até confirmação por corvo de Solarion. O conteúdo não será contado como prova nesse intervalo.

Não farei exceção por pressa, medo ou nome ilustre. Quantas vezes um rito se perdeu porque alguém perguntou “que mal há em deixar mais uma mão entrar”? O preço não foi ouro; foram lembranças arrancadas de três iniciados, e nenhum deles sabia que estava pagando.

Nossos calculadores levarão a lista aceita ao posto. A cópia de All Marifh sobre Krythos será recebida em lacre separado e aberta somente depois da conta do céu. Chegai a Raven’s Cross com esses nomes, esses lacres e não mais que doze guardas.
```

### antes #1

reciclagem 1% · eco 0/0 · prazos 0 · 1233 car. · prompt 32897 car.
termos do fio: diante (9→1), correcao (5→0), mandai (5→0), numero (5→1), velas carrocas (4→0)

nomes fora do material: L-I, T-I, R, G-I, I e C, V, Marek Thalen e Iram Velkor, Arven e Iram, Rimewatch e Asterhall

```text
Os lacres SOL-I, AST-II, REG-III e CAL-IV ficam aceitos, e também ficam aceitos Capitão Arven Solkar, Marek Thalen e Iram Velkor nas responsabilidades que nomeastes. Se os sinais chegarem como declarados, abriremos as quatro caixas diante da testemunha da Irmandade; se um lacre vier rompido, a caixa ficará fechada até Arven e Iram escreverem, de próprio punho, onde foi vista íntegra pela última vez.

Eol, Belegue e Ritolun entrarão sozinhos na sala. Que tragam a boca pronta para responder ao que pesa agora mais que nossa vaidade: em qual noite a sombra deixou de mover-se, qual margem do disco solar foi tomada primeiro, e se vossas tábuas mostram mudança antes dos mortos se levantarem em Rimewatch e Asterhall. Não vos peço conclusão. Peço número, referência e mão que escreveu.

Asterhall caiu. O poder que devolve cadáveres não será tratado por capitão, faraó nem rei como ferramenta de campanha. Se algum dos vossos, no caminho, vir morto andar, que não toque, não queime sem testemunha e não recolha osso ou roupa. Marquem lugar, hora e nome do morto se houver, e tragam essa folha lacrada à mesa depois da conta do céu.

Vinde com doze guardas no pátio, quatro caixas lacradas e os três nomes já aceitos a Raven’s Cross.
```

### antes #2

reciclagem 0% · eco 0/0 · prazos 0 · 1187 car. · prompt 32897 car.
termos do fio: diante (9→1), correcao (5→0), mandai (5→0), numero (5→0), velas carrocas (4→0)

nomes fora do material: L-I, T-I, R, G-I, I e C, V

```text
Capitão Arven Solkar, Marek Thalen, Iram Velkor e os lacres SOL-I, AST-II, REG-III e CAL-IV ficam aceitos para Raven’s Cross. Eol, Belegue e Ritolun continuam sendo os únicos solarianos que entrarão na sala de conta.

Vossa ordem sobre caixa violada está correta: se qualquer lacre chegar partido, Arven a apresentará fechada e Marek não tocará no conteúdo; a caixa ficará sob guarda da Irmandade até que eu autorize sua abertura por escrito. Não é desconfiança contra Solarion. É medo concreto de mão errada sobre instrumento certo.

Asterhall caiu, e a noite já não é só erro de céu. Depois da primeira conta diante do sol, faremos uma segunda leitura: compararemos a parada do astro com os relatos de Rimewatch e de Asterhall sobre mortos levantados. Eol, Belegue e Ritolun devem trazer, sem outro homem, as marcações de hora e sombra dos últimos quarenta dias que vossos observatórios possuam.

Não aceito emissário da Coroa, capitão de Casa ou sacerdote dentro da sala para ajudar na seleção das vozes. Se isto fere orgulho, que fira o meu primeiro. A Ordem manterá a porta.

Chegai a Raven’s Cross com quatro caixas lacradas, doze guardas no pátio e os três astrônomos já nomeados.
```

### depois #1

reciclagem 1% · eco 0/0 · prazos 0 · 1159 car. · prompt 33507 car.
termos do fio: diante (9→1), correcao (5→0), mandai (5→0), numero (5→0), velas carrocas (4→0)

nomes fora do material: L-I, T-I, R, G-I, C, V

revisor: Troquei a formulação que fazia a “porta de Raven’s Cross” reconhecer nomes por uma ação da equipe da Ordem em Raven’s Cross, para não parecer que a Ordem concede autoridade sobre cidade de terceiro. | Esclareci que Iram Velkor lerá o registro no limiar da sala, sem contrariar a regra de que apenas Eol, Belegue e Ritolun entram como representantes de Solarion. | Ajustei a abertura da sala para forma passiva, evitando afirmar domínio indevido da Ordem sobre Raven’s Cross.

```text
Capitão Arven Solkar, Marek Thalen, Iram Velkor e os quatro sinais de lacre ficam aceitos pela Ordem. A equipe da Ordem em Raven’s Cross reconhecerá esses nomes e essas marcas: SOL-I em cera dourada, AST-II em cera branca, REG-III em cera azul-escura e CAL-IV em cera vermelha.

Arven Solkar manterá os doze guardas no pátio. Marek Thalen entregará as caixas sem abri-las. Iram Velkor lerá o registro dos lacres no limiar da sala, diante de nossa testemunha e de vossos três astrônomos, antes que qualquer faca toque a cera. Se um lacre vier rompido, a caixa será posta sobre a mesa fechada, e a violação será escrita antes do exame do conteúdo.

Eol, Belegue e Ritolun continuam sendo os únicos de Solarion na sala de conta. Esta linha não se move. Depois de Asterhall, todo poder sem dono claro será tratado como risco até que seu preço seja conhecido; não deixarei a pressa escolher as mãos que medirão o céu.

A carta lacrada de All Marifh sobre Krythos será recebida à parte e guardada até terminarmos a conta do sol parado. Chegai a Raven’s Cross com as quatro caixas e os nomes já aceitos; a sala de conta será aberta quando os lacres forem conferidos.
```

### depois #2

reciclagem 3% · eco 0/0 · prazos 0 · 1276 car. · prompt 33507 car.
termos do fio: diante (9→2), correcao (5→0), mandai (5→0), numero (5→0), velas carrocas (4→1)

nomes fora do material: L-I, T-I, R, G-I, I e C, V

revisor: Ajustei a guarda de caixa violada para não atribuir custódia à Irmandade dos Corvos além do que já estava firmado; a caixa fica apartada sob responsabilidade de quem a trouxe, diante da testemunha.

```text
Ficam aceitos o Capitão Arven Solkar, Marek Thalen, Iram Velkor e os quatro lacres descritos para a entrega em Raven’s Cross. Doze guardas no pátio; nenhum deles na sala de conta.

Arven responderá pela disciplina. Marek responderá pelas caixas. Iram responderá pelo registro dos lacres. As marcas SOL-I, AST-II, REG-III e CAL-IV serão conferidas antes de qualquer lâmina tocar cera. Se uma caixa chegar aberta, ou se a marca divergir desta carta, ela não será manuseada; ficará apartada, sob guarda de quem a trouxe e diante da testemunha da Irmandade dos Corvos, até eu receber o aviso e mandar ordem nova.

Eol, Belegue e Ritolun entrarão depois da conferência dos nomes. Vossos carregadores não entram por necessidade, nem vosso escrivão por zelo. Já perdi candidatos por uma exceção pequena demais para parecer perigosa; não repetirei esse erro quando a noite levanta mortos e ninguém sabe ainda qual preço foi cobrado.

A documentação de All Marifh sobre Krythos será recebida em lacre separado e guardada sem leitura até a conta do céu terminar. Primeiro mediremos o que parou diante do sol. Depois abriremos cais, velas, carroças e estandartes.

Trazei as quatro caixas a Raven’s Cross conforme firmado, com Arven no pátio e Iram pronto para ler os lacres em voz alta.
```

