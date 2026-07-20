import { describe, it, expect, vi } from "vitest";
import { hitRateLimit } from "./rateLimit";

describe("hitRateLimit", () => {
  it("increments the current window counter and returns the new count", async () => {
    const send = vi.fn().mockResolvedValue({ Attributes: { count: 3 } });
    const doc = { send } as never;
    const now = 1_800_000_000_000;
    const count = await hitRateLimit(doc, "tbl", "house-image#1.2.3.4", 3600, now);
    expect(count).toBe(3);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.UpdateExpression).toContain("ADD");
    expect(cmd.input.Key.PK).toContain("RATELIMIT#house-image#1.2.3.4");
    expect(typeof cmd.input.ExpressionAttributeValues[":ttl"]).toBe("number");
  });
});
