import type { WikiEntry } from "@ravenloft/content";
import { SEATS } from "@ravenloft/content";
import { extractCanonFacts, fold, significantTokens, titleHead } from "../visual/canonLookup";

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
  /** Verbete público da Casa que responde. */
  houseEntry: WikiEntry | null;
  /** Trechos das relações históricas que citam as duas Casas. */
  relations: string[];
  /** Evento público do turno corrente, se houver. */
  publicEvent: string;
  /** O que aconteceu nos turnos anteriores, como qualquer Casa saberia. */
  chronicle: string;
  /** Cartas trocadas com esta Casa em turnos passados. */
  priorLetters: { turnNumber: number; author: "PLAYER" | "AI"; body: string }[];
  /** A conversa deste turno, em ordem. */
  thread: { author: "PLAYER" | "AI"; body: string }[];
}

export function buildHouseReplyUser(ctx: HouseReplyContext): string {
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

  parts.push(`Escreva a resposta de ${ctx.toHouseName}.`);
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
