export interface DefaultWikiEntry {
  section: string;
  title: string;
  body: string;
  order: number;
}

/**
 * Curated, player-facing lore of Valdren, drawn from the campaign bible and the
 * world cosmology document. Covers the Great Houses and cities, the undead and
 * the Mists, plus the wider cosmology: the sky, religions, magic, peoples,
 * creatures, customs and the calendar. Only public knowledge is included — the
 * secret motivations and mysteries (the true origin of the Mists, the
 * antagonist, which faith is "correct") are deliberately left ambiguous so
 * players discover them through play. The Admin seeds these into the living
 * wiki and can then edit, expand or remove them as the campaign evolves.
 */
export const DEFAULT_WIKI_ENTRIES: DefaultWikiEntry[] = [
  // ── Histórias Antigas ────────────────────────────────────────────────
  {
    section: "historias",
    title: "O Inverno dos Mortos",
    order: 0,
    body: `O Reino de Valdren está preso entre montanhas, mares congelados e as Brumas de Ravenloft.

Durante gerações, o Norte foi considerado uma região selvagem: pequenos clãs, fortalezas isoladas e tribos que raramente obedeciam à Coroa. Então o inverno chegou cedo.

As primeiras fortalezas deixaram de enviar mensagens. Depois vieram os refugiados, contando que aldeias inteiras haviam sido destruídas por homens mortos. Poucos acreditaram neles.

Agora, um exército de cadáveres avança para o sul. No comando está uma figura conhecida apenas como o Rei Pálido.`,
  },
  {
    section: "historias",
    title: "Prólogo: Trezentos Anos Cercados",
    order: 1,
    body: `Durante quase trezentos anos, o Reino de Valdren sobreviveu cercado pelas Brumas.

Ao norte, montanhas cobertas de neve protegiam o reino das terras selvagens. Ao sul, navios navegavam por uma costa estreita antes de encontrarem a mesma parede branca e silenciosa. Os habitantes de Valdren aprenderam a não questionar as fronteiras do mundo.

Por gerações, o maior perigo de Valdren não foi sobrenatural. Foram as guerras entre nobres, as colheitas ruins, os invernos rigorosos e as antigas disputas entre as Grandes Casas. O reino cresceu fragmentado, sustentado por alianças frágeis e pela certeza de que nenhuma Casa sobreviveria sozinha.

Então chegaram as primeiras notícias do Norte. Uma aldeia desapareceu. Uma patrulha não retornou. Uma fortaleza afirmou que homens mortos caminhavam pela neve. Quando a Fortaleza de Varn deixou de responder, ninguém enviou um exército.

Agora o inverno chegou três meses antes do esperado, e milhares de pessoas caminham para o sul. Atrás delas vem um exército de mortos.`,
  },
  {
    section: "historias",
    title: "O Conselho do Trono",
    order: 2,
    body: `O rei Edric III faleceu durante o último verão, após uma doença breve. Seu único filho, o príncipe Alaric, tem apenas nove anos.

Até que Alaric alcance a idade de assumir a Coroa, Valdren é governada pelo Conselho do Trono, formado pelas Casas e instituições mais poderosas do reino.

A princípio, a transição aconteceu sem guerra. A Casa Valerius assumiu a regência. A Casa Vargen permaneceu responsável pela fronteira norte. A Casa Auremont garantiu o abastecimento das cidades. A Guilda do Ferro Negro continuou armando os soldados. A Ordem do Sino Pálido pediu calma. A Irmandade dos Corvos manteve as mensagens circulando entre regiões cada vez mais desconfiadas.

Se as Grandes Casas não agirem juntas, cada soldado perdido tornará o inimigo ainda mais forte.`,
  },

  // ── Cidades Importantes / Regiões ────────────────────────────────────
  {
    section: "cidades",
    title: "As Marcas do Norte",
    order: 0,
    body: `Uma região de montanhas, florestas de pinheiros e fortalezas isoladas, controlada principalmente pela Casa Vargen.

As Marcas protegem o restante do reino, mas possuem pouca agricultura e dependem de provisões enviadas pelo sul. A Fortaleza de Varn era a principal defesa da Estrada Branca — sua queda deixou o caminho aberto para o interior do reino.`,
  },
  {
    section: "cidades",
    title: "Os Campos Dourados",
    order: 1,
    body: `As terras mais férteis de Valdren, controladas pela Casa Auremont. Produzem a maior parte dos cereais, vegetais e animais que alimentam a população.

Os Campos Dourados não possuem grandes muralhas. Caso o exército do Rei Pálido alcance a região, o reino poderá perder seus alimentos antes mesmo de perder a guerra.`,
  },
  {
    section: "cidades",
    title: "O Vale da Coroa e Asterhall",
    order: 2,
    body: `A região central do reino, onde ficam a capital, as grandes cidades, as estradas comerciais e as propriedades da Casa Valerius.

A capital, Asterhall, é cercada por muralhas antigas e abriga o jovem príncipe Alaric e o Grande Templo da Ordem do Sino Pálido.`,
  },
  {
    section: "cidades",
    title: "As Montanhas de Ferro",
    order: 3,
    body: `Região de minas, pedreiras e cidades industriais. A Guilda do Ferro Negro controla a maior parte das minas e oficinas.

Quase todas as armas, ferramentas e peças de metal usadas em Valdren passam por suas mãos.`,
  },
  {
    section: "cidades",
    title: "A Costa das Brumas",
    order: 4,
    body: `Uma faixa de portos, pequenas cidades e estradas próximas às fronteiras nebulosas do domínio.

A região é essencial para o comércio interno e para o transporte de mensagens. É também onde a Irmandade dos Corvos possui sua maior influência.`,
  },

  // ── As Casas ─────────────────────────────────────────────────────────
  {
    section: "casas",
    title: "Casa Vargen — Os Lobos do Norte",
    order: 0,
    body: `Governa as Marcas do Norte há mais de duzentos anos. Seus soldados defendem as passagens das montanhas e mantêm as fortalezas que separam o coração de Valdren das terras selvagens.

Não é a Casa mais rica nem a mais influente — seus castelos são austeros e seus exércitos dependem dos alimentos da Casa Auremont. Mas nenhuma outra Casa conhece melhor as estradas e os perigos do Norte.

Símbolo: um lobo cinzento diante de uma montanha branca.
Lema: "Primeiro a muralha. Depois o homem."
Líder: Lady Elira Vargen, senhora da Fortaleza de Droskar e comandante das forças do Norte.`,
  },
  {
    section: "casas",
    title: "Casa Auremont — Os Senhores da Colheita",
    order: 1,
    body: `Controla as terras mais produtivas de Valdren. Seus campos alimentam a capital, suas caravanas abastecem os exércitos e seus celeiros determinam quanto tempo o reino pode resistir a um cerco.

Os Auremont evitam guerras sempre que possível; sua influência vem do controle de recursos, não de grandes exércitos. Muitos os acusam de usar a fome como instrumento político — eles respondem que homens armados ainda precisam comer.

Símbolo: um veado dourado sobre um campo verde.
Lema: "Tudo vive da terra."
Líder: Lorde Marius Auremont, senhor dos Campos Dourados.`,
  },
  {
    section: "casas",
    title: "Casa Valerius — O Sangue da Coroa",
    order: 2,
    body: `Possui laços antigos com a família real. Seus membros serviram como regentes, conselheiros e diplomatas por gerações. Após a morte do rei Edric III, foi a Casa Valerius que assumiu a proteção do príncipe Alaric e a administração de Valdren.

Para seus aliados, são a única força capaz de impedir uma guerra civil. Para seus críticos, usam a infância do príncipe para controlar o reino.

Símbolo: uma coroa de prata sobre um fundo azul-escuro.
Lema: "O reino acima da Casa."
Líder: Lady Celene Valerius, regente de Valdren e protetora do jovem príncipe.`,
  },
  {
    section: "casas",
    title: "Guilda do Ferro Negro — Os Mestres das Fornalhas",
    order: 3,
    body: `Não é uma Casa nobre, mas uma confederação de mineradores, ferreiros, pedreiros, engenheiros e comerciantes que controla a maior parte da produção de armas e ferramentas de Valdren.

Sem a Guilda, muralhas não são reparadas, espadas não são forjadas e pontes destruídas não são reconstruídas. A nobreza depende da Guilda, mas raramente a trata como igual — e os trabalhadores não esqueceram isso.

Símbolo: um martelo negro diante de uma chama vermelha.
Lema: "O reino permanece onde o ferro resiste."
Líder: Mestre Torren Krail, primeiro-ferreiro e representante da Guilda no Conselho.`,
  },
  {
    section: "casas",
    title: "Ordem do Sino Pálido — Guardiões dos Vivos e dos Mortos",
    order: 4,
    body: `Administra templos, hospitais, cemitérios e casas de acolhimento. Seus sacerdotes registram nascimentos e mortes, cuidam dos feridos e conduzem os ritos funerários de quase toda a população.

Em tempos de paz, a Ordem aconselha a Coroa. Em tempos de crise, pode transformar medo em esperança — ou em fanatismo.

Símbolo: um sino prateado cercado por seis velas.
Lema: "Todo sino deve tocar uma última vez."
Líder: Madre Ysabet Voss, guardiã do Grande Templo de Asterhall.`,
  },
  {
    section: "casas",
    title: "Irmandade dos Corvos — Aqueles que Sabem Primeiro",
    order: 5,
    body: `Controla mensageiros, informantes, guias, contrabandistas e espiões por todo o reino. Começou como uma rede de entregadores criada para atravessar as estradas perigosas próximas às Brumas e tornou-se uma organização capaz de descobrir segredos antes mesmo que seus donos percebam que os perderam.

As Casas utilizam seus serviços e, ao mesmo tempo, desconfiam dela.

Símbolo: um corvo negro carregando uma chave.
Lema: "Toda estrada conta uma verdade."
Líder: Nera Corvin, mestra dos mensageiros e representante da Irmandade.`,
  },

  // ── Os Mortos-Vivos ──────────────────────────────────────────────────
  {
    section: "mortos-vivos",
    title: "O Rei Pálido",
    order: 0,
    body: `No comando do exército dos mortos está uma figura que os sobreviventes chamam de Rei Pálido. Ninguém sabe seu verdadeiro nome.

Alguns dizem que foi um antigo rei do Norte que retornou para reclamar Valdren. Outros afirmam que é um feiticeiro vindo de além das Brumas. Há quem diga que ele nunca foi humano.

Os poucos estudiosos que compreendem a criatura usam uma palavra mais antiga: Lich. Seu poder aumenta a cada pessoa morta, e os soldados que caem defendendo o reino levantam-se novamente para lutar ao seu lado.

O Conselho não sabe quem ele é, de onde veio, onde está seu filactério, nem por que escolheu Valdren.`,
  },
  {
    section: "mortos-vivos",
    title: "O Exército dos Mortos",
    order: 1,
    body: `Os mortos marcham sob os estandartes das fortalezas que destruíram. Entre eles estão soldados desaparecidos, camponeses enterrados no último inverno e guerreiros mortos há muitas gerações.

O exército cresce a cada batalha: quem morre enfrentando os mortos levanta-se antes do amanhecer. Alguns cadáveres usam moedas, armaduras e símbolos jamais vistos em Valdren, e alguns falam línguas que nenhum sábio consegue identificar.`,
  },

  // ── As Brumas ────────────────────────────────────────────────────────
  {
    section: "brumas",
    title: "As Brumas de Ravenloft",
    order: 0,
    body: `As Brumas cercam Valdren desde antes de qualquer memória viva. Estradas que entram profundamente nelas podem retornar ao ponto de partida, desaparecer por semanas ou levar viajantes a lugares que não existem em nenhum mapa.

Os habitantes de Valdren aprenderam a não questionar as fronteiras do mundo — as Brumas estavam ali antes deles e provavelmente continuarão ali depois que todos estiverem mortos.

Agora, algo impossível acontece: a influência do Rei Pálido parece atravessar as Brumas. Mortos-vivos de outros Domínios do Pavor começaram a aparecer em Valdren, e viajantes falam de cadáveres marchando dentro das próprias Brumas, seguindo estradas que não existem.`,
  },

  // ── Cosmologia ───────────────────────────────────────────────────────
  {
    section: "cosmologia",
    title: "O mundo conhecido",
    order: 0,
    body: `Para a maioria dos habitantes, Valdren não é apenas um reino — é o mundo inteiro que pode ser alcançado.

A ilha tem aproximadamente o tamanho da Inglaterra. Ao sul, suas costas encontram um oceano frio e escuro, cercado por uma muralha de Brumas. Ao norte, montanhas, geleiras e tempestades permanentes tornam qualquer viagem quase impossível.

Os mapas mais antigos mostram terras além do mar — reinos distantes, desertos, impérios élficos e cidades sobre montanhas flutuantes. Ninguém sabe se esses lugares ainda existem, se pertencem ao passado ou se foram invenções de cartógrafos.

Navios que tentam atravessar as Brumas normalmente retornam ao mesmo porto, desaparecem ou surgem semanas depois em outro ponto da costa. Por isso, os marinheiros dizem: "Todo caminho que deixa Valdren acaba encontrando Valdren novamente."`,
  },
  {
    section: "cosmologia",
    title: "Os três estados da existência",
    order: 1,
    body: `A filosofia mais difundida em Valdren divide a existência em três estados: a Carne, o Eco e o Silêncio.

A Carne é a vida material: corpo, desejo, fome, dor, prazer, família e dever. É considerada imperfeita, mas necessária — é nela que as escolhas são feitas.

O Eco é aquilo que permanece no mundo após a morte: memória, influência ou presença. Um nome lembrado, uma promessa não cumprida, uma casa construída ou uma injustiça podem manter esse Eco por gerações. Nem todo Eco é um fantasma — uma tradição familiar, uma canção ou uma antiga rivalidade também são manifestações dele.

O Silêncio é o destino final da alma, quando ela abandona completamente o mundo. Para a Igreja do Sino, é descanso; para tradições élficas, união com algo maior; para povos do Norte, o momento em que a pessoa se torna parte da neve, da pedra e do vento. Os mortos inquietos são os que não conseguiram deixar o Eco e alcançar o Silêncio.`,
  },
  {
    section: "cosmologia",
    title: "A alma e os mortos",
    order: 2,
    body: `Quase todas as culturas de Valdren acreditam que existe uma diferença entre o corpo morto e a alma do falecido. Essa distinção é importante: um cadáver que volta a caminhar não é necessariamente a pessoa que viveu dentro dele.

Existem muitas teorias — o corpo pode ser movido por magia, um espírito estranho pode ocupá-lo, apenas um fragmento de memória pode permanecer, a própria alma pode estar presa, ou a criatura pode apenas imitar quem morreu.

Por isso, os ritos funerários são levados muito a sério. Costuma-se fechar os olhos do morto, cobrir espelhos, tocar um sino, colocar sal sobre a língua, amarrar uma fita com o nome da família, vigiar o corpo até o enterro e manter uma vela acesa por três noites. Todos têm o mesmo objetivo: permitir que o morto reconheça que sua vida terminou e encontre o caminho para o Silêncio.`,
  },
  {
    section: "cosmologia",
    title: "Conhecimento e verdade",
    order: 3,
    body: `A cosmologia de Valdren permanece parcialmente contraditória. Nenhuma instituição conhece toda a verdade.

A Igreja possui textos antigos, mas pode interpretá-los incorretamente. Os elfos têm memórias longas, mas também preservam seus próprios interesses. Os estudiosos explicam parte dos fenômenos, mas ignoram aspectos espirituais. O povo mantém tradições úteis sem compreender suas origens.

A diferença entre fé, mito, superstição, história e realidade sobrenatural permanece ambígua. Os jogadores descobrem o mundo por meio de ruínas, textos, testemunhos, rituais, artefatos, sonhos, decisões e versões conflitantes dos mesmos acontecimentos.`,
  },

  // ── O Céu de Valdren ─────────────────────────────────────────────────
  {
    section: "ceu",
    title: "O céu de Valdren",
    order: 0,
    body: `Valdren possui sol, lua e estrelas, mas o céu nem sempre se comporta de maneira previsível.

Durante certas noites, constelações desconhecidas aparecem sobre o reino. Em outras, estrelas familiares desaparecem. Existem relatos de luas duplas, eclipses sem previsão e auroras observadas muito ao sul das geleiras.

Os estudiosos reconhecem sete constelações principais, cada uma carregada de significado para o povo de Valdren.`,
  },
  {
    section: "ceu",
    title: "As sete constelações",
    order: 1,
    body: `A Coroa Quebrada — um círculo de estrelas dividido ao meio. Associada a reis, sucessão e queda de dinastias. Crianças nascidas sob sua posição mais alta são consideradas destinadas à liderança ou à tragédia.

O Lobo — visível principalmente no inverno. Associada à proteção, à caça, à família e à sobrevivência. No Norte, algumas famílias deixam carne do lado de fora na primeira noite em que o Lobo aparece.

O Sino — estrelas fracas que brilham mais antes do amanhecer. Para os religiosos, representa o chamado que desperta as almas; para os supersticiosos, anuncia mortes importantes.

O Corvo — referência de direção para marinheiros. Simboliza memória, segredo e notícia. Quando some do céu, acredita-se que mentiras estão sendo contadas nos salões do poder.

A Ponte — uma linha curva que liga duas regiões do céu. Associada a viagens, alianças, casamentos e passagens entre mundos.

A Forja — estrelas avermelhadas veneradas por ferreiros e mineiros. A Guilda do Ferro Negro vê seu surgimento como bom presságio para grandes obras.

A Vela Apagada — uma região escura onde quase nenhuma estrela é visível. Os astrônomos falam em ausência natural; a população acredita que algo ocupa aquele espaço e impede a luz de atravessar.`,
  },

  // ── Religiões ────────────────────────────────────────────────────────
  {
    section: "religioes",
    title: "Os deuses e as religiões",
    order: 0,
    body: `Valdren não possui uma única fé universal. Existem igrejas organizadas, tradições familiares e crenças muito mais antigas que o próprio reino.

Nenhuma religião consegue provar completamente que sua interpretação está correta. Milagres acontecem, mas também podem ser resultado de magia, coincidência ou forças desconhecidas.`,
  },
  {
    section: "religioes",
    title: "A Igreja do Sino",
    order: 1,
    body: `A maior instituição religiosa de Valdren é a Igreja do Sino. Ela ensina que a criação começou quando o Primeiro Sino foi tocado no vazio, e seu som separou luz e escuridão, vida e morte, memória e esquecimento, ordem e caos. Cada ser vivo seria uma pequena reverberação daquele primeiro som. Quando alguém morre, o sino funerário ajuda sua alma a reencontrar o ritmo original da criação e seguir para o Silêncio.

A doutrina reconhece os Sete Toques: Nascimento (toda vida começa como resposta a um chamado), Nome (ser nomeado é ocupar um lugar no mundo), Dever (toda pessoa tem responsabilidade diante dos demais), Memória (os mortos permanecem enquanto suas ações são lembradas), Julgamento (toda escolha produz consequência), Despedida (aquilo que terminou deve ser libertado) e Silêncio (o descanso final não deve ser interrompido).

A Igreja tem grande influência política e mantém hospitais, mosteiros, registros de nascimento e cemitérios. Há divisões internas: alguns sacerdotes pregam misericórdia; outros creem que disciplina, confissão e punição são necessárias para impedir o caos.`,
  },
  {
    section: "religioes",
    title: "Os Antigos Nomes",
    order: 2,
    body: `Antes da Igreja do Sino, os habitantes de Valdren já veneravam forças associadas à natureza, chamadas coletivamente de Antigos Nomes. Não existe lista oficial — cada região tem suas tradições. Entre os mais conhecidos:

A Mãe sob a Terra — do solo, das cavernas, dos minerais e dos mortos enterrados. Mineiros deixam a primeira moeda encontrada dentro da pedra, como pagamento.

O Pai das Tempestades — venerado por pescadores e moradores da costa. Não é bondoso nem maligno; é uma força que se respeita.

A Senhora dos Caminhos — protetora de viajantes, mensageiros, comerciantes e fugitivos. Pequenos montes de pedra são erguidos em cruzamentos em sua homenagem.

O Lobo Branco — símbolo de proteção, inverno, caça e lealdade. Importante nas Marcas do Norte. Dizem que conduz crianças perdidas para casa — ou devora quem abandona a própria família.

A Senhora do Último Fogo — invocada no inverno quando resta pouca madeira ou alimento. Representa hospitalidade, sacrifício e a obrigação de dividir o último recurso com quem está sob o mesmo teto.

A Igreja tolera muitos desses cultos como tradições locais, mas considera heréticos os que fazem sacrifícios ou dizem receber ordens diretas dessas entidades.`,
  },

  // ── Magia ────────────────────────────────────────────────────────────
  {
    section: "magia",
    title: "As quatro fontes da magia",
    order: 0,
    body: `A magia existe em Valdren, mas não é completamente compreendida. Não funciona como ciência exata: mesmo rituais conhecidos produzem resultados diferentes conforme o lugar, a intenção, o preço pago e as forças envolvidas. Os estudiosos dividem-na em quatro fontes.

Magia da Forma — altera a matéria e as forças naturais: fogo, gelo, luz, movimento, transformação e proteção. Estudada por magos, alquimistas e artesãos.

Magia do Sangue — usa a ligação entre corpo, herança, identidade e sacrifício. Não é necessariamente maligna, mas é temida e muitas vezes proibida. Pode revelar parentesco, fortalecer juramentos, curar ou amaldiçoar.

Magia do Nome — baseia-se na ideia de que conhecer o nome verdadeiro de algo concede poder sobre sua natureza. Usada em juramentos, selos, exorcismos e encantamentos. Muitas famílias nobres protegem nomes, títulos e genealogias antigas.

Magia do Véu — ligada a sonhos, espíritos, memória, profecia e Brumas. É a forma mais perigosa e imprevisível. Quem a pratica pode ver acontecimentos distantes, caminhar em sonhos ou falar com Ecos — mas pode perder memórias, identidade ou a capacidade de distinguir visão e realidade.`,
  },
  {
    section: "magia",
    title: "O preço da magia",
    order: 1,
    body: `Em Valdren, toda magia significativa possui algum preço. Nem sempre é sangue ou morte: pode ser exaustão, perda de memória, anos de vida, um juramento, uma dívida espiritual, um objeto importante, uma mudança permanente no corpo, atenção indesejada ou consequências que aparecem apenas muito tempo depois.

A magia não resolve problemas sem criar novas complicações. Um ritual pode salvar uma cidade da fome, mas tornar o solo estéril no ano seguinte. Uma visão pode revelar um traidor, mas mostrar também um futuro que o observador tentará desesperadamente evitar.`,
  },

  // ── Povos de Valdren ─────────────────────────────────────────────────
  {
    section: "povos",
    title: "Humanos",
    order: 0,
    body: `São o povo mais numeroso e politicamente dominante de Valdren. Possuem grande diversidade cultural entre a capital, o Norte, as regiões agrícolas, as montanhas e a costa.`,
  },
  {
    section: "povos",
    title: "Elfos",
    order: 1,
    body: `Algumas comunidades élficas vivem em florestas antigas, bairros urbanos ou famílias nobres. Muitos elfos acreditam que a ilha já existiu em outro lugar e que as Brumas a separaram de um mundo anterior.

Sua longevidade faz com que guardem memórias de eventos que os registros humanos tratam como lendas.`,
  },
  {
    section: "povos",
    title: "Anões",
    order: 2,
    body: `Concentram-se nas Montanhas de Ferro e em cidades ligadas à mineração, engenharia e comércio.

Para muitos anões, pedra e metal possuem memória: uma ferramenta bem construída preservaria algo do caráter de quem a produziu.`,
  },
  {
    section: "povos",
    title: "Povos menores",
    order: 3,
    body: `Valdren também abriga comunidades de halflings, gnomos, meio-elfos, descendentes de gigantes, famílias tocadas pela magia e outros grupos.

Esses povos não formam necessariamente nações separadas. Muitos vivem há séculos misturados às cidades e Casas humanas.`,
  },

  // ── Criaturas e Lendas ───────────────────────────────────────────────
  {
    section: "criaturas",
    title: "Criaturas místicas",
    order: 0,
    body: `Nem toda criatura sobrenatural é maligna. Algumas são animais transformados pela magia; outras parecem pertencer a uma ordem mais antiga do mundo.

Entre as criaturas conhecidas: cervos com galhadas luminosas, corvos capazes de repetir frases nunca ouvidas, lobos brancos que não deixam pegadas, espíritos domésticos, serpentes de rios, gigantes das geleiras, sombras que imitam viajantes, árvores que guardam memórias e criaturas que assumem a aparência de pessoas desaparecidas.

A distinção entre monstro, espírito, animal e divindade local depende muito da região e de quem conta a história.`,
  },
  {
    section: "criaturas",
    title: "Sonhos",
    order: 1,
    body: `Em Valdren, sonhos são considerados importantes. A maioria não tem significado sobrenatural, mas certos sonhos são compartilhados por várias pessoas ou deixam marcas físicas. Os estudiosos os classificam em três categorias.

Sonhos de Eco — mostram memórias do passado, nem sempre pertencentes ao sonhador.

Sonhos de Presságio — apresentam possibilidades futuras por meio de símbolos. Não são previsões exatas e muitas vezes mudam quando alguém tenta impedi-los.

Sonhos de Travessia — o sonhador visita um lugar desconhecido, conversa com alguém ou retorna carregando um objeto, ferimento ou informação. A Igreja recomenda cautela: nem toda entidade encontrada em um sonho é aquilo que afirma ser.`,
  },

  // ── Costumes e Superstições ──────────────────────────────────────────
  {
    section: "costumes",
    title: "Juramentos",
    order: 0,
    body: `Juramentos têm grande importância cultural e possivelmente mágica. Promessas feitas diante de um sino, uma sepultura, uma chama, uma espada ancestral, sangue compartilhado, uma ponte ou as Brumas são consideradas especialmente poderosas.

Quebrar um juramento não provoca necessariamente uma maldição imediata, mas histórias de famílias destruídas por promessas rompidas são comuns. Por isso, nobres experientes escolhem cuidadosamente as palavras usadas em alianças e tratados.`,
  },
  {
    section: "costumes",
    title: "Lugares liminares",
    order: 1,
    body: `Alguns lugares são considerados liminares — pontos em que as fronteiras entre os estados da existência ficam mais fracas: pontes, portas, praias, cavernas, ruínas, cemitérios, cruzamentos, florestas cobertas por névoa, campos de batalha e casas onde muitas pessoas morreram.

Nesses lugares, Ecos podem ser mais fortes, sonhos mais claros e a magia mais imprevisível. Isso explica por que pontes e portões têm tanta importância simbólica em Valdren: não representam apenas passagem física, mas mudança entre um estado e outro.`,
  },
  {
    section: "costumes",
    title: "Festividades",
    order: 2,
    body: `A Noite dos Sinos — no início da primavera, os sinos das cidades são tocados para marcar o fim do período mais perigoso do inverno.

A Mesa Aberta — festival da colheita. Cada família deve oferecer ao menos um lugar à mesa para um viajante, pobre ou desconhecido.

A Vigília dos Nomes — no final do outono, os nomes dos mortos são lidos em voz alta. Acredita-se que lembrar corretamente os mortos ajuda seus Ecos a permanecerem em paz.

O Último Fogo — encerra o ano. As famílias apagam todas as chamas da casa e acendem uma nova fogueira a partir de uma chama comunitária, lembrando que ninguém sobrevive ao inverno sozinho.`,
  },
  {
    section: "costumes",
    title: "Superstições comuns",
    order: 3,
    body: `Em Valdren, muitas superstições são tratadas quase como regras de sobrevivência:

— Nunca siga uma voz conhecida dentro da névoa sem ver o rosto de quem chama.
— Não conte os mortos antes do amanhecer.
— Não atravesse uma ponte depois que um sino tocar sozinho.
— Não aceite comida de alguém que não deixa pegadas.
— Não diga seu nome completo diante de um espelho quebrado.
— Se um corvo bater três vezes na janela, espere antes de abrir a porta.
— Sempre deixe uma cadeira vazia durante o Último Fogo.
— Nunca enterre uma pessoa sem algum objeto que tenha pertencido a ela.
— Se uma criança falar sobre uma casa que nunca visitou, anote o que ela diz.
— Quando a Bruma cobrir uma estrada, retorne pelo mesmo caminho, mesmo que pareça impossível.

Nenhuma dessas crenças é confirmada. Algumas podem ser coincidência; outras podem conter fragmentos de conhecimento antigo.`,
  },

  // ── Calendário ───────────────────────────────────────────────────────
  {
    section: "calendario",
    title: "Calendário e eras",
    order: 0,
    body: `O calendário oficial de Valdren é contado a partir da fundação de Asterhall. O ano tem doze meses, divididos em quatro estações.

Primavera — Degelo, Semeadura, Florescimento.
Verão — Sol Alto, Frutos, Colheita Clara.
Outono — Colheita Escura, Folhas, Cinzas.
Inverno — Primeira Neve, Longa Noite, Último Fogo.

O último dia do ano ocorre ao final de Último Fogo. Durante essa noite, as famílias mantêm uma vela acesa e evitam dizer o nome completo dos mortos.`,
  },
];
