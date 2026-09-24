import { describe, expect, it, vi } from "vitest";
import { listPairHistory } from "./messages";

describe("histórico de correspondência", () => {
  it("lê todas as páginas do DynamoDB antes de montar o fio", async () => {
    const cursor = { PK: "CAMPAIGN#c", SK: "DIPLMSG#001#fim" };
    const send = vi.fn()
      .mockResolvedValueOnce({ Items: [{ PK: "x", SK: "x", id: "m1", fromHouseId: "solarion-k0hc", toHouseKey: "casa-ferrumor", turnNumber: 1, createdAt: "1" }], LastEvaluatedKey: cursor })
      .mockResolvedValueOnce({ Items: [{ PK: "x", SK: "y", id: "m2", fromHouseId: "solarion-k0hc", toHouseKey: "casa-ferrumor", turnNumber: 2, createdAt: "2" }] });
    const result = await listPairHistory({ send } as never, "t", "c", "solarion-k0hc", "casa-ferrumor");
    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(send.mock.calls[1][0].input.ExclusiveStartKey).toEqual(cursor);
  });
});
