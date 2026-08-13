import type { DefaultWikiEntry } from "../../defaultWiki.js";
import { VALDREN_CLASSES } from "./classes.js";
import { VALDREN_PEOPLES } from "./peoples.js";
import type { ValdrenPeople } from "./types.js";

/** Seção da wiki onde o guia de campanha vive. */
export const CAMPAIGN_GUIDE_SECTION = "campanha-dnd";

function classTable(): string {
  const rows = VALDREN_CLASSES.map((c) => `| ${c.name} | ${c.appearsAs} |`);
  return ["| Classe | Como aparece em Valdren |", "| --- | --- |", ...rows].join("\n");
}

function classNotes(): string {
  return VALDREN_CLASSES.filter((c) => c.note)
    .map((c) => `### ${c.name}\n\n${c.note}`)
    .join("\n\n");
}

function peopleBody(p: ValdrenPeople): string {
  const parts = [
    `> **Espécie (SRD 5.2.1):** ${p.species}  \n> **Origem:** ${p.homeland}`,
    `## Silhueta\n\n${p.silhouette}`,
    `## Cultura\n\n${p.culture}`,
    `## Costumes\n\n${p.customs.map((c) => `- ${c}`).join("\n")}`,
    `## As regras, lidas em Valdren\n\n${p.reinterpretation}`,
  ];

  if (p.renamedOptions?.length) {
    const rows = p.renamedOptions.map((o) => `| ${o.srd} | ${o.valdren} |`);
    parts.push(
      [
        "### Linhagens",
        "",
        "Os efeitos são exatamente os do SRD. Só o nome e a origem mudam.",
        "",
        "| Opção do SRD | Em Valdren |",
        "| --- | --- |",
        ...rows,
      ].join("\n"),
    );
  }

  parts.push(`## Classes\n\n${p.classNotes}`);
  parts.push(`## Relações\n\n${p.relations}`);
  return parts.join("\n\n");
}

function peopleTable(): string {
  const rows = VALDREN_PEOPLES.map((p) => `| ${p.name} | ${p.species} | ${p.homeland} |`);
  return ["| Povo | Espécie | Origem |", "| --- | --- | --- |", ...rows].join("\n");
}

