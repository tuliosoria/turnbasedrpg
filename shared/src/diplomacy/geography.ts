/**
 * Posições das sedes no mapa canônico de Valdren (1536×1024) e a distância
 * entre elas.
 *
 * A tabela §1.18 do atlas dá tempos de viagem apenas *a partir de Asterhall*,
 * então não existe Solarion↔Karasoy nela. Coordenadas resolvem isso — mas
 * marcar dezesseis pontos num mapa a olho erra em silêncio, então a ordem que
 * elas produzem é conferida contra aquela tabela por teste. A tabela é a fonte
 * de verdade; as coordenadas se submetem a ela.
 */

export interface Seat {
  /** Chave canônica da Casa ou ordem. */
  key: string;
  name: string;
  seat: string;
  x: number;
  y: number;
}

/**
 * A ilha ocupa cerca de 750 px verticais no mapa e o atlas lhe dá 560 km de
 * norte a sul, o que fixa a escala.
 */
export const KM_PER_PIXEL = 560 / 750;

export const SEATS: Seat[] = [
  { key: "casa-valerius", name: "Casa Valerius", seat: "Asterhall", x: 751, y: 433 },
  { key: "casa-rimerberg", name: "Casa Rimerberg", seat: "Rimewatch", x: 570, y: 66 },
  { key: "casa-vargen", name: "Casa Vargen", seat: "Droskar", x: 698, y: 128 },
  { key: "casa-euralune", name: "Casa Euralune", seat: "Ninho Alto", x: 954, y: 182 },
  { key: "casa-khazdrun", name: "Casa Khazdrun", seat: "Khar-Durak", x: 440, y: 265 },
  { key: "ordem-do-sino", name: "Ordem do Sino", seat: "Abadia Branca", x: 635, y: 293 },
  { key: "grande-casa-ulgar", name: "Grande Casa Ulgar", seat: "Rok'thar", x: 1170, y: 258 },
  { key: "irmandade-dos-corvos", name: "Irmandade dos Corvos", seat: "Raven's Cross", x: 928, y: 370 },
  { key: "casa-ferrumor", name: "Casa Ferrumor", seat: "Ferrum", x: 342, y: 496 },
  { key: "cla-mandibula-de-osso", name: "Clã Mandíbula de Osso", seat: "Gor-Kirius", x: 1117, y: 482 },
  { key: "ordem-dos-tres", name: "Ordem dos Três", seat: "Torre de Véspera", x: 747, y: 551 },
  { key: "casa-auremont", name: "Casa Auremont", seat: "Aurivale", x: 402, y: 614 },
  { key: "casa-karasoy", name: "Casa Karasoy", seat: "Ordu-Yildiz", x: 653, y: 649 },
  { key: "casa-solarion", name: "Casa Solarion", seat: "Sahra-Lun", x: 963, y: 645 },
  { key: "casa-do-ouro", name: "Casa do Ouro", seat: "Porto Cinzento", x: 761, y: 807 },
  { key: "casa-drakorys", name: "Casa Drakorys", seat: "Akrathos", x: 405, y: 807 },
];

const BY_KEY = new Map(SEATS.map((s) => [s.key, s]));

