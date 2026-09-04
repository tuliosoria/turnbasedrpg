import { processProjectForTurn, applyCompletion } from "./engine";

/**
 * O que toda carta ativa avança por turno, mesmo sem Energia nenhuma.
 *
 * Uma obra em andamento continua andando: a Energia escolhe o que anda MAIS
 * depressa, não o que anda.
 */
const PASSO_POR_TURNO = 1;
import type { ProjectCard, House, Favor, AlocacaoEnergia } from "@ravenloft/content";

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
  /**
   * A alocação de Energia daquela Casa naquele turno, ou null se o jogador não
   * distribuiu nada. Opcional para não quebrar quem monta as deps sem ela.
   */
  getAlocacaoEnergia?: (houseId: string, turnId: number) => Promise<AlocacaoEnergia | null>;
}

export async function processProjectsForTurn(deps: ProcessTurnDeps, campaignId: string, turnId: number): Promise<void> {
  const projects = await deps.listCampaignProjects(campaignId);
  const ativos = projects.filter((p) => p.status === "ACTIVE");

  // A Energia é por Casa, então a alocação é resolvida uma vez por Casa e não
  // uma vez por projeto — senão o banco seria lido de novo a cada carta.
  //
  // O que a alocação carrega é a Energia EXTRA. Toda carta ativa anda um passo
  // por turno de graça, e a Energia soma em cima disso.
  //
  // Antes, o passo era só o que a Energia desse. Enquanto ninguém distribuía,
  // `alocacaoPadrao` dava um ponto a cada carta e tudo andava; no instante em
  // que o jogador distribuía, qualquer carta fora da distribuição travava para
  // sempre. Um Aqueduto de Khazdrun ficou três turnos em 3/5 assim, e uma Rota
  // de Solarion nunca deu um passo desde que foi criada.
  const extraPorProjeto = new Map<string, number>();
  const porCasa = new Map<string, ProjectCard[]>();
  for (const p of ativos) {
    porCasa.set(p.houseId, [...(porCasa.get(p.houseId) ?? []), p]);
  }
  for (const [houseId, cartas] of porCasa) {
    const alocacao = deps.getAlocacaoEnergia ? await deps.getAlocacaoEnergia(houseId, turnId) : null;
    for (const carta of cartas) {
      extraPorProjeto.set(carta.id, alocacao?.[carta.id] ?? 0);
    }
  }

  for (const project of projects) {
    if (project.status !== "ACTIVE") continue;
    if (project.lastProcessedTurnId === turnId) continue;
    // Um passo por turno, sempre, mais a Energia que o jogador colocou.
    const passos = PASSO_POR_TURNO + (extraPorProjeto.get(project.id) ?? 0);
    const { project: advanced, justCompleted } = processProjectForTurn(project, turnId, passos);
    if (justCompleted) {
      const house = await deps.getHouse(advanced.houseId);
      if (house) {
        const verdict = deps.judgeOutcome
          ? await safeJudge(deps.judgeOutcome, advanced, house)
          : { success: true, narrative: "" };
        const now = new Date().toISOString();
        let conversoes: string[] = [];
        if (verdict.success) {
          const resultado = applyCompletion(house, advanced);
          conversoes = resultado.conversoes;
          await deps.updateHouseAttributes(advanced.houseId, resultado.house.attributes);
          await deps.updateHouseStabilityAndAssets(advanced.houseId, resultado.house.stability ?? 3, resultado.house.assets ?? []);
          for (const fe of resultado.favorsToCreate) {
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
        // A conversão de teto precisa chegar ao jogador: um ganho que virou
        // outra coisa em silêncio é a mesma promessa quebrada de antes.
        advanced.outcomeNarrative = [verdict.narrative, conversoes.join(" ")].filter(Boolean).join("\n\n") || null;
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
