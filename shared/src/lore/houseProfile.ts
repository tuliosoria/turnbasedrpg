/**
 * O que cada número de atributo realmente significa para aquela Casa.
 *
 * "Riqueza 4" não diz nada sobre com quem negociar. Riqueza 4 em ouro vivo é
 * uma coisa; riqueza 4 em favores devidos é outra, e uma delas não compra
 * mantimento no inverno. O mesmo vale para o resto: mil cavaleiros de estepe e
 * mil fuzileiros de doca não servem para a mesma guerra.
 *
 * Cada linha diz o que a Casa TEM e — quando o cânone é claro — o que lhe
 * FALTA. A escassez é o motor da mesa: é ela que obriga uma Casa a negociar com
 * quem ela detesta, porque o ferro não nasce no deserto e o trigo não cresce
 * dentro da montanha.
 *
 * Escrito a partir de `HOUSE_CANON` e da Enciclopédia; não recalibra as notas,
 * apenas explica o que elas representam.
 */
export interface HouseProfile {
  /** Em que a Riqueza consiste: dinheiro, favores, influência ou necessidade. */
  wealth: string;
  /** O que o território produz — e o que ele não dá. */
  resources: string;
  /** Que tipo de força: marinha, exército de campo, especialistas de terreno. */
  soldiers: string;
  /** Como a Casa manda: pela força, pela influência ou pela estrutura social. */
  control: string;
}

