import { describe, it, expect, vi } from "vitest";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createAccountAndHouse, getHouse, listHouses } from "./houses";
import type { Attributes, Emblem } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";
const attributes: Attributes = { riqueza: 3, recursos: 3, soldados: 2, controle: 2 };
const emblem: Emblem = { icon: "lobo", color1: "#111111", color2: "#222222" };

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

describe("houses db", () => {
  it("creates an account and house with a slugged houseId", async () => {
    const doc = docReturning({});
    const result = await createAccountAndHouse(doc as never, TABLE, CAMPAIGN, {
      displayName: "Jogador",
      codeHash: "hash-1",
      name: "Casa X",
      motto: "Sempre",
      emblem,
      leaderName: "Líder",
      heirName: "Herdeiro",
      castleName: "Castelo",
      townsText: "Vilas",
      historyText: "História",
      specialty: "Força",
      weakness: "Medo",
      attributes,
    });

    expect(result.houseId).toMatch(/^casa-x-[a-z0-9]{4}$/);
    expect(doc.send).toHaveBeenCalledTimes(1);
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(TransactWriteCommand);
  });

  it("returns null when a house item is missing", async () => {
    const doc = docReturning({});
    await expect(getHouse(doc as never, TABLE, CAMPAIGN, "vargen-a1b2")).resolves.toBeNull();
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });

  it("lists houses by mapping returned items", async () => {
    const doc = docReturning({
      Items: [{
        houseId: "vargen-a1b2",
        name: "Casa Vargen",
        motto: "No inverno, resistimos",
        emblem,
        leaderName: "Radan",
        heirName: "Irina",
        castleName: "Castelo Vargen",
        townsText: "Três vilas",
        historyText: "Antiga linhagem",
        specialty: "Patrulhas",
        weakness: "Orgulho",
        attributes,
        createdAt: "2026-07-18T00:00:00.000Z",
        ownerCodeHash: "hash-1",
      }],
    });

    await expect(listHouses(doc as never, TABLE, CAMPAIGN)).resolves.toEqual([
      {
        houseId: "vargen-a1b2",
        name: "Casa Vargen",
        motto: "No inverno, resistimos",
        emblem,
        leaderName: "Radan",
        heirName: "Irina",
        castleName: "Castelo Vargen",
        townsText: "Três vilas",
        historyText: "Antiga linhagem",
        specialty: "Patrulhas",
        weakness: "Orgulho",
        attributes,
        createdAt: "2026-07-18T00:00:00.000Z",
      },
    ]);
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
  });
});
