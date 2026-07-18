import type { TurnDefinition, TurnCard, HouseId, HouseTurnContent } from "../types.js";
import { INITIAL_STATE } from "../campaign.js";

const cards: TurnCard[] = [
  {
    id: "vargen-defend-bridge",
    houseId: "vargen",
    title: "Defender a Ponte",
    categories: ["military"],
    description:
      "Envie soldados para manter a ponte aberta até que o maior número possível de refugiados atravesse.",
    contribution:
      "aumenta a Proteção da Retirada e mantém a ponte aberta por mais tempo.",
    risk: "sem apoio militar ou logístico, a Casa Vargen perde tropas.",
    adminTags: ["military-contribution", "bridge-defend"],
  },
  {
    id: "vargen-retreat-droskar",
    houseId: "vargen",
    title: "Recuar para Droskar",
    categories: ["military", "logistics"],
    description: "Abandone a estrada e concentre suas forças na fortaleza.",
    contribution:
      "fortalece Droskar e reduz a possibilidade de perda militar imediata.",
    risk: "centenas de refugiados ficam sem proteção e a Ordem Pública pode cair.",
    adminTags: ["military-contribution", "logistics-contribution"],
  },
  {
    id: "vargen-destroy-bridge",
    houseId: "vargen",
    title: "Destruir a Ponte",
    categories: ["sacrifice"],
    description:
      "Derrube a ponte assim que a maior parte de suas tropas atravessar.",
    contribution:
      "atrasa imediatamente os mortos e protege Droskar de um ataque direto.",
    risk: "refugiados ainda no Norte são abandonados e a Unidade pode cair.",
    adminTags: ["sacrifice-contribution", "bridge-destroy"],
  },

  {
    id: "auremont-send-caravans",
    houseId: "auremont",
    title: "Enviar Caravanas de Alimentos",
    categories: ["logistics"],
    description: "Envie comida, cobertores e combustível para Droskar.",
    contribution:
      "ajuda a abrigar os refugiados e impede uma perda adicional provocada pelo caos.",
    cost: "Provisões diminuem após a resolução.",
    adminTags: ["logistics-contribution"],
  },
  {
    id: "auremont-preserve-reserves",
    houseId: "auremont",
    title: "Preservar as Reservas",
    categories: ["administration"],
    description:
      "Recuse o envio imediato e prepare os celeiros para um inverno prolongado.",
    contribution: "protege os alimentos dos turnos futuros.",
    risk: "não ajuda a crise atual e pode reduzir a Ordem Pública.",
    adminTags: ["administration-contribution"],
  },
  {
    id: "auremont-divert-harrow",
    houseId: "auremont",
    title: "Desviar os Refugiados para Harrow",
    categories: ["logistics", "politics"],
    description:
      "Envie mensageiros e guias para conduzir parte dos refugiados diretamente à cidade de Harrow.",
    contribution:
      "reduz a pressão sobre Droskar e ajuda a acomodar a população.",
    risk: "sem escolta militar, a coluna pode ser atacada na estrada.",
    adminTags: ["logistics-contribution", "politics-contribution"],
  },

  {
    id: "valerius-mobilize-guard",
    houseId: "valerius",
    title: "Mobilizar a Guarda Real",
    categories: ["military", "politics"],
    description: "Envie tropas da capital para proteger a retirada.",
    contribution:
      "aumenta a Proteção da Retirada e reforça a autoridade do Conselho.",
    cost: "a defesa da capital fica temporariamente reduzida.",
    adminTags: ["military-contribution", "politics-contribution", "bridge-defend"],
  },
  {
    id: "valerius-order-bridge-destruction",
    houseId: "valerius",
    title: "Ordenar a Destruição da Ponte",
    categories: ["politics", "sacrifice"],
    description:
      "Use a autoridade da Coroa para ordenar que a ponte seja destruída antes da chegada dos mortos.",
    contribution: "garante o atraso do exército inimigo.",
    risk:
      "a Casa Valerius será publicamente responsabilizada pelos refugiados abandonados.",
    adminTags: ["politics-contribution", "sacrifice-contribution", "bridge-destroy"],
  },
  {
    id: "valerius-declare-emergency",
    houseId: "valerius",
    title: "Declarar Estado de Emergência",
    categories: ["politics"],
    description:
      "Conceda ao Conselho poderes para requisitar alimentos, tropas e acomodações.",
    contribution:
      "ajuda a abrigar os refugiados e fortalece uma ação logística aliada.",
    risk: "a Ordem Pública cai se outra Casa rejeitar a autoridade da Coroa.",
    adminTags: ["politics-contribution"],
  },

  {
    id: "iron-guild-fortify-bridge",
    houseId: "iron-guild",
    title: "Fortificar a Ponte",
    categories: ["engineering", "military"],
    description: "Envie engenheiros para reforçar a ponte e preparar barricadas.",
    contribution:
      "ajuda a retirada e atrasa os mortos mesmo que a ponte permaneça aberta.",
    cost: "materiais e trabalhadores ficam indisponíveis no próximo turno.",
    adminTags: ["engineering-contribution", "military-contribution", "bridge-defend"],
  },
  {
    id: "iron-guild-prepare-demolition",
    houseId: "iron-guild",
    title: "Preparar a Demolição",
    categories: ["engineering", "sacrifice"],
    description:
      "Instale cargas e pontos de ruptura para destruir a ponte no momento escolhido.",
    contribution:
      "permite destruir a ponte depois da passagem de mais refugiados.",
    risk: "sem proteção militar, os engenheiros podem morrer.",
    adminTags: ["engineering-contribution", "sacrifice-contribution", "bridge-demolition-prep"],
  },
  {
    id: "iron-guild-examine-weapons",
    houseId: "iron-guild",
    title: "Examinar as Armas de Varn",
    categories: ["investigation"],
    description:
      "Recolha armas e armaduras trazidas pelos soldados sobreviventes.",
    contribution:
      "ajuda a descobrir como os mortos estão sendo equipados e controlados.",
    risk: "não contribui diretamente para a retirada.",
    adminTags: ["investigation-contribution"],
  },

  {
    id: "pale-bell-examine-wounded",
    houseId: "pale-bell",
    title: "Examinar os Feridos",
    categories: ["religion", "investigation"],
    description:
      "Envie sacerdotes e curadores para examinar os soldados de Varn.",
    contribution: "pode identificar sinais de influência necromântica.",
    risk: "membros da Ordem podem ser atacados por infiltrados mortos.",
    adminTags: ["religion-contribution", "investigation-contribution"],
  },
  {
    id: "pale-bell-open-temples",
    houseId: "pale-bell",
    title: "Abrir os Templos",
    categories: ["popular-support", "logistics"],
    description:
      "Transforme templos, hospitais e espaços protegidos em abrigos temporários.",
    contribution: "ajuda a acomodar os refugiados e pode reduzir o medo.",
    cost: "a Ordem ficará sobrecarregada no próximo turno.",
    adminTags: ["popular-support-contribution", "logistics-contribution"],
  },
  {
    id: "pale-bell-burn-dead",
    houseId: "pale-bell",
    title: "Queimar os Mortos",
    categories: ["religion", "sacrifice"],
    description:
      "Ordene que todos os cadáveres encontrados entre os refugiados sejam imediatamente queimados.",
    contribution: "impede que novos mortos se levantem durante o turno.",
    risk: "aumenta o medo e provoca resistência das famílias.",
    adminTags: ["religion-contribution", "sacrifice-contribution"],
  },

  {
    id: "ravens-infiltrate-refugees",
    houseId: "ravens",
    title: "Infiltrar-se entre os Refugiados",
    categories: ["investigation"],
    description:
      "Envie agentes disfarçados para ouvir histórias e identificar contradições.",
    contribution: "pode revelar quem abriu os portões de Varn.",
    risk: "não oferece proteção imediata à retirada.",
    adminTags: ["investigation-contribution"],
  },
  {
    id: "ravens-find-alternate-route",
    houseId: "ravens",
    title: "Encontrar uma Rota Alternativa",
    categories: ["investigation", "logistics"],
    description:
      "Use contrabandistas e guias para encontrar uma travessia menor sobre o Rio Keld.",
    contribution:
      "ajuda a retirada e permite que parte dos refugiados escape mesmo que a ponte seja destruída.",
    risk: "a rota pode passar perto das Brumas.",
    adminTags: ["investigation-contribution", "logistics-contribution"],
  },
  {
    id: "ravens-spread-news",
    houseId: "ravens",
    title: "Espalhar a Notícia",
    categories: ["politics"],
    description:
      "Envie mensagens para todas as regiões descrevendo a queda de Varn e a chegada dos mortos.",
    contribution:
      "facilita futuras mobilizações e impede que as Casas neguem publicamente a ameaça.",
    risk: "aumenta o medo e pode provocar pânico.",
    adminTags: ["politics-contribution"],
  },
];

