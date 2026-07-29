import { describe, expect, it, vi } from "vitest";
import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { batchWriteAll, listExistingWikiKeys, replaceWiki, validateDefaultWikiEntries } from "./replace-wiki.mjs";

describe("replace-wiki script helpers", () => {
  function canonicalSizedEntries(overrides = []) {
    return [
      ...overrides,
      ...Array.from({ length: 80 - overrides.length }, (_, index) => ({
        section: "visao-geral",
        title: `Entrada ${index}`,
        body: "Conteúdo público canônico.",
        order: index,
      })),
    ];
  }

  function validCanonicalEntries() {
    return canonicalSizedEntries([
      { section: "geografia", title: "Atlas de Valdren", body: "Mapa.", order: 0, imageUrls: ["/valdren-map.png"] },
      { section: "casas", title: "Casa Khazdrun — A Montanha e a Maré", body: "Montanha e maré.", order: 0 },
      { section: "crise-atual", title: "A ameaça do Norte", body: "Os mortos avançam.", order: 0 },
    ]);
  }

  it("paginates existing wiki key queries", async () => {
    const doc = {
      send: vi.fn()
        .mockResolvedValueOnce({
          Items: [{ PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#a" }],
          LastEvaluatedKey: { PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#a" },
        })
        .mockResolvedValueOnce({
          Items: [{ PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#b" }],
        }),
    };

    const keys = await listExistingWikiKeys(doc, "ravenloft-game", "CAMPAIGN#WINTER_DEAD");

    expect(keys).toEqual([
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#a" },
      { PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#b" },
    ]);
    expect(doc.send).toHaveBeenCalledTimes(2);
    expect(doc.send.mock.calls[1][0]).toBeInstanceOf(QueryCommand);
    expect(doc.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#a" });
  });

  it("retries unprocessed batch write items", async () => {
    const firstRequest = { PutRequest: { Item: { PK: "P", SK: "WIKI#a" } } };
    const secondRequest = { PutRequest: { Item: { PK: "P", SK: "WIKI#b" } } };
    const doc = {
      send: vi.fn()
        .mockResolvedValueOnce({ UnprocessedItems: { "ravenloft-game": [secondRequest] } })
        .mockResolvedValueOnce({ UnprocessedItems: {} }),
    };

    await batchWriteAll(doc, "ravenloft-game", [firstRequest, secondRequest], { maxAttempts: 2, baseDelayMs: 0 });

    expect(doc.send).toHaveBeenCalledTimes(2);
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(BatchWriteCommand);
    expect(doc.send.mock.calls[1][0].input.RequestItems["ravenloft-game"]).toEqual([secondRequest]);
  });

  it("rejects stale default wiki content before destructive writes", () => {
    expect(() => validateDefaultWikiEntries(canonicalSizedEntries([
      { section: "casas", title: "Casa Vargen", body: "Antigo", order: 0 },
    ]))).toThrow(/Atlas de Valdren/);
  });

  it("does not delete existing wiki keys when writing canonical entries fails", async () => {
    const doc = {
      send: vi.fn(async (command) => {
        if (command instanceof QueryCommand) {
          return { Items: [{ PK: "CAMPAIGN#WINTER_DEAD", SK: "WIKI#old" }] };
        }
        if (command instanceof BatchWriteCommand) {
          const requests = command.input.RequestItems["ravenloft-game"];
          if (requests.some((request) => "PutRequest" in request)) {
            throw new Error("write failed");
          }
          return { UnprocessedItems: {} };
        }
        return {};
      }),
    };

    await expect(replaceWiki(doc, {
      tableName: "ravenloft-game",
      pk: "CAMPAIGN#WINTER_DEAD",
      entries: validCanonicalEntries(),
    })).rejects.toThrow(/write failed/);

    const batchCommands = doc.send.mock.calls.map((call) => call[0]).filter((command) => command instanceof BatchWriteCommand);
    expect(batchCommands).toHaveLength(1);
    expect(batchCommands[0].input.RequestItems["ravenloft-game"].every((request) => "PutRequest" in request)).toBe(true);
  });
});
