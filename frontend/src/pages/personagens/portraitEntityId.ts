/**
 * Um id do Codex vira o id da entidade visual canônica. Batem em todos os casos
 * menos Celene: o retrato canônico dela foi seedado como `celene-valerius` antes
 * do Codex existir, enquanto o Codex a chama de `lady-celene-valerius`.
 * O mesmo mapa é usado no seed do backend (`seed-npc-portraits.mjs`).
 */
const ENTITY_ALIAS: Record<string, string> = {
  "lady-celene-valerius": "celene-valerius",
};

export function portraitEntityId(codexId: string): string {
  return ENTITY_ALIAS[codexId] ?? codexId;
}
