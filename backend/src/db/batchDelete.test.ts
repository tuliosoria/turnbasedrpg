import { describe, it, expect, vi } from "vitest";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { batchDeleteKeys } from "./batchDelete";

const TABLE = "ravenloft-game";

describe("batchDeleteKeys", () => {
  it("throws when items stay unprocessed, so the caller cannot report them deleted", async () => {
    const stuck = { DeleteRequest: { Key: { PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" } } };
    const doc = {
      send: vi.fn(async (_cmd: unknown) => ({ UnprocessedItems: { [TABLE]: [stuck] } })),
    };

    await expect(
      batchDeleteKeys(doc as never, TABLE, [{ PK: "CAMPAIGN#WINTER_DEAD", SK: "TURN#001" }], {
        maxAttempts: 2,
        baseDelayMs: 0,
      }),
    ).rejects.toThrow(/unprocessed delete requests after 2 attempts/);

    const writes = doc.send.mock.calls.map((c) => c[0]) as BatchWriteCommand[];
    expect(writes).toHaveLength(2);
    expect(writes[0]).toBeInstanceOf(BatchWriteCommand);
    expect(writes[1]!.input.RequestItems![TABLE]).toEqual([stuck]);
  });
});
