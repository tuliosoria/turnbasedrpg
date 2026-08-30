import { isProjectCategory, PROJECT_COST_TYPES, CARD_TITLE_MAX, CARD_DESCRIPTION_MAX, clampText, TABELA_DE_TROCA } from "@ravenloft/content";
import type { House, ProjectCategory, ProjectCost, CompletionEffects, AttributeChange, CustomProjectInput, EnhanceCardInput, ProjectCard } from "@ravenloft/content";
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

/**
 * A regra de troca escrita para a IA, gerada da tabela de `@ravenloft/content`.
 * Antes havia três cópias em prosa neste arquivo, e a terceira contradizia as
 * outras duas sobre quantos turnos um ganho de atributo exige. Agora a regra
 * muda num lugar só, e o prompt acompanha.
 */
const MAX_PERMANENTE = Math.max(...TABELA_DE_TROCA.map((f) => f.atributoPermanenteMax));
const MIN_TURNOS_PARA_ATRIBUTO = TABELA_DE_TROCA.find((f) => f.atributoPermanenteMax > 0)?.turnos ?? 3;

const REGRAS_DE_BALANCEAMENTO = [
  "Regras de balanceamento:",
  ...TABELA_DE_TROCA.map(
    (f) => `- ${f.turnos} turno${f.turnos > 1 ? "s" : ""}: ${f.resumo}, custo ${f.custoMin}-${f.custoMax}.`,
  ),
  `- Nenhuma carta concede mais de +${MAX_PERMANENTE} permanente num atributo, e um aumento de atributo exige >= ${MIN_TURNOS_PARA_ATRIBUTO} turnos.`,
  "- TODA carta precisa conceder alguma coisa em completionEffects: atributo, Estabilidade, ativo nomeado, Favor ou desbloqueio de outra carta. Uma carta que só promete narrativa não é uma carta.",
  "- Efeitos temporários não são aplicados pelo motor. Não prometa nenhum: use permanent: true ou pague em ativo nomeado.",
].join("\n");

const SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria.
Sua função é transformar o pedido livre de um jogador em uma "carta de projeto" equilibrada, usando SOMENTE o cânone público fornecido (nunca invente segredos do mestre).
${REGRAS_DE_BALANCEAMENTO}
- Cartas que envolvem outra Casa controlada por jogador exigem requiresTargetApproval e NUNCA garantem a cooperação dela.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem requiresGmApproval.
- SEMPRE escreva pelo menos um risco concreto em "risks": uma condição plausível pela qual o projeto pode FRACASSAR (cerco, sabotagem, falta de mão de obra, traição, clima, revolta). Esses riscos serão usados para julgar, ao final, se o projeto deu certo ou não.
Responda SOMENTE com JSON no formato pedido.`;

const ENUM_GUIDE = `Valores permitidos (use EXATAMENTE estes códigos em inglês):
- category: MILITARY (militar), INFRASTRUCTURE (infraestrutura), ECONOMY (economia), DIPLOMACY (diplomacia), INTELLIGENCE (espionagem), SOCIETY (sociedade), MAGIC (magia), EXPLORATION (exploração).
- costs[].type: WEALTH (riqueza), RESOURCES (recursos), SOLDIERS_COMMITTED (soldados), CONTROL_COMMITTED (controle), STABILITY (estabilidade), FAVOR (favor), CUSTOM (especial).
- costs[].timing: sempre "ON_START".
- completionEffects.attributeChanges[].attribute: riqueza, recursos, soldados, controle, stability.
- aiBalanceStatus: BALANCED, STRONG, WEAK ou NEEDS_GM_REVIEW.`;

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
    ENUM_GUIDE,
    "",
    'Responda com JSON: { "title", "description", "publicDescription", "category", "durationTurns", "costs":[{"type","amount","timing"}], "requirements":[], "risks":[], "complications":[], "completionEffects":{"attributeChanges":[{"attribute","amount","permanent"}],"favors":[{"targetHouseId","amount","requiresAcceptance"}],"assets":[],"qualitativeEffects":[],"unlocks":[]}, "targetHouseId", "requiresTargetApproval", "requiresGmApproval", "aiBalanceStatus", "aiBalanceExplanation" }',
  ].filter(Boolean).join("\n");
  return { system: SYSTEM, user };
}

const ENHANCE_SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria.
O jogador ESCREVEU um rascunho da própria carta. Sua tarefa é APRIMORAR o título e a descrição.
Regras de refinamento do texto:
- MANTENHA a intenção, o objetivo e os fatos do jogador. Não invente uma história diferente nem troque o que ele quer realizar.
- REFINE o título e a descrição: corrija gramática e ortografia, melhore a clareza, o tom e o impacto, e deixe o texto mais evocativo e coeso, coerente com o mundo de Valdren.
- O título ("title") deve ter no MÁXIMO ${CARD_TITLE_MAX} caracteres, ser conciso e chamativo.
- A descrição ("description") deve ter no MÁXIMO ${CARD_DESCRIPTION_MAX} caracteres, em 1 a 3 frases claras.
- Nunca invente segredos do mestre; use SOMENTE o cânone público fornecido.
Sua contribuição também inclui ADICIONAR as regras mecânicas coerentes com o texto: categoria, duração, custos, requisitos, riscos, complicações e efeitos de conclusão.
${REGRAS_DE_BALANCEAMENTO}
- Cartas que envolvem outra Casa controlada por jogador exigem requiresTargetApproval e NUNCA garantem a cooperação dela.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem requiresGmApproval.
- SEMPRE escreva pelo menos um risco concreto em "risks": uma condição plausível pela qual o projeto pode FRACASSAR. Esses riscos serão usados para julgar, ao final, se o projeto deu certo ou não.
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
    ENUM_GUIDE,
    "",
    'Responda com JSON: { "title", "description", "publicDescription", "category", "durationTurns", "costs":[{"type","amount","timing"}], "requirements":[], "risks":[], "complications":[], "completionEffects":{"attributeChanges":[{"attribute","amount","permanent"}],"favors":[{"targetHouseId","amount","requiresAcceptance"}],"assets":[],"qualitativeEffects":[],"unlocks":[]}, "targetHouseId", "requiresTargetApproval", "requiresGmApproval", "aiBalanceStatus", "aiBalanceExplanation" }. Lembre: refine o "title" (máx. ' + CARD_TITLE_MAX + ' caracteres) e a "description" (máx. ' + CARD_DESCRIPTION_MAX + ' caracteres) mantendo a intenção do jogador.',
  ].filter(Boolean).join("\n");
  return { system: ENHANCE_SYSTEM, user };
}

function fail(): never {
  throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
}

export const PROJECT_MECHANICS_CANON = `MECÂNICA — PROJETOS DA CASA (regras canônicas):
- A cada turno, além de responder ao evento público, a Casa pode manter uma atividade contínua (projeto) que avança automaticamente ao fim de cada turno até concluir, ser interrompida ou cancelada.
- Cada Casa tem 1 espaço de projeto ativo; Casas com Controle 4 ou 5 podem manter 2 projetos simultâneos.
- Custos podem ser em Riqueza, Recursos, Estabilidade; Soldados/Controle podem ser comprometidos temporariamente. Nenhum atributo permanente passa de 5.
- Duração de 1 a 5 turnos, e a duração é o que define o tamanho da recompensa. ${TABELA_DE_TROCA.map((f) => `${f.turnos}: ${f.resumo}`).join("; ")}.
- Cancelar um projeto perde os custos já investidos. Eventos públicos (cerco, revolta) podem atrasar ou suspender projetos.
- Favores são dívidas políticas: exigem que a outra Casa aceite; a IA nunca decide por uma Casa de jogador nem garante sua cooperação.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem aprovação do mestre.`;

// Sections that give the AI enough world grounding to write a coherent card
// without dumping the entire (very large) encyclopedia into every prompt.
const CANON_SECTIONS = ["visao-geral", "crise-atual", "brumas", "geografia", "governo", "povos", "religioes", "magia", "cidades", "casas"] as const;
const PER_SECTION_CHARS = 800;
const CANON_BUDGET_CHARS = 6000;

export function buildProjectCanon(entries: { section: string; title: string; body: string }[]): string {
  const parts: string[] = [PROJECT_MECHANICS_CANON, "", "CÂNONE PÚBLICO DE VALDREN:"];
  let used = 0;
  for (const section of CANON_SECTIONS) {
    for (const e of entries.filter((x) => x.section === section)) {
      if (used >= CANON_BUDGET_CHARS) break;
      const body = e.body.length > PER_SECTION_CHARS ? `${e.body.slice(0, PER_SECTION_CHARS)}…` : e.body;
      const block = `## ${e.title}\n${body}`;
      parts.push(block);
      used += block.length;
    }
    if (used >= CANON_BUDGET_CHARS) break;
  }
  return parts.join("\n\n");
}

