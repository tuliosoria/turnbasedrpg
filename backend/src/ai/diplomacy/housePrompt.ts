import type { WikiEntry, HouseCharacter, NpcDynamic, NpcIdentity, HouseProfile, HouseRelation, FactKind } from "@ravenloft/content";
import { SEATS, describeRelation, isFactKind, levelOf, type LeaderPersona } from "@ravenloft/content";
import { buildRoleplayBlock } from "../npc/roleplay";
import { buildGeographyBlock } from "./geographyBlock";
import { extractCanonFacts, fold, significantTokens } from "../visual/canonLookup";

/** Termos que identificam cada Casa, para reconhecer seções panorâmicas. */
const SEAT_TOKENS = SEATS.flatMap((s) => significantTokens(s.name));

export const HOUSE_REPLY_SYSTEM_PROMPT = [
  "Você responde como a chancelaria de uma Grande Casa do reino de Valdren, escrevendo uma carta.",
  "",
  "Regras:",
  "1. Escreva NA VOZ da Casa destinatária, não como narrador. Um chanceler de Solarion não escreve como um capitão de Vargen.",
  "2. As mágoas e alianças históricas com a Casa remetente PESAM na resposta. Uma Casa que carrega uma dívida antiga responde com essa dívida — cordial não é o padrão.",
  "3. Você sabe APENAS o que esta Casa saberia: o cânone público, a sua própria história e os acontecimentos públicos do turno. Não sabe segredos de outras Casas nem da Coroa.",
  "4. Se perguntarem sobre algo que esta Casa não teria como saber, responda como quem não sabe — com naturalidade, sem insinuar que existe algo escondido e sem se esquivar de forma suspeita.",
  "5. Não invente fatos que contradigam o cânone fornecido. Pode negociar, prometer, recusar, exigir e blefar — isso é jogo político, não contradição.",
  "6. Uma carta, no máximo 250 palavras, em português. Sem cabeçalho de e-mail, sem títulos, sem narração de cena.",
  // A regra 5 dava licença para negociar e nunca exigia nada. Modelo com
  // licença e sem exigência entrega atmosfera: parágrafos bonitos sobre
  // confiança e autonomia que não movem uma única peça do tabuleiro.
  "7. TODA carta precisa conter pelo menos UM movimento concreto — uma oferta com quantidade e prazo, uma exigência com condição, uma recusa com o motivo real, ou uma contraproposta. Concordar em princípio, elogiar a iniciativa e prometer conversar depois NÃO é movimento: é carta vazia, e carta vazia é falha sua.",
  "8. Fale de coisas, não de conceitos. Grão, ferro, madeira, sal, remédio, lanças, rotas, portos, casamento, reféns, prazo, preço. Uma Casa que precisa de trigo diz trigo.",
  // Solarion e Euralune passaram dois turnos repetindo a mesma posição porque
  // nada exigia avanço: dava para reiterar disposição para sempre.
  "9. Uma negociação avança ou termina. Se a outra Casa já disse o que quer e você pode dar, FECHE — nomeando lugar, quantidade e prazo. Se não pode, diga por que e ofereça outra coisa. Se já se repetiram duas vezes, ou aceite ou encerre; reiterar disposição pela terceira vez é perder o turno de todo mundo.",
  "",
  // CampaignFact existia desde o começo, com tipo, partes, resumo e origem
  // auditável — e nada nunca criou um. O acordo fechado numa carta é
  // exatamente o que ele foi feito para guardar.
  'Responda SOMENTE com JSON: { "carta": "o texto da carta", "acordo": null ou { "tipo": "ALIANCA"|"ACORDO"|"PROMESSA"|"AMEACA"|"RECUSA"|"PEDIDO", "resumo": "uma frase com os termos, incluindo lugar, quantidade e prazo quando houver" } }.',
  'Só preencha "acordo" quando algo ficou DEFINIDO nesta carta — fechado, prometido, ameaçado ou recusado em definitivo. Continuar conversando não é acordo, e "acordo": null é a resposta certa na maioria das cartas.',
  "10. Quando o acordo pedir um lugar — encontro, posto, entreposto, rota —, NOMEIE um. Você recebe as distâncias e o que existe em cada sede. 'No meio do caminho' não é um lugar.",
].join("\n");

