import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putGeneration, getGeneration, updateGeneration } from "./generations";
import { newVisualGeneration } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
describe("db/visual/generations", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined, Attributes: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putGeneration writes VGEN SK and PENDING status", async () => {
    await putGeneration(doc, TABLE, CAMP, newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "castelo" }));
    expect(sent[0].input.Item.SK).toBe("VGEN#g1");
    expect(sent[0].input.Item.status).toBe("PENDING");
  });
  it("getGeneration maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "castelo" }), PK: "x", SK: "y" } });
    const got = await getGeneration(doc, TABLE, CAMP, "g1");
    expect(got?.id).toBe("g1");
    expect(got?.status).toBe("PENDING");
  });
  it("updateGeneration overwrites the item via put", async () => {
    const g = { ...newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "x" }), status: "COMPLETED" as const };
    await updateGeneration(doc, TABLE, CAMP, g);
    expect(sent[0].input.Item.status).toBe("COMPLETED");
    expect(sent[0].input.Item.SK).toBe("VGEN#g1");
  });
});
