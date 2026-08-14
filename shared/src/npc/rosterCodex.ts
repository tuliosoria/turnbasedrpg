import type { NpcIdentity } from "./codex.js";

/**
 * NPCs que não saem do elenco das Casas: a Coroa, os 27 magos da Ordem dos
 * Três, generais, sacerdotes, mercadores de peso.
 *
 * Gerados do cânone por `backend/scripts/seed-npc-codex.mjs`, revisados, e
 * commitados aqui como canon — mesmo caminho das personas de líder. Vazio até
 * o script rodar (ele precisa da chave da OpenAI). O Codex derivado das Casas
 * funciona sem isto; este arquivo só acrescenta o resto do reino.
 */
export const ROSTER_CODEX: NpcIdentity[] = [];
