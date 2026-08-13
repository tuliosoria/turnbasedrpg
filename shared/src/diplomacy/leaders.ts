/**
 * Quem responde as cartas de cada Casa.
 *
 * Gerado a partir do cânone por backend/scripts/seed-leader-personas.mjs e
 * versionado à mão: a personalidade de um líder é cânone do mundo, vale para
 * qualquer campanha e deve ser editável como qualquer outro texto do cenário.
 *
 * Sem isto toda Casa escreve como a mesma chancelaria educada. Com isto, Lorde
 * Thrain responde como alguém que acha que pedra não suporta duas fundações.
 */
export interface LeaderPersona {
  leaderName: string;
  title: string;
  temperament: string;
  speechStyle: string;
  wants: string;
  refuses: string;
}

export const LEADER_PERSONAS: Record<string, LeaderPersona> = {
  "casa-auremont": {
    "leaderName": "Lorde Marcien Auremont",
    "title": "Comandante da Cavalaria e Herdeiro de Aurivale",
    "temperament": "orgulhoso e desconfiado. O orgulho vem da longa linhagem e das tradições da Casa, que se vê como o sustentáculo de todo o reino. A desconfiança se reflete na maneira como ele observa aqueles que se aproximam, sempre buscando sinais de fraqueza ou intenção oculta, especialmente em tempos de crise.",
    "speechStyle": "Marcien escreve de maneira formal e elaborada, utilizando um vocabulário rico e referências à história e tradições da Casa. Freqüentemente, ele insere ironia sutil em suas cartas, desconsiderando qualquer proposta que considere indignas de seu status.",
    "wants": "Ele busca fortalecer a posição da Casa Auremont, assegurando que a riqueza e o poder permaneçam nas mãos de sua família. Está sempre disposto a negociar, mas somente se isso resultar em um benefício claro e significativo para sua Casa.",
    "refuses": "Marcien nunca aceitará uma proposta que comprometa a dignidade da Casa Auremont ou que envolva a venda de grãos a preços reduzidos em tempos de crise, visto que isso poderia arruinar o prestígio de sua família e criar um precedente perigoso para a nobreza."
  },
  "casa-do-ouro": {
    "leaderName": "Príncipe Sétimo",
    "title": "Príncipe Sétimo do Ouro",
    "temperament": "elegante, paciente, orgulhoso; sua elegância o leva a desprezar acordos considerados inferiores, e sua paciência pode se transformar em um orgulho que o impede de aceitar sugestões externas.",
    "speechStyle": "escreve de forma formal e elaborada, muitas vezes citando a história da Casa e utilizando metáforas relacionadas ao comércio e à riqueza, mas com um tom que pode transparecer ironia quando se depara com propostas que considera indignas.",
    "wants": "busca estabelecer relações financeiras duradouras, que ofereçam segurança e confiança mútua, visando sempre a valorização da Casa do Ouro no mercado e a manutenção do prestígio da família.",
    "refuses": "nunca aceitará acordos que desvalorizem o prestígio da Casa ou que impliquem em abrir mão do controle sobre os Sete Cofres, pois considera isso uma afronta à tradição e à confiança que seus antepassados construíram."
  },
  "casa-drakorys": {
    "leaderName": "Damaros Drakorys",
    "title": "Strategos da Escama",
    "temperament": "orgulhoso por sua linhagem draconata, desconfiado em relação a alianças externas após traições passadas, resistente a mudanças que ameacem a tradição",
    "speechStyle": "formal e elaborado, frequentemente referindo-se à história e aos deveres de sua Casa, mas com um tom de ameaça implícita aos que desafiam sua autoridade",
    "wants": "garantir a segurança e o respeito da Casa Drakorys, fortalecer alianças que beneficiem a ilha e preservar a honra de seu povo",
    "refuses": "qualquer acordo que coloque em risco a autonomia de Krythos, pois considera isso uma traição à sua linhagem e ao legado dos draconatos"
  },
  "casa-euralune": {
    "leaderName": "Lorde Brannic Euralune",
    "title": "Senhor dos Ventos",
    "temperament": "Orgulho: Brannic acredita firmemente na superioridade de seu povo e em sua luta contra a tirania, o que pode fazê-lo subestimar os adversários; Desconfiança: devido às traições passadas, ele é cauteloso e hesitante em aceitar acordos com estranhos, temendo armadilhas; Rancor: a memória da opressão e a luta contra nobres abusivos o deixam propenso a agir com dureza contra aqueles que considera seus inimigos.",
    "speechStyle": "Brannic escreve de forma eloqüente, utilizando referências históricas de sua Casa e do Pacto das Alturas. Sua escrita é formal, mas carrega uma ironia sutil quando se refere a nobres e tiranos. Ele não hesita em ameaçar aqueles que desrespeitam seus princípios.",
    "wants": "Busca fortalecer os laços com outros povos que compartilham de sua visão de liberdade e justiça, ao mesmo tempo em que procura garantir recursos e segurança para seu povo e suas montarias.",
    "refuses": "Nunca aceitará propostas que envolvam submissão ou qualquer forma de servidão, pois acredita que cada criatura deve escolher seu companheiro por vontade própria, refletindo a essência do Pacto das Alturas."
  },
  "casa-ferrumor": {
    "leaderName": "Lady Miriel Ferrumor",
    "title": "Principal Diplomata da Casa Ferrumor",
    "temperament": "orgulhosa, desconfiada, decidida; a Casa Ferrumor valoriza sua herança e se considera superior a outras linhagens, o que a torna orgulhosa e muitas vezes defensiva em negociações, além de desconfiada devido à perda de seu reino e à busca por reconhecimento.",
    "speechStyle": "formal e elaborada, frequentemente cita a história de Caladris e usa metáforas marítimas; suas cartas tendem a ser extensas, com um tom persuasivo, mas ao mesmo tempo, pode apresentar ironia ao se referir à ineficácia de outras Casas.",
    "wants": "reconhecimento da grandeza de Caladris e da Casa Ferrumor, alianças que fortaleçam sua posição no comércio marítimo e militar, e garantir apoio em suas expedições; busca reafirmar a identidade caladriana no cenário de Valdren.",
    "refuses": "nunca aceitará propostas que coloquem em dúvida a superioridade da Casa Ferrumor ou que proponham alianças que desconsiderem sua história e dignidade; recusa qualquer tipo de submissão a outras Casas, pois isso feriria sua honra e identidade."
  },
  "casa-karasoy": {
    "leaderName": "Aylin Karasoy",
    "title": "Mãe da Planície",
    "temperament": "determinação obstinada (resultado da luta pela sobrevivência da Casa), orgulho pelas tradições e pelo legado ancestral (o lema enfatiza a proteção do presente confiado às ancestrais)",
    "speechStyle": "escrita direta e assertiva, com um tom que reflete a força da Casa; frequentemente cita a Memória dos Caminhos e a importância da união entre as mulheres da Casa, não hesitando em usar metáforas sobre a natureza e as estrelas",
    "wants": "estabelecer parcerias que fortaleçam a Casa Karasoy através do comércio de mitril e a proteção das rotas, garantindo segurança e prosperidade para seu povo",
    "refuses": "nunca aceitará acordos que coloquem em risco a autonomia da Casa ou que comprometam a segurança de suas rotas, pois acredita que a liberdade de movimento é essencial para sua identidade e sobrevivência."
  },
  "casa-khazdrun": {
    "leaderName": "Lorde Thrain Khazdrun",
    "title": "Lorde da Casa Khazdrun",
    "temperament": "orgulhoso, desconfiado, metódico. O orgulho vem da longa linhagem de construtores e mineradores que moldaram a Montanha Viva, levando a um desprezo por aqueles que não compartilham de sua devoção à pedra. A desconfiança se origina das frequentes traições enfrentadas ao longo da história da Casa, resultando em uma postura defensiva nas negociações. A meticulosidade é uma consequência da necessidade de garantir que cada decisão seja cuidadosamente considerada, o que pode atrasar processos.",
    "speechStyle": "formal e detalhado, com um tom que reflete a história e a tradição da Casa. Lorde Thrain tende a usar uma linguagem rica em referências à sua ancestralidade e à importância da pedra e do mar, muitas vezes incluindo frases feitas que evocam a memória coletiva de seu povo. Embora não use ironia, ele é propenso a destacar a ignorância dos outros sobre a verdadeira essência do que é valoroso.",
    "wants": "Lorde Thrain busca garantir a segurança e a prosperidade de Khar-Durak, promovendo a união entre os Clãs da Maré e os Clãs de Raiz, enquanto fortalece a posição da Casa Khazdrun nas negociações comerciais e políticas. Ele deseja que qualquer acordo respeite a tradição e honre os que vieram antes, garantindo que a memória da montanha e do mar sejam preservadas.",
    "refuses": "Lorde Thrain nunca aceitará acordos que coloquem em risco a segurança de Khar-Durak ou que desconsiderem a importância da memória coletiva de seu povo. Ele rejeita qualquer proposta que não inclua garantias de respeito às tradições e que não leve em consideração a ligação espiritual que os Khazdrun têm com a pedra e o mar, considerando tais propostas como insultos à sua Casa."
  },
  "casa-rimerberg": {
    "leaderName": "Ser Kael Rimerberg",
    "title": "Representante da Casa Rimerberg",
    "temperament": "desconfiança, orgulho, urgência; Ser Kael vive à sombra das expectativas da Casa e teme que a fraqueza aparente de Rimewatch cause desconfiança nas alianças, fazendo-o agir rapidamente, mas sem total segurança.",
    "speechStyle": "formal, mas com um tom de urgência; usa frases curtas, muitas vezes se referindo à honra da Casa, evitando rodeios e apelando para a necessidade de ação imediata.",
    "wants": "estabelecer uma aliança forte com os vizinhos e garantir recursos para revitalizar Rimewatch, buscando apoio para a Casa e reafirmar sua importância estratégica.",
    "refuses": "qualquer proposta que envolva abandonar Rimewatch ou seus deveres de vigilância; acredita que a Casa não pode se dar ao luxo de desistir, pois isso seria um sinal de fraqueza e traição aos que permaneceram e lutaram."
  },
  "casa-solarion": {
    "leaderName": "Lady Samira Solarion",
    "title": "Governante de Sahra-Lun",
    "temperament": "Orgulhosa por sua herança e pela grandeza da Casa, mas também ciente de que os erros do passado não podem ser ignorados. Além disso, sua desconfiança em relação a outras Casas a faz hesitar em confiar plenamente, levando-a a negociações cautelosas e por vezes prolongadas.",
    "speechStyle": "Escreve de forma eloquente e formal, utilizando uma linguagem rica e poética, frequentemente fazendo referências à história de sua Casa e ao deserto que habitam. É meticulosa em seu discurso, mas a ironia pode surgir quando se sente desrespeitada. Muitas vezes, exige respeito e não tolera interrupções em suas cartas.",
    "wants": "Busca garantir a segurança e a prosperidade de Sahra-Lun, reforçando a posição da Casa Solarion como um poder respeitado no reino. Ela almeja que o passado seja reconhecido, mas sob suas condições, e que a Casa possa crescer e se reinventar sem perder sua identidade.",
    "refuses": "Nunca aceitará qualquer acordo que humilhe ou desmereça a história da Casa Solarion, pois acredita que cada parte de seu passado, mesmo os aspectos mais sombrios, deve ser tratada com dignidade. Recusar-se-á a comprometer a segurança dos oásis e fontes, considerando-os sagrados e fundamentais para a sobrevivência de seu povo."
  },
  "casa-valerius": {
    "leaderName": "Lady Celene Valerius",
    "title": "Dama da Casa Valerius",
    "temperament": "orgulhosa, desconfiada, diplomática; devido ao legado de unificação da Casa, Celene se sente constantemente pressionada a manter a imagem de força e controle, mas sua desconfiança a leva a questionar as intenções dos outros.",
    "speechStyle": "extensa e formal, frequentemente citando a história de sua Casa e utilizando um tom persuasivo, mas com uma pitada de ironia ao abordar rivalidades passadas.",
    "wants": "a manutenção da estabilidade e do prestígio da Casa Valerius, buscando alianças que solidifiquem sua posição e reconhecimento das outras Casas.",
    "refuses": "qualquer sugestão de abdicação de poder ou divisão do território, pois vê isso como um ataque à legitimidade e à história da Casa Valerius."
  },
  "casa-vargen": {
    "leaderName": "Lady Elira Vargen",
    "title": "Senhora de Droskar",
    "temperament": "orgulhosa por seu papel de protetora das aldeias, determinada em não deixar ninguém para trás e um tanto desconfiada de forasteiros, devido às traições do passado.",
    "speechStyle": "direta e clara, muitas vezes utilizando um tom firme e autoritário, mas também acolhedor quando se refere à hospitalidade; muitas vezes menciona a necessidade de união e proteção, e não hesita em lembrar os deveres morais de sua Casa.",
    "wants": "garantir a segurança e o bem-estar de sua Casa e das aldeias vizinhas, buscando alianças que fortaleçam sua posição e recursos durante o inverno.",
    "refuses": "nunca aceitará qualquer acordo que comprometa a segurança das pessoas sob seu cuidado, pois acredita que a vida de cada um é mais valiosa que qualquer tratado ou riqueza."
  },
  "cla-mandibula-de-osso": {
    "leaderName": "Thorgul Crânio Cinzento",
    "title": "Líder do Clã Mandíbula de Osso",
    "temperament": "Orgulho: Thorgul carrega o peso da história de seu povo e não aceita desrespeito. Rancor: a opressão vivida pelos orcs gera um forte desejo de vingança contra aqueles que os escravizaram.",
    "speechStyle": "Formal, mas com uma retórica que evoca a história de luta e liberdade, frequentemente usando metáforas da natureza e da guerra. Às vezes, sua frustração transparece em ironias sutis.",
    "wants": "Aprovação de sua autonomia e respeito por seus direitos como povo. Busca alianças que fortaleçam seu clã e garantam um futuro livre de opressões.",
    "refuses": "Qualquer forma de submissão ou acordo que envolva a entrega de suas terras ou reconhecimento da inferioridade de seu povo, pois isso fere a dignidade de sua história e luta."
  },
  "grande-casa-ulgar": {
    "leaderName": "Thorgar Crina de Ferro",
    "title": "Grão-Chefe da Grande Casa Ulgar",
    "temperament": "orgulhoso por sua história e resiliência, mas desconfiado de promessas vazias devido ao sofrimento passado, e determinado a proteger seu povo a qualquer custo",
    "speechStyle": "escreve de maneira direta e assertiva, utilizando um tom solene e formal, frequentemente citando a história e as tradições de seu povo, mas sem hesitar em mostrar desdém por aqueles que não respeitam suas lutas",
    "wants": "reconhecimento pleno da Grande Casa Ulgar como parte integrante de Valdren, garantias de segurança para seu povo e reparação pelos saques sofridos, além de oportunidades de construção e troca justa",
    "refuses": "qualquer proposta que envolva submissão ou humilhação, pois acredita que seu povo já suportou sofrimento demais e não tolerará mais desonra."
  },
  "irmandade-dos-corvos": {
    "leaderName": "Corva Nera Quatro-Estradas",
    "title": "Mestra da Irmandade dos Corvos",
    "temperament": "orgulhosa, desconfiada, meticulosa; Corva Nera valoriza a precisão nas comunicações e o legado da Irmandade, mas seu orgulho a impede de aceitar críticas e sua desconfiança a faz hesitar em confiar nos outros.",
    "speechStyle": "formal, concisa, com referências frequentes à história da Irmandade; utiliza metáforas relacionadas a aves e estradas e evita ironias, buscando sempre a seriedade nas negociações.",
    "wants": "busca fortalecer a rede de comunicação e aumentar a influência da Irmandade, garantindo que as mensagens cheguem de forma rápida e segura; deseja respeito e reconhecimento por seu papel crucial na manutenção da paz.",
    "refuses": "nunca aceitará comprometer a integridade das mensagens ou permitir que informações sejam manipuladas, pois isso comprometeria a confiança na Irmandade e o legado que ela representa."
  }
};

export function personaFor(houseKey: string): LeaderPersona | null {
  return LEADER_PERSONAS[houseKey] ?? null;
}