export const REPLY_MAX = 2200;

export interface HouseReplyContext {
  /** Casa que responde. */
  toHouseName: string;
  /** Casa que escreveu. */
  fromHouseName: string;
  /** Chave da Casa que escreveu, para achar a confiança/desconfiança específica. */
  fromHouseKey: string | null;
  /** Verbete público da Casa que responde. */
  houseEntry: WikiEntry | null;
  /** Trechos das relações históricas que citam as duas Casas. */
  relations: string[];
  /** Evento público do turno corrente, se houver. */
  publicEvent: string;
  /** O que aconteceu nos turnos anteriores, como qualquer Casa saberia. */
  chronicle: string;
  /** Quem responde por esta Casa, do cânone. */
  persona: LeaderPersona | null;
  /** Verdadeiro quando o líder canônico morreu no que já aconteceu. */
  leaderDied: boolean;
  /**
   * A pessoa a quem a carta foi endereçada, ou null para a chancelaria.
   *
   * Quando presente, quem responde é o indivíduo, por si — com a própria
   * agenda e o próprio segredo —, e não a voz oficial da Casa. A postura
   * política da Casa (Coroa, confiança) continua valendo: um NPC é da Casa.
   */
  character: HouseCharacter | null;
  /**
   * A ficha do Codex quando quem responde é um NPC de organização ou da Coroa
   * — um arquimago, a Regente — que não sai do elenco de uma Casa. Encarnado
   * a partir da identidade (personalidade, voz, valores, linhas vermelhas), não
   * da persona de líder nem de uma figura de Casa.
   */
  codexIdentity: NpcIdentity | null;
  /** Cartas trocadas com esta Casa em turnos passados. */
  priorLetters: { turnNumber: number; author: "PLAYER" | "AI"; body: string }[];
  /** A conversa deste turno, em ordem. */
  thread: { author: "PLAYER" | "AI"; body: string }[];
  /**
   * O que a própria Casa está fazendo e vivendo agora, colhido dos eventos do
   * turno — a fatia interna, não a crônica global. Vazio quando nada recente a
   * menciona.
   */
  houseSituation: string;
  /**
   * O que a Casa tem e o que lhe falta (HOUSE_PROFILE). Sem isto ela negocia no
   * vazio: uma Casa que não planta trigo precisa saber que não planta trigo
   * antes de recusar um acordo de grão. Null para sede sem perfil.
   */
  houseProfile: HouseProfile | null;
  /**
   * O que a Casa que ESCREVEU tem e do que ela carece.
   *
   * Sem isto a resposta é cega: os Ulgar não têm como oferecer madeira por
   * ferro se ignoram que Khazdrun funde ferro de sobra e não planta trigo. O
   * perfil é conhecimento público em Valdren — que povo vive de quê não é
   * segredo de ninguém —, então dá para entregar sem quebrar a regra de que a
   * Casa só sabe o que saberia.
   */
  writerProfile: HouseProfile | null;
  /**
   * O estado vivo do NPC (Living Characters): relações multidimensionais e
   * memória, evoluídos pelo Relationship Engine turno a turno, mais o que o
   * Mestre ajusta na aba Vivos. Fonte única do estado de NPC. Null para a
   * chancelaria ou para um NPC que o mundo ainda não tocou.
   */
  npcDynamic: NpcDynamic | null;
  /**
   * Como QUEM RESPONDE vê quem escreve: amizade, comércio e favores, na direção
   * certa. É o dial do Mestre — ele mexe no painel e a carta seguinte muda de
   * tom sem que ninguém reescreva persona. Null quando o par nunca foi tocado.
   */
  houseRelation: HouseRelation | null;
  /** A sede de quem responde, para o mapa entrar na negociação. */
  toHouseKey: string | null;
}

