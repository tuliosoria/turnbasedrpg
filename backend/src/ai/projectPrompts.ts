import { isProjectCategory, PROJECT_COST_TYPES } from "@ravenloft/content";
import type { House, ProjectCategory, ProjectCost, CompletionEffects, AttributeChange, CustomProjectInput, EnhanceCardInput } from "@ravenloft/content";
import { HttpError } from "../types/domain";

export interface ProjectProposal {
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  risks: string[];
  complications: string[];
  completionEffects: CompletionEffects;
  targetHouseId: string | null;
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
}

const SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria ("O Inverno dos Mortos").
Sua função é transformar o pedido livre de um jogador em uma "carta de projeto" equilibrada, usando SOMENTE o cânone público fornecido (nunca invente segredos do mestre).
Regras de balanceamento:
- 1 turno: efeito pequeno/temporário, custo 0-1.
- 2 turnos: um Favor, vantagem temporária ou ativo pequeno, custo ~1.
- 3 turnos: unidade/rota/rede/acordo, custo 1-2.
- 4 turnos: ativo permanente ou +1 atributo, custo 2-3.
- 5 turnos: +1 permanente em atributo ou transformação, custo 3-4.
- 6+ turnos: projeto épico, altos custos e aprovação do mestre.
- Nenhuma carta comum concede mais de +1 permanente num atributo, e um aumento de atributo exige >= 4 turnos.
- Cartas que envolvem outra Casa controlada por jogador exigem requiresTargetApproval e NUNCA garantem a cooperação dela.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem requiresGmApproval.
Responda SOMENTE com JSON no formato pedido.`;

export function buildProjectCardPrompt(house: House, publicCanon: string, input: CustomProjectInput): { system: string; user: string } {
  const attrs = house.attributes;
  const user = [
    `Casa: ${house.name} (líder ${house.leaderName}, castelo ${house.castleName}).`,
    `Atributos — Riqueza ${attrs.riqueza}, Recursos ${attrs.recursos}, Soldados ${attrs.soldados}, Controle ${attrs.controle}, Estabilidade ${house.stability ?? 3}.`,
    `Pedido do jogador: ${input.request}`,
    input.targetHouseId ? `Casa/região alvo: ${input.targetHouseId}` : "",
    input.desiredOutcome ? `Resultado desejado: ${input.desiredOutcome}` : "",
    typeof input.maxSpend === "number" ? `Gasto máximo aceitável: ${input.maxSpend}` : "",
    input.riskLevel ? `Nível de risco desejado: ${input.riskLevel}` : "",
    "",
    "Cânone público de Valdren:",
    publicCanon || "(nenhum)",
    "",
    'Responda com JSON: { "title", "description", "publicDescription", "category", "durationTurns", "costs":[{"type","amount","timing"}], "requirements":[], "risks":[], "complications":[], "completionEffects":{"attributeChanges":[{"attribute","amount","permanent"}],"favors":[{"targetHouseId","amount","requiresAcceptance"}],"assets":[],"qualitativeEffects":[],"unlocks":[]}, "targetHouseId", "requiresTargetApproval", "requiresGmApproval", "aiBalanceStatus", "aiBalanceExplanation" }',
  ].filter(Boolean).join("\n");
  return { system: SYSTEM, user };
}

const ENHANCE_SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria ("O Inverno dos Mortos").
O jogador ESCREVEU o texto da própria carta. Sua tarefa é APRIMORAR essa carta, não reescrevê-la.
Regras de preservação do texto:
- PRESERVE as palavras, o tom e a intenção do jogador. Não invente uma história diferente nem troque o objetivo.
- Você SÓ pode corrigir gramática, ortografia e clareza. Faça o mínimo de mudanças possível no texto.
- Os campos "title" e "description" devem conter o texto do jogador apenas com esses pequenos ajustes de gramática/clareza.
- Nunca invente segredos do mestre; use SOMENTE o cânone público fornecido.
Sua contribuição real é ADICIONAR as regras mecânicas coerentes com o texto: categoria, duração, custos, requisitos, riscos, complicações e efeitos de conclusão.
Regras de balanceamento:
- 1 turno: efeito pequeno/temporário, custo 0-1.
- 2 turnos: um Favor, vantagem temporária ou ativo pequeno, custo ~1.
- 3 turnos: unidade/rota/rede/acordo, custo 1-2.
- 4 turnos: ativo permanente ou +1 atributo, custo 2-3.
- 5 turnos: +1 permanente em atributo ou transformação, custo 3-4.
- 6+ turnos: projeto épico, altos custos e aprovação do mestre.
- Nenhuma carta comum concede mais de +1 permanente num atributo, e um aumento de atributo exige >= 4 turnos.
- Cartas que envolvem outra Casa controlada por jogador exigem requiresTargetApproval e NUNCA garantem a cooperação dela.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem requiresGmApproval.
Responda SOMENTE com JSON no formato pedido.`;

