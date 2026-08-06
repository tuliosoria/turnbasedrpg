import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putProject, getProject, listHouseProjects, listCampaignProjects, putFavor, listFavorsForHouse } from "./projects";
import type { ProjectCard, Favor } from "@ravenloft/content";

const TABLE = "t";
const CAMP = "winter-dead";

function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1", campaignId: CAMP, houseId: "casa-a", title: "T", description: "d", publicDescription: "pd",
    category: "MILITARY", status: "ACTIVE", durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", completedAt: null,
    ...over,
  };
}

describe("db/projects", () => {
  let sent: any[];
  let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });

  it("putProject writes item with correct PK/SK", async () => {
    await putProject(doc, TABLE, CAMP, project());
    const item = sent[0].input.Item;
    expect(item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(item.SK).toBe("PROJECT#casa-a#p1");
    expect(item.title).toBe("T");
  });

  it("getProject returns mapped card", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...project(), PK: "x", SK: "y" } });
    const got = await getProject(doc, TABLE, CAMP, "casa-a", "p1");
    expect(got?.id).toBe("p1");
    expect(got?.category).toBe("MILITARY");
  });

  it("listHouseProjects queries the house prefix", async () => {
    await listHouseProjects(doc, TABLE, CAMP, "casa-a");
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("PROJECT#casa-a#");
  });

  it("listCampaignProjects queries the global prefix", async () => {
    await listCampaignProjects(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("PROJECT#");
  });

  it("putFavor + listFavorsForHouse use FAVOR keys", async () => {
    const favor: Favor = { id: "f1", campaignId: CAMP, fromHouseId: "casa-b", toHouseId: "casa-a", amount: 1, status: "PENDING", reason: "r", createdAt: "", updatedAt: "" };
    await putFavor(doc, TABLE, CAMP, favor);
    expect(sent[0].input.Item.SK).toBe("FAVOR#casa-a#f1");
    await listFavorsForHouse(doc, TABLE, CAMP, "casa-a");
    expect(sent[1].input.ExpressionAttributeValues[":sk"]).toBe("FAVOR#casa-a#");
  });
});