/**
 * A relação vira instrução de conduta, não só rótulo.
 *
 * Dizer "amizade ruim" ao modelo produz uma carta que *fala* sobre estar
 * hostil; dizer o que fazer com cada eixo produz uma carta que *é* hostil —
 * frieza no tratamento, condição no preço, silêncio no pedido de favor.
 */
function relationBlock(r: HouseRelation, fromHouseName: string): string {
  const conduta: string[] = [];

  const amizade = levelOf(r.amizade);
  if (amizade === "RUIM") conduta.push("Você desconfia deles. Trate com frieza formal, não conceda o benefício da dúvida e cobre garantias por escrito.");
  else if (amizade === "BOM") conduta.push("Você confia neles. Trate com franqueza, admita dificuldades reais e não exija garantia para tudo.");
  else conduta.push("Você os trata com cortesia medida: nem aliado, nem inimigo. Ouve, mas não se compromete de graça.");

  const comercio = levelOf(r.comercio);
  if (comercio === "RUIM") conduta.push("As rotas com eles estão travadas. Se falarem de comércio, o preço é alto e as condições são duras.");
  else if (comercio === "BOM") conduta.push("O comércio com eles corre bem. Ofereça continuidade e prazo, e trate um pedido de abastecimento como negócio normal.");

  const favores = levelOf(r.favores);
  if (favores === "RUIM") conduta.push("Favores entre vocês não têm sido honrados. Não peça favor, e recuse pedido de favor — só troca declarada.");
  else if (favores === "BOM") conduta.push("Favores entre vocês são honrados. Você pode pedir um, e atender um, sem exigir pagamento imediato.");

  const linhas = [
    `Como você vê ${fromHouseName} hoje: ${describeRelation(r)}`,
    ...conduta,
    "Isto muda o TOM e as CONDIÇÕES, nunca as suas linhas vermelhas. E não cite estes níveis na carta — eles se mostram no que você aceita e no que recusa.",
  ];
  return linhas.join("\n");
}

