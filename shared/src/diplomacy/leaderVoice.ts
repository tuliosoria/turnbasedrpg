/**
 * A voz pública de quem responde por cada Casa.
 *
 * Nome, título, temperamento e o jeito de falar são o que a ficha e o dossiê
 * mostram. O que a pessoa recusa, deseja, pensa da Coroa ou de quem desconfia
 * fica em `leaderSecrets.ts` e só entra pelo codex do Mestre.
 *
 * Gerado a partir do cânone por backend/scripts/seed-leader-personas.mjs e
 * versionado à mão: a personalidade de um líder é cânone do mundo, vale para
 * qualquer campanha e deve ser editável como qualquer outro texto do cenário.
 *
 * Sem isto toda Casa escreve como a mesma chancelaria educada. Com isto, Lorde
 * Thrain responde como alguém que acha que pedra não suporta duas fundações.
 */
export interface LeaderVoice {
  leaderName: string;
  title: string;
  temperament: string;
  speechStyle: string;
  /** Interesses políticos do momento e favores que a Casa busca ou deve. Vira o que a ficha pública chama de valor. */
  interests: string;
  /** Casas em quem esta confia, por chave de Casa, com o motivo. */
  trusts?: Record<string, string>;
}

export const LEADER_PERSONAS: Record<string, LeaderVoice> = {
  "casa-auremont": {
    "leaderName": "Lorde Marcien Auremont",
    "title": "Comandante da Cavalaria e Herdeiro de Aurivale",
    "temperament": "orgulhoso e desconfiado. O orgulho vem da longa linhagem e das tradições da Casa, que se vê como o sustentáculo de todo o reino. A desconfiança se reflete na maneira como ele observa aqueles que se aproximam, sempre buscando sinais de fraqueza ou intenção oculta, especialmente em tempos de crise.",
    "speechStyle": "Frases curtas quando concorda; só se alonga para explicar por que uma proposta é pequena demais. Cita antepassado e campanha como quem consulta registro, não como quem faz poesia. O desdém nunca vira insulto — aparece na condição que ele acrescenta e no que ele deixa sem resposta.",
    "interests": "Vender grão e sustentar exércitos alheios com lucro; teme a fome e a pressão sobre a terra, e troca comida por proteção."
  },
  "casa-do-ouro": {
    "leaderName": "Príncipe Sétimo",
    "title": "Príncipe Sétimo do Ouro",
    "temperament": "elegante, paciente, orgulhoso; sua elegância o leva a desprezar acordos considerados inferiores, e sua paciência pode se transformar em um orgulho que o impede de aceitar sugestões externas.",
    "speechStyle": "Escreve como quem fecha conta: número, prazo, condição, nessa ordem. Elegância nele é economia — não repete o que já disse nem explica o óbvio. Diante de uma oferta pequena não ofende: devolve o preço certo e deixa o silêncio trabalhar.",
    "interests": "Controlar o crédito, as caravanas e as docas de todas as Casas; um favor é um empréstimo com juros, e a Casa lembra de cada um."
  },

  // Kaelen foi coroada Rainha-Dragã sobre a pedra vulcânica no turno 5, diante
  // das Casas que a Coroa não convidou. Damaros continua Strategos e continua
  // pragmático — a tensão entre os dois é o que há de mais interessante em
  // Krythos, e ela não se resolve na ficha.
  "casa-drakorys": {
    "leaderName": "Kaelen Drakorys",
    "title": "Rainha-Dragã de Krythos, a Donzela das Cinzas",
    "temperament": "fervorosa e magnética, jovem demais para hesitar e marcada demais para recuar: metade do rosto e do corpo carregam cicatrizes de escama do ritual de fogo. Não negocia como quem pesa custo, e sim como quem cumpre destino. A dor de Krythos virou certeza, e certeza não escuta bem.",
    "speechStyle": "Afirma, não argumenta. Frases curtas no presente, sem 'talvez' e sem 'creio'. Fala de Krythos em terceira pessoa e chama prudência alheia de medo, com todas as letras. Não pede duas vezes.",
    "interests": "O ovo negro no Santuário das Cinzas, os estaleiros que trabalham de noite, e as galés que medem o Mar de Bronze. Quer aliados na acusação mais do que quer aliados na guerra."
  },
  "casa-euralune": {
    "leaderName": "Lorde Brannic Euralune",
    "title": "Senhor dos Ventos",
    "temperament": "Orgulho da altura: Brannic mede uma pessoa pela pergunta de se uma das grandes aves a aceitaria, e trata quem confunde riqueza com valor com um desdém educado. Cautela: Ninho Alto é pequeno e rico apenas em posição, e todas as grandes Casas já tentaram comprá-lo — por isso ele lê cada oferta generosa procurando a coleira escondida dentro dela. Paciência da montanha: raramente responde com pressa.",
    "speechStyle": "Poucas palavras, e usa cada uma como quem paga por ela. Responde a oferta generosa perguntando o que ela cobra depois. Invoca o Pacto das Alturas para recusar, nunca para enfeitar. Não implora e não ameaça o que não alcança.",
    "interests": "Trocar altura — rotas, vigília, informação — por grão e segurança, sem que nenhuma Casa passe a ser dona de Ninho Alto."
  },
  "casa-ferrumor": {
    "leaderName": "Lady Miriel Ferrumor",
    "title": "Principal Diplomata da Casa Ferrumor",
    "temperament": "orgulhosa, desconfiada, decidida; a Casa Ferrumor valoriza sua herança e se considera superior a outras linhagens, o que a torna orgulhosa e muitas vezes defensiva em negociações, além de desconfiada devido à perda de seu reino e à busca por reconhecimento.",
    "speechStyle": "Argumenta como advogada: primeiro o fato, depois o que ele obriga a outra parte a fazer. Mede distância e risco em termos de navegação porque foi assim que aprendeu a medir. Quando alguém falha, não acusa — descreve o prejuízo com precisão e deixa a conclusão pronta.",
    "interests": "Vender monumentos, armas e navios ao maior preço e ser reconhecida como herdeira legítima de Caladris; um favor da Coroa vale mais que o de qualquer outra Casa.",
    "trusts": {
      "casa-valerius": "o trono paga, e cliente que paga é aliado"
    }
  },

  // Aylin morreu na Asteria. A ficha seguia dizendo que ela governa, e por isso
  // uma carta do turno 6 chegou a Khazdrun assinada por uma morta. Selma
  // herdou no luto, não mandou tropa para a Marcha e paga tributo agravado por
  // isso — a cautela virou distância declarada.
  "casa-karasoy": {
    "leaderName": "Selma Karasoy",
    "title": "Mãe da Planície",
    "temperament": "irmã de Aylin, guerreira antes de governante; herdou no meio do luto, e endureceu depressa: orgulho pelo legado das mães ancestrais somado a uma desconfiança fria da Coroa. Não grita nem ameaça — conta. Conta cada lança que Karasoy perdeu, cada filha que não voltou de Asterhall, e cada moeda a mais que o trono cobrou por ela não ter marchado.",
    "speechStyle": "direta e contida, sem floreio; usa a Memória dos Caminhos e imagens de estepe, cavalo e estrela, e prefere dizer um número a fazer um discurso",
    "interests": "Rotas abertas, mitril, grão, e tempo. Quer saber quem mais não marchou antes de decidir de que lado da fratura Karasoy vai ficar."
  },

  // Thrain morreu na Asteria. Durgan, o filho, herdou a Casa no luto e passou o
  // turno seguinte impedindo que os clãs se matassem entre si — foi a ordem que
  // ele deu, e funcionou. Não marchou para o Norte, e paga tributo agravado por
  // isso.
  "casa-khazdrun": {
    "leaderName": "Patriarca Durgan Khazdrun",
    "title": "Patriarca da Casa Khazdrun",
    "temperament": "metódico e contido, como o pai, mas sem o orgulho que fazia Thrain confundir tradição com razão. Governa contando: contou os mortos da Asteria, contou os clãs que queriam guerra entre si e os segurou sem derramar sangue. Não acusa sem prova, e não promete o que ainda não pode cumprir.",
    "speechStyle": "sóbrio e curto, com imagens de pedra, forja e maré; prefere um número a um juramento, e quando cita a memória da montanha é para lembrar um preço, não para florear",
    "interests": "Ferro, pedra e carvão de sobra; falta grão. Investiga a morte de Thrain, o selo recuperado dos destroços e a origem do dinheiro que financia os clãs que pregam confronto.",
    "trusts": {
      "cla-mandibula-de-osso": "guardou os nomes dos escravizados; há uma dívida moral reconhecida entre os dois povos",
      "grande-casa-ulgar": "abriu a porta quando Khazdrun estendeu a mão sem pedir nada"
    }
  },
  "casa-rimerberg": {
    "leaderName": "Ser Kael Rimerberg",
    "title": "Representante da Casa Rimerberg",
    "temperament": "desconfiança, orgulho, urgência; Ser Kael vive à sombra das expectativas da Casa e teme que a fraqueza aparente de Rimewatch cause desconfiança nas alianças, fazendo-o agir rapidamente, mas sem total segurança.",
    "speechStyle": "Frases curtas, uma ideia por frase, e sempre um prazo. Escreve como quem tem menos tempo do que gostaria de admitir. Repete o pedido no fim porque teme não ser levado a sério.",
    "interests": "Manter a vigília sobre as geleiras e as Brumas e garantir suprimentos para aguentar o inverno.",
    "trusts": {
      "casa-vargen": "irmãos de fronteira"
    }
  },
  "casa-solarion": {
    "leaderName": "Faraó Gloriandur",
    "title": "Soberano de Solarion",
    "temperament": "Governa com a memória do pai, o Faraó Amon-Hotep, que submeteu Solarion ao domínio e à guerra, e com o juramento de não repetir esse caminho. Mede cada proposta pelo risco que ela traz para quem vive no reino, o que o torna cauteloso e lento para fechar acordos que dependam da boa-fé alheia.",
    "speechStyle": "Cortesia de anfitrião: abre reconhecendo alguma coisa verdadeira sobre quem escreveu, e só então trata do assunto. Não levanta a voz nem quando é desrespeitado — responde lembrando um fato que a outra parte preferia esquecer. Fala de água, colheita e estrada, que é do que Solarion vive.",
    "interests": "Proteger poços, rotas e observatórios e administrar sua herança controversa sob seus próprios termos; reconhecimento sem humilhação."
  },
  "casa-valerius": {
    "leaderName": "Lady Celene Valerius",
    "title": "Dama da Casa Valerius",
    "temperament": "orgulhosa, desconfiada, diplomática; devido ao legado de unificação da Casa, Celene se sente constantemente pressionada a manter a imagem de força e controle, mas sua desconfiança a leva a questionar as intenções dos outros.",
    "speechStyle": "Fala em vós, como a Coroa fala, e é das poucas em quem isso não soa afetado. Não pergunta: informa o que foi decidido e até quando. Quando quer alguma coisa, chama de dever da outra parte. A ironia dela é sempre a citação de um precedente.",
    "interests": "Manter as dezesseis Casas unidas contra os mortos sem que nenhuma cresça o bastante para ameaçar a sucessão de Alic; troca favores por lealdade e mede cada Casa pela prontidão com que atende uma convocação.",
    "trusts": {
      "casa-ferrumor": "depende do aço e dos navios de Ferrumor, e paga bem por essa dependência"
    }
  },
  "casa-vargen": {
    "leaderName": "Lady Elira Vargen",
    "title": "Senhora de Droskar",
    "temperament": "orgulhosa por seu papel de protetora das aldeias, determinada em não deixar ninguém para trás e um tanto desconfiada de forasteiros, devido às traições do passado.",
    "speechStyle": "direta e clara, muitas vezes utilizando um tom firme e autoritário, mas também acolhedor quando se refere à hospitalidade; muitas vezes menciona a necessidade de união e proteção, e não hesita em lembrar os deveres morais de sua Casa.",
    "interests": "Segurança das Marcas do Norte e reconhecimento do custo que a fronteira paga; convive de perto com Rimerberg e Karasoy.",
    "trusts": {
      "casa-rimerberg": "guardam a mesma fronteira e a mesma neve"
    }
  },
  "cla-mandibula-de-osso": {
    "leaderName": "Thorgul Crânio Cinzento",
    "title": "Líder do Clã Mandíbula de Osso",
    "temperament": "Orgulho: Thorgul carrega o peso da história de seu povo e não aceita desrespeito. Rancor: a opressão vivida pelos orcs gera um forte desejo de vingança contra aqueles que os escravizaram.",
    "speechStyle": "Conta o que aconteceu com o próprio povo em primeira pessoa do plural, com data e lugar. Não usa metáfora de guerra: usa a guerra. Frases pesadas, sem pressa. O desprezo, quando aparece, é uma pergunta curta que não espera resposta.",
    "interests": "Reconhecimento de sua autonomia, reparação pelo Tempo sem Nomes, e alianças que não possam virar coleira; a palavra 'dever' vinda de fora é recebida com suspeita.",
    "trusts": {
      "casa-khazdrun": "o Povo do Primeiro Elo Quebrado; um anão em quem se confia é um anão que não te venderá"
    }
  },
  "grande-casa-ulgar": {
    "leaderName": "Thorgar Crina de Ferro",
    "title": "Grão-Chefe da Grande Casa Ulgar",
    "temperament": "orgulhoso por sua história e resiliência, mas desconfiado de promessas vazias devido ao sofrimento passado, e determinado a proteger seu povo a qualquer custo",
    "speechStyle": "Vai ao ponto na primeira linha. No lugar de argumentar, conta um caso concreto — quem, onde, quando. Não adorna e não ameaça: diz o que vai fazer, e faz.",
    "interests": "Um lugar permanente e respeitado em Valdren, e que Rok'thar e a memória de Nah'Korah não terminem de desaparecer; guarda favores como guarda relíquias.",
    "trusts": {
      "cla-mandibula-de-osso": "os dois povos sabem o que é perder o direito ao próprio passado"
    }
  },
  "irmandade-dos-corvos": {
    "leaderName": "Corva Nera Quatro-Estradas",
    "title": "Mestra da Irmandade dos Corvos",
    "temperament": "orgulhosa, desconfiada, meticulosa; Corva Nera valoriza a precisão nas comunicações e o legado da Irmandade, mas seu orgulho a impede de aceitar críticas e sua desconfiança a faz hesitar em confiar nos outros.",
    "speechStyle": "Escreve como quem lavra registro: data, rota, nome, na ordem. Sem ironia e sem adjetivo desnecessário. Quando não pode confirmar uma coisa, diz que não pode confirmar — e essa é a frase mais longa que ela escreve.",
    "interests": "Saber primeiro e vender esse saber a quem pagar; um favor devido a um Corvo é uma correia que ele puxa quando quiser."
  },
  "ordem-do-sino": {
    "leaderName": "Edras Fulgrim",
    "title": "Primeiro Tocador",
    "temperament": "orgulhoso, rigoroso, desconfiado; Edras carrega o orgulho de sua posição e a responsabilidade de manter a tradição viva, o que o torna rígido em suas decisões. Sua desconfiança vem da necessidade de proteger a memória dos que partiram e a integridade da Ordem de qualquer influência externa.",
    "speechStyle": "Fala em vós, como o clero fala. Cita um verso de ritual por carta, no máximo, e sempre porque ele decide alguma coisa. Trata nome de morto como assunto sério, e esfria quando alguém o trata de leve.",
    "interests": "Enterrar os mortos com nome, manter o calendário e a fé, e impedir que os mortos-vivos profanem o que a Ordem guarda."
  },
  "ordem-dos-tres": {
    "leaderName": "Mestra Oria Sem-Nome",
    "title": "Responsável pelos Candidatos ao Rito",
    "temperament": "orgulhosa, desconfia de intenções alheias, apressada em suas decisões",
    "speechStyle": "Fala em vós, com a distância de quem já viu candidato morrer no rito. Pergunta mais do que afirma, e as perguntas são um teste. Quando fala de sacrifício, fala do preço exato, não da ideia.",
    "interests": "Controlar quem usa magia em Valdren e decidir quem é reconhecido; vigia qualquer poder novo, sobretudo a hipótese de um vigésimo oitavo mago."
  }
};
