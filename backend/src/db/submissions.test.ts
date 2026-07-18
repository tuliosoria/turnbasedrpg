import { describe, it, expect, vi } from "vitest";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSubmission, listSubmissions, putSubmission } from "./submissions";
import type { Submission } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";
const submission: Submission = {
  houseId: "vargen-a1b2",
  orderText: "Defender a ponte.",
  cardResponses: [{ cardId: "ponte", text: "Avançar" }],
  submittedAt: "2026-07-18T00:00:00.000Z",
};

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

describe("submissions db", () => {
  it("puts a submission under the turn submission key", async () => {
    const doc = docReturning({});
    await putSubmission(doc as never, TABLE, CAMPAIGN, 1, submission);
    const command = doc.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(command.input.Item.SK).toBe("TURN#001#SUB#vargen-a1b2");
  });

  it("gets a submission or null", async () => {
    const doc = docReturning({ Item: submission });
    await expect(getSubmission(doc as never, TABLE, CAMPAIGN, 1, "vargen-a1b2")).resolves.toEqual(submission);
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);

    const emptyDoc = docReturning({});
    await expect(getSubmission(emptyDoc as never, TABLE, CAMPAIGN, 1, "other")).resolves.toBeNull();
  });

  it("lists submissions for a turn", async () => {
    const doc = docReturning({ Items: [submission] });
    await expect(listSubmissions(doc as never, TABLE, CAMPAIGN, 1)).resolves.toEqual([submission]);
    const command = doc.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input.ExpressionAttributeValues[":sk"]).toBe("TURN#001#SUB#");
  });
});