export function buildEnhanceCardPrompt(house: House, publicCanon: string, input: EnhanceCardInput): { system: string; user: string } {
  const attrs = house.attributes;
  const user = [
    `Casa: ${house.name} (líder ${house.leaderName}, castelo ${house.castleName}).`,
    `Atributos — Riqueza ${attrs.riqueza}, Recursos ${attrs.recursos}, Soldados ${attrs.soldados}, Controle ${attrs.controle}, Estabilidade ${house.stability ?? 3}.`,
    input.targetHouseId ? `Casa/região alvo: ${input.targetHouseId}` : "",
    "",
    "Título escrito pelo jogador:",
    input.title,
    "",
    "Texto escrito pelo jogador (preserve-o, só corrija gramática/clareza):",
    input.body,
    "",
    "Cânone público de Valdren:",
    publicCanon || "(nenhum)",
    "",
    'Responda com JSON: { "title", "description", "publicDescription", "category", "durationTurns", "costs":[{"type","amount","timing"}], "requirements":[], "risks":[], "complications":[], "completionEffects":{"attributeChanges":[{"attribute","amount","permanent"}],"favors":[{"targetHouseId","amount","requiresAcceptance"}],"assets":[],"qualitativeEffects":[],"unlocks":[]}, "targetHouseId", "requiresTargetApproval", "requiresGmApproval", "aiBalanceStatus", "aiBalanceExplanation" }. Lembre: "title" e "description" devem ser o texto do jogador com apenas pequenos ajustes de gramática/clareza.',
  ].filter(Boolean).join("\n");
  return { system: ENHANCE_SYSTEM, user };
}

function fail(): never {
  throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function parseCosts(v: unknown): ProjectCost[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => {
    const o = c as Record<string, unknown>;
    if (!(PROJECT_COST_TYPES as readonly string[]).includes(o.type as string)) fail();
    if (typeof o.amount !== "number") fail();
    // The rules engine only charges ON_START costs, so normalize all AI-proposed
    // cost timings to ON_START to guarantee resources are actually spent.
    return { type: o.type as ProjectCost["type"], amount: o.amount, timing: "ON_START" as const };
  });
}

function parseEffects(v: unknown): CompletionEffects {
  const o = (v ?? {}) as Record<string, unknown>;
  const changes: AttributeChange[] = Array.isArray(o.attributeChanges)
    ? o.attributeChanges.map((c) => {
        const x = c as Record<string, unknown>;
        const allowed = ["riqueza", "recursos", "soldados", "controle", "stability"];
        if (!allowed.includes(x.attribute as string)) fail();
        if (typeof x.amount !== "number") fail();
        return { attribute: x.attribute as AttributeChange["attribute"], amount: x.amount, permanent: x.permanent === true };
      })
    : [];
  const favors = Array.isArray(o.favors)
    ? o.favors.map((f) => {
        const x = f as Record<string, unknown>;
        return { targetHouseId: String(x.targetHouseId ?? ""), amount: typeof x.amount === "number" ? x.amount : 1, requiresAcceptance: x.requiresAcceptance !== false };
      })
    : [];
  return { attributeChanges: changes, favors, assets: strArr(o.assets), qualitativeEffects: strArr(o.qualitativeEffects), unlocks: strArr(o.unlocks) };
}

export function parseProjectCardProposal(raw: string): ProjectProposal {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { fail(); }
  const o = obj as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title) fail();
  if (!isProjectCategory(o.category as string)) fail();
  if (typeof o.durationTurns !== "number" || o.durationTurns < 1) fail();
  const status = o.aiBalanceStatus;
  const okStatus = status === "BALANCED" || status === "STRONG" || status === "WEAK" || status === "NEEDS_GM_REVIEW" || status === null || status === undefined;
  if (!okStatus) fail();
  return {
    title: o.title,
    description: typeof o.description === "string" ? o.description : "",
    publicDescription: typeof o.publicDescription === "string" ? o.publicDescription : "",
    category: o.category as ProjectCategory,
    durationTurns: Math.round(o.durationTurns),
    costs: parseCosts(o.costs),
    requirements: strArr(o.requirements),
    risks: strArr(o.risks),
    complications: strArr(o.complications),
    completionEffects: parseEffects(o.completionEffects),
    targetHouseId: typeof o.targetHouseId === "string" ? o.targetHouseId : null,
    requiresTargetApproval: o.requiresTargetApproval === true,
    requiresGmApproval: o.requiresGmApproval === true,
    aiBalanceStatus: (status as ProjectProposal["aiBalanceStatus"]) ?? null,
    aiBalanceExplanation: typeof o.aiBalanceExplanation === "string" ? o.aiBalanceExplanation : null,
  };
}

export function enforceGmTriggers(p: ProjectProposal): ProjectProposal {
  let requiresGmApproval = p.requiresGmApproval;
  const maxPermanent = p.completionEffects.attributeChanges
    .filter((c) => c.permanent)
    .reduce((m, c) => Math.max(m, c.amount), 0);
  if (maxPermanent > 1) requiresGmApproval = true;
  if (p.durationTurns > 6) requiresGmApproval = true;
  const favorWithoutCost = p.completionEffects.favors.length > 0 && p.costs.length === 0;
  if (favorWithoutCost) requiresGmApproval = true;
  return { ...p, requiresGmApproval };
}