const PROSE_ENTRIES: { title: string; body: string }[] = [
  {
    title: "Magia rara, não magia fraca",
    body: [
      "Esta é a regra fundamental de Valdren, e tudo o mais neste guia decorre dela.",
      "",
      "Magia em Valdren é rara. Não é fraca.",
      "",
      "Nada muda nos spell slots, no dano, na progressão ou no funcionamento das classes. Um Wizard de nível 7 continua sendo, mecanicamente, um Wizard de nível 7. O que muda é o que isso significa dentro do mundo.",
      "",
      "Um guerreiro de nível 5 é um excelente guerreiro. Um Wizard de nível 5 em Valdren é alguém que provavelmente já começa a ser conhecido pelo nome.",
      "",
      "Evitamos de propósito a expressão *low magic*, porque ela costuma sugerir que Wizard não funciona, que itens mágicos não existem e que spellcasting foi enfraquecido. Não é nada disso. Queremos que, ao ver magia, alguém pense \"que diabos foi aquilo?\" — e não \"ah, o padeiro da esquina também sabe Prestidigitation\".",
      "",
      "## Os quatro princípios",
      "",
      "**1. Personagens jogadores são excepcionais.** Existir um Sorcerer no grupo não significa que exista um Sorcerer em cada cidade. O grupo é a exceção, não a amostra.",
      "",
      "**2. Os Vinte e Sete Magos da Ordem dos Três são um título e uma instituição, não o conjunto de todos os usuários de magia.** Existem aprendizes, sacerdotes que realizam milagres, pessoas com dons naturais, bruxos, tradições antigas, magia élfica, rituais e gente que esconde o que sabe fazer.",
      "",
      "**3. Quanto maior a magia, mais extraordinária ela é para o mundo.** Cantrips e magia de 1º e 2º círculo são raros. De 3º a 5º são extraordinários. De 6º em diante pertencem quase ao domínio da lenda.",
      "",
      "**4. Magia poderosa produz consequência narrativa, não penalidade mecânica.** Se alguém lança uma magia absurda no meio de Asterhall, o problema não é perder spell slots extras. O problema é que a Coroa, a Ordem dos Três, os Corvos e metade das Casas vão querer saber quem é aquela pessoa.",
    ].join("\n"),
  },
  {
    title: "Faixa recomendada: níveis 1 a 10",
    body: [
      "Valdren foi desenhado principalmente para campanhas de **nível 1 a 10**.",
      "",
      "A razão é simples: D&D muda bastante de natureza quando os personagens ficam muito poderosos. A progressão das classes eventualmente entrega poderes capazes de alterar viagem, morte, distância e o próprio mundo — e Valdren é um cenário sobre política, escassez e memória, coisas que dependem de distância e de perda serem reais.",
      "",
      "Níveis 11 a 20 não são proibidos.",
      "",
      "A partir do nível 11, os personagens deixam de ser apenas aventureiros dentro de Valdren e passam a ser algumas das figuras mais extraordinárias de sua geração. A existência deles pode alterar o equilíbrio político, religioso e mágico do reino.",
      "",
      "Isso é bom material, não um defeito. Um Wizard de nível 15 **deveria** causar problema em Valdren: ele é praticamente uma arma geopolítica ambulante, e nenhuma Casa vai fingir que não notou.",
      "",
      "O que o Mestre precisa aceitar, ao passar do nível 10, é que a campanha deixa de ser sobre sobreviver a Valdren e passa a ser sobre o que Valdren faz com pessoas assim.",
    ].join("\n"),
  },
  {
    title: "Manifestação de Poder",
    body: [
      "Uma regra de mundo, não de combate. Ela não altera nenhuma mecânica.",
      "",
      "Quando magia extraordinária é usada publicamente, o Mestre pode aumentar o nível de atenção sobre o personagem.",
      "",
      "Um Fireball numa ruína, sem testemunhas? Possivelmente não acontece nada.",
      "",
      "Um Fireball diante de cem pessoas em Asterhall?",
      "",
      "- No dia seguinte, existem testemunhas contando a história.",
      "- Alguns dias depois, talvez os Corvos já saibam.",
      "- Em algum momento, talvez a Ordem dos Três queira conversar.",
      "",
      "É assim que a raridade da magia vira jogo em vez de virar restrição. O jogador não perde recurso por lançar a magia; ele ganha um mundo que reagiu.",
      "",
      "Vale para o inverso também: um grupo que quer atenção sabe exatamente como consegui-la.",
    ].join("\n"),
  },
  {
    title: "Classes em Valdren",
    body: [
      "Nenhuma classe é proibida e nenhuma é alterada. A tabela diz onde cada uma encaixa num reino onde magia é rara — quem já tem um nome para ela, e quem vai querer saber quem você é.",
      "",
      classTable(),
      "",
      "## As classes cujo peso muda",
      "",
      classNotes(),
    ].join("\n"),
  },
  {
    title: "Os Vinte e Sete e a questão do vigésimo oitavo",
    body: [
      "Os Vinte e Sete não são os únicos capazes de usar magia. São os únicos reconhecidos como Magos Plenos da Ordem dos Três.",
      "",
      "A distinção é a coisa mais importante deste guia para quem quer jogar de Wizard. O título é institucional: existe registro, existe formação, existe alguém decidindo quem entra.",
      "",
      "Um Wizard jogador pode ser:",
      "",
      "- aprendiz da Ordem;",
      "- expulso da Ordem;",
      "- autodidata;",
      "- discípulo secreto de um dos Vinte e Sete;",
      "- descendente de outra tradição;",
      "- alguém que a Ordem ainda não descobriu.",
      "",
      "E quando esse personagem ficar poderoso o suficiente, aparece a pergunta que vale uma campanha inteira:",
      "",
      "> A Ordem vai permitir que exista um vigésimo oitavo?",
      "",
      "Isso é muito mais interessante do que proibir a classe.",
    ].join("\n"),
  },
  {
    title: "Povo e Espécie: como ler a ficha",
    body: [
      "Em Valdren, a cultura importa quase tanto quanto a biologia. Por isso a ficha traz duas linhas em vez de uma:",
      "",
      "```",
      "Povo: Solarion",
      "Espécie: Elf",
      "```",
      "",
      "A **Espécie** é o bloco de regras, tal como o SRD 5.2.1 o publica. A **Povo** é onde o personagem nasceu, e é a linha que responde perguntas que a mecânica não responde: quem lhe deve alguma coisa, quem o odeia por motivos anteriores ao nascimento dele, e o que ele aprendeu antes de aprender a lutar.",
      "",
      "Nenhum povo de Valdren inventa mecânica nova. Cada um aponta para uma espécie do SRD e a reinterpreta: os nomes das linhagens mudam, os efeitos ficam exatamente como publicados. Um jogador que chega com um Elf pronto de outra mesa pode jogá-lo em Valdren sem alterar uma linha da ficha.",
      "",
      peopleTable(),
      "",
      "## Não existem povos malignos",
      "",
      "Existem povos inimigos, e isso é diferente.",
      "",
      "Casco Vermelho pode ser inimigo. Algumas tribos praticam coisas horríveis. Um reino pode ser cruel. Um culto pode ser maligno. Mas não existe \"orcs são maus porque são orcs\".",
      "",
      "Isso combina muito melhor com a política de Valdren, e libera as combinações que tornam a mesa interessante: um orc herói, um elfo escravocrata, um anão corrupto, um Ulgar fanático, um humano misericordioso.",
      "",
      "Em Valdren, nenhum povo existe apenas para preencher um arquétipo de fantasia. Cada um carrega uma história, uma ferida e uma maneira diferente de compreender o mundo.",
    ].join("\n"),
  },
];

/**
 * Os verbetes do guia de campanha, prontos para semear.
 *
 * A prosa é autoral; as tabelas de classes e povos são geradas a partir de
 * VALDREN_CLASSES e VALDREN_PEOPLES, para que a tabela nunca discorde da
 * fonte que ela resume.
 */
export const CAMPAIGN_GUIDE_ENTRIES: DefaultWikiEntry[] = [
  ...PROSE_ENTRIES.map((e, i) => ({
    section: CAMPAIGN_GUIDE_SECTION,
    title: e.title,
    body: e.body,
    order: i,
  })),
  ...VALDREN_PEOPLES.map((p, i) => ({
    section: CAMPAIGN_GUIDE_SECTION,
    title: `${p.name} — ${p.species} de Valdren`,
    body: peopleBody(p),
    order: PROSE_ENTRIES.length + i,
  })),
];

/** Atribuição exigida pela licença do SRD 5.2.1, palavra por palavra. */
export const SRD_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";
