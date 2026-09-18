import { describe, it, expect, vi } from "vitest";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  listBookChapters,
  putBookChapter,
  deleteBookChapter,
  generateBookId,
  seedDefaultBook,
} from "./book";
import { DEFAULT_BOOK_CHAPTERS, type BookChapter } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

const chapter: BookChapter = {
  chapterId: "prologo",
  part: "prologo",
  order: 0,
  title: "A mão que ainda lembra",
  body: "Eu era jovem quando o Norte calou.",
  status: "publicado",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("book db", () => {
  it("lists and sorts chapters by part order then chapter order", async () => {
    const doc = docReturning({
      Items: [
        { chapterId: "b", part: "parte-2", order: 0, title: "Dois", body: "", status: "publicado", updatedAt: "" },
        { chapterId: "a", part: "parte-1", order: 2, title: "Segundo", body: "", status: "publicado", updatedAt: "" },
        { chapterId: "c", part: "parte-1", order: 1, title: "Primeiro", body: "", status: "publicado", updatedAt: "" },
        { chapterId: "p", part: "prologo", order: 0, title: "Prólogo", body: "", status: "publicado", updatedAt: "" },
      ],
    });
    const chapters = await listBookChapters(doc as never, TABLE, CAMPAIGN);
    expect(chapters.map((c) => c.chapterId)).toEqual(["p", "c", "a", "b"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("BOOK#");
  });

  it("puts a chapter under a BOOK# sort key", async () => {
    const doc = docReturning({});
    await putBookChapter(doc as never, TABLE, CAMPAIGN, chapter);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("BOOK#prologo");
    expect(cmd.input.Item.title).toBe("A mão que ainda lembra");
  });

  it("deletes a chapter by id", async () => {
    const doc = docReturning({});
    await deleteBookChapter(doc as never, TABLE, CAMPAIGN, "prologo");
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteCommand);
    expect(cmd.input.Key.SK).toBe("BOOK#prologo");
  });

  it("generates a slugged id with a random suffix", () => {
    const id = generateBookId("A Forja e a Leva");
    expect(id).toMatch(/^a-forja-e-a-leva-[a-z0-9]{4}$/);
  });

  it("seeds the default chapters when the book is empty", async () => {
    const doc = { send: vi.fn().mockResolvedValue({ Items: [] }) };
    const result = await seedDefaultBook(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(DEFAULT_BOOK_CHAPTERS.length);
    const puts = doc.send.mock.calls.map((c) => c[0]).filter((c) => c instanceof PutCommand);
    expect(puts).toHaveLength(DEFAULT_BOOK_CHAPTERS.length);
    expect(puts[0]!.input.Item!.SK).toMatch(/^BOOK#/);
  });

  it("does not seed when chapters already exist", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({
        Items: [{ chapterId: "x", part: "prologo", order: 0, title: "T", body: "", status: "publicado", updatedAt: "" }],
      }),
    };
    const result = await seedDefaultBook(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(0);
    expect(doc.send.mock.calls.map((c) => c[0]).some((c) => c instanceof PutCommand)).toBe(false);
  });
});
