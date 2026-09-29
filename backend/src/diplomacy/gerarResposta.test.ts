import { beforeEach, describe, expect, it, vi } from "vitest";
import { gerarResposta } from "./gerarResposta";
import * as housesDb from "../db/houses";
import * as turnsDb from "../db/turns";
import * as wikiDb from "../db/wiki";
import * as messagesDb from "../db/diplomacy/messages";
import * as npcDb from "../db/npcDynamic";
import * as relDb from "../db/houseRelations";
import * as factsDb from "../db/diplomacy/facts";
import * as worldDb from "../db/worldFacts";
import * as dossieMod from "../ai/diplomacy/dossie";
import { emptyDynamic, emptyHouseRelation, type CampaignFact, type DiplomaticMessage } from "@ravenloft/content";

const DRAFT = "Proponho aliança de defesa em Ninho Alto contra a marcha deste inverno, com madeira de carvalho na rota.";
const REVIEWED = "A defesa de Ninho Alto pode esperar: mando madeira de carvalho pela rota neste inverno, e mantenho a palavra.";

const deps = () => ({
  doc: {} as never,
  config: { tableName: "t", campaignId: "winter-dead" },
  chatDiplomacia: vi.fn(),
});

const pedido = {
  playerHouseId: "solarion-k0hc",
  ownKey: "casa-solarion",
  toHouseKey: "casa-euralune",
  toCharacterId: null,
  sentId: "sent-1",
};

let saved: DiplomaticMessage | null = null;
let fact: CampaignFact | null = null;

beforeEach(() => {
  vi.restoreAllMocks();
  saved = null;
  fact = null;
  vi.spyOn(housesDb, "getHouse").mockResolvedValue({ houseId: "solarion-k0hc", name: "Solarion" } as never);
  vi.spyOn(turnsDb, "getActiveTurn").mockResolvedValue({
    turnId: 7, status: "OPEN", publicEvent: "", privateInfo: {}, createdAt: "2026-09-01T00:00:00.000Z",
  } as never);
  vi.spyOn(turnsDb, "listTurns").mockResolvedValue([]);
  vi.spyOn(wikiDb, "listWikiEntries").mockResolvedValue([]);
  vi.spyOn(messagesDb, "listThread").mockResolvedValue([{
    id: "sent-1",
    campaignId: "winter-dead",
    turnNumber: 7,
    fromHouseId: "solarion-k0hc",
    toHouseKey: "casa-euralune",
    author: "PLAYER",
    body: "Podemos falar de madeira e de defesa?",
    replyToId: null,
    toCharacterId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
  }]);
  vi.spyOn(messagesDb, "putMessage").mockImplementation(async (_doc, _table, _campaign, message) => {
    saved = message;
  });
  vi.spyOn(npcDb, "getNpcDynamic").mockResolvedValue(emptyDynamic("casa-euralune", ""));
  vi.spyOn(relDb, "getHouseRelation").mockResolvedValue(emptyHouseRelation("casa-euralune", "casa-solarion"));
  vi.spyOn(factsDb, "putFact").mockImplementation(async (_doc, _table, _campaign, written) => {
    fact = written;
  });
  vi.spyOn(worldDb, "listWorldFacts").mockResolvedValue([]);
  vi.spyOn(dossieMod, "montarDossie").mockResolvedValue({ fio: [], compromissos: [] });
});

function writerJson(acordo: { tipo: string; resumo: string } | null) {
  return JSON.stringify({ carta: DRAFT, acordo });
}

describe("acordo quando o revisor não devolve carta", () => {
  it("grava o rascunho e o acordo do escritor conferido contra esse texto", async () => {
    const d = deps();
    d.chatDiplomacia.mockImplementation(async (system: string) =>
      system.includes("editor de uma chancelaria") ? "" : writerJson({
        tipo: "ALIANCA",
        resumo: "Aliança de defesa em Ninho Alto contra a marcha deste inverno, com madeira de carvalho na rota.",
      }));

    const reply = await gerarResposta(d as never, pedido);

    expect(reply?.body).toContain("defesa em Ninho Alto");
    expect(saved?.body).toContain("defesa em Ninho Alto");
    expect(fact?.kind).toBe("PEDIDO");
    expect(fact?.summary).toMatch(/defesa em Ninho Alto/);
    expect(fact?.betweenA).toBe("solarion-k0hc");
    expect(fact?.betweenB).toBe("casa-euralune");
    expect(fact?.sourceMessageId).toBe(reply?.id);
    expect(fact?.status).toBe("ATIVO");
  });

  it("não grava pacto quando o acordo do escritor não está no rascunho salvo", async () => {
    const d = deps();
    d.chatDiplomacia.mockImplementation(async (system: string) =>
      system.includes("editor de uma chancelaria") ? "não é json" : writerJson({
        tipo: "PEDIDO",
        resumo: "Envio de 300 cavaleiras para Asterhall.",
      }));

    const reply = await gerarResposta(d as never, pedido);

    expect(reply?.body).toContain(DRAFT);
    expect(fact).toBeNull();
  });
});

describe("acordo quando o revisor devolve carta", () => {
  it("usa o acordo do revisor e deixa o do escritor de lado", async () => {
    const d = deps();
    d.chatDiplomacia.mockImplementation(async (system: string) => {
      if (!system.includes("editor de uma chancelaria")) {
        return writerJson({
          tipo: "PEDIDO",
          resumo: "Aliança de defesa em Ninho Alto contra a marcha deste inverno, com madeira de carvalho na rota.",
        });
      }
      return JSON.stringify({
        veredito: "corrigida",
        carta: REVIEWED,
        motivos: ["tirei a aliança"],
        acordo: { tipo: "PROMESSA", resumo: "Madeira de carvalho pela rota neste inverno." },
      });
    });

    const reply = await gerarResposta(d as never, pedido);

    expect(reply?.body).toContain("madeira de carvalho pela rota");
    expect(saved?.body).toBe(reply?.body);
    expect(fact?.kind).toBe("PROMESSA");
    expect(fact?.summary).toBe("Madeira de carvalho pela rota neste inverno.");
    expect(fact?.sourceMessageId).toBe(reply?.id);
  });

  it("não cai no acordo do escritor quando o revisor devolve carta sem pacto", async () => {
    const d = deps();
    d.chatDiplomacia.mockImplementation(async (system: string) => {
      if (!system.includes("editor de uma chancelaria")) {
        return writerJson({
          tipo: "PEDIDO",
          resumo: "Aliança de defesa em Ninho Alto contra a marcha deste inverno, com madeira de carvalho na rota.",
        });
      }
      return JSON.stringify({
        veredito: "corrigida",
        carta: REVIEWED,
        motivos: ["sem pacto"],
        acordo: null,
      });
    });

    const reply = await gerarResposta(d as never, pedido);

    expect(reply?.body).toContain("madeira de carvalho pela rota");
    expect(fact).toBeNull();
  });
});
