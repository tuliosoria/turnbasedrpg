export interface GmSection {
  id: string;
  label: string;
}

/**
 * Sections for the GM-only "Bíblia do Mestre" (Game Master's bible). These are
 * NEVER exposed through any public endpoint. Kept separate from the player wiki
 * by design, so secret lore can never leak. Labels here are neutral on purpose:
 * the real titles live in the admin UI.
 */
export const GM_SECTIONS: GmSection[] = [
  { id: "a-verdade", label: "A Verdade" },
  { id: "casas-segredo", label: "O Segredo das Casas" },
  { id: "revelacao", label: "Como Revelar a Verdade" },
  { id: "ancoras", label: "Âncoras" },
  { id: "pergunta", label: "A Pergunta Central" },
];

export const GM_SECTION_IDS: string[] = GM_SECTIONS.map((s) => s.id);

export function gmSectionLabel(id: string): string {
  return GM_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

export interface GmEntry {
  entryId: string;
  section: string;
  title: string;
  body: string;
  order: number;
  updatedAt: string;
}
