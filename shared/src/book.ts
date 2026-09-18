export interface BookPart {
  id: string;
  label: string;
}

/**
 * As partes do romance, em ordem de leitura. O prólogo abre a moldura de
 * memória; as três partes seguem a jornada. A ordem aqui é a ordem canônica
 * de leitura, e é ela que agrupa os capítulos no índice público e no editor.
 */
export const BOOK_PARTS: BookPart[] = [
  { id: "prologo", label: "Prólogo" },
  { id: "parte-1", label: "Parte I — O Norte Morto" },
  { id: "parte-2", label: "Parte II — A Companhia" },
  { id: "parte-3", label: "Parte III — A Coroa" },
];

export const BOOK_PART_IDS: string[] = BOOK_PARTS.map((p) => p.id);

export function bookPartLabel(id: string): string {
  return BOOK_PARTS.find((p) => p.id === id)?.label ?? id;
}

export type BookStatus = "rascunho" | "publicado";

export interface BookChapter {
  chapterId: string;
  part: string;
  order: number;
  title: string;
  body: string;
  status: BookStatus;
  updatedAt: string;
}
