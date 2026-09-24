import { SEATS, isFactKind, selectFactsForLetter, type FactKind, type WorldFact } from "@ravenloft/content";
import { fold } from "../visual/canonLookup";

/** Fatos públicos com uma origem conferível; o filtro de visibilidade fica aqui. */
export function letterEvidence(facts: readonly WorldFact[], seats: (string | null | undefined)[]): string | null {
  const selected = selectFactsForLetter(facts, { seats });
  if (!selected.length) return null;
  const name = (key: string) => SEATS.find((s) => s.key === key)?.name ?? key;
  return [
    "O QUE JÁ ACONTECEU E NÃO SE DISCUTE. Registro público com fonte; nunca contradiga nem confunda proposta com fato:",
    ...selected.map((f) => `- [Turno ${f.turnNumber}, ${f.id}] ${f.parties.length ? f.parties.map(name).join(", ") : "reino"}: ${f.summary} Fonte: «${f.quote.slice(0, 220)}»`),
  ].join("\n");
}

/** Uma extração do revisor não pode acrescentar números ausentes da carta enviada. */
export function finalAgreement(
  agreement: { tipo: FactKind; resumo: string } | null,
  letter: string,
): { tipo: FactKind; resumo: string } | null {
  if (!agreement || !isFactKind(agreement.tipo) || !agreement.resumo.trim()) return null;
  const numbers = agreement.resumo.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const letterNumbers = new Set(letter.match(/\d+(?:[.,]\d+)*/g) ?? []);
  if (numbers.some((n) => !letterNumbers.has(n))) return null;
  const terms = fold(agreement.resumo).match(/[a-z]{5,}/g)?.filter((w) => !new Set(["sobre", "entre", "contra", "pelas", "pelos", "antes", "depois", "envio", "acordo", "alianca", "pedido", "oferta", "promessa"]).has(w)) ?? [];
  const letterWords = new Set(fold(letter).match(/[a-z]{5,}/g) ?? []);
  if (terms.length && terms.filter((w) => letterWords.has(w)).length < Math.ceil(terms.length / 2)) return null;
  // O NPC pode propor um pacto; só o jogador pode aceitá-lo no razão.
  const tipo = agreement.tipo === "ALIANCA" || agreement.tipo === "ACORDO" ? "PEDIDO" : agreement.tipo;
  return { tipo, resumo: agreement.resumo.trim() };
}

/** Corrige apenas uma assinatura explicitamente nomeada que não existe na sede. */
export function safeSignature(letter: string, knownNames: string[], houseName: string, fallback = `Pela chancelaria de ${houseName}`): string {
  const lines = letter.trim().split("\n");
  const last = lines.at(-1)?.trim() ?? "";
  if (!last.startsWith("—") && !last.startsWith("–")) return letter;
  const signature = last.replace(/^[—–]\s*/, "").trim();
  if (/chancelaria/i.test(signature)) return letter;
  const normalized = fold(signature);
  if (normalized.length >= 4 && knownNames.some((name) => normalized.includes(fold(name)) || fold(name).includes(normalized))) return letter;
  lines[lines.length - 1] = `— ${fallback}`;
  return lines.join("\n");
}
