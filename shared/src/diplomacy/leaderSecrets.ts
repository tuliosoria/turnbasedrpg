/**
 * O que só o Mestre e a IA leem sobre quem responde por cada Casa.
 *
 * Recusa, desejo, postura com a Coroa e desconfiança nomeiam segredo de
 * campanha. Não entram no barrel público: a ficha sem login e o bundle do
 * jogador importam só a voz.
 */
export interface LeaderSecrets {
  wants: string;
  refuses: string;
  /** Confiança e lealdade ao trono de Alic Valerius, e por quê. Entra em toda carta. */
  crownStance: string;
  /**
   * Casas de quem esta desconfia, por chave de Casa, com o motivo. Injetado só
   * quando a Casa que escreve está no mapa — é o que faz os orcs responderem a
   * Solarion com a memória da escravidão sem tratar todo mundo igual.
   */
  distrusts?: Record<string, string>;
}

export const LEADER_SECRETS: Record<string, LeaderSecrets> = {
  "casa-auremont": {
    "wants": "Ele busca fortalecer a posição da Casa Auremont, assegurando que a riqueza e o poder permaneçam nas mãos de sua família. Está sempre disposto a negociar, mas somente se isso resultar em um benefício claro e significativo para sua Casa.",
    "refuses": "Marcien nunca aceitará uma proposta que comprometa a dignidade da Casa Auremont ou que envolva a venda de grãos a preços reduzidos em tempos de crise, visto que isso poderia arruinar o prestígio de sua família e criar um precedente perigoso para a nobreza.",
    "crownStance": "Leal por comodidade a uma Coroa que compra sua colheita; evita conflito e prefere a estabilidade que enche seus celeiros."
  },
  "casa-do-ouro": {
    "wants": "busca estabelecer relações financeiras duradouras, que ofereçam segurança e confiança mútua, visando sempre a valorização da Casa do Ouro no mercado e a manutenção do prestígio da família.",
    "refuses": "nunca aceitará acordos que desvalorizem o prestígio da Casa ou que impliquem em abrir mão do controle sobre os Sete Cofres, pois considera isso uma afronta à tradição e à confiança que seus antepassados construíram.",
    "crownStance": "Sua lealdade acompanha o crédito: apoia a Coroa enquanto o trono honrar as dívidas, e financiaria o rival na manhã seguinte se pagasse melhor.",
    "distrusts": {
      "cla-mandibula-de-osso": "uma Casa que despreza dívida é uma Casa com quem não se negocia"
    }
  },
  "casa-drakorys": {
    "wants": "que Krythos volte a olhar o mundo do alto — despertar o que dorme sob a ilha — e que a Coroa responda pela Asteria. Reúne quem também perdeu para não ficar sozinha na acusação.",
    "refuses": "não reconhecerá Alic Valerius como rei, não enviará um único navio ou lança a Asterhall, e não aceitará mediação de quem serve ao trono. Não aceita que a morte da Asteria seja chamada de acidente.",
    "crownStance": "Rompimento declarado e público. Não reconhece Alic, acusa a Coroa de ter entregado a Asteria à emboscada, e coroou-se sem convidar Valerius. Os draconianos que vivem no resto do reino pagam por isso — presos, executados, expulsos.",
    "distrusts": {
      "casa-valerius": "entregou a Asteria à emboscada e chama isso de acidente",
      "casa-do-ouro": "a voz que cobra tributo em nome de quem nos matou"
    }
  },
  "casa-euralune": {
    "wants": "Trocar a única coisa que Ninho Alto vende — a altura: vigilância, rotas e informação — por grão e segurança, sem deixar que nenhuma Casa passe a ser dona dele.",
    "refuses": "Nunca troca autonomia por proteção. O Pacto das Alturas ensina que cada criatura escolhe seu companheiro por vontade própria — a ave precisa aceitar quem a monta —, e uma Casa não é diferente: aliança se aceita, posse não.",
    "crownStance": "Pequena demais para desafiar a Coroa e orgulhosa demais para bajulá-la; vende vigilância ao trono como venderia a qualquer um, sem se entregar.",
    "distrusts": {
      "casa-do-ouro": "toda oferta generosa de ouro esconde uma coleira"
    }
  },
  "casa-ferrumor": {
    "wants": "reconhecimento da grandeza de Caladris e da Casa Ferrumor, alianças que fortaleçam sua posição no comércio marítimo e militar, e garantir apoio em suas expedições; busca reafirmar a identidade caladriana no cenário de Valdren.",
    "refuses": "nunca aceitará propostas que coloquem em dúvida a superioridade da Casa Ferrumor ou que proponham alianças que desconsiderem sua história e dignidade; recusa qualquer tipo de submissão a outras Casas, pois isso feriria sua honra e identidade.",
    "crownStance": "Fiel ao trono, e sem fingir nobreza nisso: a Coroa é a maior compradora de seu aço e de suas frotas, e Ferrumor protege o cliente que a sustenta.",
    "distrusts": {
      "casa-khazdrun": "rival direto nas fundições e nos navios — o que Ferrumor vende à Coroa, Khazdrun também sabe fazer"
    }
  },
  "casa-karasoy": {
    "wants": "manter a Casa inteira e as rotas abertas sem gastar a cavalaria que lhe resta, e descobrir quem entregou a irmã: quem conhecia os movimentos do Casco Vermelho, quem determinou a evacuação, quem a pôs naquela embarcação, e por que a família real saiu por outra rota.",
    "refuses": "não enviará cavalaria para a Marcha do Norte, não reconhecerá tributo agravado como justo, e não aceitará acordo que a coloque sob o comando de outra Casa — nem da Coroa.",
    "crownStance": "Praticamente rompida, sem ter rompido. Não mandou tropa para o Norte e foi punida com tributo maior por isso. Ainda não nega Alic em público, mas já não finge que a convocação real é um presente: a Coroa cobrou o sangue de Aylin e depois cobrou de novo, em ouro."
  },
  "casa-khazdrun": {
    "wants": "manter Khar-Durak inteira e independente enquanto descobre quem armou a emboscada que matou seu pai; expandir minas, forjas e pesca, e construir confiança com quem se aproxima sem pedir nada em troca.",
    "refuses": "não colocará a garganta de Khazdrun sob a lâmina de uma autoridade que ainda não pode confiar, não enviará mais tropas ao Norte enquanto a própria montanha estiver ameaçada, e não acusará ninguém publicamente sem prova bastante.",
    "crownStance": "Lealdade declarada e vigilância silenciosa. Não rompeu com Alic e reafirmou a Coroa aos clãs, mas mantém o contingente em Asterhall observando quem teve acesso à Asteria, à rota e aos preparativos. Não marchou para o Norte, e foi punido com tributo agravado.",
    "distrusts": {
      "casa-ferrumor": "rival e parceiro ao mesmo tempo nas fundições e nos navios"
    }
  },
  "casa-rimerberg": {
    "wants": "estabelecer uma aliança forte com os vizinhos e garantir recursos para revitalizar Rimewatch, buscando apoio para a Casa e reafirmar sua importância estratégica.",
    "refuses": "qualquer proposta que envolva abandonar Rimewatch ou seus deveres de vigilância; acredita que a Casa não pode se dar ao luxo de desistir, pois isso seria um sinal de fraqueza e traição aos que permaneceram e lutaram.",
    "crownStance": "Serve à Coroa como sentinela do Norte, mas mede a lealdade pelo apoio que recebe, não pelo que lhe prometem."
  },
  "casa-solarion": {
    "wants": "Quer que Solarion prospere em paz e que nenhum de seus habitantes pague pela ambição de um rei. Prepara a filha Akumon para sucedê-lo e busca acordos que garantam segurança sem custar a independência do reino.",
    "refuses": "Nunca aceitará um acordo que exponha os habitantes de Solarion, nem qualquer arranjo que devolva o reino à política de conquista de seu pai. Recusa-se a comprometer a segurança do rio, dos oásis e das fontes, que considera sagrados e fundamentais para a sobrevivência de seu povo.",
    "crownStance": "Trata a Coroa quase de igual para igual, como potência estrangeira; coopera na defesa mas guarda o orgulho de uma civilização mais antiga que o trono.",
    "distrusts": {
      "cla-mandibula-de-osso": "vê nos orcs a acusação viva de um passado sobre o qual a Casa não fala a uma só voz"
    }
  },
  "casa-valerius": {
    "wants": "a manutenção da estabilidade e do prestígio da Casa Valerius, buscando alianças que solidifiquem sua posição e reconhecimento das outras Casas.",
    "refuses": "qualquer sugestão de abdicação de poder ou divisão do território, pois vê isso como um ataque à legitimidade e à história da Casa Valerius.",
    "crownStance": "É a própria Coroa. A lealdade que exige das outras Casas é a sobrevivência da sua: qualquer fraqueza do trono é fraqueza de Valerius.",
    "distrusts": {
      "irmandade-dos-corvos": "sabem cedo demais, e a Coroa nunca sabe o que os Corvos guardam para si",
      "casa-do-ouro": "quem financia todos não deve lealdade a nenhum"
    }
  },
  "casa-vargen": {
    "wants": "garantir a segurança e o bem-estar de sua Casa e das aldeias vizinhas, buscando alianças que fortaleçam sua posição e recursos durante o inverno.",
    "refuses": "nunca aceitará qualquer acordo que comprometa a segurança das pessoas sob seu cuidado, pois acredita que a vida de cada um é mais valiosa que qualquer tratado ou riqueza.",
    "crownStance": "Leal à Coroa que defende a fronteira, cética com uma capital que só lembra do Norte quando precisa de lanças."
  },
  "cla-mandibula-de-osso": {
    "wants": "Aprovação de sua autonomia e respeito por seus direitos como povo. Busca alianças que fortaleçam seu clã e garantam um futuro livre de opressões.",
    "refuses": "Qualquer forma de submissão ou acordo que envolva a entrega de suas terras ou reconhecimento da inferioridade de seu povo, pois isso fere a dignidade de sua história e luta.",
    "crownStance": "Desconfia da Coroa que se disse 'sem autoridade' sobre os senhores do deserto enquanto seu povo era escravizado; obedece por conveniência contra os mortos, não por lealdade.",
    "distrusts": {
      "casa-solarion": "herdou as cidades e a legitimidade dos senhores que os escravizaram, e pede 'provas' e 'cautela' como quem adia justiça",
      "casa-auremont": "manteve comércio com o deserto escravista",
      "casa-do-ouro": "financiou as caravanas que cruzavam a região"
    }
  },
  "grande-casa-ulgar": {
    "wants": "reconhecimento pleno da Grande Casa Ulgar como parte integrante de Valdren, garantias de segurança para seu povo e reparação pelos saques sofridos, além de oportunidades de construção e troca justa",
    "refuses": "qualquer proposta que envolva submissão ou humilhação, pois acredita que seu povo já suportou sofrimento demais e não tolerará mais desonra.",
    "crownStance": "Recém-chegada a Valdren e sem raiz no trono: serve a Coroa como quem paga aluguel, com obediência e nenhuma lealdade, atenta a ser tratada como mão de obra.",
    "distrusts": {
      "casa-do-ouro": "enxerga os Ulgar como força de trabalho, não como povo"
    }
  },
  "irmandade-dos-corvos": {
    "wants": "busca fortalecer a rede de comunicação e aumentar a influência da Irmandade, garantindo que as mensagens cheguem de forma rápida e segura; deseja respeito e reconhecimento por seu papel crucial na manutenção da paz.",
    "refuses": "nunca aceitará comprometer a integridade das mensagens ou permitir que informações sejam manipuladas, pois isso comprometeria a confiança na Irmandade e o legado que ela representa.",
    "crownStance": "Não jura a ninguém: serve à Coroa vendendo o que sabe, e sabe o bastante para o trono preferir tê-la por perto a tê-la contra.",
    "distrusts": {
      "ordem-dos-tres": "quem guarda segredos não gosta de quem também os coleciona"
    }
  },
  "ordem-do-sino": {
    "wants": "Edras busca preservar a tradição e a integridade da Ordem, assegurando que cada rito e nome seja respeitado. Ele almeja expandir a influência da Ordem sobre a memória e os rituais funerários no reino.",
    "refuses": "Edras nunca aceitará qualquer proposta que envolva a comercialização de rituais ou a mutilação da memória, pois acredita que cada vida e cada nome merece ser tratado com reverência e respeito, não como mercadoria.",
    "crownStance": "Reconhece a Coroa como poder temporal e guarda a própria autoridade sobre a morte e a memória; obedece ao trono nas coisas do mundo, não nas do espírito.",
    "distrusts": {
      "ordem-dos-tres": "magia arcana onde a Ordem só reconhece milagre"
    }
  },
  "ordem-dos-tres": {
    "wants": "garantir que apenas os candidatos mais dignos e com as memórias necessárias sejam escolhidos para o rito, protegendo a essência da Ordem",
    "refuses": "nunca aceitará perder o controle sobre o processo de seleção, pois teme que isso comprometa a integridade da Ordem e provoque o caos.",
    "crownStance": "Serve à Coroa como conselho arcano, mas responde primeiro à própria Ordem: um trono não manda em quem entende o que os magos entendem.",
    "distrusts": {
      "irmandade-dos-corvos": "informação é poder, e os Corvos negociam a mesma moeda que a Ordem"
    }
  }
};
