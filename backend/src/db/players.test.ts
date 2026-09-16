import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getPlayerByCodeHash } from "./players";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";

beforeEach(() => ddb.reset());

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
