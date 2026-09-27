import type { DiplomaticMessage } from "@ravenloft/content";
import type { RememberedLetter } from "./dossie";

export const HISTORY_MAX_CHARS = 12_000;
export const HISTORY_RECENT_LIMIT = 6;
export const CURRENT_THREAD_LIMIT = 6;

export function selectHistoricalLetters(
  letters: readonly RememberedLetter[],
  options: { maxChars?: number; recentLimit?: number } = {},
): RememberedLetter[] {
  const maxChars = options.maxChars ?? HISTORY_MAX_CHARS;
  const recentLimit = options.recentLimit ?? HISTORY_RECENT_LIMIT;
  const selected = new Set<number>();

  for (let i = 0; i < Math.min(2, letters.length); i++) selected.add(i);
  let used = [...selected].reduce((sum, i) => sum + letters[i].body.length, 0);
  let recent = 0;

  for (let i = letters.length - 1; i >= 0 && recent < recentLimit; i--) {
    if (selected.has(i)) continue;
    const size = letters[i].body.length;
    if (used + size > maxChars) continue;
    selected.add(i);
    used += size;
    recent++;
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((i) => letters[i]);
}

export function selectCurrentExchange(
  messages: readonly DiplomaticMessage[],
  targetMessageId: string,
  limit = CURRENT_THREAD_LIMIT,
): { before: DiplomaticMessage[]; incoming: DiplomaticMessage } {
  const ordered = [...messages].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const index = ordered.findIndex((m) => m.id === targetMessageId);
  if (index < 0) throw new Error(`Carta atual ausente do fio: ${targetMessageId}`);
  return {
    before: ordered.slice(Math.max(0, index - limit), index),
    incoming: ordered[index],
  };
}
