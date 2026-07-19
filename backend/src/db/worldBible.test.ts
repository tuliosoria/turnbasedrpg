import { describe, it, expect, vi } from "vitest";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getWorldBible, putWorldBible } from "./worldBible";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

describe("worldBible db", () => {
  it("returns null when the World Bible item is missing", async () => {
    const doc = docReturning({});
    await expect(getWorldBible(doc as never, TABLE, CAMPAIGN)).resolves.toBeNull();
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });

  it("maps a stored World Bible item", async () => {
    const doc = docReturning({
      Item: { lore: "Valdren", visualDirectives: "Dark fantasy", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    await expect(getWorldBible(doc as never, TABLE, CAMPAIGN)).resolves.toEqual({
      lore: "Valdren",
      visualDirectives: "Dark fantasy",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("puts the World Bible with a fresh updatedAt and round-trips the fields", async () => {
    const doc = docReturning({});
    const saved = await putWorldBible(doc as never, TABLE, CAMPAIGN, {
      lore: "Lore texto",
      visualDirectives: "Diretrizes visuais",
    });
    expect(saved.lore).toBe("Lore texto");
    expect(saved.visualDirectives).toBe("Diretrizes visuais");
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("WORLDBIBLE");
    expect(cmd.input.Item.lore).toBe("Lore texto");
  });
});
