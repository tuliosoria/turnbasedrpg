import type { ProjectCategory } from "@ravenloft/content";

/**
 * A faixa de 4px à esquerda da carta. Tons dessaturados, longe do turquesa da
 * Energia e do ouro do tema, para a categoria orientar sem competir.
 */
export const CORES_DE_CATEGORIA: Record<ProjectCategory, string> = {
  MILITARY: "#b06a5e",
  INFRASTRUCTURE: "#8f8a7a",
  ECONOMY: "#b59a5a",
  DIPLOMACY: "#6f8fb0",
  INTELLIGENCE: "#8a7aa8",
  SOCIETY: "#9a7f6a",
  MAGIC: "#a07ab0",
  EXPLORATION: "#6f9a7a",
};
