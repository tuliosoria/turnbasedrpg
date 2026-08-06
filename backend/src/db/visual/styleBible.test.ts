import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putStyleBible, getActiveStyleBible } from "./styleBible";
import type { VisualStyleBible } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
function bible(over: Partial<VisualStyleBible> = {}): VisualStyleBible {
  return {
    campaignId: CAMP, version: 1, status: "ACTIVE", artMedium: "digital painting",
    renderingStyle: "dark fantasy", lightingRules: "cold", colorPalette: "muted",
    architectureRenderingRules: "gothic", characterRenderingRules: "detailed",
    prohibitedStyles: [], globalNegativeInstructions: [], referenceAssetIds: [],
    createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}
describe("db/visual/styleBible", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putStyleBible writes with VSTYLE SK", async () => {
    await putStyleBible(doc, TABLE, CAMP, bible());
    expect(sent[0].input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(sent[0].input.Item.SK).toBe("VSTYLE#0001");
  });
  it("getActiveStyleBible returns the ACTIVE version with highest number", async () => {
    (doc.send as any).mockResolvedValueOnce({ Items: [
      { ...bible({ version: 1, status: "ARCHIVED" }), PK: "x", SK: "VSTYLE#0001" },
      { ...bible({ version: 2, status: "ACTIVE" }), PK: "x", SK: "VSTYLE#0002" },
    ] });
    const got = await getActiveStyleBible(doc, TABLE, CAMP);
    expect(got?.version).toBe(2);
    expect(got?.status).toBe("ACTIVE");
  });
  it("getActiveStyleBible returns null when none active", async () => {
    (doc.send as any).mockResolvedValueOnce({ Items: [{ ...bible({ status: "ARCHIVED" }), PK: "x", SK: "y" }] });
    expect(await getActiveStyleBible(doc, TABLE, CAMP)).toBeNull();
  });
});