const houseContent: Record<HouseId, HouseTurnContent> = {
  vargen: {
    privateInformation:
      "Arlen Vargen reconhece um dos oficiais entre os refugiados. O homem afirma ter escapado de Varn, mas Arlen viu seu corpo ser colocado na cripta dois dias antes da queda da fortaleza.",
    cardIds: ["vargen-defend-bridge", "vargen-retreat-droskar", "vargen-destroy-bridge"],
  },
  auremont: {
    privateInformation:
      "Os cálculos indicam que alimentar todos os refugiados por apenas sete dias consumirá quase um décimo das reservas disponíveis para o inverno.",
    cardIds: ["auremont-send-caravans", "auremont-preserve-reserves", "auremont-divert-harrow"],
  },
  valerius: {
    privateInformation:
      "Um mensageiro afirma portar uma ordem assinada pelo falecido rei Edric. A ordem determina que a ponte permaneça aberta, independentemente das perdas.",
    cardIds: ["valerius-mobilize-guard", "valerius-order-bridge-destruction", "valerius-declare-emergency"],
  },
  "iron-guild": {
    privateInformation:
      "As correntes de sustentação da Ponte do Keld estão mais frágeis do que os registros indicam. Ela pode não suportar simultaneamente uma multidão, carroças e combate.",
    cardIds: ["iron-guild-fortify-bridge", "iron-guild-prepare-demolition", "iron-guild-examine-weapons"],
  },
  "pale-bell": {
    privateInformation:
      "Um curador encontrou marcas de gelo sob a pele de três soldados feridos. Os homens ainda estão vivos, mas não possuem pulso perceptível.",
    cardIds: ["pale-bell-examine-wounded", "pale-bell-open-temples", "pale-bell-burn-dead"],
  },
  ravens: {
    privateInformation:
      "Um agente infiltrado entre os refugiados ouviu a mesma frase repetida por diferentes pessoas durante o sono: “Abram o caminho para aquele que não pode atravessar.”",
    cardIds: ["ravens-infiltrate-refugees", "ravens-find-alternate-route", "ravens-spread-news"],
  },
};

