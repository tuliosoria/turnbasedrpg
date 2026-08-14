/**
 * Estado dinâmico de um NPC, ajustado pelo Mestre.
 *
 * Estado desta partida, não canon do mundo: mora ao lado dos fatos de campanha,
 * não no wiki. Uma mágoa deste turno não pode virar verdade permanente de
 * Valdren — se morasse no canon, uma campanha nova nasceria contaminada.
 *
 * Tudo é opcional: ausência de estado significa que o NPC responde só a partir
 * do canon e da situação do turno. Isto é a camada de cima, que o Mestre usa
 * para colorir ou contradizer o que vem de baixo.
 */
export interface NpcState {
  houseKey: string;
  characterId: string;
  /** Humor atual: com raiva, esperançoso, desconfiado, exausto. */
  mood: string;
  /** Favores que o NPC deve ou que lhe devem. */
  favors: string;
  /** Nota livre do Mestre sobre o momento do NPC. */
  note: string;
  /** Percepção de outras Casas, por chave de Casa. Injetada só para a que escreve. */
  perceptions: Record<string, string>;
  updatedAt: string;
}

/** Um estado vazio, para um NPC que o Mestre ainda não tocou. */
export function emptyNpcState(houseKey: string, characterId: string): NpcState {
  return { houseKey, characterId, mood: "", favors: "", note: "", perceptions: {}, updatedAt: "" };
}

/** Verdadeiro quando o Mestre não pôs nada — nada a injetar no prompt. */
export function isBlankNpcState(s: NpcState): boolean {
  return !s.mood.trim() && !s.favors.trim() && !s.note.trim() && Object.keys(s.perceptions).length === 0;
}
