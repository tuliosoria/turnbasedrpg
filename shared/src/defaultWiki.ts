export interface DefaultWikiEntry {
  section: string;
  title: string;
  body: string;
  order: number;
}

/**
 * Curated, player-facing cosmology of Valdren, drawn from the campaign bible.
 * Only public knowledge is included here — the secret motivations, private
 * intel and mysteries of each faction are deliberately left out so players can
 * discover them through play. The Admin can seed these into the living wiki and
 * then edit, expand or remove them as the campaign evolves.
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
];
