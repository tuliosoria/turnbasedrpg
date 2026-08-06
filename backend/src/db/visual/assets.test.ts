import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putAsset, getAsset, listAssets, setAssetCanonicalLevel } from "./assets";
import type { VisualAsset } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
function asset(over: Partial<VisualAsset> = {}): VisualAsset {
  return {
    id: "a1", campaignId: CAMP, entityId: "alic", assetType: "PORTRAIT",
    storageKey: "visual/a1.png", storageUrl: "https://x/a1.png", thumbnailStorageKey: null, thumbnailUrl: null,
    mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c",
    status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
    description: "", extractedVisualDescription: "", consistencyScore: 92, consistencyReport: null,
    tags: [], createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}
describe("db/visual/assets", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined, Attributes: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putAsset writes VASSET SK", async () => {
    await putAsset(doc, TABLE, CAMP, asset());
    expect(sent[0].input.Item.SK).toBe("VASSET#a1");
  });
  it("getAsset maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...asset(), PK: "x", SK: "y" } });
    const got = await getAsset(doc, TABLE, CAMP, "a1");
    expect(got?.canonicalLevel).toBe("CANONICAL");
  });
  it("listAssets queries the VASSET prefix", async () => {
    await listAssets(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("VASSET#");
  });
  it("setAssetCanonicalLevel updates the level field", async () => {
    await setAssetCanonicalLevel(doc, TABLE, CAMP, "a1", "LOCKED");
    expect(sent[0].input.UpdateExpression).toContain("canonicalLevel");
    expect(sent[0].input.ExpressionAttributeValues[":level"]).toBe("LOCKED");
  });
});
