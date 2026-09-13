import { describe, it, expect, vi, beforeEach } from "vitest";
import { montarDossie, descreverFio, descreverCompromissos } from "./dossie";
import * as messagesDb from "../../db/diplomacy/messages";
import * as factsDb from "../../db/diplomacy/facts";

const doc = {} as never;

function carta(turnNumber: number, author: "PLAYER" | "AI", body: string) {
  return { id: `m${turnNumber}${author}`, campaignId: "c", turnNumber, author, body,
    fromHouseId: "solarion-k0hc", toHouseKey: "casa-ferrumor", replyToId: null,
    toCharacterId: null, createdAt: `2026-01-0${turnNumber}` } as never;
}

beforeEach(() => vi.restoreAllMocks());

describe("montarDossie", () => {
  // O defeito que motivou o módulo: a carta proativa escrevia para quem conhece
  // há cinco turnos sem ver uma linha da conversa, e reabria acordos que ela
  // mesma tinha fechado.
  it("traz o fio de TODOS os turnos, e não só o atual", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([
      carta(6, "PLAYER", "Proponho um encontro."),
      carta(7, "AI", "Aceito, na Pirâmide."),
      carta(9, "PLAYER", "Confirmo a data."),
    ]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(d.fio.map((m) => m.turnNumber)).toEqual([6, 7, 9]);
  });

  // Um acordo que a outra parte fechou com um terceiro não é compromisso deste
  // fio, e citá-lo denuncia que quem escreve leu correspondência alheia.
  it("só traz compromissos que envolvem as duas Casas do fio", async () => {
    vi.spyOn(messagesDb, "listPairHistory").mockResolvedValue([]);
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      { id: "1", campaignId: "c", turnNumber: 7, kind: "ACORDO", status: "ATIVO",
        betweenA: "solarion-k0hc", betweenB: "casa-ferrumor", summary: "Encontro na Pirâmide." } as never,
      { id: "2", campaignId: "c", turnNumber: 7, kind: "ACORDO", status: "ATIVO",
        betweenA: "solarion-k0hc", betweenB: "casa-karasoy", summary: "Rota das Planícies." } as never,
      { id: "3", campaignId: "c", turnNumber: 5, kind: "ACORDO", status: "REVOGADO",
        betweenA: "solarion-k0hc", betweenB: "casa-ferrumor", summary: "Acordo morto." } as never,
    ]);
    const d = await montarDossie(doc, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(d.compromissos).toHaveLength(1);
    expect(d.compromissos[0]).toContain("Pirâmide");
  });
});

describe("descreverFio", () => {
  it("nomeia quem falou em cada carta, com o turno", () => {
    const texto = descreverFio(
      { fio: [{ turnNumber: 7, author: "AI", body: "Aceito." }], compromissos: [] },
      "Solarion", "Casa Ferrumor",
    );
    expect(texto).toContain("[Turno 7] Casa Ferrumor: Aceito.");
  });

  // Fio vazio não vira bloco: um cabeçalho seguido de nada ensina o modelo que
  // eles já conversaram quando nunca conversaram.
  it("devolve vazio quando nunca se falaram", () => {
    expect(descreverFio({ fio: [], compromissos: [] }, "A", "B")).toBe("");
    expect(descreverCompromissos({ fio: [], compromissos: [] })).toBe("");
  });
});