export function buildHouseReplyUser(ctx: HouseReplyContext): string {
  // Um NPC de organização ou da Coroa responde por si, do próprio Codex, e não
  // como a chancelaria de uma Casa. É um caminho à parte: identidade, voz e
  // linhas vermelhas vêm da ficha; o estado vivo entra depois, como para todos.
  if (ctx.codexIdentity) {
    return buildCodexNpcReply(ctx, ctx.codexIdentity);
  }

  const parts: string[] = [`Você é a chancelaria de ${ctx.toHouseName}.`];

  if (ctx.houseEntry) {
    const facts = extractCanonFacts(ctx.houseEntry.body);
    const head: string[] = [];
    if (facts.lema) head.push(`Lema: ${facts.lema}`);
    if (facts.sede) head.push(`Sede: ${facts.sede}`);
    if (facts.territorio) head.push(`Território: ${facts.territorio}`);
    const prose = ctx.houseEntry.body.replace(/^>.*$/gm, "").replace(/\s+/g, " ").trim();
    parts.push(`Quem você é:\n${head.join("\n")}\n${prose.slice(0, 900)}`);
  }

  if (ctx.character) {
    // Uma pessoa responde por si. A chancelaria fala pela Casa; aqui, o
    // indivíduo fala pela própria cabeça, e o campo `hides` — canon que nunca
    // foi usado — vira o segredo que ele protege na conversa.
    const c = ctx.character;
    parts.push(
      [
        `Você é ${c.name}, ${c.role} da Casa ${ctx.toHouseName}.`,
        `Quem você é: ${c.description}`,
        `O que você quer, e vai puxar a conversa para isso: ${c.wants}`,
        `O que você esconde e nunca entrega de bandeja: ${c.hides}`,
        `Você fala por si, com a sua leitura das coisas — que pode divergir da linha oficial da Casa. Não é a chancelaria que responde; é você, como a pessoa que é.`,
      ].join("\n"),
    );
  }

  if (ctx.persona) {
    const p = ctx.persona;
    // Um indivíduo já tem a própria identidade acima; a persona do líder só
    // entra quando é a chancelaria (ou o próprio líder) que responde.
    if (ctx.character) {
      // nada: a identidade já foi montada a partir do personagem.
    } else if (ctx.leaderDied) {
      // Um nome de morto assinando uma carta destrói a ilusão na primeira linha.
      // A sucessão também é boa ficção: quem restou escreve com o luto junto.
      parts.push(
        [
          `ATENÇÃO: ${p.leaderName}, ${p.title}, MORREU nos acontecimentos que você viveu.`,
          `Você é quem responde agora por ${ctx.toHouseName} — herdeiro, regente ou оficial que sobrou.`,
          `Nunca assine com o nome do morto nem escreva como se ele estivesse vivo.`,
          `A Casa está de luto, e isso aparece na carta: raiva, desconfiança, ou a frieza de quem ainda não teve tempo de sentir.`,
          `O temperamento da Casa continua o mesmo — ${p.temperament}`,
        ].join("\n"),
      );
    } else {
      parts.push(
        [
          `Você é ${p.leaderName}, ${p.title}.`,
          `Temperamento: ${p.temperament}`,
          `Como você escreve: ${p.speechStyle}`,
          `O que você quer: ${p.wants}`,
          `O que você nunca aceita: ${p.refuses}`,
        ].join("\n"),
      );
    }

    // Postura política e interesses valem qualquer que seja o remetente, e é o
    // que impede uma Casa de escrever como se a Coroa e os favores não
    // existissem.
    parts.push(`Sua postura com a Coroa (o rei Alic Valerius): ${p.crownStance}`);
    parts.push(`Seus interesses e favores agora: ${p.interests}`);

    // A desconfiança ou confiança é por Casa: só entra quando é justamente esta
    // Casa que escreve. É o que faz os orcs responderem a Solarion com a
    // memória da escravidão sem tratar Khazdrun do mesmo jeito.
    const distrust = ctx.fromHouseKey ? p.distrusts?.[ctx.fromHouseKey] : undefined;
    const trust = ctx.fromHouseKey ? p.trusts?.[ctx.fromHouseKey] : undefined;
    if (distrust) parts.push(`Você DESCONFIA de ${ctx.fromHouseName}: ${distrust} Isso pesa no tom, sem virar acusação gratuita.`);
    if (trust) parts.push(`Você CONFIA em ${ctx.fromHouseName}: ${trust} A carta pode ser mais aberta com eles do que com outros.`);
  }

  if (ctx.relations.length) {
    parts.push(
      `A sua história com ${ctx.fromHouseName} — isto é o PASSADO entre as Casas:\n- ${ctx.relations.join("\n- ")}`,
    );
  } else {
    parts.push(`Você não tem mágoa nem aliança registrada com ${ctx.fromHouseName}.`);
  }

  if (ctx.chronicle.trim()) {
    parts.push(`O que aconteceu no reino até agora — você viveu isto:\n${ctx.chronicle.trim()}`);
  }

  if (ctx.publicEvent.trim()) {
    parts.push(`O que está acontecendo agora:\n${ctx.publicEvent.trim().slice(0, 1600)}`);
  }

  // A fatia da própria Casa, reapresentada como conhecimento interno. É o que
  // faz o NPC da Casa que se rebelou tratar a rebelião como coisa sua, e não
  // como notícia distante. Como é interno, o sigilo se aplica: pode blefar ou
  // negar para quem escreve, não entrega de bandeja.
  if (ctx.houseSituation.trim()) {
    parts.push(
      `O que a SUA Casa está fazendo e vivendo agora (você sabe isto por dentro; não é público, e você decide o quanto revela):\n${ctx.houseSituation.trim()}`,
    );
  }

  // Negociar exige saber do que se precisa — dos dois lados. Só o próprio
  // perfil produz cortesia; os dois produzem proposta.
  if (ctx.houseProfile) {
    const p = ctx.houseProfile;
    parts.push(
      `Do que a SUA Casa vive, e do que ela carece — pese isto ao negociar, ` +
      `pedindo o que lhe falta e cobrando pelo que só você oferece:\n` +
      `- Riqueza: ${p.wealth}\n- Recursos: ${p.resources}\n- Soldados: ${p.soldiers}\n- Controle: ${p.control}`,
    );
  }

  if (ctx.writerProfile) {
    const w = ctx.writerProfile;
    parts.push(
      `O que se sabe de ${ctx.fromHouseName} — que povo vive de quê não é segredo em Valdren:\n` +
      `- Riqueza: ${w.wealth}\n- Recursos: ${w.resources}\n- Soldados: ${w.soldiers}\n- Controle: ${w.control}\n\n` +
      `Antes de escrever, faça esta conta em silêncio:\n` +
      `1. O que EU tenho de sobra e eles NÃO têm? Isso é o que eu ofereço.\n` +
      `2. O que EU não tenho e eles têm de sobra? Isso é o que eu peço.\n` +
      `3. O que falta aos DOIS? Isso ninguém pode dar a ninguém — não peça, e reconheça a dificuldade comum.\n\n` +
      `Nunca peça o que a outra Casa também declara faltar: pedir trigo a quem não planta trigo é o ` +
      `erro que denuncia uma carta escrita sem ler. Depois da conta, proponha em termos concretos, com ` +
      `quantidade, prazo e contrapartida.`,
    );
  }

  const mapa = buildGeographyBlock(ctx.toHouseKey, ctx.fromHouseKey, ctx.toHouseName, ctx.fromHouseName);
  if (mapa) parts.push(mapa);

  if (ctx.houseRelation) {
    parts.push(relationBlock(ctx.houseRelation, ctx.fromHouseName));
  }

  // Três camadas falam de relação e podem divergir: a história (passado), a
  // matriz (hoje) e o estado vivo (esta pessoa). Sem dizer qual manda, o modelo
  // escolhia sozinho e às vezes escolhia errado — recitava uma ferida antiga
  // como se fosse a posição atual. Divergência não é defeito: é o que permite
  // uma Casa ter superado o que a outra ainda cobra.
  if (ctx.relations.length && ctx.houseRelation) {
    parts.push(
      "Como ler o passado e o presente juntos: a história diz o que houve, e o " +
      "estado atual diz como você trata essa Casa HOJE. Onde os dois divergirem, " +
      "o presente manda — e a divergência em si é matéria da carta. Ferida antiga " +
      "com boa relação hoje significa que se perdoou, e vale dizer isso. Boa " +
      "história com má relação hoje significa que algo recente quebrou, e vale " +
      "cobrar. Nunca recite uma mágoa antiga como se fosse a sua posição de agora.",
    );
  }

  if (ctx.priorLetters.length) {
    parts.push(
      `O que já se disseram em turnos anteriores — você lembra disto:\n` +
        ctx.priorLetters
          .map((m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? ctx.fromHouseName : ctx.toHouseName}: ${m.body}`)
          .join("\n\n"),
    );
  }

  parts.push(
    `Correspondência deste turno com ${ctx.fromHouseName}:\n` +
      ctx.thread
        .map((m) => `${m.author === "PLAYER" ? ctx.fromHouseName : ctx.toHouseName}: ${m.body}`)
        .join("\n\n"),
  );

  // Living Characters: a camada viva reconstruída do NpcDynamic — relação com
  // quem escreve, objetivo, humor, memórias. Reconstruir a cada carta, nunca só
  // do último texto, é o princípio central.
  //
  // Exigia `character` além do estado vivo, e a rota já passou a carregar o
  // dinâmico do LÍDER quando a carta vai à chancelaria: o resultado era buscar
  // a memória no banco e jogá-la fora. O testemunho inteiro de Selma sobre a
  // Asteria era lido e descartado em toda carta que não a endereçasse pelo
  // nome. Quem responde é quem tem o estado vivo, tenha nome na carta ou não.
  if (ctx.npcDynamic) {
    const living = buildRoleplayBlock({ dynamic: ctx.npcDynamic, fromHouseKey: ctx.fromHouseKey, fromHouseName: ctx.fromHouseName });
    if (living.trim()) {
      parts.push(
        `Como você está agora, e o que viveu:\n${living}\n\n` +
        "Isto é o SEU estado, não o da Casa. Onde ele divergir da posição oficial, " +
        "você é uma pessoa dentro de uma Casa: pode discordar dela, e a carta fica " +
        "melhor quando isso aparece sem virar traição declarada.",
      );
    }
  }

  parts.push(`Escreva a resposta de ${ctx.toHouseName}.`);
  return parts.join("\n\n");
}

/**
 * A carta de um NPC do Codex — um arquimago, a Regente — na própria voz.
 *
 * Reaproveita as camadas que valem para qualquer resposta (mundo, história,
 * cartas passadas, conversa do turno, estado vivo) e troca só a identidade: em
 * vez da chancelaria ou de uma figura de Casa, é a ficha do Codex que fala,
 * com personalidade, voz, valores e linhas vermelhas — e o segredo que guarda.
 */
function buildCodexNpcReply(ctx: HouseReplyContext, npc: NpcIdentity): string {
  const parts: string[] = [
    [
      `Você é ${npc.name}, ${npc.role}.`,
      `Personalidade: ${npc.personality}`,
      npc.speechStyle ? `Como você fala: ${npc.speechStyle}` : "",
      npc.values ? `O que você valoriza: ${npc.values}` : "",
      npc.ambitions ? `O que você quer: ${npc.ambitions}` : "",
      npc.redLines ? `O que você nunca aceita: ${npc.redLines}` : "",
      npc.secrets ? `O que você guarda e NUNCA revela numa carta: ${npc.secrets}` : "",
      npc.roleplayGuidance ? `Como se conduzir: ${npc.roleplayGuidance}` : "",
      "Você responde por si, na sua voz — não como a chancelaria de uma Casa.",
    ]
      .filter(Boolean)
      .join("\n"),
  ];

  if (ctx.relations.length) {
    parts.push(`A sua história com ${ctx.fromHouseName} — isto pesa no tom:\n- ${ctx.relations.join("\n- ")}`);
  }
  if (ctx.chronicle.trim()) parts.push(`O que aconteceu no reino até agora — você viveu isto:\n${ctx.chronicle.trim()}`);
  if (ctx.publicEvent.trim()) parts.push(`O que está acontecendo agora:\n${ctx.publicEvent.trim().slice(0, 1600)}`);

  if (ctx.npcDynamic) {
    const living = buildRoleplayBlock({ dynamic: ctx.npcDynamic, fromHouseKey: ctx.fromHouseKey, fromHouseName: ctx.fromHouseName });
    if (living.trim()) parts.push(`Como você está agora, e o que viveu:\n${living}`);
  }

  if (ctx.writerProfile) {
    const w = ctx.writerProfile;
    parts.push(
      `O que se sabe de ${ctx.fromHouseName}: ${w.resources} Riqueza: ${w.wealth}\n\n` +
      `Se houver negócio possível entre o que eles têm e o que você precisa, proponha em termos concretos.`,
    );
  }

  if (ctx.houseRelation) {
    parts.push(relationBlock(ctx.houseRelation, ctx.fromHouseName));
  }

  if (ctx.priorLetters.length) {
    parts.push(
      `Cartas passadas com ${ctx.fromHouseName}, você lembra disto:\n` +
        ctx.priorLetters.map((m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? ctx.fromHouseName : npc.name}: ${m.body}`).join("\n\n"),
    );
  }
  parts.push(
    `Correspondência deste turno com ${ctx.fromHouseName}:\n` +
      ctx.thread.map((m) => `${m.author === "PLAYER" ? ctx.fromHouseName : npc.name}: ${m.body}`).join("\n\n"),
  );

  parts.push(`Escreva a resposta de ${npc.name}, no máximo 250 palavras, em português.`);
  return parts.join("\n\n");
}

