import { describe, it, expect, vi } from "vitest";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getNpcState, listNpcStates, putNpcState } from "./npcState";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

describe("npcState db", () => {
  it("devolve o estado vazio quando o Mestre nunca tocou no NPC", async () => {
    const doc = { send: vi.fn().mockResolvedValue({ Item: undefined }) };
    const s = await getNpcState(doc as never, TABLE, CAMPAIGN, "casa-karasoy", "selma-karasoy");
    expect(s.mood).toBe("");
    expect(s.perceptions).toEqual({});
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });

  it("lê o estado gravado", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({
        Item: { houseKey: "casa-karasoy", characterId: "selma-karasoy", mood: "exausta", favors: "", note: "", perceptions: { "casa-auremont": "rancor" }, updatedAt: "t" },
      }),
    };
    const s = await getNpcState(doc as never, TABLE, CAMPAIGN, "casa-karasoy", "selma-karasoy");
    expect(s.mood).toBe("exausta");
    expect(s.perceptions["casa-auremont"]).toBe("rancor");
  });

  it("grava com a chave por Casa e personagem", async () => {
    const doc = { send: vi.fn().mockResolvedValue({}) };
    await putNpcState(doc as never, TABLE, CAMPAIGN, {
      houseKey: "casa-karasoy", characterId: "selma-karasoy", mood: "firme", favors: "", note: "", perceptions: {},
    });
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("NPCSTATE#casa-karasoy#selma-karasoy");
    expect(cmd.input.Item.updatedAt).not.toBe("");
  });

  it("lista todos os estados editados", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({ Items: [{ houseKey: "casa-karasoy", characterId: "selma-karasoy", mood: "firme", perceptions: {} }] }),
    };
    const states = await listNpcStates(doc as never, TABLE, CAMPAIGN);
    expect(states).toHaveLength(1);
    expect(doc.send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
  });
});
