import type { ValdrenPeople } from "./types.js";

/**
 * Os sete povos jogáveis de Valdren.
 *
 * Todos já existiam no canon antes deste guia: cada um tem Casa, território e
 * história. Nenhum foi inventado para completar uma lista.
 *
 * Nenhum inventa mecânica, tampouco. Cada povo aponta para uma espécie do SRD
 * 5.2.1 e a reinterpreta — os nomes das linhagens mudam, os efeitos ficam
 * exatamente como estão publicados. Um jogador que chega com um Elf pronto de
 * outra mesa pode jogá-lo em Valdren sem mudar uma linha da ficha.
 *
 * E não existem povos malignos. Existem povos inimigos, o que é diferente:
 * Casco Vermelho é inimigo, algumas tribos praticam coisas horríveis, um culto
 * pode ser maligno — mas ninguém é cruel por nascimento. Cabe um orc herói, um
 * elfo escravocrata, um anão corrupto e um Ulgar fanático na mesma mesa.
 */
export const VALDREN_PEOPLES: ValdrenPeople[] = [
  {
    key: "casa-solarion",
    name: "Solarion",
    species: "Elf",
    homeland: "Deserto de Sahr, com sede em Solythar e a cidade antiga de Sahra-Lun",
    silhouette:
      "Pele em tons bronzeados, dourados, oliva e escuros. Olhos frequentemente muito claros. Roupas longas de tecido extremamente leve, mantos contra a areia, véus cerimoniais e joias geométricas. A arquitetura é branca e dourada, construída em torno de sombra, vento e água — não parece uma cidade élfica, parece uma civilização antiga que aprendeu a viver onde humanos morreriam.",
    culture:
      "Os Solarion acreditam que o universo pode ser lido. Movimento das estrelas, sonhos, padrões de clima e memória são tratados quase como partes de uma mesma ciência, e seus grandes estudiosos não são simplesmente magos: são astrônomos, historiadores, matemáticos e intérpretes de sonhos. Valorizam paciência, memória e precisão acima de talento bruto.\n\nE carregam uma contradição que nenhum deles resolveu. Enxergam-se como uma das civilizações mais esclarecidas de Valdren e vivem cercados pelas ruínas de uma cultura élfica que escravizou os ancestrais dos orcs. A Casa moderna não fala com uma única voz sobre essa herança.",
    customs: [
      "Um Solarion pode receber novos nomes após feitos, fracassos ou juramentos. O nome anterior não desaparece: vira parte de uma sequência que registra a vida inteira.",
      "Debates formais acontecem ao redor de uma lâmpada, e quem fala segura um anel de vidro. Interromper é lido como incapacidade de ouvir.",
      "Água tem valor quase sagrado. Desperdiçá-la diante de um Solarion chega perto de profanação.",
      "Hospitalidade no deserto é inviolável. Um inimigo recebe água e abrigo por uma noite, e volta a ser inimigo ao nascer do sol.",
    ],
    reinterpretation:
      "Trance não é misticismo: é o que permite a um observatório funcionar em turnos ininterruptos por quarenta anos. Keen Senses é o hábito treinado de ler padrões — no céu, no clima ou no rosto de um embaixador. Darkvision é banal para quem trabalha à noite porque o dia é quente demais.",
    renamedOptions: [
      { srd: "High Elf", valdren: "Linhagem do Observatório — os que leem o céu" },
      { srd: "Drow", valdren: "Linhagem da Noite de Sahr — os que trabalham quando o sol se põe" },
      { srd: "Wood Elf", valdren: "Linhagem das Caravanas — os que conhecem a distância entre poços" },
    ],
    classNotes:
      "Wizard e Bard são as classes que Sahra-Lun entende e financia. Um Sorcerer Solarion é constrangedor: a Casa acredita que magia se estuda, e alguém que simplesmente a tem contradiz a tese. Paladin costuma vir dos reformistas que exigem reconhecimento público das antigas escravidões.",
    relations:
      "Mandíbula de Osso os vê através da memória da escravidão, e nenhum discurso Solarion sobre esclarecimento apaga isso. Karasoy disputa tarifas e caminhos. A Casa do Ouro quer o crédito das caravanas. A Ordem dos Três respeita os observatórios e acha Solarion confiante demais em previsões.",
  },
  {
    key: "casa-khazdrun",
    name: "Khazdrun",
    species: "Dwarf",
    homeland: "Khar-Durak, a montanha costeira",
    silhouette:
      "Bronze oxidado, ferro negro, cordas grossas e mecanismos hidráulicos. Barbas presas com peças de metal para trabalhar perto de máquinas. Grandes portões marítimos e docas talhadas na rocha. São engenheiros monumentais de uma civilização de montanha costeira, não anões de taverna.",
    culture:
      "Para os Khazdrun, construir é atividade quase religiosa. Uma parede pode carregar a assinatura de quarenta gerações de pedreiros, e derrubar uma construção antiga sem necessidade é tratado como uma espécie de assassinato histórico.\n\nEles acreditam, literalmente, que a pedra lembra. É essa filosofia — e não caridade — que explica por que foram o povo que preservou os nomes dos orcs escravizados. Se alguém existiu, seu nome merece permanecer.",
    customs: [
      "No nascimento, a criança recebe uma pedra polida da galeria de sua família.",
      "Na maioridade, grava nela o próprio sinal.",
      "Quando um Khazdrun morre, seu nome é inscrito numa parede voltada para o mar, e uma segunda pedra é lançada nas águas: parte da memória permanece, parte segue adiante.",
    ],
    reinterpretation:
      "Stonecunning é a mecânica que mais literalmente encena a crença do povo: você toca a pedra e ela informa. Dwarven Toughness é o corpo de quem trabalha em túnel e doca a vida inteira. Darkvision de 120 pés é o que se espera de quem nasceu dentro da montanha.",
    classNotes:
      "Fighter, Monk e Cleric encaixam sem atrito. Um Wizard Khazdrun costuma ser engenheiro antes de ser mago, e trata magia como mais um sistema a manter. Druid é raro e desconfortável: a montanha é obra, não natureza.",
    relations:
      "Ferrumor é rival e parceiro ao mesmo tempo. A Casa do Ouro quer financiar a expansão das docas. Karasoy tem mitril que os ferreiros Khazdrun estudariam por gerações. A Coroa quer engenheiros, e Khazdrun teme que cooperação temporária vire controle permanente.",
  },
  {
    key: "cla-mandibula-de-osso",
    name: "Mandíbula de Osso",
    species: "Orc",
    homeland: "As terras retomadas depois do Tempo sem Nomes",
    silhouette:
      "Pele cinza, verde-escura, ferrugem ou quase negra. Dentes irregulares, presas evidentes, rostos fortes e assimétricos, corpos densos, cicatrizes. Armadura grosseira de ferro escurecido, couro e osso. São provavelmente o povo de aparência mais brutal de Valdren — e isso é proposital, porque contrasta com quem eles de fato são.",
    culture:
      "Depois de gerações de escravidão sob senhores élficos, os Mandíbula desenvolveram uma cultura quase obsessiva com liberdade pessoal. Correntes são objetos repugnantes. Segurar o braço de um orc contra a vontade dele é uma das piores ofensas que existem.\n\nO contraste é o ponto inteiro deste povo: o mais assustador de se olhar é um dos que mais levam a sério a liberdade individual.",
    customs: [
      "Quando uma criança nasce, o pai ou a mãe pronuncia o nome dela diante de testemunhas, e todos respondem: \"O nome é seu.\" Durante o Tempo sem Nomes, os senhores élficos decidiam até como seus escravos seriam chamados.",
      "Portas de casas orcs tradicionalmente não têm fechadura por dentro.",
      "Prisioneiros comem antes de serem interrogados, porque os ancestrais eram privados de comida.",
    ],
    reinterpretation:
      "Relentless Endurance não é ferocidade: é um povo que já se recusou a morrer uma vez, coletivamente. Adrenaline Rush é o corpo lembrando que correr já foi a diferença entre viver e não viver. Darkvision de 120 pés vem de gerações nas galerias.",
    classNotes:
      "Barbarian é a leitura óbvia e a mais preguiçosa. Rogue, Paladin e Bard rendem muito mais: um orc juramentado, ou um cronista orc que registra nomes, diz algo sobre o povo que um Barbarian não diz. Warlock é perigoso e frequente — um pacto é, afinal, uma corrente que a pessoa escolheu.",
    relations:
      "Com Solarion, a ferida está aberta e é histórica, não pessoal. Com Khazdrun há uma dívida real e reconhecida: foram os anões que guardaram os nomes. Com a Coroa, a relação depende inteiramente de quem senta no trono.",
  },
  {
    key: "grande-casa-ulgar",
    name: "Ulgar",
    species: "Goliath",
    homeland: "Rok'thar, e antes dela Nah'Korah, um mundo que não existe mais",
    silhouette:
      "Gigantes humanoides bovinos, entre 2,1 e 2,5 metros. Pescoços largos, mãos enormes, corpos pesados, grandes chifres. O formato do chifre varia conforme as antigas linhagens de Nah'Korah: alguns curvam para cima, outros lateralmente, outros quase para frente.",
    culture:
      "Tudo na cultura Ulgar nasce de um fato: eles são refugiados de um mundo morto.\n\nUm Ulgar quase nunca descarta alguma coisa. Ferramentas são reparadas por gerações, tecidos têm remendos cerimoniais, e objetos trazidos de Nah'Korah são relíquias familiares. Eles não dizem \"esta espada era do meu avô\". Dizem: \"esta espada existia antes de Valdren.\"\n\nRok'thar tem estruturas construídas em torno de objetos absolutamente comuns de Nah'Korah — uma pedra, uma porta, uma coluna quebrada — porque são das últimas coisas restantes daquele mundo.",
    customs: [
      "A Memória do Céu: crianças aprendem desde cedo como era o céu de Nah'Korah, suas luas, constelações e estações, embora nenhuma delas jamais tenha visto aquilo.",
      "Um Ulgar olhando as estrelas de Valdren pode sentir, a vida inteira, que aquele não é o céu dele.",
    ],
    reinterpretation:
      "Os Ulgar usam o bloco de Goliath do SRD sem nenhuma alteração de efeito. Powerful Build e Large Form são o corpo; o que muda é a origem. Giant Ancestry não descende de gigantes: são as linhagens de Nah'Korah, e o \"boon\" é herança do mundo perdido se manifestando em quem restou.",
    renamedOptions: [
      { srd: "Stone's Endurance", valdren: "Resistência de Pedra — a linhagem que carregou as fundações" },
      { srd: "Fire's Burn", valdren: "Brasa de Nah'Korah — a linhagem que trabalhou as forjas" },
      { srd: "Frost's Chill", valdren: "Frio do Mundo Morto — a linhagem das últimas estações" },
      { srd: "Hill's Tumble", valdren: "Peso de Rok'thar — a linhagem dos construtores" },
      { srd: "Cloud's Jaunt", valdren: "Salto de Névoa — a linhagem que atravessou" },
      { srd: "Storm's Thunder", valdren: "Trovão do Céu Perdido — a linhagem dos que se lembram" },
    ],
    classNotes:
      "Fighter e Barbarian são naturais e um pouco esperados. O Ulgar mais interessante costuma ser Cleric ou Druid de uma fé que perdeu o próprio mundo, ou Bard: alguém cujo trabalho é impedir que Nah'Korah termine de desaparecer.",
    relations:
      "São os recém-chegados de Valdren e sabem disso. Casas que os tratam como mão de obra ganham obediência e nenhuma lealdade. Com os Mandíbula há um entendimento imediato e raramente falado: os dois povos sabem o que é perder o direito ao próprio passado.",
  },
  {
    key: "casa-drakorys",
    name: "Drakorys",
    species: "Dragonborn",
    homeland: "Krythos, no Mar de Bronze",
    silhouette:
      "Corpo reptiliano de civilização militar insular, mais criatura antiga e aristocrática do que cabeça de dragão. Escamas diferentes indicam antigas linhagens dos dragões de Krythos — sem que isso determine personalidade ou aptidão.",
    culture:
      "Os Drakorys cresceram ouvindo que já governaram os céus. E hoje nenhum dragão existe.\n\nÉ uma cultura inteira vivendo à sombra da própria era dourada. Alguns querem restaurá-la. Outros acreditam que os dragões foram exatamente a ruína de Krythos, e que a queda foi o começo de alguma coisa melhor. Essa discussão atravessa famílias.",
    customs: [
      "Linhagem se declara antes do nome próprio em contextos formais.",
      "As escamas de um Drakorys são lidas como um documento — e falsificar essa leitura é crime.",
    ],
    reinterpretation:
      "Draconic Ancestry é herança, não patrono: o dragão que originou a linhagem morreu há muito, e o Breath Weapon é o que sobrou dele. Draconic Flight, que chega no nível 5, é um acontecimento político em Krythos — asas voltaram a aparecer, e alguém vai querer usar isso como argumento.",
    classNotes:
      "Fighter e Paladin dominam a autoimagem da Casa. Um Drakorys Sorcerer é explosivo no sentido político: se o poder dos dragões está voltando por dentro das pessoas, os restauradores ganham a prova que queriam.",
    relations:
      "Krythos é orgulhosa e insular. Khazdrun a respeita como potência naval, o que é quase amizade. A Coroa nunca sabe de que lado Krythos estará até que Krythos decida.",
  },
  {
    key: "casa-euralune",
    name: "Euralune",
    species: "Gnome",
    homeland: "As grandes altitudes, entre penhascos e ninhos",
    silhouette:
      "Pequenos e leves, adaptados à montanha. Mãos e pés proporcionalmente maiores, grande capacidade pulmonar, equilíbrio extraordinário. A arquitetura é extremamente vertical: pontes de corda, plataformas escavadas na rocha, observatórios e ninhos gigantes.",
    culture:
      "Os Euralune são o oposto do gnomo inventor maluco. São um povo das alturas, e a altura organiza tudo — o comércio, a guerra, o casamento e a noção de distância.\n\nPara um Euralune, alguém que passou a vida inteira ao nível do mar é uma figura levemente estranha, como quem nunca saiu de um quarto.\n\nE a maior demonstração de status não é riqueza. É ter o respeito de uma das grandes aves.",
    customs: [
      "Uma dívida se paga subindo: quem deve faz a viagem até a plataforma de quem cobra, por mais alta que seja.",
      "Nomear uma grande ave sem que ela tenha aceitado a pessoa é ridículo, e as crianças aprendem isso rindo de quem tentou.",
    ],
    reinterpretation:
      "Gnomish Cunning é a teimosia de um povo pequeno cercado por potências maiores. O tamanho Small e o equilíbrio explicam a arquitetura vertical, não o contrário. Speak with Animals, na linhagem dos ninhos, é literalmente a relação com as grandes aves — e não garante respeito nenhum: falar com a ave e ser aceito por ela são coisas diferentes.",
    renamedOptions: [
      { srd: "Forest Gnome", valdren: "Linhagem dos Ninhos — os que crescem entre as grandes aves" },
      { srd: "Rock Gnome", valdren: "Linhagem dos Mecanismos — os que mantêm pontes, guinchos e observatórios" },
    ],
    classNotes:
      "Ranger e Rogue aproveitam o terreno melhor que qualquer outra classe. Um Euralune Wizard tende a ser astrônomo, e a Ordem dos Três tem interesse permanente nos observatórios das alturas.",
    relations:
      "Pequenos, ricos em posição e pobres em exército: os Euralune sobrevivem vendendo altura — vigilância, rotas e informação. Todas as Casas grandes já tentaram comprá-los, e nenhuma conseguiu comprá-los por inteiro.",
  },
  {
    key: "povos-humanos",
    name: "Povos humanos",
    species: "Human",
    homeland: "Asterhall, Auremont, Ferrumor, Vargen, Rimerberg, Karasoy e a maior parte do reino",
    silhouette:
      "Não há uma silhueta. Um Vargen de fronteira, uma banqueira da Casa do Ouro em Asterhall e um pastor de Rimerberg não se parecem, não se vestem igual e frequentemente não se entendem.",
    culture:
      "Humanos são a maioria de Valdren e a razão de o reino ser um problema político em vez de um mapa. As Casas humanas competem entre si com mais violência do que competem com qualquer outro povo, e a Coroa passa a maior parte do tempo administrando isso.\n\nPara um personagem humano, a pergunta que importa nunca é a espécie. É de qual Casa ele vem, e o que aquela Casa deve ou cobra dele.",
    customs: [
      "A lealdade se declara pela Casa antes do reino, e todo mundo finge que não é assim.",
      "O nome de família carrega dívida: heranças e obrigações passam junto com ele.",
    ],
    reinterpretation:
      "Resourceful, Skillful e Versatile descrevem exatamente o que humanos são em Valdren: adaptáveis, presentes em toda parte e definidos pelo que treinaram, não pelo que nasceram sendo.",
    classNotes:
      "Todas as classes cabem. É o povo com menos atrito mecânico e mais atrito político — nenhuma escolha de classe surpreende, e toda escolha de Casa cobra alguma coisa.",
    relations:
      "Com os outros povos, depende inteiramente da Casa. Vargen e Rimerberg convivem com Karasoy na fronteira; Asterhall trata Solarion como potência estrangeira; a Casa do Ouro trata todo mundo como crédito.",
  },
];
