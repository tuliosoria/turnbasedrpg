import { describe, it, expect, beforeEach } from "vitest";
import { MockApiClient } from "./mockClient";

async function loginPlayer(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as any);
  return acc.playerToken;
}

describe("MockApiClient projects", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); });

  it("getProjects returns the template library and slot limit", async () => {
    const token = await loginPlayer(client);
    const res = await client.getProjects(token);
    expect(res.templates.length).toBe(65);
    expect(res.slotLimit).toBe(1);
    expect(res.stability).toBe(3);
    expect(res.projects).toEqual([]);
    expect(Array.isArray(res.recommended)).toBe(true);
  });

  it("startProjectFromTemplate activates an affordable project and charges costs", async () => {
    const token = await loginPlayer(client);
    const p = await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    expect(p.status).toBe("ACTIVE");
    const after = await client.getProjects(token);
    expect(after.projects).toHaveLength(1);
  });

  it("blocks a second active project when slot limit is 1", async () => {
    const token = await loginPlayer(client);
    await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    await expect(client.startProjectFromTemplate(token, { templateId: "infiltrar-um-agente" })).rejects.toThrow();
  });

  it("cancelProject marks it cancelled", async () => {
    const token = await loginPlayer(client);
    const p = await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    const cancelled = await client.cancelProject(token, { projectId: p.id });
    expect(cancelled.status).toBe("CANCELLED");
  });
});
