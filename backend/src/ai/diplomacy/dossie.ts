import { listPairHistory } from "../../db/diplomacy/messages";
import { listFacts } from "../../db/diplomacy/facts";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { CampaignFact } from "@ravenloft/content";
import { fold } from "../visual/canonLookup";

/**
 * O que quem escreve uma carta precisa saber antes de escrever.
 *
 * Existe porque os dois caminhos de carta sabiam coisas diferentes, e o mais
 * cego era justamente o que escreve sem ter texto ao qual reagir: a carta
 * proativa recebia o evento do turno e a relação, e nenhuma linha do que as
 * duas Casas já se disseram. Lady Miriel Ferrumor reabriu um encontro que ela
 * mesma tinha marcado sem lembrar de tê-lo marcado.
 *
 * Montado em código, sem chamar modelo. É a parte que não pode alucinar: se o
 * fio está errado aqui, nenhuma quantidade de raciocínio depois conserta.
 */
export interface RememberedLetter {
  turnNumber: number;
  author: "PLAYER" | "AI";
  body: string;
}

export interface Dossie {
  /** A conversa inteira, de todos os turnos, na ordem em que aconteceu. */
  fio: RememberedLetter[];
  /** Fatos auditáveis deste par; o estado ativo é projetado ao renderizar. */
  fatos: CampaignFact[];
}

export async function montarDossie(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  playerHouseId: string,
  toHouseKey: string,
): Promise<Dossie> {
  const [historia, fatos] = await Promise.all([
    listPairHistory(doc, tableName, campaignId, playerHouseId, toHouseKey),
    listFacts(doc, tableName, campaignId),
  ]);

  return {
    fio: historia
      .map((m) => ({ turnNumber: m.turnNumber, author: m.author, body: m.body })),
    fatos: fatos.filter(
      (f) =>
        [f.betweenA, f.betweenB].includes(playerHouseId) &&
        [f.betweenA, f.betweenB].includes(toHouseKey),
    ),
  };
}

/** O fio, escrito para entrar no pedido ao modelo. Vazio quando nunca falaram. */
export function descreverFio(d: Dossie, nomeDoJogador: string, nomeDoNpc: string): string {
  if (d.fio.length === 0) return "";
  const linhas = d.fio.map(
    (m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? nomeDoJogador : nomeDoNpc}: ${m.body}`,
  );
  return `Tudo que vocês dois já se escreveram, do mais antigo ao mais recente. Você lembra de cada uma destas cartas, inclusive das suas:\n\n${linhas.join("\n\n")}`;
}

function factKey(f: CampaignFact): string {
  return `${f.kind}|${fold(f.summary).replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function activeUniqueFacts(facts: CampaignFact[]): CampaignFact[] {
  const ordered = [...facts]
    .filter((f) => f.status === "ATIVO")
    .sort(
      (a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
        b.id.localeCompare(a.id),
    );
  const seen = new Set<string>();
  return ordered.filter((f) => {
    const key = factKey(f);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Estado estruturado da negociação; preenchido sem uma chamada de modelo. */
export function descreverEstadoDiplomatico(d: Dossie): string {
  const facts = activeUniqueFacts(d.fatos);
  if (facts.length === 0) return "";

  const turns = [...new Set(facts.map((f) => f.turnNumber))]
    .sort((a, b) => b - a)
    .slice(0, 2);
  const groups = [
    [
      "OBRIGAÇÕES EM VIGOR",
      facts.filter((f) => ["ALIANCA", "ACORDO", "PROMESSA"].includes(f.kind)),
    ],
    ["PROPOSTAS ABERTAS", facts.filter((f) => f.kind === "PEDIDO")],
    [
      "DECISÕES RECENTES",
      facts.filter(
        (f) =>
          (f.kind === "RECUSA" || f.kind === "AMEACA") &&
          turns.includes(f.turnNumber),
      ),
    ],
  ] as const;

  const body = groups
    .filter(([, entries]) => entries.length > 0)
    .map(
      ([title, entries]) =>
        `${title}:\n${entries
          .map((f) => `- [Turno ${f.turnNumber}, ${f.kind}, ${f.id}] ${f.summary}`)
          .join("\n")}`,
    )
    .join("\n\n");

  return body
    ? [
        "ESTADO DIPLOMÁTICO E SUA AUTORIDADE:",
        "Acordos e alianças são compromissos mútuos; propostas abertas ainda aguardam resposta; decisões recentes registram posição, não obrigação.",
        "Importante: promessa unilateral não prova aceite da outra Casa.",
        body,
      ].join("\n")
    : "";
}