function deburr(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const CATEGORY_ALIASES: Record<string, ProjectCategory> = {
  military: "MILITARY", militar: "MILITARY",
  infrastructure: "INFRASTRUCTURE", infraestrutura: "INFRASTRUCTURE",
  economy: "ECONOMY", economia: "ECONOMY",
  diplomacy: "DIPLOMACY", diplomacia: "DIPLOMACY",
  intelligence: "INTELLIGENCE", espionagem: "INTELLIGENCE", informacao: "INTELLIGENCE", inteligencia: "INTELLIGENCE",
  society: "SOCIETY", sociedade: "SOCIETY", social: "SOCIETY",
  magic: "MAGIC", magia: "MAGIC",
  exploration: "EXPLORATION", exploracao: "EXPLORATION",
};

const COST_ALIASES: Record<string, ProjectCost["type"]> = {
  wealth: "WEALTH", riqueza: "WEALTH",
  resources: "RESOURCES", recursos: "RESOURCES", recurso: "RESOURCES",
  soldiers_committed: "SOLDIERS_COMMITTED", soldiers: "SOLDIERS_COMMITTED", soldados: "SOLDIERS_COMMITTED",
  control_committed: "CONTROL_COMMITTED", control: "CONTROL_COMMITTED", controle: "CONTROL_COMMITTED",
  stability: "STABILITY", estabilidade: "STABILITY",
  favor: "FAVOR", favores: "FAVOR",
  custom: "CUSTOM", especial: "CUSTOM", personalizado: "CUSTOM",
};

const ATTR_ALIASES: Record<string, AttributeChange["attribute"]> = {
  riqueza: "riqueza", wealth: "riqueza",
  recursos: "recursos", resources: "recursos", recurso: "recursos",
  soldados: "soldados", soldiers: "soldados",
  controle: "controle", control: "controle",
  stability: "stability", estabilidade: "stability",
};

function normalizeCategory(v: unknown): ProjectCategory | null {
  if (typeof v !== "string") return null;
  if (isProjectCategory(v)) return v;
  return CATEGORY_ALIASES[deburr(v)] ?? null;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function parseCosts(v: unknown): ProjectCost[] {
  if (!Array.isArray(v)) return [];
  const out: ProjectCost[] = [];
  for (const c of v) {
    const o = c as Record<string, unknown>;
    if (typeof o.amount !== "number") continue;
    const type = typeof o.type === "string"
      ? ((PROJECT_COST_TYPES as readonly string[]).includes(o.type) ? o.type as ProjectCost["type"] : COST_ALIASES[deburr(o.type)])
      : undefined;
    if (!type) continue;
    // The rules engine only charges ON_START costs, so normalize all AI-proposed
    // cost timings to ON_START to guarantee resources are actually spent.
    out.push({ type, amount: o.amount, timing: "ON_START" as const });
  }
  return out;
}

function parseEffects(v: unknown): CompletionEffects {
  const o = (v ?? {}) as Record<string, unknown>;
  const changes: AttributeChange[] = Array.isArray(o.attributeChanges)
    ? o.attributeChanges.reduce<AttributeChange[]>((acc, c) => {
        const x = c as Record<string, unknown>;
        const attribute = typeof x.attribute === "string" ? ATTR_ALIASES[deburr(x.attribute)] : undefined;
        if (attribute && typeof x.amount === "number") {
          acc.push({ attribute, amount: x.amount, permanent: x.permanent === true });
        }
        return acc;
      }, [])
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
  const category = normalizeCategory(o.category);
  if (!category) fail();
  if (typeof o.durationTurns !== "number" || o.durationTurns < 1) fail();
  const status = o.aiBalanceStatus;
  const okStatus = status === "BALANCED" || status === "STRONG" || status === "WEAK" || status === "NEEDS_GM_REVIEW" || status === null || status === undefined;
  if (!okStatus) fail();
  return {
    title: o.title,
    description: typeof o.description === "string" ? o.description : "",
    publicDescription: typeof o.publicDescription === "string" ? o.publicDescription : "",
    category,
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
  // O Mestre liberou o +2 sem portão de aprovação (decisão 1 da spec). Só o que
  // estoura a tabela ainda desce para a mesa dele.
  if (maxPermanent > MAX_PERMANENTE) requiresGmApproval = true;
  if (p.durationTurns > 6) requiresGmApproval = true;
  const favorWithoutCost = p.completionEffects.favors.length > 0 && p.costs.length === 0;
  if (favorWithoutCost) requiresGmApproval = true;
  return { ...p, requiresGmApproval };
}

export interface ProjectResolution {
  success: boolean;
  /**
   * Entregou, mas cobrou um preço.
   *
   * O desfecho era binário, e num sistema binário sob um prompt hostil a
   * gravidade puxa sempre para a perda: três turnos de investimento viravam pó.
   * O meio-termo é o que a maioria dos turnos deveria produzir.
   */
  custo: boolean;
  /** Qual risco declarado se concretizou. Null quando não houve fracasso. */
  riscoAtivado: string | null;
  narrative: string;
}

const RESOLUTION_SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria.
Um projeto de uma Casa chegou ao fim de sua duração. Sua tarefa é decidir COMO ele terminou.

Três desfechos possíveis:
- "sucesso": o projeto entrega o que prometia. Este é o desfecho NORMAL.
- "custo": entrega, mas cobra um preço — atraso, dinheiro a mais, gente perdida, um favor devido, uma promessa quebrada com terceiros.
- "fracasso": não entrega. É o desfecho RARO e tem uma condição obrigatória.

A CONDIÇÃO DO FRACASSO: só existe fracasso quando um RISCO DECLARADO NA CARTA se concretizou, e você precisa dizer qual, copiando o texto do risco no campo "riscoAtivado". Se a carta não declara risco nenhum, ela NÃO PODE fracassar — o pior desfecho possível para ela é "custo". Isto é conferido automaticamente; um fracasso sem risco correspondente é rebaixado.

O QUE NÃO É MOTIVO DE FRACASSO: o estado geral do reino. Valdren vive em crise permanente — há guerra, luto, tributo, eclipse anunciado e cidade em chamas o tempo todo, e isso é o pano de fundo de TODOS os turnos. Uma Casa que trabalha em meio ao caos é o normal desta campanha, não uma anomalia. Atributos baixos também não bastam: eles limitam a ESCALA do que se entrega, não a possibilidade de entregar.

Como julgar:
- Comece supondo sucesso.
- Se um risco declarado tinha razão clara para se concretizar neste turno, considere fracasso e NOMEIE o risco.
- Se o projeto era ambicioso para os atributos da Casa, prefira "custo" a fracasso: ele entrega menor, mais tarde ou mais caro.
- Use SOMENTE o cânone público fornecido; nunca invente segredos do mestre.

Escreva uma "narrative" curta (1 a 3 frases) em português, no tom sombrio de Valdren, dizendo o que aconteceu. Se houve custo, diga qual foi.
Responda SOMENTE com JSON: { "desfecho": "sucesso"|"custo"|"fracasso", "riscoAtivado": string|null, "narrative": string }.`;

export function buildProjectResolutionPrompt(house: House, project: ProjectCard, campaignEvent: string, publicCanon: string): { system: string; user: string } {
  const attrs = house.attributes;
  const risks = (project.risks && project.risks.length ? project.risks : ["(nenhum risco declarado)"]).map((r) => `- ${r}`).join("\n");
  const user = [
    `Casa: ${house.name} (líder ${house.leaderName}).`,
    `Atributos — Riqueza ${attrs.riqueza}, Recursos ${attrs.recursos}, Soldados ${attrs.soldados}, Controle ${attrs.controle}, Estabilidade ${house.stability ?? 3}.`,
    "",
    `Projeto concluído: ${project.title} (duração ${project.durationTurns} turnos).`,
    `Descrição: ${project.description}`,
    "Riscos declarados na carta:",
    risks,
    "",
    "Evento público recente da campanha:",
    campaignEvent || "(sem evento relevante)",
    "",
    "Cânone público de Valdren:",
    publicCanon || "(nenhum)",
    "",
    'Responda com JSON: { "success": boolean, "narrative": string }',
  ].join("\n");
  return { system: RESOLUTION_SYSTEM, user };
}

/**
 * O JSON do árbitro vira desfecho, e o fracasso precisa provar que pode existir.
 *
 * Cinco cartas fracassaram seguidas e nenhuma narrativa citou um risco da
 * própria carta: todas citaram o resultado público do turno — porto em chamas,
 * eclipse anunciado, edito da Coroa. Como o resultado público desta campanha é
 * sempre catastrófico, o juiz reprovava tudo, para sempre. Duas delas chegaram
 * a usar a AUSÊNCIA de riscos declarados como motivo, que é o contrário do que
 * uma lista vazia significa.
 *
 * Por isso a checagem é aqui, em código: um fracasso que não aponta para um
 * risco declarado na carta vira "custo". O modelo pode narrar o que quiser; não
 * pode reprovar sem mostrar de onde veio a reprovação.
 */
const DESFECHOS = new Set(["sucesso", "custo", "fracasso"]);

export function parseProjectResolution(raw: string, risks: readonly string[] = []): ProjectResolution {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    fail();
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) fail();
  const o = obj as Record<string, unknown>;

  const narrative = typeof o.narrative === "string" ? clampText(o.narrative, 600) : "";
  const bruto = typeof o.desfecho === "string" ? o.desfecho.toLowerCase() : "";
  // Resposta sem desfecho reconhecível é resposta malformada, e precisa
  // continuar sendo detectada: um JSON que só traz narrativa não é um veredito.
  if (!DESFECHOS.has(bruto) && typeof o.success !== "boolean") fail();
  // O formato antigo mandava `success: boolean`. Continua entrando.
  const desfecho = DESFECHOS.has(bruto) ? bruto : o.success === false ? "fracasso" : "sucesso";

  if (desfecho === "fracasso") {
    const apontado = typeof o.riscoAtivado === "string" ? o.riscoAtivado.trim() : "";
    const combina = apontado.length > 0 && risks.some((r) => mesmoRisco(r, apontado));
    if (!combina) {
      return { success: true, custo: true, narrative, riscoAtivado: null };
    }
    return { success: false, custo: false, narrative, riscoAtivado: apontado };
  }

  return { success: true, custo: desfecho === "custo", narrative, riscoAtivado: null };
}

/**
 * O risco apontado é um dos declarados?
 *
 * Compara por conteúdo, não por igualdade: o modelo reescreve pontuação e
 * maiúsculas ao copiar, e reprovar por isso transformaria um fracasso legítimo
 * em custo. O que precisa bater é a substância.
 */
function mesmoRisco(declarado: string, apontado: string): boolean {
  const limpar = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = limpar(declarado), b = limpar(apontado);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}