export const turn001: TurnDefinition = {
  id: 1,
  slug: "the-road-from-varn",
  title: "A Estrada de Varn",
  publicEvent: [
    "Ao amanhecer, os vigias da Fortaleza de Droskar avistam uma longa coluna de pessoas na Estrada Branca.",
    "São sobreviventes da queda de Varn.",
    "Mais de dois mil homens, mulheres e crianças caminham para o sul. Muitos estão feridos. Alguns carregam crianças pequenas. Outros arrastam carroças vazias.",
    "Atrás deles, a menos de um dia de distância, marcha uma força de aproximadamente quinhentos mortos.",
    "Os inimigos avançam lentamente, mas não descansam.",
    "A tempestade que se aproxima deve alcançar a estrada antes do anoitecer. Quando isso acontecer, a visibilidade será quase inexistente e a temperatura poderá matar qualquer pessoa sem abrigo.",
    "A ponte sobre o Rio Keld é a única passagem rápida para o sul.",
    "Caso a ponte seja destruída, os mortos serão atrasados por vários dias.",
    "Porém, nem todos os refugiados conseguirão atravessar a tempo.",
    "A Fortaleza de Droskar pode receber aproximadamente oitocentas pessoas sem comprometer completamente suas reservas. A cidade de Harrow, dois dias ao sul, pode receber o restante, desde que alimentos e escolta sejam enviados.",
    "Há ainda um problema.",
    "Entre os refugiados existem soldados de Varn.",
    "Alguns estão gravemente feridos.",
    "Um deles morreu durante a madrugada.",
    "Ao nascer do sol, seu corpo desapareceu.",
    "O Conselho precisa agir antes do anoitecer.",
  ].join("\n\n"),
  stateBefore: INITIAL_STATE,
  houseContent,
  cards,
  adminResolutionNotes: [
    "Os jogadores não veem necessariamente estas regras.",
    "Desafio A — Proteger a retirada",
    "São necessárias duas contribuições militares ou logísticas.",
    "Falha sugerida: centenas de refugiados morrem; Avanço dos Mortos aumenta; Ordem Pública diminui ou o medo aumenta.",
    "Desafio B — Alimentar e abrigar os refugiados",
    "São necessárias duas contribuições de logística, administração ou apoio popular.",
    "Falha sugerida: Provisões diminuem; Ordem Pública diminui; começam revoltas em Droskar.",
    "Desafio C — Investigar os soldados de Varn",
    "São necessárias duas contribuições de investigação ou religião.",
    "Sucesso sugerido: Conhecimento sobre o Inimigo aumenta; a pista sobre o Portão de Varn é publicada.",
    "Desafio D — Destino da ponte",
    "O resultado depende das cartas escolhidas: duas ou mais escolhas favoráveis à destruição: a ponte é destruída; uma escolha de destruição mais Preparar a Demolição: destruição tardia e mais controlada; Fortificar ou Defender sem ordem de destruição: a ponte permanece aberta; decisões contraditórias sem coordenação: acidente, atraso ou destruição prematura.",
    "Primeira pista possível",
    "Os sobreviventes fornecem versões contraditórias sobre a queda de Varn.",
    "Os investigadores concluem que o portão não foi destruído. Ele foi aberto por um oficial com autoridade suficiente para retirar as barras internas.",
    "Esse oficial era o comandante de Varn, Lorde Cassian Rorik.",
    "Cassian morreu seis dias antes da abertura dos portões.",
    "Seu corpo havia sido colocado na cripta da fortaleza.",
    "Com investigação excepcional, o resultado acrescenta: Na noite anterior à queda, vários soldados afirmaram ter visto Cassian caminhando sobre as muralhas, ainda usando as roupas com as quais foi enterrado.",
  ].join("\n\n"),
  publishedResult: undefined,
};
