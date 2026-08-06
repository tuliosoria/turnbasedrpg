import type { House } from "./types.js";
import type { ProjectTemplate } from "./projects.js";
import { getTemplate } from "./projectTemplates.js";

const STARTER_LIMIT = 8;

// Curated signature cards per theme, in priority order.
const MILITARY = ["construir-um-arsenal-regional", "fundar-uma-academia-de-oficiais", "formar-uma-guarda-de-elite", "recrutar-companhias-errantes"];
const INFRASTRUCTURE = ["construir-um-aqueduto", "construir-oficinas-reais", "construir-uma-ponte-fortificada", "restaurar-uma-estrada-real"];
const ECONOMY = ["abrir-uma-nova-mina", "criar-um-mercado-regional", "estabelecer-uma-rota-de-caravanas"];
const NAVAL = ["fundar-um-estaleiro", "expandir-o-porto", "expandir-a-frota"];
const SOCIETY = ["fundar-um-hospital", "distribuir-alimentos", "reformar-a-justica-local"];
const DIPLOMACY = ["criar-um-tratado-comercial", "realizar-um-grande-banquete", "enviar-uma-delegacao-permanente"];
const INTELLIGENCE = ["estabelecer-uma-rede-de-informantes", "infiltrar-um-agente", "mapear-rotas-secretas"];
const ARCANE = ["investigar-uma-alteracao-nas-brumas", "pesquisar-um-artefato", "enviar-uma-expedicao-as-ruinas"];
const WAR_ANIMALS = ["domesticar-animais-de-guerra"];

// Universally useful cards every House can benefit from.
const UNIVERSAL = ["realizar-um-festival-popular", "criar-uma-rede-de-batedores", "enviar-um-presente-cerimonial"];

interface KeywordRule {
  match: RegExp;
  cards: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  { match: /forj|ferr|arma|metal|aco|espada|escudo/, cards: [...MILITARY, ...ECONOMY] },
  { match: /mine|mina|minerio|jazida|tunel/, cards: [...ECONOMY, ...INFRASTRUCTURE] },
  { match: /engenh|constru|arquitet|edific/, cards: INFRASTRUCTURE },
  { match: /na+veg|porto|maritim|barco|frota|naval|litoral|estaleir|mar\b/, cards: [...NAVAL, ...INFRASTRUCTURE] },
  { match: /remedi|medic|cura|saude|hospital|ervas/, cards: SOCIETY },
  { match: /montari|animal|animais|cavalo|besta/, cards: [...WAR_ANIMALS, ...MILITARY] },
  { match: /ceramic|vidro|madeira|artesan|oficina|manufat/, cards: [...INFRASTRUCTURE, ...ECONOMY] },
  { match: /comerci|mercado|ouro|riqueza|caravana|banco|banqueir/, cards: [...ECONOMY, ...DIPLOMACY] },
  { match: /magia|arcano|bruma|ritual|mistic|mago|feiti/, cards: ARCANE },
  { match: /espi|informa|segred|intriga|batedor/, cards: INTELLIGENCE },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function attributeCards(house: House): string[] {
  const a = house.attributes;
  const ranked: Array<[keyof typeof a, string[]]> = [
    ["soldados", MILITARY],
    ["riqueza", [...ECONOMY, ...DIPLOMACY]],
    ["recursos", INFRASTRUCTURE],
    ["controle", [...SOCIETY, ...INTELLIGENCE]],
  ];
  const top = ranked
    .slice()
    .sort((x, y) => a[y[0]] - a[x[0]])[0];
  return top ? top[1] : [];
}

/**
 * Recommends a themed starter set of project cards for a House, based on its
 * specialty text and attribute strengths. Always returns valid templates and
 * includes a few universally useful cards. Deterministic and pure.
 */
export function recommendStarterCards(house: House): ProjectTemplate[] {
  const spec = normalize(house.specialty ?? "");
  const ordered: string[] = [];

  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(spec)) ordered.push(...rule.cards);
  }
  ordered.push(...attributeCards(house));
  ordered.push(...UNIVERSAL);

  const seen = new Set<string>();
  const result: ProjectTemplate[] = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    const template = getTemplate(id);
    if (!template) continue;
    seen.add(id);
    result.push(template);
    if (result.length >= STARTER_LIMIT) break;
  }
  return result;
}
