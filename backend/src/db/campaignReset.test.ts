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

  it("preserves hand-authored visual canon and the style bible", async () => {
    // Canon sheets and the style bible are authored by hand, exactly like the
    // wiki, and a campaign reset is about clearing play state (turns, houses,
    // submissions) — not about discarding the encyclopedia. Deleting them here
    // would also be silent: the wiki survives, so the loss looks partial.
    const campaignItems = [
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "VENTITY#khar-durak" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "VSTYLE#0003" },
    ];
    const doc = makeDoc(campaignItems, []);

    const result = await resetCampaign(doc as never, TABLE, CAMPAIGN);

    const batch = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof BatchWriteCommand);
    const deletedSks = (batch as BatchWriteCommand).input.RequestItems![TABLE].map(
      (r) => r.DeleteRequest!.Key!.SK as string,
    );

    expect(deletedSks).toContain("TURN#001");
    expect(deletedSks).not.toContain("VENTITY#khar-durak");
    expect(deletedSks).not.toContain("VSTYLE#0003");
    expect(result.deleted).toBe(1);
  });

  it("keeps novel chapters and canonical images, and still deletes generations", async () => {
    const campaignItems = [
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "BOOK#prologo" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "VASSET#mapa" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "VGEN#0001" },
    ];
    const doc = makeDoc(campaignItems, []);

    const result = await resetCampaign(doc as never, TABLE, CAMPAIGN);

    const batch = doc.send.mock.calls.map((c) => c[0]).find((c) => c instanceof BatchWriteCommand);
    const deletedSks = (batch as BatchWriteCommand).input.RequestItems![TABLE].map(
      (r) => r.DeleteRequest!.Key!.SK as string,
    );

    expect(deletedSks).toContain("TURN#001");
    expect(deletedSks).toContain("VGEN#0001");
    expect(deletedSks).not.toContain("BOOK#prologo");
    expect(deletedSks).not.toContain("VASSET#mapa");
    expect(result.deleted).toBe(2);
  });

  it("retries delete requests DynamoDB left unprocessed before reporting deleted", async () => {
    const campaignItems = [
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "HOUSE#casa-a" },
    ];
    const leftover = { DeleteRequest: { Key: { PK: "CAMPAIGN#WINTER_DEAD", SK: "HOUSE#casa-a" } } };
    let batches = 0;
    const doc = {
      send: vi.fn(async (cmd: unknown) => {
        if (cmd instanceof QueryCommand) return { Items: campaignItems };
        if (cmd instanceof ScanCommand) return { Items: [] };
        if (cmd instanceof BatchWriteCommand) {
          batches += 1;
          if (batches === 1) return { UnprocessedItems: { [TABLE]: [leftover] } };
          return { UnprocessedItems: {} };
        }
        return {};
      }),
    };

    const result = await resetCampaign(doc as never, TABLE, CAMPAIGN);

    const writes = doc.send.mock.calls.map((c) => c[0]).filter((c) => c instanceof BatchWriteCommand) as BatchWriteCommand[];
    expect(writes).toHaveLength(2);
    expect(writes[1]!.input.RequestItems![TABLE]).toEqual([leftover]);
    expect(result.deleted).toBe(2);
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