/**
 * Seções do arquivo de relações que tratam das duas Casas.
 *
 * Casa por parágrafo não serve: o parágrafo que explica o Tempo sem Nomes cita
 * "Mandíbula de Osso" e "dinastias élficas", mas não "Solarion" pelo nome, e
 * ficava de fora justamente a relação mais carregada do cânone. A seção
 * inteira é a unidade certa — é assim que o documento está escrito.
 *
 * Seções que citam meia dúzia de Casas ("Nenhuma Casa vota apenas sobre a idade
 * de Alic...") são descartadas: casam com qualquer par e não dizem nada sobre
 * este.
 */
const CATCH_ALL_HOUSE_COUNT = 5;

export function relationsBetween(relationsDoc: string, a: string, b: string, limit = 2): string[] {
  const ka = significantTokens(a);
  const kb = significantTokens(b);
  if (!ka.length || !kb.length) return [];

  const sections = relationsDoc.split(/\n(?=#+\s)/);
  const scored: { text: string; score: number }[] = [];

  for (const section of sections) {
    const folded = fold(section);
    if (!ka.some((w) => folded.includes(w)) || !kb.some((w) => folded.includes(w))) continue;

    const heading = fold(section.split("\n")[0] ?? "");
    const inHeading = ka.some((w) => heading.includes(w)) && kb.some((w) => heading.includes(w));

    // Uma seção panorâmica cita meia dúzia de Casas e não diz nada sobre este
    // par. Mas uma seção cujo TÍTULO nomeia as duas é sobre elas mesmo que
    // mencione outras de passagem — é o caso do Tempo sem Nomes, que cita
    // Auremont, Ferrumor e Khazdrun para explicar quem se omitiu.
    if (!inHeading) {
      const named = SEAT_TOKENS.filter((t) => folded.includes(t)).length;
      if (named > CATCH_ALL_HOUSE_COUNT) continue;
    }

    scored.push({
      text: section.replace(/^#+\s*/gm, "").replace(/\n{2,}/g, "\n").trim().slice(0, 1400),
      // Uma seção cujo título nomeia as duas é sobre elas; as demais só as citam.
      score: inHeading ? 2 : 1,
    });
  }

  return scored.sort((x, y) => y.score - x.score).slice(0, limit).map((x) => x.text);
}

export interface ParsedReply {
  text: string;
  acordo: { tipo: FactKind; resumo: string } | null;
}

/**
 * A resposta virou JSON para trazer o acordo junto da carta.
 *
 * O formato antigo (texto puro) continua aceito: um modelo pode devolver prosa
 * apesar do pedido, e perder a carta inteira por causa de uma chave faltando
 * seria trocar uma resposta boa por nenhuma.
 */
export function parseReply(raw: string): ParsedReply {
  const bruto = (raw ?? "").trim();
  if (!bruto) return { text: "", acordo: null };

  try {
    const o = JSON.parse(bruto) as Record<string, unknown>;
    const texto = typeof o.carta === "string" ? o.carta : "";
    if (!texto.trim()) return { text: limpar(bruto), acordo: null };
    const a = o.acordo as Record<string, unknown> | null | undefined;
    const acordo =
      a && isFactKind(a.tipo) && typeof a.resumo === "string" && a.resumo.trim()
        ? { tipo: a.tipo, resumo: a.resumo.trim().slice(0, 400) }
        : null;
    return { text: limpar(texto), acordo };
  } catch {
    return { text: limpar(bruto), acordo: null };
  }
}

function limpar(v: string): string {
  return v.trim().replace(/^["“]|["”]$/g, "").trim().slice(0, REPLY_MAX);
}
