import { ATTR_MIN, ATTR_MAX, STABILITY_MIN, STABILITY_MAX, houseStability } from "./types.js";
import type { House, Attributes } from "./types.js";
import type { ProjectCard, ProjectCost, FavorEffect } from "./projects.js";

/**
 * Quantas cartas a Casa pode ter em andamento.
 *
 * Era 1, ou 2 com Controle 4. Subiu com a Energia: com teto 1 o jogador não tem
 * o que escolher entre espalhar e concentrar, e a mecânica não existe. O 4 mantém
 * o prêmio do Controle e aperta melhor — quatro cartas para três pontos por turno
 * obrigam a deixar uma parada.
 */
export function projectSlotLimit(house: House): number {
  return house.attributes.controle >= 4 ? 4 : 3;
}

export function activeProjectCount(projects: ProjectCard[]): number {
  return projects.filter((p) => p.status === "ACTIVE" || p.status === "PAUSED").length;
}

function sumCost(costs: ProjectCost[], type: ProjectCost["type"], timing: ProjectCost["timing"]): number {
  return costs.filter((c) => c.type === type && c.timing === timing).reduce((n, c) => n + c.amount, 0);
}

export function canAffordStart(house: House, project: ProjectCard): { ok: boolean; reason?: string } {
  const wealth = sumCost(project.costs, "WEALTH", "ON_START");
  const resources = sumCost(project.costs, "RESOURCES", "ON_START");
  const stabilityCost = sumCost(project.costs, "STABILITY", "ON_START");
  const soldiers = sumCost(project.costs, "SOLDIERS_COMMITTED", "ON_START");
  const control = sumCost(project.costs, "CONTROL_COMMITTED", "ON_START");
  if (house.attributes.riqueza < wealth) return { ok: false, reason: "Riqueza insuficiente." };
  if (house.attributes.recursos < resources) return { ok: false, reason: "Recursos insuficientes." };
  if (houseStability(house) < stabilityCost) return { ok: false, reason: "Estabilidade insuficiente." };
  if (house.attributes.soldados < soldiers) return { ok: false, reason: "Soldados insuficientes." };
  if (house.attributes.controle < control) return { ok: false, reason: "Controle insuficiente." };
  return { ok: true };
}

export function applyStartCharges(house: House, project: ProjectCard): House {
  const attrs: Attributes = { ...house.attributes };
  attrs.riqueza -= sumCost(project.costs, "WEALTH", "ON_START");
  attrs.recursos -= sumCost(project.costs, "RESOURCES", "ON_START");
  const stability = clamp(houseStability(house) - sumCost(project.costs, "STABILITY", "ON_START"), STABILITY_MIN, STABILITY_MAX);
  return { ...house, attributes: attrs, stability };
}

export interface CompletionResult {
  house: House;
  favorsToCreate: FavorEffect[];
  assetsAdded: string[];
  /** O que não coube no teto e para onde foi. Vazio quando tudo coube. */
  conversoes: string[];
}

const NOMES_ATRIBUTO: Record<string, string> = {
  riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados",
  controle: "Controle", stability: "Estabilidade",
};

/**
 * Aplica o ganho da carta, convertendo o que não couber em vez de descartar.
 *
 * Antes, um ganho que batia no teto sumia num clamp silencioso: a Casa do Ouro,
 * com Riqueza 5, concluía um projeto de cinco turnos e não recebia nada. Como o
 * Mestre tirou o portão de aprovação do +2, esta cascata passou a ser o freio de
 * inflação do jogo: quem chega ao teto para de crescer em número e passa a
 * crescer em ativo nomeado, que é onde o Mestre tem controle narrativo.
 *
 * A ordem é atributo, depois estabilidade, depois ativo. O ativo não tem teto,
 * então sempre sobra para onde ir e nenhuma conclusão termina em nada.
 */
export function applyCompletion(house: House, project: ProjectCard): CompletionResult {
  const attrs: Attributes = { ...house.attributes };
  let stability = houseStability(house);
  const conversoes: string[] = [];
  const assetsAdded = [...project.completionEffects.assets];

  for (const ch of project.completionEffects.attributeChanges) {
    if (!ch.permanent) continue;

    if (ch.attribute === "stability") {
      stability = clamp(stability + ch.amount, STABILITY_MIN, STABILITY_MAX);
      continue;
    }

    const antes = attrs[ch.attribute];
    attrs[ch.attribute] = clamp(antes + ch.amount, ATTR_MIN, ATTR_MAX);
    let sobra = ch.amount - (attrs[ch.attribute] - antes);
    if (sobra <= 0) continue;

    const nome = NOMES_ATRIBUTO[ch.attribute] ?? ch.attribute;
    const estAntes = stability;
    stability = clamp(stability + sobra, STABILITY_MIN, STABILITY_MAX);
    const absorvido = stability - estAntes;
    sobra -= absorvido;

    if (absorvido > 0) {
      conversoes.push(`${nome} já estava no teto: ${absorvido} ponto${absorvido > 1 ? "s" : ""} virou Estabilidade.`);
    }
    if (sobra > 0) {
      assetsAdded.push(project.title);
      conversoes.push(`${nome} e Estabilidade já estavam no teto: o ganho virou o ativo '${project.title}'.`);
    }
  }

  const assets = [...(house.assets ?? []), ...assetsAdded];
  return {
    house: { ...house, attributes: attrs, stability, assets },
    favorsToCreate: project.completionEffects.favors,
    assetsAdded,
    conversoes,
  };
}

export interface ProcessResult {
  project: ProjectCard;
  justCompleted: boolean;
}

/**
 * Avança a carta `passos` turnos. O padrão de 1 mantém quem chama sem saber da
 * Energia — inclusive os testes antigos — no comportamento de sempre.
 *
 * Com `passos` em zero a carta não é tocada, nem marcada como processada: é o
 * caso de quem não recebeu Energia neste turno e fica esperando, sem penalidade.
 */
export function processProjectForTurn(project: ProjectCard, turnId: number, passos = 1): ProcessResult {
  if (project.lastProcessedTurnId === turnId) return { project, justCompleted: false };
  if (passos <= 0) return { project, justCompleted: false };
  const turnsCompleted = Math.min(project.turnsCompleted + passos, project.durationTurns);
  const completed = turnsCompleted >= project.durationTurns;
  // Status/outcome on completion is decided by the backend after the AI verdict.
  const next: ProjectCard = {
    ...project,
    turnsCompleted,
    lastProcessedTurnId: turnId,
    updatedAt: new Date().toISOString(),
  };
  return { project: next, justCompleted: completed };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
