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

export interface WikiGroup {
  id: string;
  label: string;
  /** Uma frase sobre o que se encontra aqui, para o índice. */
  blurb: string;
  sections: string[];
}

/**
 * As seções reunidas em cinco grupos.
 *
 * Vinte e três seções numa fileira única não é um índice, é uma parede: quem
 * chega não sabe por onde começar e quem procura algo específico varre tudo.
 * Os grupos são a unidade de navegação; a seção continua sendo a unidade de
 * conteúdo.
 */
export const WIKI_GROUPS: WikiGroup[] = [
  {
    id: "reino",
    label: "O Reino",
    blurb: "Quem governa, quem paga tributo e onde tudo isso fica.",
    sections: ["visao-geral", "governo", "casas", "cidades", "geografia", "censo", "tributos"],
  },
  {
    id: "historia",
    label: "História",
    blurb: "O que já aconteceu, e o que está acontecendo agora.",
    sections: ["historias", "guerras", "expedicao", "crise-atual"],
  },
  {
    id: "povos",
    label: "Povos e Cultura",
    blurb: "Como se vive em Valdren: fé, costume, calendário e língua.",
    sections: ["povos", "costumes", "religioes", "calendario"],
  },
  {
    id: "mistério",
    label: "Magia e Mistério",
    blurb: "O que a Ordem estuda, o que as Brumas escondem e o que volta dos túmulos.",
    sections: ["magia", "os-magos", "cosmologia", "ceu", "brumas", "mortos-vivos", "criaturas"],
  },
  {
    id: "mesa",
    label: "Na Mesa",
    blurb: "Como levar Valdren para uma campanha de verdade.",
    sections: ["campanha-dnd"],
  },
];

export const WIKI_SECTION_IDS: string[] = WIKI_SECTIONS.map((s) => s.id);

/** O grupo a que uma seção pertence, ou null se ela ainda não foi agrupada. */
export function wikiGroupOf(sectionId: string): WikiGroup | null {
  return WIKI_GROUPS.find((g) => g.sections.includes(sectionId)) ?? null;
}

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
