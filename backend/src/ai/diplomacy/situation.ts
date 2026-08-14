import type { Turn } from "@ravenloft/content";
import { fold, significantTokens } from "../visual/canonLookup";

/**
 * A situação atual de uma Casa, colhida do que aconteceu nos turnos.
 *
 * A crônica pública já vai ao NPC como história global do reino. O que falta é
 * a fatia que é da própria Casa: se os eventos de um turno dizem que a Casa X
 * rompeu com a Coroa, o NPC de X precisa tratar isso como coisa da SUA Casa, não
 * como notícia distante. Esta função extrai as linhas dos textos do turno que
 * mencionam a Casa e as reapresenta como conhecimento interno.
 *
 * Determinístico e automático: só reorganiza o que o Mestre já escreveu nos
 * eventos e nas resoluções. Não inventa. Para as três Casas de jogador — que
 * hoje não são endereçáveis, mas podem vir a ser — a info privada e o resultado
 * privado do turno também entram, porque são o que aquela Casa sabe por dentro.
 */
export function buildHouseSituation(input: {
  houseName: string;
  turns: Turn[];
  /** Preenchido quando a Casa é uma Casa viva de jogador. */
  houseId?: string | null;
}): string {
  const tokens = significantTokens(input.houseName);
  if (tokens.length === 0) return "";

  const mentions = (text: string | undefined): string[] => {
    if (!text) return [];
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && tokens.some((t) => fold(s).includes(fold(t))));
  };

  const lines: string[] = [];
  // Do mais recente para trás, poucos turnos: a situação é o agora, não a
  // história inteira — para isso já existe a crônica.
  for (const turn of [...input.turns].sort((a, b) => b.turnId - a.turnId).slice(0, 3)) {
    for (const line of mentions(turn.publicEvent)) lines.push(line);
    if (turn.result) {
      for (const line of mentions(turn.result.publicResult)) lines.push(line);
      for (const d of turn.result.discoveries ?? []) for (const line of mentions(d)) lines.push(line);
    }
    if (input.houseId) {
      const priv = turn.privateInfo?.[input.houseId];
      if (priv) lines.push(priv.trim());
      const own = turn.result?.houseResults?.[input.houseId];
      if (own) lines.push(own.trim());
    }
  }

  // Sem repetir: um evento que atravessa turnos ou a mesma frase em evento e
  // resolução apareceria duas vezes.
  const seen = new Set<string>();
  const unique = lines.filter((l) => {
    const key = fold(l);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 6).join("\n");
}
