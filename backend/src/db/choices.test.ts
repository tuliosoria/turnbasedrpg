import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { putChoice, getChoice, listChoices } from "./choices";

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
});
