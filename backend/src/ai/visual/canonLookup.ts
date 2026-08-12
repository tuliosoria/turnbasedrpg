import type { WikiEntry } from "@ravenloft/content";

/**
 * Structured facts every "casas" wiki entry opens with, e.g.
 *   > **Símbolo:** uma torre negra sob três flocos.
 * These are the highest-value lines for image generation: an emblem or a seat
 * is concrete and drawable, where the surrounding prose is mostly politics.
 */
export interface CanonFacts {
  lema?: string;
  simbolo?: string;
  territorio?: string;
  sede?: string;
  status?: string;
}

const FACT_LABELS: { key: keyof CanonFacts; pattern: RegExp }[] = [
  { key: "lema", pattern: /\*\*Lema:\*\*\s*(.+)/i },
  { key: "simbolo", pattern: /\*\*S[íi]mbolo:\*\*\s*(.+)/i },
  { key: "territorio", pattern: /\*\*Territ[óo]rio:\*\*\s*(.+)/i },
  { key: "sede", pattern: /\*\*Sede:\*\*\s*(.+)/i },
  { key: "status", pattern: /\*\*Status:\*\*\s*(.+)/i },
];

function clean(v: string): string {
  return v.replace(/^[>\s]+/, "").replace(/[*_]/g, "").replace(/\s+/g, " ").trim().replace(/[.;]$/, "");
}

export function extractCanonFacts(body: string): CanonFacts {
  const out: CanonFacts = {};
  // Only the header block carries these; scanning the whole body risks picking
  // up another house's symbol quoted later in the prose.
  const head = body.slice(0, 1200);
  for (const { key, pattern } of FACT_LABELS) {
    const m = head.match(pattern);
    if (m?.[1]) out[key] = clean(m[1]);
  }
  return out;
}

export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The distinctive part of a wiki title: "Casa Rimerberg — Os Vigias da Última
 * Neve" → "Casa Rimerberg". Titles follow `Nome — Epíteto`.
 */
export function titleHead(title: string): string {
  return title.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();
}

/**
 * A seat is written as prose, not an identifier: "Ordu-Yildiz, cidade móvel"
 * names the city plus an aside. Only the part before the comma is the name.
 */
export function seatName(sede: string | undefined): string | null {
  if (!sede) return null;
  const head = fold(titleHead(sede.split(",")[0] ?? ""));
  return head || null;
}

/** Words too common in this setting to identify anything on their own. */
const STOPWORDS = new Set(["casa", "cla", "clã", "ordem", "grande", "os", "as", "de", "da", "do", "dos", "das", "valdren", "a", "o"]);

/**
 * Significant tokens of a title head, e.g. "Casa Rimerberg" → ["rimerberg"].
 * Matching on "Casa" alone would hit every house entry at once.
 */
export function significantTokens(titleOrName: string): string[] {
  return fold(titleHead(titleOrName))
    .split(/[^a-z0-9']+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

export interface CanonMatch {
  entry: WikiEntry;
  facts: CanonFacts;
  matchedOn: string;
}

/**
 * Finds the wiki entries a free-text request is talking about.
 *
 * Deliberately literal: a token from the entry's title must appear in the
 * request. No fuzzy scoring, because a wrong match injects another house's
 * emblem into the prompt — worse than injecting nothing, since the author may
 * not notice and the discovery loop could later canonise the error.
 */
export function findCanonMatches(requestText: string, entries: WikiEntry[], limit = 3): CanonMatch[] {
  const haystack = fold(requestText);
  const matches: { m: CanonMatch; weight: number }[] = [];

  for (const entry of entries) {
    const facts = extractCanonFacts(entry.body);
    // A house is identifiable by its own name or by its seat: "desenhe Droskar"
    // should reach Casa Vargen, which declares `Sede: Droskar`.
    const tokens = [...significantTokens(entry.title), ...(facts.sede ? significantTokens(facts.sede) : [])];
    const hit = tokens.find((t) => haystack.includes(t));
    if (!hit) continue;
    matches.push({
      m: { entry, facts, matchedOn: hit },
      // Longer tokens are more distinctive: "rimerberg" beats "norte".
      weight: hit.length,
    });
  }

  matches.sort((a, b) => b.weight - a.weight);
  const chosen = matches.slice(0, limit).map((x) => x.m);

  // Follow "Sede:" in BOTH directions, because a request names one end or the
  // other but almost never both.
  //
  // City -> House: "uma muralha de Rimewatch" must reach Casa Rimerberg for its
  // heraldry, though the word "Rimerberg" never appears.
  //
  // House -> City: "a capital de Karasoy" must reach the Ordu-Yildiz article,
  // which is the only place the fortified wagons and disassemblable towers are
  // described. Without it the model has nothing concrete to draw and invents
  // something vague — this is exactly how a city defined by its wheels came
  // back as tents standing on the ground.
  const chosenIds = new Set(chosen.map((c) => c.entry.entryId));
  const chosenNames = new Set(chosen.map((c) => fold(titleHead(c.entry.title))));
  const chosenSeats = new Set(
    chosen.map((c) => seatName(c.facts.sede)).filter((s): s is string => !!s),
  );

  for (const entry of entries) {
    if (chosen.length >= limit + 2) break;
    if (chosenIds.has(entry.entryId)) continue;
    const facts = extractCanonFacts(entry.body);
    const head = fold(titleHead(entry.title));

    const isSeatOfChosen = chosenSeats.has(head);
    const housesAChosenSeat = !!facts.sede && chosenNames.has(seatName(facts.sede) ?? "");
    if (!isSeatOfChosen && !housesAChosenSeat) continue;

    chosen.push({ entry, facts, matchedOn: isSeatOfChosen ? `sede-de:${head}` : `sede:${facts.sede}` });
    chosenIds.add(entry.entryId);
  }

  return chosen;
}

/** Renders matches as prompt-ready canon lines. */
export function renderCanonMatches(matches: CanonMatch[], bodyChars = 500): string {
  return matches
    .map(({ entry, facts }) => {
      const lines = [`## ${entry.title}`];
      if (facts.simbolo) lines.push(`Símbolo (deve aparecer se houver estandarte, brasão ou insígnia): ${facts.simbolo}`);
      if (facts.sede) lines.push(`Sede: ${facts.sede}`);
      if (facts.territorio) lines.push(`Território: ${facts.territorio}`);
      if (facts.lema) lines.push(`Lema: ${facts.lema}`);
      const prose = entry.body.replace(/^>.*$/gm, "").replace(/\s+/g, " ").trim();
      if (prose) lines.push(prose.slice(0, bodyChars));
      return lines.join("\n");
    })
    .join("\n\n");
}
