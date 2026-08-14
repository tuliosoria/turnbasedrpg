import type { NpcDynamic, NpcRelation } from "@ravenloft/content";

/**
 * Roleplay Engine: reconstrói o personagem a cada carta.
 *
 * O princípio central do Living Characters: nenhuma resposta depende só da
 * última mensagem. Toda vez que a IA encarna um NPC, ela remonta quem ele é a
 * partir das camadas — e esta função monta a parte VIVA (relações, objetivo,
 * humor, memórias), que se soma à identidade estável do Codex.
 *
 * A relação injetada é só a da Casa que escreve: a leitura que este NPC tem de
 * quem está do outro lado da carta, nas cinco dimensões mais o resumo em prosa.
 * As memórias são as dele — o que ele viveu e por isso pensa como pensa —, e é
 * o que deixa a IA citar o passado ("Solarion já mostrou reconhecer uma ameaça
 * antes dos outros, como na crise de Véspera").
 */
export function buildRoleplayBlock(input: {
  dynamic: NpcDynamic;
  fromHouseKey: string | null;
  fromHouseName: string;
}): string {
  const d = input.dynamic;
  const parts: string[] = [];

  if (d.mood.trim()) parts.push(`Seu humor agora: ${d.mood.trim()}`);
  if (d.objective.trim()) parts.push(`Seu objetivo imediato: ${d.objective.trim()}`);
  if (d.loyalty.trim()) parts.push(`Sua lealdade agora: ${d.loyalty.trim()}`);

  const rel = input.fromHouseKey ? d.relations[input.fromHouseKey] : undefined;
  if (rel) parts.push(`A sua relação com ${input.fromHouseName} agora: ${describeRelation(rel)}`);

  // As memórias mais recentes, poucas: a resposta reconstrói do que ele viveu,
  // não recita a campanha inteira.
  const recent = [...d.memory].sort((a, b) => b.turnNumber - a.turnNumber).slice(0, 5);
  if (recent.length) {
    parts.push(
      "O que você lembra, e por isso pensa como pensa:\n" +
        recent.map((m) => `- [Turno ${m.turnNumber}] ${m.description}`).join("\n"),
    );
  }

  return parts.join("\n");
}

/** A relação em prosa: o resumo, se houver, mais as dimensões que se destacam. */
function describeRelation(r: NpcRelation): string {
  const strong: string[] = [];
  if (r.trust >= 70) strong.push("confia");
  else if (r.trust <= 30) strong.push("desconfia");
  if (r.fear >= 60) strong.push("teme");
  if (r.resentment >= 60) strong.push("ressente");
  if (r.respect >= 70) strong.push("respeita");
  const label = strong.length ? ` (${strong.join(", ")})` : "";
  return `${r.summary || "sem história registrada"}${label}. Números 0–100 — confiança ${r.trust}, respeito ${r.respect}, medo ${r.fear}, ressentimento ${r.resentment}, obrigação ${r.obligation}.`;
}
