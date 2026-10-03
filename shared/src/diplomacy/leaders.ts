/**
 * A persona inteira de quem responde as cartas: voz pública mais o que só o
 * Mestre lê.
 *
 * Importar de `@ravenloft/content/gm-codex`. O barrel público exporta só
 * `LeaderVoice` / `LEADER_PERSONAS` sem recusa, desejo, postura com a Coroa
 * ou desconfiança.
 */
import { LEADER_PERSONAS as VOICES, type LeaderVoice } from "./leaderVoice.js";
import { LEADER_SECRETS, type LeaderSecrets } from "./leaderSecrets.js";

export interface LeaderPersona extends LeaderVoice, LeaderSecrets {}

export const LEADER_PERSONAS: Record<string, LeaderPersona> = Object.fromEntries(
  Object.keys(VOICES).map((key) => {
    const voice = VOICES[key];
    const secrets = LEADER_SECRETS[key];
    if (!voice || !secrets) throw new Error(`Persona incompleta: ${key}`);
    return [key, { ...voice, ...secrets }];
  }),
);

export function personaFor(houseKey: string): LeaderPersona | null {
  return LEADER_PERSONAS[houseKey] ?? null;
}
