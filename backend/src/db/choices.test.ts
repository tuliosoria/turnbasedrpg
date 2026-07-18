import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { putChoice, putChoiceGuarded, getChoice, listChoices } from "./choices";
import { HttpError } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("choices", () => {
  it("puts a choice keyed by turn partition and house", async () => {
    ddb.on(PutCommand).resolves({});
    await putChoice(doc, TABLE, CAMPAIGN, 1, "vargen", "vargen-defend-bridge", "2026-07-18T00:00:00.000Z");
    const item = ddb.commandCalls(PutCommand)[0].args[0].input.Item!;
    expect(item.PK).toBe("CAMPAIGN#WINTER_DEAD#TURN#001");
    expect(item.SK).toBe("HOUSE#vargen");
    expect(item.cardId).toBe("vargen-defend-bridge");
    expect(item.chosenAt).toBe("2026-07-18T00:00:00.000Z");
  });

  it("gets a single house choice or null", async () => {
    ddb.on(GetCommand).resolves({ Item: { cardId: "vargen-defend-bridge", chosenAt: "t" } });
    expect(await getChoice(doc, TABLE, CAMPAIGN, 1, "vargen")).toMatchObject({ cardId: "vargen-defend-bridge" });
    ddb.on(GetCommand).resolves({});
    expect(await getChoice(doc, TABLE, CAMPAIGN, 1, "ravens")).toBeNull();
  });

  it("lists all choices for a turn as a map", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [{ houseId: "vargen", cardId: "vargen-defend-bridge", chosenAt: "t" }],
    });
    const map = await listChoices(doc, TABLE, CAMPAIGN, 1);
    expect(map.get("vargen")?.cardId).toBe("vargen-defend-bridge");
  });

  it("guarded put writes the choice and condition-checks the turn is not locked", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await putChoiceGuarded(doc, TABLE, CAMPAIGN, 1, "vargen", "vargen-defend-bridge", "2026-07-18T00:00:00.000Z");
    const input = ddb.commandCalls(TransactWriteCommand)[0].args[0].input;
    const items = input.TransactItems!;
    const put = items.find((i) => i.Put)!.Put!;
    const check = items.find((i) => i.ConditionCheck)!.ConditionCheck!;
    expect(put.Item!.PK).toBe("CAMPAIGN#WINTER_DEAD#TURN#001");
    expect(put.Item!.SK).toBe("HOUSE#vargen");
    expect(put.Item!.cardId).toBe("vargen-defend-bridge");
    expect(check.Key!.SK).toBe("META");
    expect(check.ConditionExpression).toContain("turnStatus");
    expect(check.ExpressionAttributeValues![":locked"]).toBe("LOCKED");
  });

  it("guarded put throws 423 TURN_LOCKED when the transaction is cancelled", async () => {
    ddb.on(TransactWriteCommand).rejects(
      Object.assign(new Error("cancelled"), { name: "TransactionCanceledException" }),
    );
    await expect(
      putChoiceGuarded(doc, TABLE, CAMPAIGN, 1, "vargen", "vargen-defend-bridge", "t"),
    ).rejects.toMatchObject({ status: 423, code: "TURN_LOCKED" });
    await expect(
      putChoiceGuarded(doc, TABLE, CAMPAIGN, 1, "vargen", "vargen-defend-bridge", "t"),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
