import { describe, it, expect, vi } from "vitest";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createNextTurnDraft, getActiveTurn, listTurns, putTurn, saveTurnResult, setTurnStatus } from "./turns";
import type { Turn, TurnResult } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

function turn(turnId: number): Turn {
  return {
    turnId,
    status: "OPEN",
    publicEvent: `Evento ${turnId}`,
    privateInfo: {},
    cards: [],
    createdAt: "2026-07-18T00:00:00.000Z",
  };
}

describe("turns db", () => {
  it("putTurn issues a PutCommand for a full turn record", async () => {
    const doc = docReturning({});
    await putTurn(doc as never, TABLE, CAMPAIGN, turn(1));
    const command = doc.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(command.input.Item.SK).toBe("TURN#001");
  });

  it("getActiveTurn returns the highest-numbered turn", async () => {
    const doc = docReturning({ Items: [{ ...turn(2), SK: "TURN#002" }, { ...turn(1), SK: "TURN#001" }] });
    await expect(getActiveTurn(doc as never, TABLE, CAMPAIGN)).resolves.toMatchObject({ turnId: 2 });
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
  });

  it("listTurns filters out submission records", async () => {
    const doc = docReturning({
      Items: [
        { ...turn(1), SK: "TURN#001" },
        { houseId: "vargen", SK: "TURN#001#SUB#vargen" },
        { ...turn(3), SK: "TURN#003" },
      ],
    });
    await expect(listTurns(doc as never, TABLE, CAMPAIGN)).resolves.toEqual([turn(1), turn(3)]);
  });

  it("setTurnStatus updates the turn status", async () => {
    const doc = docReturning({});
    await setTurnStatus(doc as never, TABLE, CAMPAIGN, 1, "LOCKED");
    const command = doc.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.Key).toEqual({ PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" });
    expect(command.input.ExpressionAttributeValues[":s"]).toBe("LOCKED");
  });

  it("saveTurnResult marks the turn resolved and stores the result", async () => {
    const result: TurnResult = { publicResult: "Vitória", houseResults: {}, attributeDeltas: {}, discoveries: [] };
    const doc = docReturning({});
    await saveTurnResult(doc as never, TABLE, CAMPAIGN, 1, result);
    const command = doc.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.ExpressionAttributeValues[":s"]).toBe("RESOLVED");
    expect(command.input.ExpressionAttributeValues[":r"]).toBe(result);
  });

  it("createNextTurnDraft creates and returns a draft turn", async () => {
    const doc = docReturning({});
    const draft = await createNextTurnDraft(doc as never, TABLE, CAMPAIGN, 4);
    expect(draft).toMatchObject({ turnId: 4, status: "DRAFT", publicEvent: "", privateInfo: {}, cards: [] });
    expect(draft.createdAt).toEqual(expect.any(String));
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(PutCommand);
  });

  it("getTurn returns null when no item exists", async () => {
    const doc = docReturning({});
    const { getTurn } = await import("./turns");
    await expect(getTurn(doc as never, TABLE, CAMPAIGN, 1)).resolves.toBeNull();
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });
});
