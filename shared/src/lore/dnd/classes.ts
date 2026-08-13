import type { ValdrenClass } from "./types.js";

/**
 * As doze classes do SRD 5.2.1 e o lugar que cada uma ocupa em Valdren.
 *
 * Nenhuma classe é proibida e nenhuma é alterada. O que a tabela diz é onde
 * um personagem daquela classe encaixa num reino onde magia é rara: quem já
 * tem um nome para ele, quem vai querer saber quem ele é, e o que a existência
 * dele implica.
 */
export const VALDREN_CLASSES: ValdrenClass[] = [
  {
    name: "Fighter",
    appearsAs: "Soldados, cavaleiros, campeões das Casas",
  },
  {
    name: "Barbarian",
    appearsAs: "Povos das fronteiras, Casco Vermelho, guerreiros tribais",
  },
  {
    name: "Rogue",
    appearsAs: "Corvos, agentes das Casas, contrabandistas",
  },
  {
    name: "Ranger",
    appearsAs: "Vargen, Rimerberg, Karasoy, patrulheiros das Brumas",
  },
  {
    name: "Monk",
    appearsAs: "Ordens marciais e tradições isoladas",
  },
  {
    name: "Paladin",
    appearsAs: "Juramentados, campeões de Casas ou ordens religiosas",
  },
  {
    name: "Bard",
    appearsAs: "Cronistas, diplomatas e raríssimos praticantes de magia pela voz e pela memória",
    note:
      "O Bard de Valdren raramente é o músico de taverna. Cronistas e diplomatas são profissões respeitadas e comuns; o que é raro é o cronista cuja voz *faz* alguma coisa. Um Bard que só canta bem passa despercebido a vida inteira. Um Bard que canta e a ferida fecha não passa.",
  },
  {
    name: "Cleric",
    appearsAs: "Milagres genuínos são raros; um verdadeiro Cleric é figura extraordinária",
    note:
      "A Igreja e a Ordem do Sino têm milhares de sacerdotes. Quase nenhum lança magia. Eles enterram, registram nomes, consolam e mantêm o calendário — e isso é o sacerdócio para a esmagadora maioria de Valdren. Um Cleric jogador é a exceção que o resto da instituição vai ter de explicar, e nem todos dentro dela vão gostar da explicação.",
  },
  {
    name: "Druid",
    appearsAs: "Guardiões de tradições antigas, sobretudo em Na'usca, Arven e regiões selvagens",
  },
  {
    name: "Sorcerer",
    appearsAs: "Pessoas que nascem com algo extraordinário — ou errado — dentro delas",
    note:
      "Ninguém escolhe ser Sorcerer, e em Valdren isso quase nunca começa bem. Você fez fogo aparecer na palma da mão aos oito anos. Sua mãe fez você jurar nunca mais repetir aquilo na frente de ninguém. Aos dezesseis, um homem da Ordem dos Três apareceu na aldeia perguntando por você. Escolher esta classe já é escolher uma história.",
  },
  {
    name: "Warlock",
    appearsAs: "Poder obtido por pactos, entidades e coisas que talvez devessem permanecer desconhecidas",
    note:
      "Talvez a classe que melhor encaixa em Valdren. Num reino onde a magia é rara, o atalho existe — e alguém do outro lado do atalho cobra. As Brumas, os Antigos Nomes e o que quer que tenha respondido quando alguém chamou são fontes de pacto perfeitamente boas.",
  },
  {
    name: "Wizard",
    appearsAs: "A forma mais institucionalizada de magia: a Ordem dos Três, seus aprendizes e magos independentes raríssimos",
    note:
      "É a única magia de Valdren com burocracia. A Ordem dos Três mantém registros, forma aprendizes e decide quem é reconhecido — e é justamente por ser institucional que um Wizard fora dela incomoda tanto.",
  },
];
