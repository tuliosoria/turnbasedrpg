import { processProjectForTurn, applyCompletion } from "./engine";
import type { ProjectCard, House, Favor } from "@ravenloft/content";

export interface ProjectVerdict {
  success: boolean;
  narrative: string;
}

export interface ProcessTurnDeps {
  listCampaignProjects: (campaignId: string) => Promise<ProjectCard[]>;
  getHouse: (houseId: string) => Promise<House | null>;
  putProject: (p: ProjectCard) => Promise<void>;
  updateHouseAttributes: (houseId: string, attributes: House["attributes"]) => Promise<void>;
  updateHouseStabilityAndAssets: (houseId: string, stability: number, assets: string[]) => Promise<void>;
  putFavor: (f: Favor) => Promise<void>;
  // Decides whether a completed project succeeded. When absent (e.g. no OpenAI
  // configured), completion defaults to success to preserve prior behaviour.
  judgeOutcome?: (project: ProjectCard, house: House) => Promise<ProjectVerdict>;
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
        const verdict = deps.judgeOutcome
          ? await safeJudge(deps.judgeOutcome, advanced, house)
          : { success: true, narrative: "" };
        const now = new Date().toISOString();
        if (verdict.success) {
          const { house: nextHouse, favorsToCreate } = applyCompletion(house, advanced);
          await deps.updateHouseAttributes(advanced.houseId, nextHouse.attributes);
          await deps.updateHouseStabilityAndAssets(advanced.houseId, nextHouse.stability ?? 3, nextHouse.assets ?? []);
          for (const fe of favorsToCreate) {
            const favor: Favor = {
              id: `${advanced.id}-favor-${fe.targetHouseId}`, campaignId, fromHouseId: advanced.houseId,
              toHouseId: fe.targetHouseId, amount: fe.amount, status: "PENDING",
              reason: `Projeto: ${advanced.title}`, createdAt: now, updatedAt: now,
            };
            await deps.putFavor(favor);
          }
        }
        advanced.status = verdict.success ? "COMPLETED" : "FAILED";
        advanced.outcome = verdict.success ? "SUCCESS" : "FAILURE";
        advanced.outcomeNarrative = verdict.narrative || null;
        advanced.completedAt = now;
        advanced.resolvedAt = now;
      }
    }
    await deps.putProject(advanced);
  }
}

async function safeJudge(
  judge: NonNullable<ProcessTurnDeps["judgeOutcome"]>,
  project: ProjectCard,
  house: House,
): Promise<ProjectVerdict> {
  try {
    return await judge(project, house);
  } catch {
    // Never let a turn get stuck on an AI failure — default to success.
    return { success: true, narrative: "" };
  }
}
