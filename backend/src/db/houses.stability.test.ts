import { describe, it, expect, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { updateHouseStabilityAndAssets } from "./houses";

describe("updateHouseStabilityAndAssets", () => {
  it("writes stability and assets", async () => {
    const sent: any[] = [];
    const doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return {}; }) } as unknown as DynamoDBDocumentClient;
    await updateHouseStabilityAndAssets(doc, "t", "winter-dead", "casa-a", 4, ["Hospital"]);
    const input = sent[0].input;
    expect(input.ExpressionAttributeValues[":s"]).toBe(4);
    expect(input.ExpressionAttributeValues[":assets"]).toEqual(["Hospital"]);
  });
});
