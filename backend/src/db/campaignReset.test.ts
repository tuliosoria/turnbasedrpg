import { describe, it, expect, vi } from "vitest";
import { QueryCommand, ScanCommand, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { resetCampaign } from "./campaignReset";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function makeDoc(campaignItems: Record<string, unknown>[], playerItems: Record<string, unknown>[]) {
  const send = vi.fn(async (cmd: unknown) => {
    if (cmd instanceof QueryCommand) return { Items: campaignItems };
    if (cmd instanceof ScanCommand) return { Items: playerItems };
    return {};
  });
  return { send };
}

describe("resetCampaign", () => {
  it("deletes campaign and player items but keeps the World Bible, then seeds TURN#001 as DRAFT", async () => {
    const campaignItems = [
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "HOUSE#casa-a" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001#SUB#casa-a" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "WORLDBIBLE" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#abc123" },
    ];
    const playerItems = [{ PK: "PLAYER#hash-a", SK: "PROFILE" }];
    const doc = makeDoc(campaignItems, playerItems);

    const result = await resetCampaign(doc as never, TABLE, CAMPAIGN);

    const batch = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof BatchWriteCommand);
    expect(batch).toBeInstanceOf(BatchWriteCommand);
    const deleteKeys = (batch as BatchWriteCommand).input.RequestItems![TABLE].map((r) => r.DeleteRequest!.Key);
    const deletedSks = deleteKeys.map((k) => k!.SK as string);

    expect(deletedSks).toEqual(expect.arrayContaining(["TURN#001", "HOUSE#casa-a", "TURN#001#SUB#casa-a", "PROFILE"]));
    expect(deletedSks).not.toContain("WORLDBIBLE");
    expect(deletedSks).not.toContain("WIKI#abc123");
    expect(deleteKeys).toHaveLength(4);
    expect(result.deleted).toBe(4);

    const put = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof PutCommand) as PutCommand | undefined;
    expect(put).toBeInstanceOf(PutCommand);
    expect(put!.input.Item!.SK).toBe("TURN#001");
    expect(put!.input.Item!.status).toBe("DRAFT");
  });

  it("does nothing to delete when only the World Bible exists but still seeds TURN#001", async () => {
    const campaignItems = [{ PK: "CAMPAIGN#WINTER_DEAD", SK: "WORLDBIBLE" }];
    const doc = makeDoc(campaignItems, []);

    const result = await resetCampaign(doc as never, TABLE, CAMPAIGN);

    expect(result.deleted).toBe(0);
    const batch = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof BatchWriteCommand);
    expect(batch).toBeUndefined();
    const put = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof PutCommand) as PutCommand | undefined;
    expect(put!.input.Item!.SK).toBe("TURN#001");
  });
});
