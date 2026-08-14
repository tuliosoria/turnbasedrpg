/**
 * O elenco de cada Casa: quem lidera, quem herda, quem discorda.
 *
 * Gerado a partir do cânone por backend/scripts/seed-house-characters.mjs e
 * versionado à mão. Cânone do mundo, não estado de partida: quem está vivo
 * sai de `isDeadInChronicle`, em mortality.ts.
 */
export interface HouseCharacter {
  name: string;
  role: string;
  description: string;
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

/** O elenco endereçável de uma Casa. */
export function houseRoster(houseKey: string): HouseCharacter[] {
  return HOUSE_CHARACTERS[houseKey] ?? [];
}

/** Resolve um personagem pela Casa e pelo id, ou null se não existir ali. */
export function characterFor(houseKey: string, id: string): HouseCharacter | null {
  return houseRoster(houseKey).find((c) => characterId(c.name) === id) ?? null;
}

export const HOUSE_CHARACTERS: Record<string, HouseCharacter[]> = {
  "casa-auremont": [
    {
      "name": "Lorde Marcien Auremont, Comandante da Cavalaria e Herdeiro de Aurivale",
      "role": "Líder",
      "description": "Lorde Marcien é o carismático líder da Casa Auremont, conhecido por sua destreza em montar e comandar a cavalaria. Apesar de sua aparência confiante, ele carrega o peso das expectativas de sua família e as complexidades da política de Aurivale.",
      "wants": "Provar seu valor como líder e proteger a Casa durante tempos incertos.",
      "hides": "Teme que sua inexperiência possa levar a Casa à ruína em um momento crítico."
    },
    {
      "name": "Duquesa Isolde Auremont",
      "role": "Governante",
      "description": "Isolde é uma mulher de forte presença e inteligência afiada, respeitada por seus conselheiros e temida por seus adversários. Sua habilidade em manobrar as intrigas da corte a mantém à frente, mas seu coração está dividido entre as tradições e a necessidade de inovação.",
      "wants": "Manter a estabilidade de Aurivale e garantir uma colheita próspera.",
      "hides": "Teme que sua resistência à mudança possa alienar as novas gerações da Casa."
    },
    {
      "name": "Dama Celestine de Vaux",
      "role": "Mestra dos Celeiros",
      "description": "Celestine é uma mulher prática, com um olho atento para detalhes, e a responsável por garantir que os celeiros da Casa estejam sempre abastecidos. É respeitada por sua dedicação, mas também é vista como rígida e conservadora por alguns membros da nobreza.",
      "wants": "Aumentar a eficiência dos celeiros para evitar escassez de alimentos.",
      "hides": "Receia que um mau planejamento possa resultar em descontentamento entre os camponeses e, consequentemente, em rebelião."
    },
    {
      "name": "Padre-Contador Remy Hal",
      "role": "Responsável por Dízimos e Reservas",
      "description": "Remy é um homem sério e meticuloso, cuja função é garantir que as finanças da Casa estejam sempre em ordem. Embora respeitado, ele é frequentemente visto como um aborrecimento por aqueles que preferem os banquetes e celebrações à matemática precisa de contabilidade.",
      "wants": "Estabelecer um sistema financeiro que proteja a Casa de crises futuras.",
      "hides": "Teme que uma crise iminente possa expor a vulnerabilidade financeira da Casa."
    },
    {
      "name": "Alena Primeira-Espiga",
      "role": "Representante das Aldeias",
      "description": "Alena é uma líder carismática das aldeias, cuja voz ressoa entre os camponeses e nobres. Ela é uma crítica fervorosa da nobreza, buscando melhores condições para seu povo. Embora respeitada, sua presença é muitas vezes vista como uma ameaça aos interesses dos aristocratas.",
      "wants": "Obter mais poder e influência para melhorar as vidas dos camponeses.",
      "hides": "Teme a retaliação da nobreza e a possibilidade de ser silenciada."
    }
  ],
  "casa-do-ouro": [
    {
      "name": "Príncipe Sétimo, Príncipe Sétimo do Ouro",
      "role": "Líder da Casa do Ouro",
      "description": "O Príncipe Sétimo é um homem elegante e paciente, sempre vestido de maneira impecável. Ele é respeitado por seus subordinados, mas sua busca por acordos duradouros com a Coroa é vista com ceticismo por alguns dentro da Casa.",
      "wants": "Transformar a crise atual em uma oportunidade para um relacionamento financeiro saudável com a Coroa.",
      "hides": "Teme que a falta de confiança da Coroa possa levar a Casa a perder influência e poder."
    },
    {
      "name": "Ortiz",
      "role": "Agente e negociador",
      "description": "Ortiz é um servo astuto, sempre presente nas sombras, ouvindo conversas e aconselhando com sabedoria. Embora seja visto apenas como um assistente, sua influência e conhecimento do jogo político são profundos.",
      "wants": "Estabelecer uma rede de influência que lhe permita negociar em nome da Casa com maior liberdade.",
      "hides": "Esconde sua verdadeira ambição de se tornar um jogador chave na política de Porto Cinzento."
    },
    {
      "name": "Mestra Liora Venn",
      "role": "Administradora dos cofres",
      "description": "Mestra Liora é rígida e determinada, defendendo limites estritos para empréstimos. Sua postura inflexível a torna respeitada, mas também temida entre aqueles que buscam crédito.",
      "wants": "Impor políticas financeiras mais rígidas para proteger a Casa de futuros riscos.",
      "hides": "Teme que a Casa se envolva em guerras que possam comprometer suas finanças e reputação."
    },
    {
      "name": "Capitão Jorren Daal",
      "role": "Comandante das escoltas",
      "description": "Capitão Jorren é um veterano destemido e leal, com um olhar atento e calculador. Ele valoriza a segurança acima de tudo, mas é frequentemente desafiado por outros membros da Casa que desejam um enfoque mais agressivo.",
      "wants": "Aumentar a segurança da Casa e de seus interesses comerciais em tempos de incerteza.",
      "hides": "Sente-se inseguro sobre sua capacidade de proteger a Casa em tempos de conflitos."
    },
    {
      "name": "Dama Seressa Nove-Contas",
      "role": "Líder de um ramo da Casa",
      "description": "Dama Seressa é ambiciosa e carismática, sempre buscando lucrar com as oportunidades, mesmo que isso signifique se aliar a interesses questionáveis. Sua postura agressiva em tempos de guerra a coloca em conflito com a liderança conservadora da Casa.",
      "wants": "Aumentar os lucros da Casa através de investimentos em empreendimentos militares e de guerra.",
      "hides": "Esconde suas ligações com mercenários que podem manchar a reputação da Casa."
    },
    {
      "name": "Irmão Calven",
      "role": "Representante da Casa junto à Ordem do Sino",
      "description": "Irmão Calven é um diplomata cauteloso e astuto, conhecido por sua habilidade em lidar com disputas de herança. Ele é frequentemente consultado sobre questões delicadas, mas sente que seu papel é subestimado.",
      "wants": "Obter mais influência nas decisões da Ordem do Sino em prol dos interesses da Casa.",
      "hides": "Tem medo de que sua ligação com a Ordem possa trazer consequências negativas para a Casa."
    }
  ],
  "casa-drakorys": [
    {
      "name": "Damaros Drakorys",
      "role": "Strategos da Escama",
      "description": "Líder respeitado, Damaros Drakorys era conhecido por sua sabedoria militar e habilidade em unir as facções da Casa. Ele era visto como um pilar de estabilidade em um momento de incerteza, mas sua morte deixou um vácuo de poder.",
      "wants": "A segurança e continuidade da Casa Drakorys.",
      "hides": "O medo de que sua morte cause divisão e desconfiança entre os membros da Casa."
    },
    {
      "name": "Ilyra das Cinzas",
      "role": "Sacerdotisa do Primeiro Fogo",
      "description": "Ilyra é uma figura reverenciada pelos draconatos, guiando rituais e cerimônias em honra ao Primeiro Fogo. Ela é respeitada, mas sua visão espiritual muitas vezes entra em conflito com os objetivos pragmáticos do Conselho.",
      "wants": "Que os rituais do Primeiro Fogo sejam respeitados e valorizados na sociedade draconata.",
      "hides": "Teme que a Casa Drakorys se afaste de suas tradições espirituais e ceda à pressão externa."
    },
    {
      "name": "Kassian Asa de Bronze",
      "role": "Almirante",
      "description": "Oficial de marinha experiente e carismático, Kassian é visto como um líder natural. Ele mantém a frota da Casa em prontidão, mas desconfia da liderança recente e se preocupa com o futuro da marinha.",
      "wants": "Expandir a frota e garantir a hegemonia naval de Krythos.",
      "hides": "Teme que a Casa não esteja preparada para a guerra iminente e que seu legado seja esquecido."
    },
    {
      "name": "Myrra Escudo-Partido",
      "role": "Veterana crítica do Conselho",
      "description": "Myrra é uma veterana do exército draconata e conhecida por sua postura firme e crítica em relação ao Conselho. Ela acredita que o Conselho se tornou complacente e que a Casa precisa de mudanças profundas.",
      "wants": "Ver a Casa Drakorys revitalizada e pronta para enfrentar os desafios externos.",
      "hides": "Teme que suas críticas a tornem uma rival e que seu próprio passado militar a impeça de ser ouvida."
    },
    {
      "name": "Leônidas Sal-Negro",
      "role": "Administrador dos celeiros e comércio",
      "description": "Leônidas é um administrador astuto e pragmático, responsável por garantir que os recursos da Casa sejam otimizados. Embora respeitado, sua relação com os outros membros do Conselho é muitas vezes tensa devido a suas opiniões sobre o comércio com Valdren.",
      "wants": "Aumentar as reservas de grãos e riquezas de Krythos.",
      "hides": "Teme que uma escassez de grãos leve à desconfiança e revolta entre a população."
    }
  ],
  "casa-euralune": [
    {
      "name": "Lorde Brannic Euralune",
      "role": "Senhor dos Ventos",
      "description": "Lorde Brannic é um líder carismático e respeitado que guia a Casa Euralune com firmeza e visão. Ele é conhecido por sua habilidade de negociar entre as aldeias e por proteger as comunidades com astúcia. Apesar do respeito que recebe, há quem o veja como um tirano disfarçado.",
      "wants": "Estabelecer um pacto de paz duradouro entre as aldeias e garantir a sobrevivência de seu povo.",
      "hides": "Teme que sua liderança seja vista como um ato de tirania e que a confiança das pessoas em sua autoridade se desmorone."
    },
    {
      "name": "Lyra Euralune",
      "role": "Herdeira e druida de hipogrifo prateado",
      "description": "Lyra, filha de Brannic, é uma druida talentosa que se comunica com hipogrifos e defende a harmonia entre as criaturas e os habitantes de Ninho Alto. Apesar de ser amada por muitos, sua visão sobre o Pacto das Alturas a coloca em desacordo com o pai em várias ocasiões.",
      "wants": "Deseja expandir o Pacto das Alturas para incluir não apenas suas comunidades, mas também os senhores que vivem nas terras inferiores.",
      "hides": "Teme que sua proposta de paz seja vista como traição e que os habitantes de Ninho Alto a considerem fraca."
    },
    {
      "name": "Tobren Penhasco",
      "role": "Mestre das Águias",
      "description": "Tobren é o responsável por treinar as montarias e garantir que as águias estejam sempre em condições de voar. Ele é um homem de poucas palavras, mas suas ações falam por si. Embora respeite Brannic, acredita que suas táticas de banditismo são arriscadas e prejudiciais para a imagem da Casa.",
      "wants": "Quer mudar a estratégia de ataque da Casa para algo mais aceitável aos nobres, visando manter a reputação de Euralune.",
      "hides": "Sente-se culpado por não conseguir convencer Brannic e teme que suas opiniões sejam ignoradas, levando a Casa ao desastre."
    },
    {
      "name": "Eldra Folhavento",
      "role": "Grã-Druida",
      "description": "Eldra é uma figura sábia e reverenciada entre os druidas, tendo um papel crucial na conexão espiritual entre os habitantes e as criaturas aladas. Ela é uma mediadora entre as aldeias e o Senhor dos Ventos, embora suas opiniões frequentemente desafiem as decisões de Brannic, especialmente quando se trata de combate.",
      "wants": "Anseia por um futuro onde os seres místicos e humanos coexistam em harmonia, sem mais conflitos.",
      "hides": "Teme que a guerra e a hostilidade levem à extinção das águias, das quais depende um equilíbrio vital."
    },
    {
      "name": "Pim Racha-Nuvem",
      "role": "Líder dos patrulheiros",
      "description": "Pim é o comandante dos patrulheiros que protegem Ninho Alto e suas comunidades. Ele é astuto e valente, admirado por sua bravura em batalhas. No entanto, sua lealdade a Brannic é questionável, uma vez que ele frequentemente discorda das táticas de banditismo da Casa.",
      "wants": "Deseja implementar uma abordagem mais defensiva e diplomática em vez de ataques diretos.",
      "hides": "Teme que sua posição e respeito entre os patrulheiros seja prejudicada se ele se opuser abertamente às ordens de Brannic."
    },
    {
      "name": "Nessa Três-Sementes",
      "role": "Representante das aldeias pobres",
      "description": "Nessa é uma voz poderosa entre as comunidades mais humildes que compõem a Casa Euralune. Ela é uma defensora incansável dos menos favorecidos e frequentemente se confronta com a liderança da Casa sobre as desigualdades que persistem. Ela se sente pressionada a lutar por seus semelhantes.",
      "wants": "Quer garantir que os direitos e necessidades das aldeias pobres sejam reconhecidos e atendidos pela liderança.",
      "hides": "Teme que sua luta por justiça a leve a ser vista como uma instigadora de conflitos, prejudicando sua causa."
    }
  ],
  "casa-ferrumor": [
    {
      "name": "Lady Miriel Ferrumor",
      "role": "Principal Diplomata da Casa Ferrumor",
      "description": "Lady Miriel é a eloquente e inteligente diplomata da Casa Ferrumor, frequentemente envolvida em negociações com outras casas e reinos. Sua habilidade em articular os interesses de sua Casa a torna respeitada, mas também alvo de críticas por sua aproximação cautelosa com rivais.",
      "wants": "Estabelecer alianças que garantam a segurança de Ferrum e evitem conflitos desnecessários.",
      "hides": "Teme que sua abordagem diplomática signifique fraqueza e que a Casa Ferrumor não seja respeitada pelas outras casas."
    },
    {
      "name": "Lorde Aedran Ferrumor",
      "role": "Chefe da Casa Ferrumor",
      "description": "Lorde Aedran é um homem sereno e decidido, que se esforça para restaurar a grandeza marítima de sua Casa. Ele é visto como um líder forte, mas suas decisões muitas vezes são questionadas por aqueles que o veem como excessivamente focado em tradições.",
      "wants": "Trazer de volta a história e a honra de Caladris através de uma frota naval imbatível.",
      "hides": "Teme que sua obsessão em reconstruir Caladris possa levar a Casa Ferrumor a um conflito com seus vizinhos."
    },
    {
      "name": "Almirante Caelor Ventobranco",
      "role": "Comandante da Frota",
      "description": "Caelor é um experiente comandante naval, respeitado por suas táticas e estratégias. No entanto, sua lealdade à Casa Ferrumor é frequentemente testada por suas dúvidas sobre as decisões do Lorde Aedran.",
      "wants": "Conduzir a frota em uma campanha naval bem-sucedida para consolidar a influência de Ferrum.",
      "hides": "Sente que a Casa deve adotar uma postura mais agressiva, algo que temia discutir com Aedran."
    },
    {
      "name": "Mestra Sarya Arco-de-Pedra",
      "role": "Arquiteta responsável pelas grandes obras",
      "description": "Sarya é uma arquiteta talentosa, responsável por projetar as grandiosas construções na cidade de Ferrum. Ela é admirada por sua visão, mas sua ambição às vezes causa desentendimentos com os conservadores da Casa.",
      "wants": "Ver Ferrum como um exemplo de grandeza arquitetônica e inovação.",
      "hides": "Teme que suas inovações possam ser rejeitadas e que sua reputação será manchada."
    },
    {
      "name": "Teren Caladrin",
      "role": "Historiador",
      "description": "Teren é um historiador obcecado por descobrir o destino de Caladris, passando dias na Torre do Horizonte Perdido. Sua busca o torna um tanto isolado, embora sua paixão pela história o faça ser respeitado.",
      "wants": "Encontrar provas que confirmem o destino de Caladris para reviver sua memória.",
      "hides": "Teme que nunca consiga descobrir a verdade e que Caladris caia na obscuridade."
    }
  ],
  "casa-karasoy": [
    {
      "name": "Aylin Karasoy",
      "role": "Mãe da Planície",
      "description": "Aylin era uma líder carismática e respeitada, guiando a Casa Karasoy com sabedoria e força. Sua habilidade em manter a paz e a união entre as mulheres da Casa foi admirada, mas sua morte deixou um vácuo imenso na liderança.",
      "wants": "Um futuro seguro para sua Casa e que seus descendentes continuem sua luta.",
      "hides": "A insegurança sobre a sobrevivência de sua Casa após sua morte."
    },
    {
      "name": "Selma Karasoy",
      "role": "Lança de Luz",
      "description": "Selma é uma guerreira feroz e respeitada, conhecida por sua habilidade com a lança e seu comando sobre as tropas. Ela acredita profundamente na visão de Aylin, mas teme que a nova líder não consiga unir a Casa após sua morte.",
      "wants": "Ter a liberdade de liderar em combate, sem restrições de conselheiros e tradições.",
      "hides": "Sua dúvida sobre a capacidade das novas lideranças em manter a Casa unida."
    },
    {
      "name": "Yasemin Altunay",
      "role": "Domadora dos Ventos",
      "description": "Yasemin é uma amazona ágil, com uma conexão especial com os cavalos Tempestade Branca. Ela é admirada por sua habilidade em domar até os mais indomáveis e sempre se preocupa com o bem-estar da Casa e de suas montarias.",
      "wants": "Um reconhecimento maior por suas habilidades e um lugar ao lado da nova líder.",
      "hides": "Um medo de não conseguir domar seu próprio cavalo, o que seria um sinal de fraqueza."
    },
    {
      "name": "Nahla Altunay",
      "role": "Guardiã da Estrela",
      "description": "Nahla, aos 82 anos, é a voz da experiência e sabedoria da Casa. Com um passado de lutas e vitórias, sua presença é respeitada, mas suas visões sobre o futuro muitas vezes colidem com as ideias mais jovens.",
      "wants": "Ver a Casa prosperar e garantir que as tradições sejam mantidas.",
      "hides": "O receio de que sua visão conservadora possa levar a Casa à estagnação."
    },
    {
      "name": "Leyla Duas-Rotas",
      "role": "Mestra das Exploradoras",
      "description": "Leyla é a responsável por treinar as exploradoras da Casa, conhecida por suas táticas engenhosas e habilidades de rastreamento. Ela é uma liderança natural, embora tenha seus próprios conflitos com as tradições rígidas da Casa.",
      "wants": "Transformar as práticas de exploração e adotar novas técnicas.",
      "hides": "Um desejo de provar seu valor em um mundo que ainda vê as mulheres com desconfiança."
    },
    {
      "name": "Derya Sar-Khal",
      "role": "Guardião das Ruínas Antigas",
      "description": "Derya é a guardiã dos conhecimentos ancestrais da Casa, responsável por preservar a história de Sar-Khal. Embora respeitada, ela discorda do foco da Casa em expandir o uso do mitril em vez de fortalecer suas tradições.",
      "wants": "Redefinir a importância da história em vez do avanço material.",
      "hides": "Um temor de que a história de sua Casa seja esquecida em nome do progresso."
    }
  ],
  "casa-khazdrun": [
    {
      "name": "Lorde Thrain Khazdrun",
      "role": "Lorde da Casa Khazdrun",
      "description": "Lorde Thrain era um líder forte e respeitado, mestre em engenharia naval e aclamado por suas decisões. Comandava com firmeza e buscava sempre a harmonia entre os Clãs da Maré e os Clãs de Raiz, mas suas ambições o levaram a assumir riscos que culminaram em sua morte.",
      "wants": "Um legado duradouro que una os clãs sob sua liderança.",
      "hides": "O medo de que a Casa Khazdrun se desmoronasse sem ele."
    },
    {
      "name": "Lady Brynna Khazdrun",
      "role": "Herdeira da Casa Khazdrun",
      "description": "Brynna é a filha mais velha de Thrain, uma anã determinada que se sente pressionada a preencher os sapatos de seu pai. Apesar de ser respeitada, sua juventude e inexperiência geram desconfiança entre alguns membros do conselho.",
      "wants": "Estabelecer sua própria autoridade e provar seu valor como líder.",
      "hides": "Dúvidas sobre sua habilidade de unir os clãs e manter a Casa forte."
    },
    {
      "name": "Durgan Ferrosalto",
      "role": "Mestre de Ofício",
      "description": "Durgan, um ferreiro talentoso e tradicionalista, acredita que as inovações dos estaleiros estão arruinando as tradições ancestrais. Ele é respeitado, mas suas opiniões muitas vezes geram tensão no conselho.",
      "wants": "Proteger as tradições de forjamento e engenharia da Casa.",
      "hides": "Um passado obscuro de falhas em projetos que o assombram."
    },
    {
      "name": "Kaldrin Marébrava",
      "role": "Comandante dos Fuzileiros de Doca",
      "description": "Kaldrin é um líder militar carismático e impetuoso, que desafia constantemente as decisões de Brynna, acreditando que ela não está pronta para liderar em tempos de crise. Ele é leal à Casa, mas suas discordâncias frequentemente geram conflitos.",
      "wants": "Aumentar a força militar da Casa para prepará-la para os desafios futuros.",
      "hides": "Um medo profundo de que os clãs se voltem uns contra os outros em um momento de fraqueza."
    },
    {
      "name": "Eldra Oreluna",
      "role": "Arquivista",
      "description": "Eldra é a guardiã da história e dos registros da Casa Khazdrun, reconhecida por sua sabedoria. Ela tem acesso a segredos que poderiam desestabilizar o governo atual, mas se sente dividida sobre revelá-los.",
      "wants": "Manter a história da Casa intacta e garantir que as tradições sejam respeitadas.",
      "hides": "Informações sobre um escândalo no passado que envolve a família Khazdrun."
    }
  ],
  "casa-rimerberg": [
    {
      "name": "Ser Kael Rimerberg",
      "role": "Representante da Casa Rimerberg",
      "description": "Ser Kael é um líder relutante que tenta manter a Casa unida em tempos de incerteza. Ele é visto como um homem de palavras firmes, mas sua hesitação em agir em nome dos Rimerberg gera desconfiança entre seus pares.",
      "wants": "Deseja que a Casa Rimerberg mantenha sua honra e força, mesmo na escuridão.",
      "hides": "Teme que os segredos do destino de sua família se revelem, manchando o legado da Casa."
    },
    {
      "name": "Mestre Halm",
      "role": "Guardião do Farol de Gelo",
      "description": "Mestre Halm é um homem idoso e sábio, conhecido por seu conhecimento extenso sobre o clima e o território do norte. Ele é respeitado por seus conhecimentos, mas sua relutância em compartilhar alguns dos antigos rituais de proteção gera desconfiança entre os membros mais jovens da Casa.",
      "wants": "Anseia por preservar os rituais tradicionais da Casa e manter o farol aceso.",
      "hides": "Teme que o farol nunca mais acenda e que seus segredos se percam com ele."
    },
    {
      "name": "Capitão Orven Geada",
      "role": "Comandante das patrulhas externas",
      "description": "Capitão Orven é um líder forte e decidido, conhecido por sua bravura nas fronteiras. No entanto, sua crescente desconfiança em relação à liderança de Ser Kael o faz questionar a direção da Casa e suas próprias decisões.",
      "wants": "Deseja proteger seu povo e garantir que Rimewatch não caia em completa desolação.",
      "hides": "Teme que a Casa não tenha recursos suficientes para enfrentar uma possível invasão e que suas decisões possam levar a uma catástrofe."
    },
    {
      "name": "Irmã Tessa do Último Sino",
      "role": "Sacerdotisa responsável pelos mortos",
      "description": "Irmã Tessa é uma figura calma e serena, que conforta os que perderam seus entes queridos. Enquanto muitos a veem como uma fonte de consolo, ela carrega um fardo pesado em seu coração, ligada ao destino dos Rimerberg.",
      "wants": "Anseia por um entendimento mais profundo do que aconteceu em Rimewatch para poder ajudar as almas perdidas.",
      "hides": "Teme que os mortos comecem a se levantar e que suas preces não sejam ouvidas."
    },
    {
      "name": "Lady Ysabet Rimerberg",
      "role": "Administradora das aldeias do sul",
      "description": "Lady Ysabet era uma administradora competente e respeitada, conhecida por sua habilidade em lidar com as necessidades das aldeias. Sua ausência gerou grande preocupação e incerteza entre os súditos da Casa.",
      "wants": "Queria garantir a segurança e o bem-estar das aldeias sob sua responsabilidade.",
      "hides": "Temia que a inação da Casa levasse à ruína das aldeias que ela tanto amava."
    }
  ],
  "casa-solarion": [
    {
      "name": "Lady Samira Solarion",
      "role": "Governante de Sahra-Lun",
      "description": "Lady Samira é a orgulhosa governante de Sahra-Lun, admirada por sua diplomacia e habilidade de conduzir debates. No entanto, carrega o peso do passado da Casa Solarion, o que a torna uma figura complexa e controversa.",
      "wants": "Deseja restaurar a honra da Casa e garantir a continuidade de seu legado.",
      "hides": "Teme que o passado sombrio de sua Casa venha à tona e a torne alvo de críticas e desconfiança."
    },
    {
      "name": "All Marifh",
      "role": "Conselheiro e estudioso",
      "description": "All Marifh é um erudito dedicado à astronomia e a história de Solarion, ocupando uma posição de confiável conselheiro. Sua natureza introspectiva faz com que muitos o vejam como distante, mas sua mente afiada é inegavelmente valiosa.",
      "wants": "Deseja obter provas históricas que possam legitimar a Casa na arena diplomática.",
      "hides": "Esconde seu temor de que a busca por provas revele verdades que possam ferir a reputação da Casa."
    },
    {
      "name": "Comandante Zahra al-Nur",
      "role": "Protetora das caravanas",
      "description": "Zahra al-Nur é uma líder militar respeitada e protetora das caravanas que cruzam o deserto, admirada por sua bravura e táticas inteligentes. Ela é uma figura forte, mas sua lealdade à Casa é frequentemente questionada.",
      "wants": "Deseja garantir a segurança das rotas de caravanas e expandir seu controle sobre o deserto.",
      "hides": "Teme que um ataque em grande escala revele a fragilidade das defesas de Solarion."
    },
    {
      "name": "Issen Tal",
      "role": "Diretor do Observatório das Sete Sombras",
      "description": "Issen Tal é o responsável pelo Observatório, conhecido por sua visão apurada e suas previsões astrológicas. Ele é uma figura respeitada, mas sua relação com o passado da Casa gera desconfiança entre os mais tradicionais.",
      "wants": "Deseja fazer descobertas que possam elevar a Casa a um novo patamar de prestígio.",
      "hides": "Teme que suas previsões falhem e provoquem dúvidas sobre sua competência e a do Observatório."
    },
    {
      "name": "Naevra Sol-Partido",
      "role": "Nobre reformista",
      "description": "Naevra é uma reformista conhecida por sua defesa do reconhecimento público das antigas escravidões. Ela é uma voz ousada dentro da Casa, frequentemente desafiando as tradições e gerando debates acalorados.",
      "wants": "Deseja promover mudanças significativas na forma como Solarion lida com seu passado.",
      "hides": "Teme que suas ações possam resultar em retaliações violentas por parte dos tradicionalistas."
    }
  ],
  "casa-valerius": [
    {
      "name": "Lady Celene Valerius",
      "role": "Rainha-Viúva e Regente",
      "description": "A antiga líder da Casa Valerius, Celene é uma figura austera que sempre governou com uma disciplina rígida e uma habilidade inegável de unir rivais. Sua morte deixou um grande vazio na Casa e no reino, com muitos se perguntando se o legado que ela tentou proteger será suficiente para enfrentar a instabilidade recém-chegada.",
      "wants": "Proteger a continuidade da dinastia Valerius e manter a paz no reino.",
      "hides": "Temia que seu filho, o Príncipe Alic, não estivesse preparado para a responsabilidade que agora recai sobre ele."
    },
    {
      "name": "Príncipe Alic Valerius",
      "role": "Herdeiro",
      "description": "Com apenas doze anos, Alic é um menino pálido e introspectivo, que se vê repentinamente no centro da atenção e da responsabilidade. Sua juventude e inocência contrastam com a gravidade da situação que sua Casa enfrenta após a morte de sua mãe.",
      "wants": "Deseja ser aceito como o novo líder e provar seu valor ao reino.",
      "hides": "Tem um medo profundo de não conseguir estar à altura das expectativas e de falhar em proteger seu povo."
    },
    {
      "name": "Lord Aelric Roderic",
      "role": "Mestre de Ofício",
      "description": "Um homem experiente e astuto, Aelric é responsável por gerir os assuntos administrativos da Casa Valerius. Ele é respeitado, mas sua maneira direta de lidar com as questões o torna alvo de críticas, especialmente de nobres menos pragmáticos.",
      "wants": "Quer garantir que os recursos e as finanças da Casa estejam em ordem para enfrentar a crise atual.",
      "hides": "Tem medo de que os cortes de recursos e a pressão política levem a Casa Valerius à ruína financeira."
    },
    {
      "name": "Dama Elara Voss",
      "role": "Comandante da Guarda Real",
      "description": "Um líder militar respeitado, Elara é forte e decidida, encarregada de proteger Asterhall e a nova regência. Sua lealdade ao reino e à Casa é inquestionável, mas sua visão é muitas vezes vista como radical dentro da corte.",
      "wants": "Deseja aumentar o poder militar da Casa Valerius para garantir segurança e estabilidade.",
      "hides": "Teme que a Casa Valerius esteja perdendo a fé do povo e quer evitar um levante."
    },
    {
      "name": "Sra. Nerys Thorne",
      "role": "Arquivista",
      "description": "Detentora de um vasto conhecimento sobre a história e a burocracia da Casa, Nerys é uma mulher enigmática que mantém os registros detalhados de todas as decisões e alianças. Sua vida é dedicada a garantir que o passado não seja esquecido.",
      "wants": "Quer que a história da Casa Valerius seja respeitada e reconhecida pelos novos líderes.",
      "hides": "Sente-se insegura sobre o futuro da Casa e teme que seu trabalho e conhecimento sejam desconsiderados após a morte de Celene."
    }
  ],
  "casa-vargen": [
    {
      "name": "Lady Elira Vargen",
      "role": "Senhora de Droskar",
      "description": "Lady Elira é uma líder forte e respeitada, conhecida por sua determinação e pela clareza de suas decisões. Seus soldados a respeitam, mas ela carrega o peso da responsabilidade com a dor da perda de aliados nas batalhas recentes.",
      "wants": "Elira deseja unir as forças do Norte para enfrentar a crescente ameaça das mortes que retornam.",
      "hides": "Ela teme que a fragilidade de suas alianças possa levá-la a falhar com seu povo."
    },
    {
      "name": "Hakon Vargen",
      "role": "Capitão da Estrada Branca",
      "description": "Irmão de Elira, Hakon é um guerreiro destemido, mas frequentemente em desacordo com a abordagem mais diplomática de sua irmã. Ele acredita que a Casa Vargen deveria ser mais agressiva em suas ações para proteger suas fronteiras.",
      "wants": "Hakon quer um exército maior para garantir a segurança das aldeias. ",
      "hides": "Ele esconde seu medo de que, se falharem em enfrentar a ameaça externa, sua família e seu lar sejam os próximos a cair."
    },
    {
      "name": "Maera Lobo-Velho",
      "role": "Guardião do Muro dos Ausentes",
      "description": "Maera é uma figura venerável em Droskar, respeitada por sua sabedoria e pelos rituais que realiza em memória dos ausentes. Ela mantém o Muro dos Ausentes com devoção, mas luta contra a dor de tantas perdas.",
      "wants": "Maera deseja que as histórias dos que partiram sejam sempre lembradas e honradas.",
      "hides": "Ela teme que a incessante quantidade de nomes que adiciona ao muro seja uma premonição do fim da Casa Vargen."
    },
    {
      "name": "Torvald Neve-Presa",
      "role": "Mestre dos Batedores",
      "description": "Torvald é um estrategista astuto e respeitado entre seus batedores. Embora leal à Casa, ele frequentemente questiona a liderança de Elira, acreditando que a Casa é excessivamente cautelosa nas patrulhas.",
      "wants": "Torvald quer uma expansão das operações de reconhecimento para antecipar ameaças.",
      "hides": "Ele teme que sua busca por mais aventura possa resultar em mais perdas para seus homens."
    },
    {
      "name": "Soren Vale-Branco",
      "role": "Administrador de Provisões",
      "description": "Soren é o pragmático administrador que mantém as provisões da Casa em ordem, mas sua austeridade o torna impopular entre os plebeus e soldados. Ele precisa tomar decisões difíceis e frequentemente se vê em conflito com Hakon.",
      "wants": "Soren deseja garantir que todos os recursos sejam usados da maneira mais eficiente possível para a sobrevivência da Casa.",
      "hides": "Ele teme que sua visão prática o faça ser visto como cruel e que, eventualmente, a escassez se torne insustentável."
    }
  ],
  "cla-mandibula-de-osso": [
    {
      "name": "Thorgul Crânio Cinzento",
      "role": "Líder do Clã Mandíbula de Osso",
      "description": "Thorgul é um líder respeitado e um símbolo de resistência para os orcs. Sua presença imponente e sabedoria adquirida ao longo dos anos inspiram lealdade e coragem entre seus seguidores.",
      "wants": "Seu grande desejo era garantir a autonomia e a paz duradoura para seu povo.",
      "hides": "Ele oculta o medo de que seus esforços para proteger o clã não sejam suficientes para garantir um futuro seguro."
    },
    {
      "name": "Garok do Trovão",
      "role": "Herdeiro e futuro líder do Clã Mandíbula de Osso",
      "description": "Garok é carismático e impulsivo, sempre pronto para agir em defesa de seu povo. Contudo, sua juventude e falta de experiência são frequentemente questionadas por aqueles que o apoiam.",
      "wants": "Garok quer provar que é digno do legado de seu pai e fortalecer o clã.",
      "hides": "Ele teme não estar preparado para liderar em tempos de crise e que isso possa levar à ruína do clã."
    },
    {
      "name": "Morgruk",
      "role": "Cacique e guardião de Niantã",
      "description": "Morgruk é um respeitado cacique, que mantém viva a conexão do clã com Niantã, a deusa das florestas. Ele é visto como um sábio e um protetor, mas seus métodos têm gerado controvérsias.",
      "wants": "Morgruk deseja preservar a tradição e a espiritualidade do clã acima de tudo.",
      "hides": "Ele teme que as novas ideias de Garok coloquem em risco as antigas práticas que sustentaram o clã por gerações."
    },
    {
      "name": "Ursa Dente-Verde",
      "role": "Chefe das patrulhas",
      "description": "Ursa é uma líder feroz na batalha, conhecida por sua habilidade em emboscadas e sua capacidade de inspirar os guerreiros em ação. Sua determinação é inabalável, mas seu método é frequentemente criticado.",
      "wants": "Ela quer garantir que as fronteiras do clã estejam sempre seguras e livres de invasores.",
      "hides": "Ursa teme que sua aversão a negociações possa levar a uma escalada de conflitos desnecessários."
    },
    {
      "name": "Brakka Quebra-Ferro",
      "role": "Ferreira do Clã Mandíbula de Osso",
      "description": "Brakka é uma ferreira talentosa, conhecida por transformar correntes em armas. Sua habilidade é valorizada, mas sua atitude é muitas vezes vista como brusca e direta.",
      "wants": "Brakka deseja ser reconhecida não apenas como ferreira, mas como uma líder em sua própria arte.",
      "hides": "Ela esconde a insegurança sobre sua posição e a dúvida de ser suficientemente respeitada por seu ofício."
    }
  ],
  "grande-casa-ulgar": [
    {
      "name": "Thorgar Crina de Ferro",
      "role": "Grão-Chefe da Grande Casa Ulgar",
      "description": "Thorgar é um líder forte e respeitado, conduzindo a Grande Casa Ulgar com bravura e determinação. Ele é frequentemente visto como a voz do povo, mas carrega o peso de um passado repleto de perdas e desafios. Sua presença imponente inspira tanto respeito quanto temor entre os membros do clã.",
      "wants": "Estabelecer um reconhecimento pleno para a Grande Casa Ulgar e garantir a segurança do povo.",
      "hides": "Teme que a fragilidade da nova terra possa levar seu povo a outra catástrofe."
    },
    {
      "name": "Mok'Thar",
      "role": "Grande Xamã",
      "description": "Mok'Thar é o sábio, responsável por manter viva a conexão com os ancestrais e os espíritos da natureza. Ele é conhecido por seus rituais profundos e pela busca incessante de orientação espiritual. Embora respeitado, muitos duvidam de suas visões.",
      "wants": "Descobrir um novo ritual que possa proteger o povo de uma nova Vor'Kaash.",
      "hides": "Teme que suas visões já não sejam mais claras e que os ancestrais o abandonem."
    },
    {
      "name": "Varka Chifre Rubro",
      "role": "Senhora da Guerra",
      "description": "Varka é uma guerreira feroz e defensora dos interesses da Casa Ulgar. Ela acredita firmemente em ações agressivas para garantir a sobrevivência do povo, e sua personalidade explosiva frequentemente causa conflitos com Thorgar.",
      "wants": "Conquistar respeito e temeridade por meio da força militar.",
      "hides": "Teme que sua abordagem agressiva traga mais perdas do que ganhos."
    },
    {
      "name": "Asha Três-Cicatrizes",
      "role": "Responsável pela Caça e Provisões",
      "description": "Asha é uma caçadora habilidosa, conhecida por sua habilidade em trazer sustento para a Casa Ulgar. Com cicatrizes que contam histórias de batalhas passadas, ela é tanto uma guerreira quanto uma fornecedora crucial, o que a torna respeitada entre os clãs.",
      "wants": "Estabelecer um sistema de caça que garanta a sobrevivência e o sustento a longo prazo.",
      "hides": "Teme que a escassez de recursos em Valdren coloque sua família e seu clã em risco."
    },
    {
      "name": "Rokan Pedra Oca",
      "role": "Construtor de Rok'thar",
      "description": "Rokan é o mestre de ofício responsável pela construção de Rok'thar. Ele é um homem prático, que valoriza a estrutura e a resistência, e é respeitado por sua habilidade em unir os clãs para construir um lar no novo território.",
      "wants": "Criar uma fortificação que possa proteger a Casa Ulgar contra ameaças externas.",
      "hides": "Teme que a falta de material e recursos impeça a conclusão da obra antes que a próxima calamidade chegue."
    },
    {
      "name": "Nima Olhos de Cinza",
      "role": "Jovem Xamã",
      "description": "Nima é uma jovem xamã em busca de seu lugar dentro da Casa Ulgar. Ela é curiosa e determinada a compreender os espíritos de Valdren, mas sua inexperiência a torna alvo de desconfiança por parte dos mais velhos.",
      "wants": "Compreender e aprender a invocar os espíritos de Valdren para ajudar seu povo.",
      "hides": "Teme que não seja digna dos ensinamentos dos ancestrais e que falhe em sua missão."
    }
  ],
  "irmandade-dos-corvos": [
    {
      "name": "Corva Nera Quatro-Estradas",
      "role": "Mestra da Irmandade dos Corvos",
      "description": "Corva Nera era uma líder respeitada e temida, conhecida por sua astúcia e habilidades de negociação. Seus mensageiros eram leais e a admiravam profundamente, mas ela mantinha segredos pesados sobre alianças e traições entre as casas.",
      "wants": "Restaurar a ordem e a paz em Valdren através da comunicação.",
      "hides": "Um passado obscuro envolvendo subornos e manipulações para garantir a segurança da Irmandade."
    },
    {
      "name": "Sino Mudo",
      "role": "Chefe das Penas Cinzentas",
      "description": "Sino Mudo é um analista astuto que se destaca em coletar informações e desvendar segredos. Embora tenha grande respeito entre os colegas, ele questiona a direção que a Irmandade tomou após a morte de Corva Nera.",
      "wants": "Descobrir a verdade sobre a morte de Corva Nera e vingar sua queda.",
      "hides": "Um medo profundo de que a Irmandade se perca em corrupção e se torne o que mais despreza."
    },
    {
      "name": "Tomas Três-Pontes",
      "role": "Mestre das Carruagens",
      "description": "Tomas é o responsável por manter as rotas de transporte da Irmandade em funcionamento. Ele é prático e sempre otimista, mas se sente pressionado pelas novas mudanças na liderança.",
      "wants": "Aumentar a eficiência das rotas e garantir que mensagens cheguem mais rapidamente.",
      "hides": "Um sentimento de inadequação, achando que, sem Corva Nera, a Irmandade pode desmoronar."
    },
    {
      "name": "Alva Pena-Branca",
      "role": "Responsável por Desaparecidos",
      "description": "Alva é uma mulher determinada que lidera a busca por desaparecidos, sempre focada em seu trabalho. No entanto, ela está insatisfeita com a falta de apoio da nova liderança.",
      "wants": "Encontrar todos os desaparecidos e restaurar a confiança da população na Irmandade.",
      "hides": "Um trauma não resolvido que a faz temer que não consiga salvar todos."
    },
    {
      "name": "Bico de Ferro Ren",
      "role": "Comandante dos Guardas",
      "description": "Ren é um comandante rígido que cuida da segurança das rotas e dos mensageiros. Ele respeita a tradição, mas discorda da abordagem mais leniente que a nova liderança está adotando.",
      "wants": "Estabelecer uma política de segurança mais rígida para proteger os mensageiros.",
      "hides": "Um medo de falhar em proteger seus homens, especialmente após a morte de Corva Nera."
    }
  ],
  "ordem-do-sino": [
    {
      "name": "Edras Fulgrim, Primeiro Tocador",
      "role": "Líder da Ordem do Sino",
      "description": "Edras é um líder sábio e respeitado, conhecido por sua voz calma e sua habilidade em unir diferentes facções dentro da Ordem. A sua presença inspira confiança, mas sua decisão de não tocar o Sino de Edras em tempos de crise gera descontentamento entre alguns membros da Ordem.",
      "wants": "Edras deseja garantir a estabilidade da Ordem e proteger o legado de seus fundadores. Ele busca um meio de unir as diferentes facções da Ordem diante do luto e da crise atual.",
      "hides": "Edras teme que sua hesitação em usar o Sino leve a um colapso da Ordem e que os ecos de seus erros se tornem uma maldição para os vivos."
    },
    {
      "name": "Primeira Tocadora Ysara Bel",
      "role": "Líder atual",
      "description": "Ysara é uma erudita respeitada, com um profundo conhecimento das tradições da Ordem. Ela é vista como uma mediadora entre os diferentes braços da Ordem, mas sua abordagem cautelosa em tempos de crise gera divisões.",
      "wants": "Ysara deseja trazer as facções da Ordem para um consenso, garantindo que todos os nomes sejam respeitados e que a memória dos perdidos não seja em vão.",
      "hides": "Ysara teme que sua falta de ação decisiva leve a um cisma irreparável dentro da Ordem."
    },
    {
      "name": "Mãe Maelis da Mão Serena",
      "role": "Chefe dos hospitais",
      "description": "Maelis é uma mulher forte e empática, conhecida por seu compromisso em cuidar dos necessitados e dos moribundos. Ela é um pilar para os peregrinos e os feridos, mas frequentemente se sente sobrecarregada pela quantidade de dor que testemunha.",
      "wants": "Maelis quer expandir os hospitais e garantir que toda dor recebida tenha um alívio, buscando mais recursos e apoio da Ordem.",
      "hides": "Ela esconde a frustração de não conseguir salvar todos e teme que um dia seus cuidados não sejam suficientes."
    },
    {
      "name": "Othran Sete-Tintas",
      "role": "Guardião do Arquivo dos Nomes",
      "description": "Othran é um erudito excêntrico que dedica sua vida a manter os registros da Ordem. Com um olhar atento para detalhes, ele é respeitado, mas também visto como um pouco distante por sua obsessão com os nomes.",
      "wants": "Othran deseja que todos os nomes da Ordem sejam lembrados e respeitados, e planeja criar uma nova forma de registro que capture as memórias.",
      "hides": "Ele teme que a Ordem perca alguns nomes valiosos e que, com isso, a memória dos mortos se desvaneça."
    },
    {
      "name": "Irmão Daron Bronze-Puro",
      "role": "Mestre das fundições",
      "description": "Daron é um ferreiro habilidoso e um líder respeitado na fabricação de sinos. Ele é visto como um homem de princípios, mas suas opiniões sobre a tradição às vezes o colocam em conflito com os mais novos.",
      "wants": "Daron deseja que a ordem continue a honrar as tradições da fabricação dos sinos, mas também procura um novo design que traga esperança e renovação.",
      "hides": "Ele esconde a insegurança sobre o futuro da Ordem e teme que a inovação possa desvirtuar as tradições que valoriza."
    },
    {
      "name": "Irmã Talia Véu-Branco",
      "role": "Comandante dos Vigias dos Túmulos",
      "description": "Talia é uma mulher destemida e respeitada entre os Vigias, conhecida por sua coragem em enfrentar ameaças e por defender a honra dos mortos. Apesar de sua força, ela questiona as decisões da liderança.",
      "wants": "Talia quer um maior poder para os Vigias, para que possam agir em defesa dos cemitérios e dos rituais com mais autonomia.",
      "hides": "Ela teme que suas abordagens mais assertivas possam causar conflitos desnecessários com a liderança da Ordem."
    },
    {
      "name": "Padre Jeren Eco-Manso",
      "role": "Defensor de ritos compassivos",
      "description": "Jeren é um sacerdote gentil que defende uma abordagem mais compassiva nos ritos funerários. Ele é amado pelos peregrinos, mas enfrenta resistência dos mais ortodoxos da Ordem.",
      "wants": "Jeren deseja reformar os rituais para que se tornem mais acolhedores e menos punitivos, promovendo uma maior paz entre os vivos e os mortos.",
      "hides": "Ele esconde a frustração de sentir que seus esforços são em vão e teme que sua visão nunca se concretize."
    }
  ],
  "ordem-dos-tres": [
    {
      "name": "Mestra Oria Sem-Nome",
      "role": "Responsável pelos Candidatos ao Rito",
      "description": "Mestra Oria é a líder atual da Ordem dos Três, conhecida por sua inteligência aguçada e sua habilidade em guiar os iniciados através do complexo rito de passagem. Ela é respeitada, mas também é vista com cautela por causa da sua visão rígida da tradição.",
      "wants": "Deseja encontrar um novo corpo que garanta a continuidade da Ordem e a preservação de seus ensinamentos.",
      "hides": "Teme que a próxima escolha do corpo leve à destruição da essência da Ordem e à perda de sua própria identidade."
    },
    {
      "name": "Calen Cera-Negra",
      "role": "Guardião de Artefatos",
      "description": "Calen é um homem robusto e enigmático, encarregado de proteger os artefatos sagrados da Ordem. Ele tem um profundo conhecimento sobre a história dos objetos que guarda e é altamente respeitado por seus colegas, mas sua natureza reservada faz com que poucos se aproximem.",
      "wants": "Deseja descobrir o verdadeiro potencial de um antigo artefato que acredita estar escondido na Torre de Véspera.",
      "hides": "Esconde um temor de que sua busca possa desencadear consequências catastróficas para a Ordem."
    },
    {
      "name": "Irmã Fea do Círculo",
      "role": "Curadora e Crítica",
      "description": "Irmã Fea é uma mulher de espírito forte e opiniões firmes, conhecida por sua compaixão em curar os iniciados. Ela frequentemente questiona as imposições dos ritos de sacrifício e é vista como uma voz de dissenso dentro da Ordem.",
      "wants": "Deseja reformular os ritos para que sejam mais justos e menos dolorosos para os iniciados.",
      "hides": "Teme que sua crítica leve a um rompimento irreparável com a liderança da Ordem."
    },
    {
      "name": "Serath, Voz da Cinza",
      "role": "Historiador e Estrategista",
      "description": "Serath é uma das três vozes que compõem o corpo de Maelor Véspera, conhecido por sua frieza analítica e profundo conhecimento histórico. Ele é valorizado por sua habilidade em planejar estratégias, mas sua dificuldade em se conectar emocionalmente o torna impopular entre os iniciados.",
      "wants": "Deseja preservar a história da Ordem e garantir que suas tradições sejam mantidas.",
      "hides": "Teme que o excesso de análise possa levar à paralisia da Ordem em tempos de crise."
    },
    {
      "name": "Ilyon, Voz do Sangue",
      "role": "Comandante e Curador",
      "description": "Ilyon é a voz compassiva do corpo, atenta às necessidades dos iniciados e disposta a tomar riscos para protegê-los. Ele é admirado por sua bravura, mas sua impulsividade pode levar a decisões questionáveis.",
      "wants": "Deseja criar uma nova geração de iniciados que compreendam a importância dos sacrifícios de forma mais ampla.",
      "hides": "Esconde um medo de que suas ações impulsivas possam custar vidas e manchar o legado da Ordem."
    },
    {
      "name": "Veyra, Voz do Véu",
      "role": "Profetisa e Sonhadora",
      "description": "Veyra é a voz enigmática do corpo, conhecida por suas visões e interpretações de presságios. Sua natureza obscura e difícil de compreender a torna uma figura intrigante, mas também suscita desconfiança entre os mais céticos.",
      "wants": "Deseja decifrar os segredos dos sonhos que a visitam, acreditando que eles guardam a chave para o futuro da Ordem.",
      "hides": "Teme que suas visões possam levar a tragédias que ela não consegue evitar."
    }
  ]
};

export function charactersFor(key: string): HouseCharacter[] {
  return HOUSE_CHARACTERS[key] ?? [];
}
