import { HOUSE_CHARACTERS, characterId, type HouseCharacter, type HouseFigure } from "./characters.js";

/**
 * O que cada figura quer e o que ela esconde. Só o Mestre e a IA leem isto;
 * o elenco público em `characters.ts` não carrega estes campos.
 */
export const CHARACTER_SECRETS: Record<string, Record<string, { wants: string; hides: string }>> = {
  "casa-auremont": {
    "lorde-marcien-auremont": {
      "wants": "Provar seu valor como líder e proteger a Casa durante tempos incertos.",
      "hides": "Teme que sua inexperiência possa levar a Casa à ruína em um momento crítico."
    },
    "duquesa-isolde-auremont": {
      "wants": "Manter a estabilidade de Aurivale e garantir uma colheita próspera.",
      "hides": "Teme que sua resistência à mudança possa alienar as novas gerações da Casa."
    },
    "dama-celestine-de-vaux": {
      "wants": "Aumentar a eficiência dos celeiros para evitar escassez de alimentos.",
      "hides": "Receia que um mau planejamento possa resultar em descontentamento entre os camponeses e, consequentemente, em rebelião."
    },
    "padre-contador-remy-hal": {
      "wants": "Estabelecer um sistema financeiro que proteja a Casa de crises futuras.",
      "hides": "Teme que uma crise iminente possa expor a vulnerabilidade financeira da Casa."
    },
    "alena-primeira-espiga": {
      "wants": "Obter mais poder e influência para melhorar as vidas dos camponeses.",
      "hides": "Teme a retaliação da nobreza e a possibilidade de ser silenciada."
    }
  },
  "casa-do-ouro": {
    "principe-setimo": {
      "wants": "Transformar a crise atual em uma oportunidade para um relacionamento financeiro saudável com a Coroa.",
      "hides": "Teme que a falta de confiança da Coroa possa levar a Casa a perder influência e poder."
    },
    "ortiz": {
      "wants": "Estabelecer uma rede de influência que lhe permita negociar em nome da Casa com maior liberdade.",
      "hides": "Esconde sua verdadeira ambição de se tornar um jogador chave na política de Porto Cinzento."
    },
    "mestra-liora-venn": {
      "wants": "Impor políticas financeiras mais rígidas para proteger a Casa de futuros riscos.",
      "hides": "Teme que a Casa se envolva em guerras que possam comprometer suas finanças e reputação."
    },
    "capitao-jorren-daal": {
      "wants": "Aumentar a segurança da Casa e de seus interesses comerciais em tempos de incerteza.",
      "hides": "Sente-se inseguro sobre sua capacidade de proteger a Casa em tempos de conflitos."
    },
    "dama-seressa-nove-contas": {
      "wants": "Aumentar os lucros da Casa através de investimentos em empreendimentos militares e de guerra.",
      "hides": "Esconde suas ligações com mercenários que podem manchar a reputação da Casa."
    },
    "irmao-calven": {
      "wants": "Obter mais influência nas decisões da Ordem do Sino em prol dos interesses da Casa.",
      "hides": "Tem medo de que sua ligação com a Ordem possa trazer consequências negativas para a Casa."
    }
  },
  "casa-drakorys": {
    "damaros-drakorys": {
      "wants": "A segurança e continuidade da Casa Drakorys.",
      "hides": "O medo de que sua morte cause divisão e desconfiança entre os membros da Casa."
    },
    "ilyra-das-cinzas": {
      "wants": "Que os rituais do Primeiro Fogo sejam respeitados e valorizados na sociedade draconata.",
      "hides": "Teme que a Casa Drakorys se afaste de suas tradições espirituais e ceda à pressão externa."
    },
    "kassian-asa-de-bronze": {
      "wants": "Expandir a frota e garantir a hegemonia naval de Krythos.",
      "hides": "Teme que a Casa não esteja preparada para a guerra iminente e que seu legado seja esquecido."
    },
    "myrra-escudo-partido": {
      "wants": "Ver a Casa Drakorys revitalizada e pronta para enfrentar os desafios externos.",
      "hides": "Teme que suas críticas a tornem uma rival e que seu próprio passado militar a impeça de ser ouvida."
    },
    "leonidas-sal-negro": {
      "wants": "Aumentar as reservas de grãos e riquezas de Krythos.",
      "hides": "Teme que uma escassez de grãos leve à desconfiança e revolta entre a população."
    }
  },
  "casa-euralune": {
    "lorde-brannic-euralune": {
      "wants": "Estabelecer um pacto de paz duradouro entre as aldeias e garantir a sobrevivência de seu povo.",
      "hides": "Teme que sua liderança seja vista como um ato de tirania e que a confiança das pessoas em sua autoridade se desmorone."
    },
    "lyra-euralune": {
      "wants": "Deseja expandir o Pacto das Alturas para incluir não apenas suas comunidades, mas também os senhores que vivem nas terras inferiores.",
      "hides": "Teme que sua proposta de paz seja vista como traição e que os habitantes de Ninho Alto a considerem fraca."
    },
    "tobren-penhasco": {
      "wants": "Quer mudar a estratégia de ataque da Casa para algo mais aceitável aos nobres, visando manter a reputação de Euralune.",
      "hides": "Sente-se culpado por não conseguir convencer Brannic e teme que suas opiniões sejam ignoradas, levando a Casa ao desastre."
    },
    "eldra-folhavento": {
      "wants": "Anseia por um futuro onde os seres místicos e humanos coexistam em harmonia, sem mais conflitos.",
      "hides": "Teme que a guerra e a hostilidade levem à extinção das águias, das quais depende um equilíbrio vital."
    },
    "pim-racha-nuvem": {
      "wants": "Deseja implementar uma abordagem mais defensiva e diplomática em vez de ataques diretos.",
      "hides": "Teme que sua posição e respeito entre os patrulheiros seja prejudicada se ele se opuser abertamente às ordens de Brannic."
    },
    "nessa-tres-sementes": {
      "wants": "Quer garantir que os direitos e necessidades das aldeias pobres sejam reconhecidos e atendidos pela liderança.",
      "hides": "Teme que sua luta por justiça a leve a ser vista como uma instigadora de conflitos, prejudicando sua causa."
    }
  },
  "casa-ferrumor": {
    "lady-miriel-ferrumor": {
      "wants": "Estabelecer alianças que garantam a segurança de Ferrum e evitem conflitos desnecessários.",
      "hides": "Teme que sua abordagem diplomática signifique fraqueza e que a Casa Ferrumor não seja respeitada pelas outras casas."
    },
    "lorde-aedran-ferrumor": {
      "wants": "Trazer de volta a história e a honra de Caladris através de uma frota naval imbatível.",
      "hides": "Teme que sua obsessão em reconstruir Caladris possa levar a Casa Ferrumor a um conflito com seus vizinhos."
    },
    "almirante-caelor-ventobranco": {
      "wants": "Conduzir a frota em uma campanha naval bem-sucedida para consolidar a influência de Ferrum.",
      "hides": "Sente que a Casa deve adotar uma postura mais agressiva, algo que temia discutir com Aedran."
    },
    "mestra-sarya-arco-de-pedra": {
      "wants": "Ver Ferrum como um exemplo de grandeza arquitetônica e inovação.",
      "hides": "Teme que suas inovações possam ser rejeitadas e que sua reputação será manchada."
    },
    "teren-caladrin": {
      "wants": "Encontrar provas que confirmem o destino de Caladris para reviver sua memória.",
      "hides": "Teme que nunca consiga descobrir a verdade e que Caladris caia na obscuridade."
    }
  },
  "casa-karasoy": {
    "aylin-karasoy": {
      "wants": "Um futuro seguro para sua Casa e que seus descendentes continuem sua luta.",
      "hides": "A insegurança sobre a sobrevivência de sua Casa após sua morte."
    },
    "selma-karasoy": {
      "wants": "Descobrir quem conhecia os movimentos dos Casco Vermelho, quem determinou a evacuação, quem colocou Aylin naquela embarcação, e por que a família real saiu por outra rota.",
      "hides": "Que Karasoy viu a força do Casco Vermelho avançar organizada pela Estrada da Estrela dias antes do ataque, e que Aylin mandou reforçar as patrulhas em segredo por causa disso. Guarda a última carta da irmã, com o selo pessoal dela."
    },
    "yasemin-altunay": {
      "wants": "Um reconhecimento maior por suas habilidades e um lugar ao lado da nova líder.",
      "hides": "Um medo de não conseguir domar seu próprio cavalo, o que seria um sinal de fraqueza."
    },
    "nahla-altunay": {
      "wants": "Ver a Casa prosperar e garantir que as tradições sejam mantidas.",
      "hides": "O receio de que sua visão conservadora possa levar a Casa à estagnação."
    },
    "leyla-duas-rotas": {
      "wants": "Transformar as práticas de exploração e adotar novas técnicas.",
      "hides": "Um desejo de provar seu valor em um mundo que ainda vê as mulheres com desconfiança."
    },
    "derya-sar-khal": {
      "wants": "Redefinir a importância da história em vez do avanço material.",
      "hides": "Um temor de que a história de sua Casa seja esquecida em nome do progresso."
    }
  },
  "casa-khazdrun": {
    "lorde-thrain-khazdrun": {
      "wants": "Um legado duradouro que una os clãs sob sua liderança.",
      "hides": "O medo de que a Casa Khazdrun se desmoronasse sem ele."
    },
    "lady-brynna-khazdrun": {
      "wants": "Estabelecer sua própria autoridade e provar seu valor como líder.",
      "hides": "Dúvidas sobre sua habilidade de unir os clãs e manter a Casa forte."
    },
    "durgan-ferrosalto": {
      "wants": "Proteger as tradições de forjamento e engenharia da Casa.",
      "hides": "Um passado obscuro de falhas em projetos que o assombram."
    },
    "kaldrin-marebrava": {
      "wants": "Aumentar a força militar da Casa para prepará-la para os desafios futuros.",
      "hides": "Um medo profundo de que os clãs se voltem uns contra os outros em um momento de fraqueza."
    },
    "eldra-oreluna": {
      "wants": "Manter a história da Casa intacta e garantir que as tradições sejam respeitadas.",
      "hides": "Informações sobre um escândalo no passado que envolve a família Khazdrun."
    }
  },
  "casa-rimerberg": {
    "ser-kael-rimerberg": {
      "wants": "Deseja que a Casa Rimerberg mantenha sua honra e força, mesmo na escuridão.",
      "hides": "Teme que os segredos do destino de sua família se revelem, manchando o legado da Casa."
    },
    "mestre-halm": {
      "wants": "Anseia por preservar os rituais tradicionais da Casa e manter o farol aceso.",
      "hides": "Teme que o farol nunca mais acenda e que seus segredos se percam com ele."
    },
    "capitao-orven-geada": {
      "wants": "Deseja proteger seu povo e garantir que Rimewatch não caia em completa desolação.",
      "hides": "Teme que a Casa não tenha recursos suficientes para enfrentar uma possível invasão e que suas decisões possam levar a uma catástrofe."
    },
    "irma-tessa-do-ultimo-sino": {
      "wants": "Anseia por um entendimento mais profundo do que aconteceu em Rimewatch para poder ajudar as almas perdidas.",
      "hides": "Teme que os mortos comecem a se levantar e que suas preces não sejam ouvidas."
    },
    "lady-ysabet-rimerberg": {
      "wants": "Queria garantir a segurança e o bem-estar das aldeias sob sua responsabilidade.",
      "hides": "Temia que a inação da Casa levasse à ruína das aldeias que ela tanto amava."
    }
  },
  "casa-solarion": {},
  "casa-valerius": {
    "lady-celene-valerius": {
      "wants": "Proteger a continuidade da dinastia Valerius e manter a paz no reino.",
      "hides": "Temia que seu filho, o Príncipe Alic, não estivesse preparado para a responsabilidade que agora recai sobre ele."
    },
    "principe-alic-valerius": {
      "wants": "Deseja ser aceito como o novo líder e provar seu valor ao reino.",
      "hides": "Tem um medo profundo de não conseguir estar à altura das expectativas e de falhar em proteger seu povo."
    },
    "lord-aelric-roderic": {
      "wants": "Quer garantir que os recursos e as finanças da Casa estejam em ordem para enfrentar a crise atual.",
      "hides": "Tem medo de que os cortes de recursos e a pressão política levem a Casa Valerius à ruína financeira."
    },
    "dama-elara-voss": {
      "wants": "Deseja aumentar o poder militar da Casa Valerius para garantir segurança e estabilidade.",
      "hides": "Teme que a Casa Valerius esteja perdendo a fé do povo e quer evitar um levante."
    },
    "sra-nerys-thorne": {
      "wants": "Quer que a história da Casa Valerius seja respeitada e reconhecida pelos novos líderes.",
      "hides": "Sente-se insegura sobre o futuro da Casa e teme que seu trabalho e conhecimento sejam desconsiderados após a morte de Celene."
    }
  },
  "casa-vargen": {
    "lady-elira-vargen": {
      "wants": "Elira deseja unir as forças do Norte para enfrentar a crescente ameaça das mortes que retornam.",
      "hides": "Ela teme que a fragilidade de suas alianças possa levá-la a falhar com seu povo."
    },
    "hakon-vargen": {
      "wants": "Hakon quer um exército maior para garantir a segurança das aldeias. ",
      "hides": "Ele esconde seu medo de que, se falharem em enfrentar a ameaça externa, sua família e seu lar sejam os próximos a cair."
    },
    "maera-lobo-velho": {
      "wants": "Maera deseja que as histórias dos que partiram sejam sempre lembradas e honradas.",
      "hides": "Ela teme que a incessante quantidade de nomes que adiciona ao muro seja uma premonição do fim da Casa Vargen."
    },
    "torvald-neve-presa": {
      "wants": "Torvald quer uma expansão das operações de reconhecimento para antecipar ameaças.",
      "hides": "Ele teme que sua busca por mais aventura possa resultar em mais perdas para seus homens."
    },
    "soren-vale-branco": {
      "wants": "Soren deseja garantir que todos os recursos sejam usados da maneira mais eficiente possível para a sobrevivência da Casa.",
      "hides": "Ele teme que sua visão prática o faça ser visto como cruel e que, eventualmente, a escassez se torne insustentável."
    }
  },
  "cla-mandibula-de-osso": {
    "thorgul-cranio-cinzento": {
      "wants": "Seu grande desejo era garantir a autonomia e a paz duradoura para seu povo.",
      "hides": "Ele oculta o medo de que seus esforços para proteger o clã não sejam suficientes para garantir um futuro seguro."
    },
    "garok-do-trovao": {
      "wants": "Garok quer provar que é digno do legado de seu pai e fortalecer o clã.",
      "hides": "Ele teme não estar preparado para liderar em tempos de crise e que isso possa levar à ruína do clã."
    },
    "morgruk": {
      "wants": "Morgruk deseja preservar a tradição e a espiritualidade do clã acima de tudo.",
      "hides": "Ele teme que as novas ideias de Garok coloquem em risco as antigas práticas que sustentaram o clã por gerações."
    },
    "ursa-dente-verde": {
      "wants": "Ela quer garantir que as fronteiras do clã estejam sempre seguras e livres de invasores.",
      "hides": "Ursa teme que sua aversão a negociações possa levar a uma escalada de conflitos desnecessários."
    },
    "brakka-quebra-ferro": {
      "wants": "Brakka deseja ser reconhecida não apenas como ferreira, mas como uma líder em sua própria arte.",
      "hides": "Ela esconde a insegurança sobre sua posição e a dúvida de ser suficientemente respeitada por seu ofício."
    }
  },
  "grande-casa-ulgar": {
    "thorgar-crina-de-ferro": {
      "wants": "Estabelecer um reconhecimento pleno para a Grande Casa Ulgar e garantir a segurança do povo.",
      "hides": "Teme que a fragilidade da nova terra possa levar seu povo a outra catástrofe."
    },
    "mok-thar": {
      "wants": "Descobrir um novo ritual que possa proteger o povo de uma nova Vor'Kaash.",
      "hides": "Teme que suas visões já não sejam mais claras e que os ancestrais o abandonem."
    },
    "varka-chifre-rubro": {
      "wants": "Conquistar respeito e temeridade por meio da força militar.",
      "hides": "Teme que sua abordagem agressiva traga mais perdas do que ganhos."
    },
    "asha-tres-cicatrizes": {
      "wants": "Estabelecer um sistema de caça que garanta a sobrevivência e o sustento a longo prazo.",
      "hides": "Teme que a escassez de recursos em Valdren coloque sua família e seu clã em risco."
    },
    "rokan-pedra-oca": {
      "wants": "Criar uma fortificação que possa proteger a Casa Ulgar contra ameaças externas.",
      "hides": "Teme que a falta de material e recursos impeça a conclusão da obra antes que a próxima calamidade chegue."
    },
    "nima-olhos-de-cinza": {
      "wants": "Compreender e aprender a invocar os espíritos de Valdren para ajudar seu povo.",
      "hides": "Teme que não seja digna dos ensinamentos dos ancestrais e que falhe em sua missão."
    }
  },
  "irmandade-dos-corvos": {
    "corva-nera-quatro-estradas": {
      "wants": "Restaurar a ordem e a paz em Valdren através da comunicação.",
      "hides": "Um passado obscuro envolvendo subornos e manipulações para garantir a segurança da Irmandade."
    },
    "sino-mudo": {
      "wants": "Descobrir a verdade sobre a morte de Corva Nera e vingar sua queda.",
      "hides": "Um medo profundo de que a Irmandade se perca em corrupção e se torne o que mais despreza."
    },
    "tomas-tres-pontes": {
      "wants": "Aumentar a eficiência das rotas e garantir que mensagens cheguem mais rapidamente.",
      "hides": "Um sentimento de inadequação, achando que, sem Corva Nera, a Irmandade pode desmoronar."
    },
    "alva-pena-branca": {
      "wants": "Encontrar todos os desaparecidos e restaurar a confiança da população na Irmandade.",
      "hides": "Um trauma não resolvido que a faz temer que não consiga salvar todos."
    },
    "bico-de-ferro-ren": {
      "wants": "Estabelecer uma política de segurança mais rígida para proteger os mensageiros.",
      "hides": "Um medo de falhar em proteger seus homens, especialmente após a morte de Corva Nera."
    }
  },
  "ordem-do-sino": {
    "edras-fulgrim": {
      "wants": "Edras deseja garantir a estabilidade da Ordem e proteger o legado de seus fundadores. Ele busca um meio de unir as diferentes facções da Ordem diante do luto e da crise atual.",
      "hides": "Edras teme que sua hesitação em usar o Sino leve a um colapso da Ordem e que os ecos de seus erros se tornem uma maldição para os vivos."
    },
    "primeira-tocadora-ysara-bel": {
      "wants": "Ysara deseja trazer as facções da Ordem para um consenso, garantindo que todos os nomes sejam respeitados e que a memória dos perdidos não seja em vão.",
      "hides": "Ysara teme que sua falta de ação decisiva leve a um cisma irreparável dentro da Ordem."
    },
    "mae-maelis-da-mao-serena": {
      "wants": "Maelis quer expandir os hospitais e garantir que toda dor recebida tenha um alívio, buscando mais recursos e apoio da Ordem.",
      "hides": "Ela esconde a frustração de não conseguir salvar todos e teme que um dia seus cuidados não sejam suficientes."
    },
    "othran-sete-tintas": {
      "wants": "Othran deseja que todos os nomes da Ordem sejam lembrados e respeitados, e planeja criar uma nova forma de registro que capture as memórias.",
      "hides": "Ele teme que a Ordem perca alguns nomes valiosos e que, com isso, a memória dos mortos se desvaneça."
    },
    "irmao-daron-bronze-puro": {
      "wants": "Daron deseja que a ordem continue a honrar as tradições da fabricação dos sinos, mas também procura um novo design que traga esperança e renovação.",
      "hides": "Ele esconde a insegurança sobre o futuro da Ordem e teme que a inovação possa desvirtuar as tradições que valoriza."
    },
    "irma-talia-veu-branco": {
      "wants": "Talia quer um maior poder para os Vigias, para que possam agir em defesa dos cemitérios e dos rituais com mais autonomia.",
      "hides": "Ela teme que suas abordagens mais assertivas possam causar conflitos desnecessários com a liderança da Ordem."
    },
    "padre-jeren-eco-manso": {
      "wants": "Jeren deseja reformar os rituais para que se tornem mais acolhedores e menos punitivos, promovendo uma maior paz entre os vivos e os mortos.",
      "hides": "Ele esconde a frustração de sentir que seus esforços são em vão e teme que sua visão nunca se concretize."
    }
  },
  "ordem-dos-tres": {
    "mestra-oria-sem-nome": {
      "wants": "Deseja encontrar um novo corpo que garanta a continuidade da Ordem e a preservação de seus ensinamentos.",
      "hides": "Teme que a próxima escolha do corpo leve à destruição da essência da Ordem e à perda de sua própria identidade."
    },
    "calen-cera-negra": {
      "wants": "Deseja descobrir o verdadeiro potencial de um antigo artefato que acredita estar escondido na Torre de Véspera.",
      "hides": "Esconde um temor de que sua busca possa desencadear consequências catastróficas para a Ordem."
    },
    "irma-fea-do-circulo": {
      "wants": "Deseja reformular os ritos para que sejam mais justos e menos dolorosos para os iniciados.",
      "hides": "Teme que sua crítica leve a um rompimento irreparável com a liderança da Ordem."
    },
    "serath": {
      "wants": "Deseja preservar a história da Ordem e garantir que suas tradições sejam mantidas.",
      "hides": "Teme que o excesso de análise possa levar à paralisia da Ordem em tempos de crise."
    },
    "ilyon": {
      "wants": "Deseja criar uma nova geração de iniciados que compreendam a importância dos sacrifícios de forma mais ampla.",
      "hides": "Esconde um medo de que suas ações impulsivas possam custar vidas e manchar o legado da Ordem."
    },
    "veyra": {
      "wants": "Deseja decifrar os segredos dos sonhos que a visitam, acreditando que eles guardam a chave para o futuro da Ordem.",
      "hides": "Teme que suas visões possam levar a tragédias que ela não consegue evitar."
    }
  }
};

/** O elenco endereçável de uma Casa, com o que ela não conta em público. */
export function houseRoster(houseKey: string): HouseCharacter[] {
  const secrets = CHARACTER_SECRETS[houseKey] ?? {};
  return (HOUSE_CHARACTERS[houseKey] ?? []).map((c: HouseFigure) => {
    const extra = secrets[characterId(c.name)] ?? { wants: "", hides: "" };
    return { ...c, ...extra };
  });
}

/** Resolve um personagem pela Casa e pelo id, ou null se não existir ali. */
export function characterFor(houseKey: string, id: string): HouseCharacter | null {
  return houseRoster(houseKey).find((c) => characterId(c.name) === id) ?? null;
}
