import { describe, it, expect, vi } from "vitest";
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createAccountAndHouse, getHouse, listHouses, updateHouseFull, deleteHouseCascade, setHouseImages } from "./houses";
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

  it("updateHouseFull issues an UpdateCommand guarded by attribute_exists", async () => {
    const doc = docReturning({});
    await updateHouseFull(doc as never, TABLE, CAMPAIGN, "vargen-a1b2", {
      name: "Casa Nova", motto: "Novo lema", emblem,
      leaderName: "L", heirName: "H", castleName: "C",
      townsText: "T", historyText: "Hi", specialty: "S", weakness: "W",
      attributes,
    });
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(UpdateCommand);
    expect(cmd.input.Key).toEqual({ PK: "CAMPAIGN#WINTER_DEAD", SK: "HOUSE#vargen-a1b2" });
    expect(cmd.input.ConditionExpression).toMatch(/attribute_exists/);
    expect(cmd.input.ExpressionAttributeValues[":name"]).toBe("Casa Nova");
    expect(cmd.input.ExpressionAttributeValues[":attributes"]).toEqual(attributes);
  });

  it("updateHouseFull throws 404 when the house does not exist", async () => {
    const doc = { send: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "ConditionalCheckFailedException" })) };
    await expect(
      updateHouseFull(doc as never, TABLE, CAMPAIGN, "missing", {
        name: "N", motto: "M", emblem, leaderName: "L", heirName: "H", castleName: "C",
        townsText: "T", historyText: "Hi", specialty: "S", weakness: "W", attributes,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deleteHouseCascade deletes the house, its submissions and the player account", async () => {
    const houseItem = { houseId: "vargen-a1b2", ownerCodeHash: "hash-1", attributes, emblem, name: "V", motto: "m", leaderName: "L", heirName: "H", castleName: "C", townsText: "T", historyText: "Hi", specialty: "S", weakness: "W", createdAt: "2026-07-18T00:00:00.000Z" };
    const turnItems = [
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001#SUB#vargen-a1b2" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#002#SUB#vargen-a1b2" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001#SUB#other-house" },
    ];
    const doc = {
      send: vi.fn(async (cmd: unknown) => {
        if (cmd instanceof GetCommand) return { Item: houseItem };
        if (cmd instanceof QueryCommand) return { Items: turnItems };
        return {};
      }),
    };

    const result = await deleteHouseCascade(doc as never, TABLE, CAMPAIGN, "vargen-a1b2");

    const batch = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof BatchWriteCommand) as BatchWriteCommand;
    const keys = batch.input.RequestItems![TABLE].map((r) => r.DeleteRequest!.Key);
    const asStr = keys.map((k) => `${k!.PK}/${k!.SK}`);

    expect(asStr).toEqual(expect.arrayContaining([
      "CAMPAIGN#WINTER_DEAD/HOUSE#vargen-a1b2",
      "CAMPAIGN#WINTER_DEAD/TURN#001#SUB#vargen-a1b2",
      "CAMPAIGN#WINTER_DEAD/TURN#002#SUB#vargen-a1b2",
      "PLAYER#hash-1/PROFILE",
    ]));
    expect(asStr).not.toContain("CAMPAIGN#WINTER_DEAD/TURN#001#SUB#other-house");
    expect(asStr).not.toContain("CAMPAIGN#WINTER_DEAD/TURN#001");
    expect(keys).toHaveLength(4);
    expect(result.deleted).toBe(4);
  });

  it("deleteHouseCascade throws 404 when the house is missing", async () => {
    const doc = { send: vi.fn(async (cmd: unknown) => (cmd instanceof GetCommand ? {} : {})) };
    await expect(deleteHouseCascade(doc as never, TABLE, CAMPAIGN, "missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("setHouseImages", () => {
  it("writes imageUrls to the house row", async () => {
    const send = vi.fn().mockResolvedValue({});
    const doc = { send } as never;
    await setHouseImages(doc, TABLE, CAMPAIGN, "casa-1", ["u1", "u2"]);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.UpdateExpression).toContain("imageUrls");
    expect(cmd.input.ExpressionAttributeValues[":imageUrls"]).toEqual(["u1", "u2"]);
  });
});
