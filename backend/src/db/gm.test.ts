import { describe, it, expect, vi } from "vitest";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { listGmEntries, putGmEntry, deleteGmEntry, generateGmId, seedDefaultGm } from "./gm";
import { DEFAULT_GM_ENTRIES, type GmEntry } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

const entry: GmEntry = {
  entryId: "abc123",
  section: "a-verdade",
  title: "A verdade",
  body: "Othmar I.",
  order: 0,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("gm db", () => {
  it("lists and sorts entries by section order then entry order", async () => {
    const doc = docReturning({
      Items: [
        { entryId: "b", section: "ancoras", title: "Coroa", body: "", order: 1, updatedAt: "" },
        { entryId: "a", section: "a-verdade", title: "Segundo", body: "", order: 2, updatedAt: "" },
        { entryId: "c", section: "a-verdade", title: "Primeiro", body: "", order: 1, updatedAt: "" },
      ],
    });
    const entries = await listGmEntries(doc as never, TABLE, CAMPAIGN);
    expect(entries.map((e) => e.entryId)).toEqual(["c", "a", "b"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("GM#");
  });

  it("puts an entry under a GM# sort key", async () => {
    const doc = docReturning({});
    await putGmEntry(doc as never, TABLE, CAMPAIGN, entry);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("GM#abc123");
    expect(cmd.input.Item.title).toBe("A verdade");
  });

  it("deletes an entry by id", async () => {
    const doc = docReturning({});
    await deleteGmEntry(doc as never, TABLE, CAMPAIGN, "abc123");
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteCommand);
    expect(cmd.input.Key.SK).toBe("GM#abc123");
  });

  it("generates a 10-char id", () => {
    expect(generateGmId()).toMatch(/^[a-z0-9]{10}$/);
  });

  it("seeds the default GM lore when empty", async () => {
    const doc = { send: vi.fn().mockResolvedValue({ Items: [] }) };
    const result = await seedDefaultGm(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(DEFAULT_GM_ENTRIES.length);
    const puts = doc.send.mock.calls.map((c) => c[0]).filter((c) => c instanceof PutCommand);
    expect(puts).toHaveLength(DEFAULT_GM_ENTRIES.length);
    expect(puts[0]!.input.Item!.SK).toMatch(/^GM#/);
  });

  it("does not seed when entries already exist", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({
        Items: [{ entryId: "x", section: "a-verdade", title: "T", body: "", order: 0, updatedAt: "" }],
      }),
    };
    const result = await seedDefaultGm(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(0);
    expect(doc.send.mock.calls.map((c) => c[0]).some((c) => c instanceof PutCommand)).toBe(false);
  });
});
