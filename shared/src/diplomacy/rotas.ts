import type { CampaignFact } from "./models.js";

/** Quantas rotas comerciais abertas valem um ponto de recurso por turno. */
export const ROTAS_POR_RECURSO = 3;

/**
 * O recurso que as rotas comerciais rendem por turno.
 *
 * Divisão inteira de propósito: duas rotas não rendem dois terços de recurso —
 * rendem nada, e a terceira é que paga. É o que faz a mesa perseguir a terceira.
 */
export function bonusDeRotas(rotasAbertas: number): number {
  if (!Number.isFinite(rotasAbertas) || rotasAbertas <= 0) return 0;
  return Math.floor(rotasAbertas / ROTAS_POR_RECURSO);
}

/**
 * As rotas comerciais abertas de uma Casa.
 *
 * Conta todo ACORDO ativo, que foi a regra escolhida pelo Mestre. Vale saber o
 * que isso inclui: o ACORDO nasceu para guardar "algo ficou definido nesta
 * carta", e por isso a mesma etiqueta cobre a rota permanente, a entrega única
 * e o acordo que ainda espera resposta do outro lado. O número aqui é generoso,
 * e a correção é revogar o fato que não deveria contar.
 */
export function rotasAbertasDe(facts: readonly CampaignFact[], houseId: string): CampaignFact[] {
  return facts.filter((f) => f.kind === "ACORDO" && f.status === "ATIVO" && f.betweenA === houseId);
}

/** O texto que explica o ganho no histórico do jogador. */
export function motivoDasRotas(rotas: number): string {
  // "comercial" faz plural em "comerciais", não em "comercialis".
  return rotas === 1
    ? "por 1 rota comercial aberta"
    : `por ${rotas} rotas comerciais abertas`;
}
