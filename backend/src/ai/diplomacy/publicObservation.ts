import type { Turn } from "@ravenloft/content";
import { fold, significantTokens } from "../visual/canonLookup";

/** Só o resultado público pode fundamentar uma reação à ação do turno anterior. */
export function publicObservations(turn: Turn | undefined, houses: { houseId: string; name: string }[]): Record<string, string> {
  if (turn?.status !== "RESOLVED" || !turn.result?.publicResult?.trim()) return {};
  const sentences = turn.result.publicResult.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return Object.fromEntries(houses.flatMap((house) => {
    const tokens = significantTokens(house.name).map(fold);
    const visible = sentences.filter((s) => tokens.some((t) => fold(s).includes(t))).join(" ").slice(0, 600);
    return visible ? [[house.houseId, visible]] : [];
  }));
}
