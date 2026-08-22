/**
 * Dossiê demográfico e territorial de cada Casa.
 *
 * Extraído de valdren-context/PUBLICO/04_POPULACAO_DEMOGRAFIA_E_CAPACIDADE_MILITAR.md
 * por backend/scripts/extract-house-canon.mjs. Nada é inventado aqui: o
 * documento já trazia uma seção por Casa que nunca chegou ao site.
 *
 * Cânone do mundo, não estado de partida — vale para qualquer campanha.
 */
export interface HouseCanon {
  name: string;
  /** Habitantes do território, do censo canônico. */
  population: number | null;
  region: string;
  mainCity: string;
  society: string;
  military: string;
  /** Soldados que a Casa sustenta numa campanha longa. */
  sustainableTroops: number | null;
  /** Mobilização máxima, com custo econômico. */
  emergencyTroops: number | null;
  demographicPressure: string;
}

export const HOUSE_CANON: Record<string, HouseCanon> = {
  "casa-valerius": {
    "name": "Casa Valerius",
    "population": 395000,
    "region": "Vale da Coroa, propriedades reais e comunidades diretamente subordinadas a Asterhall.",
    "mainCity": "Asterhall: 125.000 habitantes.\n\nO restante da população distribui-se entre vilas, propriedades nobres, pequenas cidades muradas, aldeias agrícolas e postos nas Cinco Estradas.",
    "society": "A maior parte dos habitantes é humana, mas a capital possui comunidades permanentes de anões, elfos, gnomos, draconatos, orcs livres, povos mistos e estrangeiros de Krythos.\n\nA família Valerius e seus ramos nobres representam uma parcela minúscula. Quase todos os 395 mil habitantes são trabalhadores, camponeses, comerciantes, soldados e súditos comuns.",
    "military": "- contribuição sustentável para uma campanha longa: cerca de 3.500 soldados;\n- mobilização de emergência: até 8.000 combatentes;\n- Guarda Real e forças profissionais permanentes: aproximadamente 2.500.\n\nUma mobilização maior é possível apenas convocando milícias urbanas e retirando trabalhadores das estradas, campos e oficinas.",
    "sustainableTroops": 3500,
    "emergencyTroops": 8000,
    "demographicPressure": "Asterhall cresce mais rápido do que suas muralhas, esgotos e celeiros. Bairros pobres expandem-se junto ao rio, enquanto refugiados do Norte começam a pressionar aluguéis, alimentos e hospitais."
  },
  "casa-auremont": {
    "name": "Casa Auremont",
    "population": 330000,
    "region": "Campos Dourados, Colinas da Primeira Espiga, vinhedos, canais e propriedades agrícolas do sudoeste.",
    "mainCity": "Aurivale: 42.000 habitantes.\n\nA maioria da população não vive na capital, mas em centenas de aldeias, fazendas, cidades de moinho, vinhedos e propriedades de criação de cavalos.",
    "society": "A maioria é formada por camponeses, arrendatários, trabalhadores sazonais, moleiros, criadores de cavalos e pequenos proprietários.\n\nA riqueza das grandes famílias contrasta com o endividamento rural. Muitas famílias possuem alimento, mas não possuem a terra em que trabalham.",
    "military": "- contribuição sustentável: 2.500 soldados;\n- mobilização de emergência: até 10.000 combatentes;\n- principal força: cavalaria nobre, arqueiros rurais e grandes milícias.\n\nAuremont pode reunir muita gente, mas cada trabalhador enviado à guerra reduz a próxima colheita.",
    "sustainableTroops": 2500,
    "emergencyTroops": 10000,
    "demographicPressure": "A Casa enfrenta o dilema de sustentar uma população crescente sem fragmentar demais as propriedades. Dívidas e heranças empurram famílias pobres para Asterhall ou Porto Cinzento."
  },
  "casa-ferrumor": {
    "name": "Casa Ferrumor",
    "population": 180000,
    "region": "Costa ocidental, parte sul das Montanhas de Ferro, vales industriais e portos subordinados a Ferrum.",
    "mainCity": "Ferrum: 95.000 habitantes.\n\nOutros 85 mil habitantes vivem em cidades costeiras menores, pedreiras, estaleiros, vilas de mineiros, vales de carvão e comunidades ligadas às grandes obras.",
    "society": "",
    "military": "- contribuição sustentável: 2.500 soldados e marinheiros;\n- mobilização de emergência: até 6.000 combatentes;\n- frota disponível: navios de guerra, transportes e embarcações de engenharia.\n\nFerrumor precisa equilibrar tripulações militares com os marinheiros que mantêm o comércio e o abastecimento.",
    "sustainableTroops": 2500,
    "emergencyTroops": 6000,
    "demographicPressure": "Ferrum atrai trabalhadores e estrangeiros, mas sua infraestrutura exige manutenção constante. A cidade pode crescer; o problema é alimentá-la."
  },
  "casa-solarion": {
    "name": "Casa Solarion",
    "population": 155000,
    "region": "O vale e a foz do rio Nayrath, o Deserto de Sahr e sua parte mais dura, chamada Kha'Zer, com oásis, rotas de caravanas, cânions e comunidades ligadas às fontes subterrâneas.",
    "mainCity": "Solythar: 64.000 habitantes.\n\nSahra-Lun: 58.000 habitantes.\n\nOs outros 33 mil vivem em Qasir-Alim, no Oásis dos Sete Espelhos, nos povoados de Nayren e Athon, e em fortalezas de poços, acampamentos de pastores e estações de caravana.\n\nNum deserto a população se junta onde há água, e por isso Solarion é a Casa mais urbana do reino: fora dos pontos de água, Sahr é vazia.",
    "society": "A população é majoritariamente élfica, mas inclui humanos, povos nômades, mercadores estrangeiros e famílias mistas.\n\nA longevidade dos elfos não produz crescimento rápido. Famílias Solarion costumam ter poucos filhos e intervalos longos entre gerações.",
    "military": "- contribuição sustentável: 1.500 soldados;\n- mobilização de emergência: até 5.000 combatentes;\n- principais forças: arqueiros, guardas de caravana, cavaleiros leves e batedores do deserto.\n\nSolarion precisa proteger poços e rotas mesmo durante uma guerra distante.",
    "sustainableTroops": 1500,
    "emergencyTroops": 5000,
    "demographicPressure": "Sahra-Lun cresce mais rapidamente que a capacidade dos canais mais antigos. Novas escavações poderiam ampliar a água disponível, mas também ameaçam ruínas e estruturas que a Casa prefere estudar antes de tocar."
  },
  "casa-khazdrun": {
    "name": "Casa Khazdrun",
    "population": 150000,
    "region": "Baía do Martelo e trecho noroeste das Montanhas de Ferro.",
    "mainCity": "Khar-Durak: 88.000 habitantes.\n\nOutros 62 mil vivem em estaleiros externos, aldeias costeiras, minas menores, fortalezas marítimas, comunidades de pescadores e vales capazes de produzir parte do alimento da Casa.",
    "society": "A maioria é anã, mas Khar-Durak também abriga marinheiros humanos, mercadores, famílias costeiras, engenheiros estrangeiros e representantes de outras Casas.",
    "military": "- contribuição sustentável: 3.000 combatentes;\n- mobilização de emergência: até 7.000;\n- especialidades: infantaria pesada, fuzileiros de doca, engenheiros, marinheiros e guardas de túnel.\n\nMobilizar mais pessoas colocaria em risco bombas, forjas, minas, elevadores e docas essenciais à sobrevivência da cidade.",
    "sustainableTroops": 3000,
    "emergencyTroops": 7000,
    "demographicPressure": "Khar-Durak cresce devagar e de forma planejada. O maior problema não é falta de espaço bruto, mas a dificuldade de ampliar uma cidade viva sem danificar seus sistemas ou suas memórias."
  },
  "casa-vargen": {
    "name": "Casa Vargen",
    "population": 145000,
    "region": "Marcas do Norte, florestas frias, vales montanhosos e fortalezas entre Stonebridge e as Montanhas da Vigília.",
    "mainCity": "Droskar: 24.000 habitantes.\n\nOs outros 121 mil habitantes vivem em aldeias pequenas, serrarias, postos militares, comunidades de caçadores e vilas separadas por grandes distâncias.",
    "society": "",
    "military": "- contribuição sustentável: 3.500 soldados;\n- mobilização de emergência: até 8.000;\n- especialidades: patrulheiros, infantaria resistente, caçadores e defensores de fortalezas.\n\nOs Vargen possuem proporção elevada de pessoas treinadas, mas não podem abandonar as aldeias e passagens que protegem.",
    "sustainableTroops": 3500,
    "emergencyTroops": 8000,
    "demographicPressure": "O Norte perde jovens para o centro e o sul. Muitos Vargen acreditam que a Coroa recebe sua madeira, peles e soldados, mas não oferece condições para que as famílias permaneçam nas Marcas."
  },
  "casa-drakorys": {
    "name": "Casa Drakorys",
    "population": 145000,
    "region": "Ilha de Krythos, Três Enseadas, encostas do Monte Aion e cidades costeiras.",
    "mainCity": "Akrathos: 62.000 habitantes.\n\nOutros 83 mil vivem em vilas de pescadores, propriedades de oliveiras, vinhedos, fortalezas costeiras e assentamentos ligados à marinha.",
    "society": "A maioria dos habitantes é draconata, mas há humanos, povos mistos e comunidades mercantis vindas de Valdren.",
    "military": "- contribuição sustentável para uma campanha continental: 4.000 combatentes;\n- mobilização de emergência: até 10.000;\n- especialidades: hoplitas, fuzileiros navais, marinheiros, fogo alquímico e defesa de estreitos.\n\nKrythos possui uma das maiores proporções de cidadãos treinados, mas enviar muitos soldados deixaria campos, navios e portos sem trabalhadores.",
    "sustainableTroops": 4000,
    "emergencyTroops": 10000,
    "demographicPressure": "A principal disputa da ilha é entre expansão comercial e isolamento. A população cresce o bastante para pressionar as terras, mas parte do Conselho teme que colônias no continente enfraqueçam a identidade de Krythos."
  },
  "cla-mandibula-de-osso": {
    "name": "Clã Mandíbula de Osso",
    "population": 125000,
    "region": "Floresta de Na’usca, Rio Bravio e comunidades orcs do sudeste.",
    "mainCity": "Gor-Kirius: 45.000 habitantes.\n\nOutros 80 mil vivem em aldeias, fortalezas de madeira, acampamentos de caça e comunidades espalhadas pela floresta.",
    "society": "",
    "military": "- contribuição sustentável: 3.500 guerreiros;\n- mobilização de emergência: até 10.000;\n- quase todos os adultos possuem alguma experiência de combate.\n\nUma mobilização completa pareceria poderosa, mas retiraria caçadores, lenhadores e defensores das aldeias.",
    "sustainableTroops": 3500,
    "emergencyTroops": 10000,
    "demographicPressure": "É provavelmente a questão política mais importante do clã. O povo que conquistou liberdade precisa decidir como expandir sem se tornar opressor de outros."
  },
  "casa-karasoy": {
    "name": "Casa Karasoy",
    "population": 115000,
    "region": "Planícies da Estrela, acampamentos sazonais e rotas protegidas pelas Filhas da Estrela.",
    "mainCity": "",
    "society": "",
    "military": "- contribuição sustentável: 3.000 combatentes, principalmente cavalaria;\n- mobilização de emergência: até 7.000;\n- força de elite montada em Ak-Boran: aproximadamente 4.000 a 5.000 cavaleiras, nem todas disponíveis ao mesmo tempo.",
    "sustainableTroops": 3000,
    "emergencyTroops": 7000,
    "demographicPressure": "A Casa precisa crescer para proteger as planícies, mas população demais ameaça sua mobilidade e pode aproximar estrangeiros das minas de mitril."
  },
  "grande-casa-ulgar": {
    "name": "Grande Casa Ulgar",
    "population": 60000,
    "region": "Floresta de Arven, Rok’thar e acampamentos dos clãs sobreviventes.",
    "mainCity": "",
    "society": "",
    "military": "- contribuição sustentável: 4.000 guerreiros;\n- mobilização de emergência: até 10.000;\n- número maior só seria possível colocando em risco a sobrevivência de clãs inteiros.",
    "sustainableTroops": 4000,
    "emergencyTroops": 10000,
    "demographicPressure": "Os Ulgar precisam de terras, alimento e uma geração de paz. Uma derrota militar de poucos milhares não seria apenas um revés: poderia eliminar grande parte da população reprodutiva e impedir a reconstrução do povo."
  },
  "casa-euralune": {
    "name": "Casa Euralune",
    "population": 35000,
    "region": "Picos da Nuvem Eterna, vales suspensos, salões de montanha e comunidades ligadas ao Pacto das Alturas.",
    "mainCity": "",
    "society": "",
    "military": "- contribuição sustentável: cerca de 1.000 combatentes;\n- mobilização de emergência: até 2.500;\n- cavaleiros de águias, grifos e hipogrifos: entre 350 e 500.\n\nApesar dos poucos números, reconhecimento aéreo e mobilidade tornam Euralune estrategicamente valiosa.",
    "sustainableTroops": 1000,
    "emergencyTroops": 2500,
    "demographicPressure": "Os jovens precisam escolher entre permanecer em comunidades pequenas, fundar novos salões ou descer para as cidades baixas. A migração ameaça lentamente reduzir a população das montanhas."
  },
  "casa-rimerberg": {
    "name": "Casa Rimerberg",
    "population": 28000,
    "region": "Rimewatch, aldeias do extremo Norte, torres de sinal e comunidades próximas às geleiras.",
    "mainCity": "",
    "society": "",
    "military": "- contribuição sustentável: 1.500 soldados;\n- mobilização de emergência: até 3.500;\n- grande parte da população adulta já exercia funções defensivas.",
    "sustainableTroops": 1500,
    "emergencyTroops": 3500,
    "demographicPressure": ""
  },
  "ordem-dos-tres": {
    "name": "Ordem dos Três",
    "population": 9000,
    "region": "Torre de Véspera e propriedades rituais ao sul do Vale da Coroa.",
    "mainCity": "",
    "society": "",
    "military": "- forças convencionais: cerca de 780 guardas;\n- combatentes especializados disponíveis para campanha: 300 a 400;\n- magos completos: 27, raramente empregados ao mesmo tempo;\n- mobilização extrema do domínio: até 1.500 pessoas, mas com pouca utilidade em batalha aberta.\n\nA força da Ordem não está em quantidade. Está em preparação, selos, cura, barreiras, investigação e rituais.",
    "sustainableTroops": null,
    "emergencyTroops": null,
    "demographicPressure": "A Ordem precisa de novos iniciados, mas teme aceitar pessoas demais ou reduzir o rigor. Cada mago perdido representa décadas de formação."
  },
  "ordem-do-sino": {
    "name": "Ordem do Sino",
    "population": 16000,
    "region": "",
    "mainCity": "",
    "society": "",
    "military": "A Ordem não é um exército.\n\n- Vigias dos Túmulos e guardas: aproximadamente 1.500 em todo o reino;\n- força que poderia ser reunida sem abandonar cemitérios e hospitais: 500 a 700;\n- maior contribuição em guerra: curadores, capelães, funerais, quarentena e controle de mortos.",
    "sustainableTroops": null,
    "emergencyTroops": null,
    "demographicPressure": "Com mortos levantando-se no Norte, a Ordem precisa proteger mais cemitérios, atender refugiados e responder a dúvidas sobre seus ritos sem possuir pessoal suficiente para todas as regiões."
  },
  "casa-do-ouro": {
    "name": "Casa do Ouro",
    "population": 16000,
    "region": "A Casa não governa uma grande província. Sua sede principal é Setecofres, fortaleza financeira em Porto Cinzento, com propriedades e escritórios em Asterhall, Aurivale, Ferrum e outras cidades.",
    "mainCity": "",
    "society": "Mais de 90.000 pessoas dependem parcialmente de crédito, contratos, transporte, seguro ou empresas financiadas pela Casa.\n\nIsso não significa que sejam súditos do Príncipe Sétimo. Continuam vivendo sob outras Casas.",
    "military": "- guardas e cavaleiros próprios: aproximadamente 2.000;\n- força enviada para campanha sem comprometer os cofres: 500 a 800;\n- mercenários que poderia contratar em emergência: entre 3.000 e 6.000, dependendo do crédito e da disponibilidade.",
    "sustainableTroops": null,
    "emergencyTroops": 3000,
    "demographicPressure": "A Casa precisa de pessoas alfabetizadas e confiáveis. Seu crescimento é limitado pela formação lenta de administradores e pela necessidade de preservar reputação entre agentes espalhados pelo reino."
  },
  "irmandade-dos-corvos": {
    "name": "Irmandade dos Corvos",
    "population": null,
    "region": "A Irmandade não governa uma província. Sua sede é Raven’s Cross, mas a cidade permanece legalmente sob magistratura real.",
    "mainCity": "",
    "society": "",
    "military": "- Bicos de Ferro e guardas: aproximadamente 1.500;\n- força que poderia ser reunida: menos de 500, pois abandonar postos destruiria a rede;\n- principal capacidade: reconhecimento, comunicação, escolta, fuga, sabotagem de pontes e inteligência.",
    "sustainableTroops": null,
    "emergencyTroops": null,
    "demographicPressure": "A crise aumenta o volume de mensagens enquanto estradas fecham e mensageiros desaparecem. A Irmandade precisa recrutar rapidamente, mas cada novo membro é também uma possível brecha na segurança dos códigos."
  }
};

export function houseCanonFor(key: string): HouseCanon | null {
  return HOUSE_CANON[key] ?? null;
}
