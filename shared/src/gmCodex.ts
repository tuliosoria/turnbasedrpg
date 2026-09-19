/**
 * Elenco e segredos que só o Mestre e a IA leem.
 *
 * Importar de `@ravenloft/content/gm-codex`. O barrel público em `index.ts`
 * não reexporta isto — senão o grafo do jogador alcança Alic, Kaelen e o
 * que cada figura esconde.
 */
export * from "./npc/codex.js";
export * from "./lore/characterSecrets.js";