export const HOUSE_PROFILE: Record<string, HouseProfile> = {
  "casa-valerius": {
    wealth: "Impostos, pedágios e o direito de cunhar moeda. Rica em autoridade, não em cofre próprio: depende do que as Casas aceitam pagar.",
    resources: "O Vale da Coroa dá grão e o rio dá transporte. Falta ferro e madeira de porte — chegam pelas Cinco Estradas.",
    soldiers: "Guarda Real profissional (2.500) e exército de campo (3.500). Tropa de capital: boa em estrada e cerco, sem tradição naval.",
    control: "Pela estrutura: lei, cartas régias e o Conselho das Cinco Estradas. Onde o costume falha, a Lei Marcial.",
  },
  "casa-do-ouro": {
    wealth: "Dinheiro e favores — crédito, contratos, seguros e seus Sete Cofres. Noventa mil pessoas dependem da sua carteira. Não é terra: é dívida alheia.",
    resources: "Não produz quase nada. Compra tudo, e é por isso que precisa de todo mundo. Sem alimento, ferro ou madeira em território próprio.",
    soldiers: "Dois mil guardas e cavaleiros. Pode alugar de três a seis mil mercenários enquanto o crédito aguentar — exército emprestado some quando o ouro acaba.",
    control: "Pela influência: dívida, contrato e a memória de cada favor. Não precisa de aço onde já tem a promissória.",
  },
  "casa-khazdrun": {
    wealth: "Ferro, obra e frete: metal trabalhado, navios e engenharia que ninguém mais entrega no mesmo prazo.",
    resources: "Ferro, pedra e carvão em abundância; o porto traz peixe e sal. Falta alimento de lavoura — montanha não planta trigo.",
    soldiers: "Infantaria pesada, fuzileiros de doca, engenheiros e guardas de túnel (3.000). Guerra de porto e de galeria, não de planície aberta.",
    control: "Pela estrutura social: o Conselho de Pedra, os clãs e as guildas. Quando o Conselho racha, a autoridade racha junto.",
  },
  "casa-solarion": {
    wealth: "Influência e conhecimento: lentes, astronomia, arquivos e o pedágio das rotas de caravana.",
    resources: "Tecidos, especiarias, cerâmica e vidro. A água é contada, poço a poço. Falta madeira e ferro — tudo vem de fora.",
    soldiers: "Especialistas do deserto: arqueiros, batedores, cavalaria leve e guardas de caravana (1.500). Poucos, mas ninguém os vence no terreno deles.",
    control: "Pela estrutura social e pela longevidade élfica: quem governa viu as leis nascerem. Prova antes de obedecer.",
  },
  "casa-vargen": {
    wealth: "Necessidade. O que tem, gasta no inverno. A moeda de Vargen é o que o Sul lhe deve por segurar a fronteira.",
    resources: "Madeira, peles, caça e pedra. Falta grão — o Norte come o que o Sul planta, e não deixa ninguém esquecer disso.",
    soldiers: "Patrulheiros, infantaria resistente, caçadores e defensores de fortaleza (3.500). Tropa de inverno: marcha onde outros congelam.",
    control: "Pela força e pelo costume da fronteira: obedece-se a quem manteve a palavra quando a neve veio.",
  },
  "casa-auremont": {
    wealth: "Dinheiro de colheita e o favor que ele compra. Quem alimenta um exército decide quando ele marcha.",
    resources: "Trigo, cevada, vinho e cavalos — o celeiro do reino. Falta ferro e pedra de qualidade; compra das montanhas.",
    soldiers: "Cavalaria nobre, arqueiros rurais e milícias enormes (2.500 sustentáveis, até 10.000 na emergência). Muita gente, pouco treino.",
    control: "Pela influência: contratos de grão, casamentos e a Primeira Espiga. Fecha-se um celeiro e uma cidade muda de ideia.",
  },
  "casa-ferrumor": {
    wealth: "Obra e mar: estaleiros, aquedutos, pontes e o que a engenharia cobra por fazer o impossível.",
    resources: "Ferro, carvão, sal e peixe; oficinas de fundição. Falta alimento de lavoura e madeira nobre.",
    soldiers: "Marinha de verdade — navios de guerra, transportes e embarcações de engenharia — com 2.500 soldados e marinheiros.",
    control: "Pela estrutura: guildas, contratos de obra e a memória de Caladris, que ordena a cidade inteira.",
  },
  "casa-rimerberg": {
    wealth: "Necessidade pura. Pobre em tudo menos em posição: vale o que vale a única torre que enxerga o que vem do gelo.",
    resources: "Pouco de tudo. Peles, pedra e o que o Sul manda. Depende de suprimento externo para atravessar cada inverno.",
    soldiers: "Mil e quinhentos, quase todos já em função defensiva. Vigias e guarnição de torre, não força de ataque.",
    control: "Pela estrutura militar: uma sociedade organizada em turnos de vigília. Manda quem acende o farol.",
  },
  "casa-euralune": {
    wealth: "Influência e raridade: pedágio de passagem nas alturas e o que só quem voa consegue entregar.",
    resources: "Pedra, ervas de altitude e criação de aves gigantes. Falta grão, ferro e madeira — os picos não sustentam lavoura.",
    soldiers: "Poucos (1.000), mas com 350 a 500 cavaleiros de águias, grifos e hipogrifos. Reconhecimento e ataque de cima que ninguém mais tem.",
    control: "Pela influência e pelo pacto: uma confederação de vales que obedece por acordo, nunca por imposição.",
  },
  "casa-karasoy": {
    wealth: "Cavalos, rebanhos e o direito de passagem pelas planícies. Riqueza que anda — e que some se as rotas fecharem.",
    resources: "Carne, couro, leite e os Ak-Boran. Falta ferro, madeira e grão estocável; a cidade se move, o celeiro não.",
    soldiers: "Cavalaria de estepe (3.000), com 4 a 5 mil cavaleiras de elite montadas em Ak-Boran. Imbatíveis em campo aberto, inúteis num cerco.",
    control: "Pela estrutura social: linhagens matriarcais e a palavra dada nas rotas. Cercar uma estrada é declarar guerra.",
  },
  "cla-mandibula-de-osso": {
    wealth: "Necessidade e trabalho. Sem moeda forte, sem crédito: o que a floresta dá e o que o braço faz.",
    resources: "Madeira, caça, peles e o Rio Bravio. Falta ferro trabalhado, tecido fino e remédio.",
    soldiers: "Três mil e quinhentos guerreiros, e quase todo adulto já lutou (até 10.000). Mobilizar tudo esvazia a floresta.",
    control: "Pela estrutura social de povo liberto: ninguém acorrenta ninguém, e nenhum chefe manda mais do que o clã aceita.",
  },
  "grande-casa-ulgar": {
    wealth: "Necessidade e dívida. Chegaram sem nada e devem à Casa do Ouro o que comeram no primeiro ano.",
    resources: "Madeira e caça da Floresta de Arven; rebanhos em formação. Falta terra cultivada, ferro e remédio.",
    soldiers: "Quatro mil guerreiros taurinos, até dez mil na emergência — mas mobilizar tudo arrisca clãs inteiros. Choque pesado e xamanismo de guerra.",
    control: "Pela estrutura de clã e pela memória dos ancestrais. Manda quem os xamãs e os anciãos reconhecem.",
  },
  "casa-drakorys": {
    wealth: "Mar e bronze: azeite, vinho, forjas e o que uma ilha entreposto cobra de quem passa.",
    resources: "Bronze, azeite, vinho e madeira naval. Falta grão em escala e ferro pesado — vêm do continente.",
    soldiers: "A melhor força por tamanho do reino: hoplitas, fuzileiros navais, marinheiros e fogo alquímico (4.000). Guerra de mar e desembarque.",
    control: "Pela força e pela disciplina militar: serviço público obrigatório e uma hierarquia que não se discute.",
  },
  "ordem-do-sino": {
    wealth: "Favores e legitimidade. Não acumula ouro: acumula o direito de estar presente quando alguém morre.",
    resources: "Remédio, cuidado e arquivo — hospitais e registros funerários em todo o reino. Não produz alimento nem metal.",
    soldiers: "Mil e quinhentos Vigias dos Túmulos, dos quais só 500 a 700 sairiam sem abandonar cemitérios e hospitais. Não é exército.",
    control: "Pela influência moral: quem enterra os mortos de uma Casa tem lugar garantido na mesa dela.",
  },
  "irmandade-dos-corvos": {
    wealth: "Informação vendida e o pedágio das mensagens. Rica em segredo, pobre em terra.",
    resources: "Postos, torres e corvos. Não produz nada: come do que as estradas rendem.",
    soldiers: "Mil e quinhentos Bicos de Ferro, mas menos de 500 mobilizáveis — tirar gente dos postos destrói a própria rede. Escolta e reconhecimento.",
    control: "Pela influência: sabe primeiro, e vende a quem paga. Controla o que os outros conseguem saber.",
  },
  "ordem-dos-tres": {
    wealth: "Influência e raridade absoluta. Não se compra um mago: negocia-se com a Torre.",
    resources: "Ervas rituais, arquivos e reagentes. Depende de fora para alimento e metal.",
    soldiers: "Setecentos e oitenta guardas e 300 a 400 especialistas — mais os vinte e sete magos, raramente empregados juntos. Poder decisivo, não sustentável.",
    control: "Pela influência e pelo monopólio do saber: controla quem pode usar magia em Valdren.",
  },
};

export function houseProfileFor(seatKey: string): HouseProfile | null {
  return HOUSE_PROFILE[seatKey] ?? null;
}
