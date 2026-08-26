import type { WikiEntry, HouseCharacter, NpcDynamic, NpcIdentity, HouseProfile } from "@ravenloft/content";
import { SEATS, type LeaderPersona } from "@ravenloft/content";
import { buildRoleplayBlock } from "../npc/roleplay";
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
   * O estado vivo do NPC (Living Characters): relações multidimensionais e
   * memória, evoluídos pelo Relationship Engine turno a turno, mais o que o
   * Mestre ajusta na aba Vivos. Fonte única do estado de NPC. Null para a
   * chancelaria ou para um NPC que o mundo ainda não tocou.
   */
  npcDynamic: NpcDynamic | null;
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
      `A sua história com ${ctx.fromHouseName} — isto pesa no tom da carta:\n- ${ctx.relations.join("\n- ")}`,
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

  // Negociar exige saber do que se precisa. Uma Casa que conhece a própria
  // escassez pede o que lhe falta e cobra caro pelo que só ela tem.
  if (ctx.houseProfile) {
    const p = ctx.houseProfile;
    parts.push(
      `Do que a SUA Casa vive, e do que ela carece — pese isto ao negociar, ` +
      `pedindo o que lhe falta e cobrando pelo que só você oferece:\n` +
      `- Riqueza: ${p.wealth}\n- Recursos: ${p.resources}\n- Soldados: ${p.soldiers}\n- Controle: ${p.control}`,
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
  // do último texto, é o princípio central. Só entra para um indivíduo com
  // estado vivo; a chancelaria segue pela persona.
  if (ctx.character && ctx.npcDynamic) {
    const living = buildRoleplayBlock({ dynamic: ctx.npcDynamic, fromHouseKey: ctx.fromHouseKey, fromHouseName: ctx.fromHouseName });
    if (living.trim()) parts.push(`Como você está agora, e o que viveu:\n${living}`);
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

export function parseReply(raw: string): string {
  return (raw ?? "").trim().replace(/^["“]|["”]$/g, "").trim().slice(0, REPLY_MAX);
}
