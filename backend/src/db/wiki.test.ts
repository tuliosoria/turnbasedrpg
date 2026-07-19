import { describe, it, expect, vi } from "vitest";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { listWikiEntries, putWikiEntry, deleteWikiEntry, generateWikiId, seedDefaultWiki } from "./wiki";
import { DEFAULT_WIKI_ENTRIES, type WikiEntry } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

const entry: WikiEntry = {
  entryId: "abc123",
  section: "casas",
  title: "Casa Vargen",
  body: "Os lobos do norte.",
  order: 0,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("wiki db", () => {
  it("lists and sorts entries by section order then entry order", async () => {
    const doc = docReturning({
      Items: [
        { entryId: "b", section: "cidades", title: "Harrow", body: "", order: 1, updatedAt: "" },
        { entryId: "a", section: "casas", title: "Segundo", body: "", order: 2, updatedAt: "" },
        { entryId: "c", section: "casas", title: "Primeiro", body: "", order: 1, updatedAt: "" },
      ],
    });
    const entries = await listWikiEntries(doc as never, TABLE, CAMPAIGN);
    expect(entries.map((e) => e.entryId)).toEqual(["c", "a", "b"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("WIKI#");
  });

  it("puts an entry under a WIKI# sort key", async () => {
    const doc = docReturning({});
    await putWikiEntry(doc as never, TABLE, CAMPAIGN, entry);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("WIKI#abc123");
    expect(cmd.input.Item.title).toBe("Casa Vargen");
  });

  it("deletes an entry by id", async () => {
    const doc = docReturning({});
    await deleteWikiEntry(doc as never, TABLE, CAMPAIGN, "abc123");
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteCommand);
    expect(cmd.input.Key.SK).toBe("WIKI#abc123");
  });

  it("generates a 10-char id", () => {
    expect(generateWikiId()).toMatch(/^[a-z0-9]{10}$/);
  });

  it("seeds the default cosmology when the wiki is empty", async () => {
    const doc = { send: vi.fn().mockResolvedValue({ Items: [] }) };
    const result = await seedDefaultWiki(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(DEFAULT_WIKI_ENTRIES.length);
    const puts = doc.send.mock.calls.map((c) => c[0]).filter((c) => c instanceof PutCommand);
    expect(puts).toHaveLength(DEFAULT_WIKI_ENTRIES.length);
    expect(puts[0]!.input.Item!.SK).toMatch(/^WIKI#/);
  });

  it("does not seed when entries already exist", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({
        Items: [{ entryId: "x", section: "casas", title: "T", body: "", order: 0, updatedAt: "" }],
      }),
    };
    const result = await seedDefaultWiki(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(0);
    expect(doc.send.mock.calls.map((c) => c[0]).some((c) => c instanceof PutCommand)).toBe(false);
  });
});
