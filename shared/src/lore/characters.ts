/**
 * O elenco de cada Casa: quem lidera, quem herda, quem discorda.
 *
 * Gerado a partir do cânone por backend/scripts/seed-house-characters.mjs e
 * versionado à mão. Cânone do mundo, não estado de partida: quem está vivo
 * sai de `isDeadInChronicle`, em mortality.ts.
 *
 * O que cada figura quer e o que ela esconde mora em `characterSecrets.ts`,
 * que o frontend não importa. Aqui fica só o que a ficha pública pode mostrar.
 */
export interface HouseFigure {
  name: string;
  role: string;
  description: string;
}

export interface HouseCharacter extends HouseFigure {
  wants: string;
  hides: string;
}

/**
 * Um id estável para um personagem, derivado do nome.
 *
 * O canon não guarda id — o nome é a fonte. Endereçar uma carta a uma pessoa
 * precisa de uma chave curta e estável que sobreviva a reordenar o elenco, e
 * um slug do nome é isso. Só a primeira parte do nome entra: vários nomes aqui
 * embutem o cargo depois de uma vírgula ("Lorde Marcien Auremont, Comandante
 * da Cavalaria…"), e o cargo não faz parte da identidade.
 */
export function characterId(name: string): string {
  return name
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const HOUSE_CHARACTERS: Record<string, HouseFigure[]> = {
  "casa-auremont": [
    {
      "name": "Lorde Marcien Auremont, Comandante da Cavalaria e Herdeiro de Aurivale",
      "role": "Líder",
      "description": "Lorde Marcien é o carismático líder da Casa Auremont, conhecido por sua destreza em montar e comandar a cavalaria. Apesar de sua aparência confiante, ele carrega o peso das expectativas de sua família e as complexidades da política de Aurivale."
    },
    {
      "name": "Duquesa Isolde Auremont",
      "role": "Governante",
      "description": "Isolde é uma mulher de forte presença e inteligência afiada, respeitada por seus conselheiros e temida por seus adversários. Sua habilidade em manobrar as intrigas da corte a mantém à frente, mas seu coração está dividido entre as tradições e a necessidade de inovação."
    },
    {
      "name": "Dama Celestine de Vaux",
      "role": "Mestra dos Celeiros",
      "description": "Celestine é uma mulher prática, com um olho atento para detalhes, e a responsável por garantir que os celeiros da Casa estejam sempre abastecidos. É respeitada por sua dedicação, mas também é vista como rígida e conservadora por alguns membros da nobreza."
    },
    {
      "name": "Padre-Contador Remy Hal",
      "role": "Responsável por Dízimos e Reservas",
      "description": "Remy é um homem sério e meticuloso, cuja função é garantir que as finanças da Casa estejam sempre em ordem. Embora respeitado, ele é frequentemente visto como um aborrecimento por aqueles que preferem os banquetes e celebrações à matemática precisa de contabilidade."
    },
    {
      "name": "Alena Primeira-Espiga",
      "role": "Representante das Aldeias",
      "description": "Alena é uma líder carismática das aldeias, cuja voz ressoa entre os camponeses e nobres. Ela é uma crítica fervorosa da nobreza, buscando melhores condições para seu povo. Embora respeitada, sua presença é muitas vezes vista como uma ameaça aos interesses dos aristocratas."
    }
  ],
  "casa-do-ouro": [
    {
      "name": "Príncipe Sétimo, Príncipe Sétimo do Ouro",
      "role": "Líder da Casa do Ouro",
      "description": "O Príncipe Sétimo é um homem elegante e paciente, sempre vestido de maneira impecável. Ele é respeitado por seus subordinados, mas sua busca por acordos duradouros com a Coroa é vista com ceticismo por alguns dentro da Casa."
    },
    {
      "name": "Ortiz",
      "role": "Agente e negociador",
      "description": "Ortiz é um servo astuto, sempre presente nas sombras, ouvindo conversas e aconselhando com sabedoria. Embora seja visto apenas como um assistente, sua influência e conhecimento do jogo político são profundos."
    },
    {
      "name": "Mestra Liora Venn",
      "role": "Administradora dos cofres",
      "description": "Mestra Liora é rígida e determinada, defendendo limites estritos para empréstimos. Sua postura inflexível a torna respeitada, mas também temida entre aqueles que buscam crédito."
    },
    {
      "name": "Capitão Jorren Daal",
      "role": "Comandante das escoltas",
      "description": "Capitão Jorren é um veterano destemido e leal, com um olhar atento e calculador. Ele valoriza a segurança acima de tudo, mas é frequentemente desafiado por outros membros da Casa que desejam um enfoque mais agressivo."
    },
    {
      "name": "Dama Seressa Nove-Contas",
      "role": "Líder de um ramo da Casa",
      "description": "Dama Seressa é ambiciosa e carismática, sempre buscando lucrar com as oportunidades, mesmo que isso signifique se aliar a interesses questionáveis. Sua postura agressiva em tempos de guerra a coloca em conflito com a liderança conservadora da Casa."
    },
    {
      "name": "Irmão Calven",
      "role": "Representante da Casa junto à Ordem do Sino",
      "description": "Irmão Calven é um diplomata cauteloso e astuto, conhecido por sua habilidade em lidar com disputas de herança. Ele é frequentemente consultado sobre questões delicadas, mas sente que seu papel é subestimado."
    }
  ],
  "casa-drakorys": [
    {
      "name": "Damaros Drakorys",
      "role": "Strategos da Escama",
      "description": "Líder respeitado, Damaros Drakorys era conhecido por sua sabedoria militar e habilidade em unir as facções da Casa. Ele era visto como um pilar de estabilidade em um momento de incerteza, mas sua morte deixou um vácuo de poder."
    },
    {
      "name": "Ilyra das Cinzas",
      "role": "Sacerdotisa do Primeiro Fogo",
      "description": "Ilyra é uma figura reverenciada pelos draconatos, guiando rituais e cerimônias em honra ao Primeiro Fogo. Ela é respeitada, mas sua visão espiritual muitas vezes entra em conflito com os objetivos pragmáticos do Conselho."
    },
    {
      "name": "Kassian Asa de Bronze",
      "role": "Almirante",
      "description": "Oficial de marinha experiente e carismático, Kassian é visto como um líder natural. Ele mantém a frota da Casa em prontidão, mas desconfia da liderança recente e se preocupa com o futuro da marinha."
    },
    {
      "name": "Myrra Escudo-Partido",
      "role": "Veterana crítica do Conselho",
      "description": "Myrra é uma veterana do exército draconata e conhecida por sua postura firme e crítica em relação ao Conselho. Ela acredita que o Conselho se tornou complacente e que a Casa precisa de mudanças profundas."
    },
    {
      "name": "Leônidas Sal-Negro",
      "role": "Administrador dos celeiros e comércio",
      "description": "Leônidas é um administrador astuto e pragmático, responsável por garantir que os recursos da Casa sejam otimizados. Embora respeitado, sua relação com os outros membros do Conselho é muitas vezes tensa devido a suas opiniões sobre o comércio com Valdren."
    }
  ],
  "casa-euralune": [
    {
      "name": "Lorde Brannic Euralune",
      "role": "Senhor dos Ventos",
      "description": "Lorde Brannic é um líder carismático e respeitado que guia a Casa Euralune com firmeza e visão. Ele é conhecido por sua habilidade de negociar entre as aldeias e por proteger as comunidades com astúcia. Apesar do respeito que recebe, há quem o veja como um tirano disfarçado."
    },
    {
      "name": "Lyra Euralune",
      "role": "Herdeira e druida de hipogrifo prateado",
      "description": "Lyra, filha de Brannic, é uma druida talentosa que se comunica com hipogrifos e defende a harmonia entre as criaturas e os habitantes de Ninho Alto. Apesar de ser amada por muitos, sua visão sobre o Pacto das Alturas a coloca em desacordo com o pai em várias ocasiões."
    },
    {
      "name": "Tobren Penhasco",
      "role": "Mestre das Águias",
      "description": "Tobren é o responsável por treinar as montarias e garantir que as águias estejam sempre em condições de voar. Ele é um homem de poucas palavras, mas suas ações falam por si. Embora respeite Brannic, acredita que suas táticas de banditismo são arriscadas e prejudiciais para a imagem da Casa."
    },
    {
      "name": "Eldra Folhavento",
      "role": "Grã-Druida",
      "description": "Eldra é uma figura sábia e reverenciada entre os druidas, tendo um papel crucial na conexão espiritual entre os habitantes e as criaturas aladas. Ela é uma mediadora entre as aldeias e o Senhor dos Ventos, embora suas opiniões frequentemente desafiem as decisões de Brannic, especialmente quando se trata de combate."
    },
    {
      "name": "Pim Racha-Nuvem",
      "role": "Líder dos patrulheiros",
      "description": "Pim é o comandante dos patrulheiros que protegem Ninho Alto e suas comunidades. Ele é astuto e valente, admirado por sua bravura em batalhas. No entanto, sua lealdade a Brannic é questionável, uma vez que ele frequentemente discorda das táticas de banditismo da Casa."
    },
    {
      "name": "Nessa Três-Sementes",
      "role": "Representante das aldeias pobres",
      "description": "Nessa é uma voz poderosa entre as comunidades mais humildes que compõem a Casa Euralune. Ela é uma defensora incansável dos menos favorecidos e frequentemente se confronta com a liderança da Casa sobre as desigualdades que persistem. Ela se sente pressionada a lutar por seus semelhantes."
    }
  ],
  "casa-ferrumor": [
    {
      "name": "Lady Miriel Ferrumor",
      "role": "Principal Diplomata da Casa Ferrumor",
      "description": "Lady Miriel é a eloquente e inteligente diplomata da Casa Ferrumor, frequentemente envolvida em negociações com outras casas e reinos. Sua habilidade em articular os interesses de sua Casa a torna respeitada, mas também alvo de críticas por sua aproximação cautelosa com rivais."
    },
    {
      "name": "Lorde Aedran Ferrumor",
      "role": "Chefe da Casa Ferrumor",
      "description": "Lorde Aedran é um homem sereno e decidido, que se esforça para restaurar a grandeza marítima de sua Casa. Ele é visto como um líder forte, mas suas decisões muitas vezes são questionadas por aqueles que o veem como excessivamente focado em tradições."
    },
    {
      "name": "Almirante Caelor Ventobranco",
      "role": "Comandante da Frota",
      "description": "Caelor é um experiente comandante naval, respeitado por suas táticas e estratégias. No entanto, sua lealdade à Casa Ferrumor é frequentemente testada por suas dúvidas sobre as decisões do Lorde Aedran."
    },
    {
      "name": "Mestra Sarya Arco-de-Pedra",
      "role": "Arquiteta responsável pelas grandes obras",
      "description": "Sarya é uma arquiteta talentosa, responsável por projetar as grandiosas construções na cidade de Ferrum. Ela é admirada por sua visão, mas sua ambição às vezes causa desentendimentos com os conservadores da Casa."
    },
    {
      "name": "Teren Caladrin",
      "role": "Historiador",
      "description": "Teren é um historiador obcecado por descobrir o destino de Caladris, passando dias na Torre do Horizonte Perdido. Sua busca o torna um tanto isolado, embora sua paixão pela história o faça ser respeitado."
    }
  ],
  "casa-karasoy": [
    {
      "name": "Aylin Karasoy",
      "role": "Mãe da Planície",
      "description": "Aylin era uma líder carismática e respeitada, guiando a Casa Karasoy com sabedoria e força. Sua habilidade em manter a paz e a união entre as mulheres da Casa foi admirada, mas sua morte deixou um vácuo imenso na liderança."
    },
    {
      "name": "Selma Karasoy",
      "role": "Mãe da Planície, irmã de Aylin",
      "description": "Irmã de Aylin, guerreira antes de ser governante, conhecida pela lança e pelo comando das amazonas. Herdou a Casa quando a irmã morreu na Asteria e governa contando: as lanças que restam, as filhas que não voltaram, e as moedas a mais que a Coroa cobra por Karasoy não ter marchado. Não acusa em público — investiga."
    },
    {
      "name": "Yasemin Altunay",
      "role": "Domadora dos Ventos",
      "description": "Yasemin é uma amazona ágil, com uma conexão especial com os cavalos Tempestade Branca. Ela é admirada por sua habilidade em domar até os mais indomáveis e sempre se preocupa com o bem-estar da Casa e de suas montarias."
    },
    {
      "name": "Nahla Altunay",
      "role": "Guardiã da Estrela",
      "description": "Nahla, aos 82 anos, é a voz da experiência e sabedoria da Casa. Com um passado de lutas e vitórias, sua presença é respeitada, mas suas visões sobre o futuro muitas vezes colidem com as ideias mais jovens."
    },
    {
      "name": "Leyla Duas-Rotas",
      "role": "Mestra das Exploradoras",
      "description": "Leyla é a responsável por treinar as exploradoras da Casa, conhecida por suas táticas engenhosas e habilidades de rastreamento. Ela é uma liderança natural, embora tenha seus próprios conflitos com as tradições rígidas da Casa."
    },
    {
      "name": "Derya Sar-Khal",
      "role": "Guardião das Ruínas Antigas",
      "description": "Derya é a guardiã dos conhecimentos ancestrais da Casa, responsável por preservar a história de Sar-Khal. Embora respeitada, ela discorda do foco da Casa em expandir o uso do mitril em vez de fortalecer suas tradições."
    }
  ],
  "casa-khazdrun": [
    {
      "name": "Lorde Thrain Khazdrun",
      "role": "Lorde da Casa Khazdrun",
      "description": "Lorde Thrain era um líder forte e respeitado, mestre em engenharia naval e aclamado por suas decisões. Comandava com firmeza e buscava sempre a harmonia entre os Clãs da Maré e os Clãs de Raiz, mas suas ambições o levaram a assumir riscos que culminaram em sua morte."
    },
    {
      "name": "Lady Brynna Khazdrun",
      "role": "Herdeira da Casa Khazdrun",
      "description": "Brynna é a filha mais velha de Thrain, uma anã determinada que se sente pressionada a preencher os sapatos de seu pai. Apesar de ser respeitada, sua juventude e inexperiência geram desconfiança entre alguns membros do conselho."
    },
    {
      "name": "Durgan Ferrosalto",
      "role": "Mestre de Ofício",
      "description": "Durgan, um ferreiro talentoso e tradicionalista, acredita que as inovações dos estaleiros estão arruinando as tradições ancestrais. Ele é respeitado, mas suas opiniões muitas vezes geram tensão no conselho."
    },
    {
      "name": "Kaldrin Marébrava",
      "role": "Comandante dos Fuzileiros de Doca",
      "description": "Kaldrin é um líder militar carismático e impetuoso, que desafia constantemente as decisões de Brynna, acreditando que ela não está pronta para liderar em tempos de crise. Ele é leal à Casa, mas suas discordâncias frequentemente geram conflitos."
    },
    {
      "name": "Eldra Oreluna",
      "role": "Arquivista",
      "description": "Eldra é a guardiã da história e dos registros da Casa Khazdrun, reconhecida por sua sabedoria. Ela tem acesso a segredos que poderiam desestabilizar o governo atual, mas se sente dividida sobre revelá-los."
    }
  ],
  "casa-rimerberg": [
    {
      "name": "Ser Kael Rimerberg",
      "role": "Representante da Casa Rimerberg",
      "description": "Ser Kael é um líder relutante que tenta manter a Casa unida em tempos de incerteza. Ele é visto como um homem de palavras firmes, mas sua hesitação em agir em nome dos Rimerberg gera desconfiança entre seus pares."
    },
    {
      "name": "Mestre Halm",
      "role": "Guardião do Farol de Gelo",
      "description": "Mestre Halm é um homem idoso e sábio, conhecido por seu conhecimento extenso sobre o clima e o território do norte. Ele é respeitado por seus conhecimentos, mas sua relutância em compartilhar alguns dos antigos rituais de proteção gera desconfiança entre os membros mais jovens da Casa."
    },
    {
      "name": "Capitão Orven Geada",
      "role": "Comandante das patrulhas externas",
      "description": "Capitão Orven é um líder forte e decidido, conhecido por sua bravura nas fronteiras. No entanto, sua crescente desconfiança em relação à liderança de Ser Kael o faz questionar a direção da Casa e suas próprias decisões."
    },
    {
      "name": "Irmã Tessa do Último Sino",
      "role": "Sacerdotisa responsável pelos mortos",
      "description": "Irmã Tessa é uma figura calma e serena, que conforta os que perderam seus entes queridos. Enquanto muitos a veem como uma fonte de consolo, ela carrega um fardo pesado em seu coração, ligada ao destino dos Rimerberg."
    },
    {
      "name": "Lady Ysabet Rimerberg",
      "role": "Administradora das aldeias do sul",
      "description": "Lady Ysabet era uma administradora competente e respeitada, conhecida por sua habilidade em lidar com as necessidades das aldeias. Sua ausência gerou grande preocupação e incerteza entre os súditos da Casa."
    }
  ],
  "casa-solarion": [],
  "casa-valerius": [
    {
      "name": "Lady Celene Valerius",
      "role": "Rainha-Viúva e Regente",
      "description": "A antiga líder da Casa Valerius, Celene é uma figura austera que sempre governou com uma disciplina rígida e uma habilidade inegável de unir rivais. Sua morte deixou um grande vazio na Casa e no reino, com muitos se perguntando se o legado que ela tentou proteger será suficiente para enfrentar a instabilidade recém-chegada."
    },
    {
      "name": "Príncipe Alic Valerius",
      "role": "Herdeiro",
      "description": "Com apenas doze anos, Alic é um menino pálido e introspectivo, que se vê repentinamente no centro da atenção e da responsabilidade. Sua juventude e inocência contrastam com a gravidade da situação que sua Casa enfrenta após a morte de sua mãe."
    },
    {
      "name": "Lord Aelric Roderic",
      "role": "Mestre de Ofício",
      "description": "Um homem experiente e astuto, Aelric é responsável por gerir os assuntos administrativos da Casa Valerius. Ele é respeitado, mas sua maneira direta de lidar com as questões o torna alvo de críticas, especialmente de nobres menos pragmáticos."
    },
    {
      "name": "Dama Elara Voss",
      "role": "Comandante da Guarda Real",
      "description": "Um líder militar respeitado, Elara é forte e decidida, encarregada de proteger Asterhall e a nova regência. Sua lealdade ao reino e à Casa é inquestionável, mas sua visão é muitas vezes vista como radical dentro da corte."
    },
    {
      "name": "Sra. Nerys Thorne",
      "role": "Arquivista",
      "description": "Detentora de um vasto conhecimento sobre a história e a burocracia da Casa, Nerys é uma mulher enigmática que mantém os registros detalhados de todas as decisões e alianças. Sua vida é dedicada a garantir que o passado não seja esquecido."
    }
  ],
  "casa-vargen": [
    {
      "name": "Lady Elira Vargen",
      "role": "Senhora de Droskar",
      "description": "Lady Elira é uma líder forte e respeitada, conhecida por sua determinação e pela clareza de suas decisões. Seus soldados a respeitam, mas ela carrega o peso da responsabilidade com a dor da perda de aliados nas batalhas recentes."
    },
    {
      "name": "Hakon Vargen",
      "role": "Capitão da Estrada Branca",
      "description": "Irmão de Elira, Hakon é um guerreiro destemido, mas frequentemente em desacordo com a abordagem mais diplomática de sua irmã. Ele acredita que a Casa Vargen deveria ser mais agressiva em suas ações para proteger suas fronteiras."
    },
    {
      "name": "Maera Lobo-Velho",
      "role": "Guardião do Muro dos Ausentes",
      "description": "Maera é uma figura venerável em Droskar, respeitada por sua sabedoria e pelos rituais que realiza em memória dos ausentes. Ela mantém o Muro dos Ausentes com devoção, mas luta contra a dor de tantas perdas."
    },
    {
      "name": "Torvald Neve-Presa",
      "role": "Mestre dos Batedores",
      "description": "Torvald é um estrategista astuto e respeitado entre seus batedores. Embora leal à Casa, ele frequentemente questiona a liderança de Elira, acreditando que a Casa é excessivamente cautelosa nas patrulhas."
    },
    {
      "name": "Soren Vale-Branco",
      "role": "Administrador de Provisões",
      "description": "Soren é o pragmático administrador que mantém as provisões da Casa em ordem, mas sua austeridade o torna impopular entre os plebeus e soldados. Ele precisa tomar decisões difíceis e frequentemente se vê em conflito com Hakon."
    }
  ],
  "cla-mandibula-de-osso": [
    {
      "name": "Thorgul Crânio Cinzento",
      "role": "Líder do Clã Mandíbula de Osso",
      "description": "Thorgul é um líder respeitado e um símbolo de resistência para os orcs. Sua presença imponente e sabedoria adquirida ao longo dos anos inspiram lealdade e coragem entre seus seguidores."
    },
    {
      "name": "Garok do Trovão",
      "role": "Herdeiro e futuro líder do Clã Mandíbula de Osso",
      "description": "Garok é carismático e impulsivo, sempre pronto para agir em defesa de seu povo. Contudo, sua juventude e falta de experiência são frequentemente questionadas por aqueles que o apoiam."
    },
    {
      "name": "Morgruk",
      "role": "Cacique e guardião de Niantã",
      "description": "Morgruk é um respeitado cacique, que mantém viva a conexão do clã com Niantã, a deusa das florestas. Ele é visto como um sábio e um protetor, mas seus métodos têm gerado controvérsias."
    },
    {
      "name": "Ursa Dente-Verde",
      "role": "Chefe das patrulhas",
      "description": "Ursa é uma líder feroz na batalha, conhecida por sua habilidade em emboscadas e sua capacidade de inspirar os guerreiros em ação. Sua determinação é inabalável, mas seu método é frequentemente criticado."
    },
    {
      "name": "Brakka Quebra-Ferro",
      "role": "Ferreira do Clã Mandíbula de Osso",
      "description": "Brakka é uma ferreira talentosa, conhecida por transformar correntes em armas. Sua habilidade é valorizada, mas sua atitude é muitas vezes vista como brusca e direta."
    }
  ],
  "grande-casa-ulgar": [
    {
      "name": "Thorgar Crina de Ferro",
      "role": "Grão-Chefe da Grande Casa Ulgar",
      "description": "Thorgar é um líder forte e respeitado, conduzindo a Grande Casa Ulgar com bravura e determinação. Ele é frequentemente visto como a voz do povo, mas carrega o peso de um passado repleto de perdas e desafios. Sua presença imponente inspira tanto respeito quanto temor entre os membros do clã."
    },
    {
      "name": "Mok'Thar",
      "role": "Grande Xamã",
      "description": "Mok'Thar é o sábio, responsável por manter viva a conexão com os ancestrais e os espíritos da natureza. Ele é conhecido por seus rituais profundos e pela busca incessante de orientação espiritual. Embora respeitado, muitos duvidam de suas visões."
    },
    {
      "name": "Varka Chifre Rubro",
      "role": "Senhora da Guerra",
      "description": "Varka é uma guerreira feroz e defensora dos interesses da Casa Ulgar. Ela acredita firmemente em ações agressivas para garantir a sobrevivência do povo, e sua personalidade explosiva frequentemente causa conflitos com Thorgar."
    },
    {
      "name": "Asha Três-Cicatrizes",
      "role": "Responsável pela Caça e Provisões",
      "description": "Asha é uma caçadora habilidosa, conhecida por sua habilidade em trazer sustento para a Casa Ulgar. Com cicatrizes que contam histórias de batalhas passadas, ela é tanto uma guerreira quanto uma fornecedora crucial, o que a torna respeitada entre os clãs."
    },
    {
      "name": "Rokan Pedra Oca",
      "role": "Construtor de Rok'thar",
      "description": "Rokan é o mestre de ofício responsável pela construção de Rok'thar. Ele é um homem prático, que valoriza a estrutura e a resistência, e é respeitado por sua habilidade em unir os clãs para construir um lar no novo território."
    },
    {
      "name": "Nima Olhos de Cinza",
      "role": "Jovem Xamã",
      "description": "Nima é uma jovem xamã em busca de seu lugar dentro da Casa Ulgar. Ela é curiosa e determinada a compreender os espíritos de Valdren, mas sua inexperiência a torna alvo de desconfiança por parte dos mais velhos."
    }
  ],
  "irmandade-dos-corvos": [
    {
      "name": "Corva Nera Quatro-Estradas",
      "role": "Mestra da Irmandade dos Corvos",
      "description": "Corva Nera era uma líder respeitada e temida, conhecida por sua astúcia e habilidades de negociação. Seus mensageiros eram leais e a admiravam profundamente, mas ela mantinha segredos pesados sobre alianças e traições entre as casas."
    },
    {
      "name": "Sino Mudo",
      "role": "Chefe das Penas Cinzentas",
      "description": "Sino Mudo é um analista astuto que se destaca em coletar informações e desvendar segredos. Embora tenha grande respeito entre os colegas, ele questiona a direção que a Irmandade tomou após a morte de Corva Nera."
    },
    {
      "name": "Tomas Três-Pontes",
      "role": "Mestre das Carruagens",
      "description": "Tomas é o responsável por manter as rotas de transporte da Irmandade em funcionamento. Ele é prático e sempre otimista, mas se sente pressionado pelas novas mudanças na liderança."
    },
    {
      "name": "Alva Pena-Branca",
      "role": "Responsável por Desaparecidos",
      "description": "Alva é uma mulher determinada que lidera a busca por desaparecidos, sempre focada em seu trabalho. No entanto, ela está insatisfeita com a falta de apoio da nova liderança."
    },
    {
      "name": "Bico de Ferro Ren",
      "role": "Comandante dos Guardas",
      "description": "Ren é um comandante rígido que cuida da segurança das rotas e dos mensageiros. Ele respeita a tradição, mas discorda da abordagem mais leniente que a nova liderança está adotando."
    }
  ],
  "ordem-do-sino": [
    {
      "name": "Edras Fulgrim, Primeiro Tocador",
      "role": "Líder da Ordem do Sino",
      "description": "Edras é um líder sábio e respeitado, conhecido por sua voz calma e sua habilidade em unir diferentes facções dentro da Ordem. A sua presença inspira confiança, mas sua decisão de não tocar o Sino de Edras em tempos de crise gera descontentamento entre alguns membros da Ordem."
    },
    {
      "name": "Primeira Tocadora Ysara Bel",
      "role": "Líder atual",
      "description": "Ysara é uma erudita respeitada, com um profundo conhecimento das tradições da Ordem. Ela é vista como uma mediadora entre os diferentes braços da Ordem, mas sua abordagem cautelosa em tempos de crise gera divisões."
    },
    {
      "name": "Mãe Maelis da Mão Serena",
      "role": "Chefe dos hospitais",
      "description": "Maelis é uma mulher forte e empática, conhecida por seu compromisso em cuidar dos necessitados e dos moribundos. Ela é um pilar para os peregrinos e os feridos, mas frequentemente se sente sobrecarregada pela quantidade de dor que testemunha."
    },
    {
      "name": "Othran Sete-Tintas",
      "role": "Guardião do Arquivo dos Nomes",
      "description": "Othran é um erudito excêntrico que dedica sua vida a manter os registros da Ordem. Com um olhar atento para detalhes, ele é respeitado, mas também visto como um pouco distante por sua obsessão com os nomes."
    },
    {
      "name": "Irmão Daron Bronze-Puro",
      "role": "Mestre das fundições",
      "description": "Daron é um ferreiro habilidoso e um líder respeitado na fabricação de sinos. Ele é visto como um homem de princípios, mas suas opiniões sobre a tradição às vezes o colocam em conflito com os mais novos."
    },
    {
      "name": "Irmã Talia Véu-Branco",
      "role": "Comandante dos Vigias dos Túmulos",
      "description": "Talia é uma mulher destemida e respeitada entre os Vigias, conhecida por sua coragem em enfrentar ameaças e por defender a honra dos mortos. Apesar de sua força, ela questiona as decisões da liderança."
    },
    {
      "name": "Padre Jeren Eco-Manso",
      "role": "Defensor de ritos compassivos",
      "description": "Jeren é um sacerdote gentil que defende uma abordagem mais compassiva nos ritos funerários. Ele é amado pelos peregrinos, mas enfrenta resistência dos mais ortodoxos da Ordem."
    }
  ],
  "ordem-dos-tres": [
    {
      "name": "Mestra Oria Sem-Nome",
      "role": "Responsável pelos Candidatos ao Rito",
      "description": "Mestra Oria é a líder atual da Ordem dos Três, conhecida por sua inteligência aguçada e sua habilidade em guiar os iniciados através do complexo rito de passagem. Ela é respeitada, mas também é vista com cautela por causa da sua visão rígida da tradição."
    },
    {
      "name": "Calen Cera-Negra",
      "role": "Guardião de Artefatos",
      "description": "Calen é um homem robusto e enigmático, encarregado de proteger os artefatos sagrados da Ordem. Ele tem um profundo conhecimento sobre a história dos objetos que guarda e é altamente respeitado por seus colegas, mas sua natureza reservada faz com que poucos se aproximem."
    },
    {
      "name": "Irmã Fea do Círculo",
      "role": "Curadora e Crítica",
      "description": "Irmã Fea é uma mulher de espírito forte e opiniões firmes, conhecida por sua compaixão em curar os iniciados. Ela frequentemente questiona as imposições dos ritos de sacrifício e é vista como uma voz de dissenso dentro da Ordem."
    },
    {
      "name": "Serath, Voz da Cinza",
      "role": "Historiador e Estrategista",
      "description": "Serath é uma das três vozes que compõem o corpo de Maelor Véspera, conhecido por sua frieza analítica e profundo conhecimento histórico. Ele é valorizado por sua habilidade em planejar estratégias, mas sua dificuldade em se conectar emocionalmente o torna impopular entre os iniciados."
    },
    {
      "name": "Ilyon, Voz do Sangue",
      "role": "Comandante e Curador",
      "description": "Ilyon é a voz compassiva do corpo, atenta às necessidades dos iniciados e disposta a tomar riscos para protegê-los. Ele é admirado por sua bravura, mas sua impulsividade pode levar a decisões questionáveis."
    },
    {
      "name": "Veyra, Voz do Véu",
      "role": "Profetisa e Sonhadora",
      "description": "Veyra é a voz enigmática do corpo, conhecida por suas visões e interpretações de presságios. Sua natureza obscura e difícil de compreender a torna uma figura intrigante, mas também suscita desconfiança entre os mais céticos."
    }
  ]
};

export function charactersFor(key: string): HouseFigure[] {
  return HOUSE_CHARACTERS[key] ?? [];
}
