import type { Turn } from "@ravenloft/content";

export const CHRONICLE_MAX_CHARS = 4500;

/**
 * A crônica pública do reino: o que aconteceu nos turnos anteriores, como
 * qualquer Casa saberia.
 *
 * Uma Casa que responde a uma carta precisa saber onde a história está. Sem
 * isto ela conhece só o evento do turno corrente e escreve como quem acabou de
 * acordar — o Rei pediu tropas, mas ela não sabe que Asterhall foi atacada nem
 * que a Asteria afundou.
 *
 * Nunca inclui `privateInfo`: aquilo é o que cada Casa recebeu em segredo, e
 * uma Casa NPC não pode conhecer o correio privado de outra.
 */
export function buildPublicChronicle(turns: Turn[], maxChars = CHRONICLE_MAX_CHARS): string {
  const resolved = turns
    .filter((t) => t.status === "RESOLVED")
    .sort((a, b) => a.turnId - b.turnId);

  const blocks = resolved.map((t) => {
    const parts = [`## Turno ${t.turnId}`];
    if (t.publicEvent?.trim()) parts.push(t.publicEvent.trim());
    const result = t.result?.publicResult?.trim();
    if (result) parts.push(`O que se seguiu: ${result}`);
    return parts.join("\n");
  });

  // O passado recente pesa mais que o distante, então o corte come pelo começo
  // em vez de truncar o fim e deixar a história parando no meio de uma frase.
  const kept: string[] = [];
  let total = 0;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (total + b.length > maxChars && kept.length > 0) break;
    kept.unshift(b.slice(0, maxChars));
    total += b.length;
  }

  return kept.join("\n\n");
}
