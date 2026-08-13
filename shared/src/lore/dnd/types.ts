/**
 * Tipos do guia de campanha — a camada de regras de Valdren.
 *
 * A regra fundamental do cenário é "magia rara, não magia fraca": nenhuma
 * destas estruturas altera spell slots, dano, progressão ou funcionamento de
 * classe. Elas descrevem o que as regras do SRD 5.2.1 *significam* dentro de
 * Valdren, e nada mais.
 */

/** Uma espécie do SRD 5.2.1, pelo nome com que a licença a publica. */
export type SrdSpecies =
  | "Dragonborn"
  | "Dwarf"
  | "Elf"
  | "Gnome"
  | "Goliath"
  | "Halfling"
  | "Human"
  | "Orc"
  | "Tiefling";

/** As espécies que o SRD 5.2.1 publica sob CC-BY-4.0. */
export const SRD_SPECIES: SrdSpecies[] = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Goliath",
  "Halfling",
  "Human",
  "Orc",
  "Tiefling",
];

/**
 * Um povo de Valdren.
 *
 * Em Valdren a cultura pesa tanto quanto a biologia, então a ficha traz as
 * duas linhas: o Povo, que é onde o personagem nasceu e o que isso significa,
 * e a Espécie, que é o bloco de regras que ele usa.
 *
 * Nenhum povo inventa mecânica. Cada um aponta para uma espécie do SRD e a
 * reinterpreta — os nomes das linhagens mudam, os efeitos não. Isso mantém o
 * cenário compatível com qualquer mesa de 5.5e e tira do caminho o risco de
 * balancear espécie nova.
 */
export interface ValdrenPeople {
  /** Chave estável, alinhada com a Casa correspondente quando existe uma. */
  key: string;
  /** Nome do povo, como Valdren o chama. */
  name: string;
  /** Espécie do SRD que fornece o bloco mecânico. */
  species: SrdSpecies;
  /** Casa ou região de origem, para ligar o povo ao resto do canon. */
  homeland: string;
  /** O que você vê antes de qualquer conversa. */
  silhouette: string;
  /** Quem eles são, e a ferida que carregam. */
  culture: string;
  /** Costumes que valem mais que uma linha de ficha. */
  customs: string[];
  /** Como as regras da espécie se leem dentro de Valdren. */
  reinterpretation: string;
  /** Onde a mecânica do SRD é renomeada, e para quê. */
  renamedOptions?: { srd: string; valdren: string }[];
  /** Como este povo tende a encarar as classes. */
  classNotes: string;
  /** Atritos e alianças com os outros povos. */
  relations: string;
}

/** Uma classe do SRD e o lugar que ela ocupa em Valdren. */
export interface ValdrenClass {
  /** Nome da classe, como o SRD a publica. */
  name: string;
  /** Como ela aparece no mundo. */
  appearsAs: string;
  /**
   * Classes cujo peso muda em Valdren ganham um parágrafo próprio depois da
   * tabela. As demais deixam este campo vazio.
   */
  note?: string;
}
