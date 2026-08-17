import { describe, it, expect, vi } from "vitest";
import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { putCanonSubmission, getCanonSubmission, listCanonSubmissions } from "./canonSubmissions";
import { newCanonSubmission, type CanonSubmission } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

function submission(id: string, createdAt: string): CanonSubmission {
  const sub = newCanonSubmission({
    id,
    campaignId: CAMPAIGN,
    houseId: "vargen",
    authorName: "Casa Vargen",
    rawText: "texto",
    rawImageUrl: null,
    rawImageKey: null,
    proposal: {
      title: "Sera",
      section: "casas",
      body: "corpo",
      summary: "resumo",
      entityType: "CHARACTER",
      canonicalName: "Sera",
      immutableTraits: [],
      houseId: "vargen",
    },
  });
  return { ...sub, createdAt, updatedAt: createdAt };
}

describe("canonSubmissions db", () => {
  it("writes under a CANONSUB# sort key in the campaign partition", async () => {
    const doc = docReturning({});
    await putCanonSubmission(doc as never, TABLE, CAMPAIGN, submission("abc", "2026-01-01T00:00:00.000Z"));
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(cmd.input.Item.SK).toBe("CANONSUB#abc");
    expect(cmd.input.Item.id).toBe("abc");
  });

  it("gets one submission by id and returns null when missing", async () => {
    const found = docReturning({ Item: submission("abc", "2026-01-01T00:00:00.000Z") });
    expect(await getCanonSubmission(found as never, TABLE, CAMPAIGN, "abc")).not.toBeNull();
    const cmd = found.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(GetCommand);
    expect(cmd.input.Key.SK).toBe("CANONSUB#abc");

    const missing = docReturning({});
    expect(await getCanonSubmission(missing as never, TABLE, CAMPAIGN, "abc")).toBeNull();
  });

  it("rejeita item corrompido sem os campos obrigatórios", async () => {
    const corrupt = docReturning({ Items: [{ id: "abc" /* faltam campaignId e status */ }] });
    await expect(listCanonSubmissions(corrupt as never, TABLE, CAMPAIGN)).rejects.toThrow(/corrompido/);

    const corruptGet = docReturning({ Item: { campaignId: CAMPAIGN /* falta id e status */ } });
    await expect(getCanonSubmission(corruptGet as never, TABLE, CAMPAIGN, "abc")).rejects.toThrow(/corrompido/);
  });

  it("lists newest first and can filter by house", async () => {
    const doc = docReturning({
      Items: [
        submission("old", "2026-01-01T00:00:00.000Z"),
        submission("new", "2026-03-01T00:00:00.000Z"),
      ],
    });
    const all = await listCanonSubmissions(doc as never, TABLE, CAMPAIGN);
    expect(all.map((s) => s.id)).toEqual(["new", "old"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.KeyConditionExpression).toContain("begins_with(SK, :sk)");
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("CANONSUB#");

    const other = docReturning({
      Items: [
        { ...submission("mine", "2026-01-01T00:00:00.000Z"), houseId: "vargen" },
        { ...submission("theirs", "2026-02-01T00:00:00.000Z"), houseId: "auremont" },
      ],
    });
    const mine = await listCanonSubmissions(other as never, TABLE, CAMPAIGN, "vargen");
    expect(mine.map((s) => s.id)).toEqual(["mine"]);
  });
});
