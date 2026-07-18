import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getTurnStatus, setTurnStatus } from "./turns";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("turn status", () => {
  it("defaults to OPEN when no status item exists", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await getTurnStatus(doc, TABLE, CAMPAIGN, 1)).toBe("OPEN");
  });

  it("returns the stored status", async () => {
    ddb.on(GetCommand).resolves({ Item: { turnStatus: "LOCKED" } });
    expect(await getTurnStatus(doc, TABLE, CAMPAIGN, 1)).toBe("LOCKED");
  });

  it("writes a status keyed per active turn", async () => {
    ddb.on(PutCommand).resolves({});
    await setTurnStatus(doc, TABLE, CAMPAIGN, 1, "LOCKED");
    const input = ddb.commandCalls(PutCommand)[0].args[0].input;
    expect(input.Item!.PK).toBe("CAMPAIGN#WINTER_DEAD#TURN#001");
    expect(input.Item!.SK).toBe("META");
    expect(input.Item!.turnStatus).toBe("LOCKED");
  });
});
