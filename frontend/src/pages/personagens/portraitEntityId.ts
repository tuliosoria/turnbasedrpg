/**
 * Um id do Codex vira o id da entidade visual canônica. Batem em todos os casos
 * menos Celene e Alic: os retratos foram seedados como `celene-valerius` e
 * `alic-valerius`, enquanto o elenco da Casa usa os títulos nos ids.
 * O mesmo mapa é usado no seed do backend (`seed-npc-portraits.mjs`).
 */
const ENTITY_ALIAS: Record<string, string> = {
  "lady-celene-valerius": "celene-valerius",
  "principe-alic-valerius": "alic-valerius",
};

export function portraitEntityId(codexId: string): string {
  return ENTITY_ALIAS[codexId] ?? codexId;
}
