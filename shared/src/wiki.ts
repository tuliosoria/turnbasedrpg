export interface WikiSection {
  id: string;
  label: string;
}

/**
 * Fixed set of sections for the living Valdren wiki. The sidebar renders these
 * in order; each entry belongs to exactly one section id.
 */
export const WIKI_SECTIONS: WikiSection[] = [
  { id: "casas", label: "As Casas" },
  { id: "cidades", label: "Cidades Importantes" },
  { id: "mortos-vivos", label: "Os Mortos-Vivos" },
  { id: "brumas", label: "As Brumas" },
  { id: "historias", label: "Histórias Antigas" },
];

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
}