export function seatOf(key: string): Seat | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * A sede correspondente à Casa de um jogador, ou null quando nenhuma casa.
 *
 * O houseId nasce de slugify(nome) mais um sufixo aleatório de quatro
 * caracteres, então "solarion-k0hc" precisa alcançar a sede "casa-solarion".
 * Tentamos o id inteiro antes do id sem sufixo porque uma sede pode terminar
 * em quatro caracteres legítimos — "casa-do-ouro" perderia "ouro" se
 * cortássemos primeiro.
 *
 * As Casas vivas guardam nomes curtos ("Solarion", "Ulgar", "Do Ouro")
 * enquanto as sedes seguem os títulos do wiki ("Casa Solarion", "Grande Casa
 * Ulgar"), então o título é descartado dos dois lados antes da comparação —
 * a mesma tolerância que `houseKeyForName` aplica sobre o nome.
 */
const SEAT_TITLE_PREFIX = /^(casa|cla|grande-casa|ordem|irmandade)(-(?:do|dos|da|das|de))?-/;

export function seatKeyForHouseId(houseId: string): string | null {
  const candidates = [houseId, houseId.replace(/-[a-z0-9]{4}$/, "")].filter((c) => c.length > 0);

  const exact = SEATS.find((s) => candidates.includes(s.key));
  if (exact) return exact.key;

  for (const candidate of candidates) {
    const bare = candidate.replace(SEAT_TITLE_PREFIX, "");
    const hit = SEATS.find((s) => s.key.replace(SEAT_TITLE_PREFIX, "") === bare || s.key.endsWith(`-${candidate}`));
    if (hit) return hit.key;
  }
  return null;
}

/** Distância em quilômetros entre duas sedes. Simétrica por construção. */
export function distanceKm(a: string, b: string): number | null {
  const sa = seatOf(a);
  const sb = seatOf(b);
  if (!sa || !sb) return null;
  return Math.round(Math.hypot(sa.x - sb.x, sa.y - sb.y) * KM_PER_PIXEL);
}

/**
 * Dias de viagem desde Asterhall, transcritos do atlas §1.18.
 *
 * Distância em linha reta não serve sozinha para correspondência: Akrathos fica
 * mais longe de Asterhall que Rimewatch no mapa, mas o atlas lhe dá 6 dias
 * contra 15, porque se chega lá por mar e a Rimewatch por geleira. O que atrasa
 * uma carta é o terreno, não o traço reto.
 */
const ATLAS_DAYS: Record<string, number> = {
  "ordem-do-sino": 1.5,
  "irmandade-dos-corvos": 2,
  "casa-do-ouro": 4,
  "casa-auremont": 4,
  "casa-drakorys": 6,
  "casa-khazdrun": 6,
  "casa-solarion": 7,
  "casa-vargen": 8,
  "casa-ferrumor": 9,
  "cla-mandibula-de-osso": 9,
  "grande-casa-ulgar": 10,
  "casa-euralune": 10,
  "casa-rimerberg": 15,
  "casa-karasoy": 6,
  "ordem-dos-tres": 2,
  "casa-valerius": 0,
};

/**
 * Dias por quilômetro de cada rota, calibrado contra o atlas. Um valor alto é
 * uma rota difícil (montanha, geleira); um valor baixo é uma rota fácil (mar,
 * estrada real).
 */
const ROUTE_COST = new Map<string, number>();
for (const s of SEATS) {
  if (s.key === "casa-valerius") continue;
  const km = Math.hypot(s.x - 751, s.y - 433) * KM_PER_PIXEL;
  ROUTE_COST.set(s.key, (ATLAS_DAYS[s.key] ?? 6) / km);
}
// A capital é o ponto mais bem servido do reino: nunca é ela que atrasa a carta.
ROUTE_COST.set("casa-valerius", Math.min(...ROUTE_COST.values()));

/**
 * Dias de viagem estimados entre duas sedes.
 *
 * Usa o custo da ponta mais difícil, não a média: uma carta para Rimewatch
 * atravessa a geleira venha de onde vier. Por construção, de Asterhall para
 * qualquer sede isto reproduz o número do atlas.
 */
export function travelDays(a: string, b: string): number | null {
  const km = distanceKm(a, b);
  if (km === null) return null;
  const cost = Math.max(ROUTE_COST.get(a) ?? 0, ROUTE_COST.get(b) ?? 0);
  return Math.round(km * cost * 10) / 10;
}

export const DISTANCE_BANDS = ["VIZINHA", "PROXIMA", "DISTANTE", "EXTREMA"] as const;
export type DistanceBand = (typeof DISTANCE_BANDS)[number];

/**
 * Os cortes são de calibragem, não de cânone: escolhidos para que
 * Solarion↔Karasoy caia em duas mensagens e Solarion↔Rimewatch em uma, que foi
 * o exemplo do autor. Medidos em dias de viagem. Ajustar aqui, num lugar só.
 */
export function bandFor(days: number): DistanceBand {
  if (days <= 3) return "VIZINHA";
  if (days <= 8) return "PROXIMA";
  if (days <= 14) return "DISTANTE";
  return "EXTREMA";
}

/** Envios permitidos por turno. Cada envio recebe uma resposta. */
export const SENDS_PER_BAND: Record<DistanceBand, number> = {
  VIZINHA: 2,
  PROXIMA: 2,
  DISTANTE: 1,
  EXTREMA: 1,
};

export interface Budget {
  band: DistanceBand;
  km: number;
  days: number;
  sends: number;
}

export function budgetBetween(a: string, b: string): Budget | null {
  const km = distanceKm(a, b);
  const days = travelDays(a, b);
  if (km === null || days === null) return null;
  const band = bandFor(days);
  return { band, km, days, sends: SENDS_PER_BAND[band] };
}
