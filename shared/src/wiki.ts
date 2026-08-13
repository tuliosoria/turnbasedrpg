export interface WikiSection {
  id: string;
  label: string;
}

/**
 * Fixed set of sections for the living Valdren wiki. The sidebar renders these
 * in order; each entry belongs to exactly one section id.
 */
export const WIKI_SECTIONS: WikiSection[] = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "censo", label: "Censo" },
  { id: "guerras", label: "Guerras" },
  { id: "os-magos", label: "Os Magos" },
  { id: "expedicao", label: "Expedição" },
  { id: "geografia", label: "Geografia e Atlas" },
  { id: "governo", label: "Governo" },
  { id: "tributos", label: "Economia e Tributos" },
  { id: "casas", label: "As Casas" },
  { id: "cidades", label: "Cidades Importantes" },
  { id: "mortos-vivos", label: "Os Mortos-Vivos" },
  { id: "brumas", label: "As Brumas" },
  { id: "crise-atual", label: "Crise Atual" },
  { id: "historias", label: "Histórias Antigas" },
  { id: "cosmologia", label: "Cosmologia" },
  { id: "ceu", label: "O Céu de Valdren" },
  { id: "religioes", label: "Religiões" },
  { id: "magia", label: "Magia" },
  { id: "povos", label: "Povos de Valdren" },
  { id: "criaturas", label: "Criaturas e Lendas" },
  { id: "costumes", label: "Costumes e Superstições" },
  { id: "calendario", label: "Calendário" },
  // Fala com o jogador na mesa, não de dentro do mundo — por isso no fim,
  // depois de toda a crônica.
  { id: "campanha-dnd", label: "Campanha D&D" },
];

/**
 * Seções que descrevem as regras do jogo, e não o mundo.
 *
 * O motor de canon visual casa o texto de um pedido de imagem contra todo
 * verbete existente. Sem esta lista, pedir "uma fogueira no acampamento"
 * poderia arrastar o verbete de Fireball para dentro do prompt como se fosse
 * canon de Valdren — regra de mesa vazando para dentro da ficção.
 */
export const NON_CANON_WIKI_SECTIONS: string[] = ["campanha-dnd"];

export function isCanonWikiSection(id: string): boolean {
  return !NON_CANON_WIKI_SECTIONS.includes(id);
}

export const WIKI_SECTION_IDS: string[] = WIKI_SECTIONS.map((s) => s.id);

export function wikiSectionLabel(id: string): string {
  return WIKI_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

export interface WikiEntry {
  entryId: string;
  section: string;
  title: string;
  body: string;
  order: number;
  updatedAt: string;
  imageUrl?: string;
  imageUrls?: string[];
}
