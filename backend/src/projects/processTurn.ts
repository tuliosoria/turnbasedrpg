import { processProjectForTurn, applyCompletion } from "./engine";
import type { ProjectCard, House, Favor } from "@ravenloft/content";

export interface ProcessTurnDeps {
  listCampaignProjects: (campaignId: string) => Promise<ProjectCard[]>;
  getHouse: (houseId: string) => Promise<House | null>;
  putProject: (p: ProjectCard) => Promise<void>;
  updateHouseAttributes: (houseId: string, attributes: House["attributes"]) => Promise<void>;
  updateHouseStabilityAndAssets: (houseId: string, stability: number, assets: string[]) => Promise<void>;
  putFavor: (f: Favor) => Promise<void>;
}

export async function processProjectsForTurn(deps: ProcessTurnDeps, campaignId: string, turnId: number): Promise<void> {
  const projects = await deps.listCampaignProjects(campaignId);
  for (const project of projects) {
    if (project.status !== "ACTIVE") continue;
    if (project.lastProcessedTurnId === turnId) continue;
    const { project: advanced, justCompleted } = processProjectForTurn(project, turnId);
    if (justCompleted) {
      const house = await deps.getHouse(advanced.houseId);
      if (house) {
        const { house: nextHouse, favorsToCreate, assetsAdded } = applyCompletion(house, advanced);
        await deps.updateHouseAttributes(advanced.houseId, nextHouse.attributes);
        await deps.updateHouseStabilityAndAssets(advanced.houseId, nextHouse.stability ?? 3, nextHouse.assets ?? []);
        for (const fe of favorsToCreate) {
          const now = new Date().toISOString();
          const favor: Favor = {
            id: `${advanced.id}-favor-${fe.targetHouseId}`, campaignId, fromHouseId: advanced.houseId,
            toHouseId: fe.targetHouseId, amount: fe.amount, status: "PENDING",
            reason: `Projeto: ${advanced.title}`, createdAt: now, updatedAt: now,
          };
          await deps.putFavor(favor);
        }
        void assetsAdded;
      }
    }
    await deps.putProject(advanced);
  }
}
