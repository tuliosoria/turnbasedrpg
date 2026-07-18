import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { claimHouse, getPlayerByCodeHash, listHouseClaims } from "./players";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("claimHouse", () => {
  it("writes the house-claim and player-profile items atomically", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await claimHouse(doc, TABLE, CAMPAIGN, {
      houseId: "vargen",
      displayName: "Elira",
      codeHash: "hash123",
      playerToken: "tok",
    });
    const calls = ddb.commandCalls(TransactWriteCommand);
    expect(calls).toHaveLength(1);
    const items = calls[0].args[0].input.TransactItems!;
    expect(items).toHaveLength(2);
    expect(items[0].Put!.ConditionExpression).toMatch(/attribute_not_exists/);
  });

  it("throws HttpError 409 when the transaction is cancelled by the condition", async () => {
    const err = Object.assign(new Error("cancelled"), { name: "TransactionCanceledException" });
    ddb.on(TransactWriteCommand).rejects(err);
    await expect(
      claimHouse(doc, TABLE, CAMPAIGN, { houseId: "vargen", displayName: "X", codeHash: "h", playerToken: "t" }),
    ).rejects.toMatchObject({ status: 409, code: "HOUSE_TAKEN" });
  });
});

describe("getPlayerByCodeHash", () => {
  it("returns the profile when present", async () => {
    ddb.on(GetCommand).resolves({ Item: { houseId: "vargen", displayName: "Elira", codeHash: "h" } });
    const profile = await getPlayerByCodeHash(doc, TABLE, "h");
    expect(profile).toMatchObject({ houseId: "vargen", displayName: "Elira" });
  });

  it("returns null when absent", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await getPlayerByCodeHash(doc, TABLE, "missing")).toBeNull();
  });
});

describe("listHouseClaims", () => {
  it("returns a map of claimed houses", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        { SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" },
        { SK: "HOUSE#ravens", houseId: "ravens", displayName: "Cael" },
      ],
    });
    const claims = await listHouseClaims(doc, TABLE, CAMPAIGN);
    expect(claims.get("vargen")?.displayName).toBe("Elira");
    expect(claims.get("ravens")?.displayName).toBe("Cael");
    expect(claims.has("valerius")).toBe(false);
  });
});
