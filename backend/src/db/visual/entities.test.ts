import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putEntity, getEntity, listEntities } from "./entities";
import { newVisualEntity } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
describe("db/visual/entities", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putEntity writes VENTITY SK", async () => {
    await putEntity(doc, TABLE, CAMP, newVisualEntity({ id: "alic", campaignId: CAMP, entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" }));
    expect(sent[0].input.Item.SK).toBe("VENTITY#alic");
    expect(sent[0].input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
  });
  it("getEntity maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...newVisualEntity({ id: "alic", campaignId: CAMP, entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" }), PK: "x", SK: "y" } });
    const got = await getEntity(doc, TABLE, CAMP, "alic");
    expect(got?.id).toBe("alic");
    expect(got?.entityType).toBe("CHARACTER");
  });
  it("listEntities queries the VENTITY prefix", async () => {
    await listEntities(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("VENTITY#");
  });
});

describe("getEntity trait coercion", () => {
  it("upgrades a legacy string[] immutableTraits record to CanonTrait[]", async () => {
    const doc = {
      send: vi.fn(async () => ({
        Item: {
          PK: "CAMPAIGN#winter-dead",
          SK: "VENTITY#khar-durak",
          id: "khar-durak",
          canonicalName: "Khar-Durak",
          immutableTraits: ["cidade escavada na montanha"],
        },
      })),
    } as unknown as DynamoDBDocumentClient;

    const e = await getEntity(doc, "t", "winter-dead", "khar-durak");
    expect(e?.immutableTraits).toEqual([
      expect.objectContaining({ text: "cidade escavada na montanha", source: "AUTHORED" }),
    ]);
  });

  it("defaults a record with no immutableTraits to an empty array", async () => {
    const doc = {
      send: vi.fn(async () => ({
        Item: { PK: "p", SK: "VENTITY#x", id: "x", canonicalName: "X" },
      })),
    } as unknown as DynamoDBDocumentClient;

    const e = await getEntity(doc, "t", "winter-dead", "x");
    expect(e?.immutableTraits).toEqual([]);
  });
});
