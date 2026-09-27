import { describe, it, expect, vi, beforeEach } from "vitest";
import { montarDossie, descreverEstadoDiplomatico, descreverFio } from "./dossie";
import * as messagesDb from "../../db/diplomacy/messages";
import * as factsDb from "../../db/diplomacy/facts";
import type { CampaignFact } from "@ravenloft/content";

const doc = {} as never;

function carta(turnNumber: number, author: "PLAYER" | "AI", body: string) {
  return { id: `m${turnNumber}${author}`, campaignId: "c", turnNumber, author, body,
    fromHouseId: "solarion-k0hc", toHouseKey: "casa-ferrumor", replyToId: null,
    toCharacterId: null, createdAt: `2026-01-0${turnNumber}` } as never;
}

function fato(over: Partial<CampaignFact>): CampaignFact {
  return {
    id: "f", campaignId: "c", turnNumber: 10, kind: "ACORDO",
    betweenA: "solarion-k0hc", betweenB: "casa-ferrumor",
    summary: "Acordo.", sourceMessageId: "m", status: "ATIVO",
    createdAt: "2026-09-20T00:00:00Z", ...over,
  };
}

function secao(texto: string, titulo: string): string {
  return texto.split(`${titulo}:\n`)[1]?.split("\n\n")[0] ?? "";
}

beforeEach(() => vi.restoreAllMocks());

describe("montarDossie", () => {
  // O defeito que motivou o módulo: a carta proativa escrevia para quem conhece
  // há cinco turnos sem ver uma linha da conversa, e reabria acordos que ela
  // mesma tinha fechado.
  it("conserva as 27 cartas do par para relação e auditoria", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue(
      Array.from({ length: 27 }, (_, i) =>
        carta(8 + Math.floor(i / 9), i % 2 ? "PLAYER" : "AI", `carta-${i}`)),
    );
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(d.fio).toHaveLength(27);
    expect(d.fio[0].body).toBe("carta-0");
    expect(d.fio[26].body).toBe("carta-26");
  });

  // Um fato que a outra parte fechou com um terceiro não pertence a este fio,
  // e citá-lo denunciaria que quem escreve leu correspondência alheia.
  it("só conserva fatos que envolvem as duas Casas do fio", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      fato({ id: "1", turnNumber: 7, summary: "Encontro na Pirâmide." }),
      fato({ id: "2", turnNumber: 7, betweenB: "casa-karasoy", summary: "Rota das Planícies." }),
      fato({ id: "3", turnNumber: 5, status: "REVOGADO", summary: "Acordo morto." }),
      fato({ id: "4", turnNumber: 8, kind: "PEDIDO", summary: "Proposta ainda sem aceite." }),
      fato({ id: "5", turnNumber: 8, kind: "RECUSA", summary: "Recusa definitiva." }),
      fato({ id: "6", turnNumber: 8, kind: "AMEACA", summary: "Ameaça de bloqueio." }),
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(d.fatos.map((f) => f.id)).toEqual(["1", "3", "4", "5", "6"]);
  });

  it("distingue promessa unilateral de acordo aceito", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      fato({ id: "p", turnNumber: 9, kind: "PROMESSA", summary: "Ferrumor enviará mensageiro." }),
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    const texto = descreverEstadoDiplomatico(d);
    expect(secao(texto, "OBRIGAÇÕES EM VIGOR")).toContain("PROMESSA");
    expect(texto).toContain("promessa unilateral não prova aceite da outra Casa");
  });

  it("separa obrigação, proposta e decisão sem promover pedido a acordo", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      fato({ id: "a", kind: "ACORDO", summary: "Troca no Vau Negro." }),
      fato({ id: "p", kind: "PEDIDO", summary: "Enviar estudiosos." }),
      fato({ id: "r", kind: "RECUSA", summary: "Garok recusa recuar." }),
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    const texto = descreverEstadoDiplomatico(d);
    expect(secao(texto, "OBRIGAÇÕES EM VIGOR")).toContain("Troca no Vau Negro");
    expect(secao(texto, "PROPOSTAS ABERTAS")).toContain("Enviar estudiosos");
    expect(secao(texto, "DECISÕES RECENTES")).toContain("Garok recusa recuar");
    expect(secao(texto, "OBRIGAÇÕES EM VIGOR")).not.toContain("Enviar estudiosos");
  });

  it("deduplica tipo e resumo normalizados e desempata por id", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      fato({ id: "a", summary: "Troca no Vau-Negro!", createdAt: "" }),
      fato({ id: "b", summary: "troca no vau negro", createdAt: "" }),
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    const texto = descreverEstadoDiplomatico(d);
    expect(texto.match(/troca no vau/gi)).toHaveLength(1);
    expect(texto).toContain("b]");
  });

  it("omite decisão antiga fora dos dois turnos mais recentes do par", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      fato({ id: "t10", turnNumber: 10, kind: "ACORDO", summary: "Acordo atual." }),
      fato({ id: "t9", turnNumber: 9, kind: "PEDIDO", summary: "Pedido atual." }),
      fato({ id: "t8", turnNumber: 8, kind: "RECUSA", summary: "Recusa antiga." }),
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(descreverEstadoDiplomatico(d)).not.toContain("Recusa antiga");
  });
});

describe("descreverFio", () => {
  it("nomeia quem falou em cada carta, com o turno", () => {
    const texto = descreverFio(
      { fio: [{ turnNumber: 7, author: "AI", body: "Aceito." }], fatos: [] },
      "Solarion", "Casa Ferrumor",
    );
    expect(texto).toContain("[Turno 7] Casa Ferrumor: Aceito.");
  });

  // Fio vazio não vira bloco: um cabeçalho seguido de nada ensina o modelo que
  // eles já conversaram quando nunca conversaram.
  it("devolve vazio quando nunca se falaram", () => {
    expect(descreverFio({ fio: [], fatos: [] }, "A", "B")).toBe("");
    expect(descreverEstadoDiplomatico({ fio: [], fatos: [] })).toBe("");
  });
});
