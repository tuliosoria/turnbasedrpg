/**
 * Como uma Casa se relaciona com outra: amizade, comércio e favores.
 *
 * É direcional de propósito. "A Casa do Ouro confia em Khazdrun" e "Khazdrun
 * confia na Casa do Ouro" são afirmações diferentes, e é justamente essa
 * assimetria que gera política — alguém corteja, alguém desconfia, e os dois
 * seguem negociando porque precisam.
 *
 * Guardamos um número de 0 a 100 e mostramos um rótulo. Assim o Mestre pode dar
 * "+10 por apoiar na votação" sem que a relação salte de ruim para boa de uma
 * vez, o que soaria falso na mesa.
 *
 * O par que o Mestre nunca tocou não existe no banco: vale o padrão, médio.
 * Dezesseis potências dariam 240 pares, e ninguém preenche isso à mão.
 */
export type RelationLevel = "RUIM" | "MEDIO" | "BOM";

export interface HouseRelation {
  /** Quem sente. */
  fromKey: string;
  /** Sobre quem. */
  toKey: string;
  /** Confiança política: apoio em votações, palavra cumprida, traições. */
  amizade: number;
  /** Fluxo de bens e crédito: rotas abertas, embargos, acordos de abastecimento. */
  comercio: number;
  /**
   * Se a troca de favores funciona: pedidos atendidos, dívidas honradas. Alto é
   * sempre bom nos três eixos — quem deve o quê em números segue no razão de
   * Favor, que é outra coisa.
   */
  favores: number;
  /** Por que está assim — o Mestre escreve, e a IA lê ao responder. */
  note: string;
  updatedAt: string;
}

export const RELATION_DEFAULT = 50;
export const RELATION_MIN = 0;
export const RELATION_MAX = 100;

export const RELATION_AXES = ["amizade", "comercio", "favores"] as const;
export type RelationAxis = (typeof RELATION_AXES)[number];

export const RELATION_AXIS_LABELS: Record<RelationAxis, string> = {
  amizade: "Amizade",
  comercio: "Comércio",
  favores: "Favores",
};

export const RELATION_LEVEL_LABELS: Record<RelationLevel, string> = {
  RUIM: "ruim",
  MEDIO: "médio",
  BOM: "bom",
};

/** O rótulo que o jogador lê. As faixas são largas para o meio não sumir. */
export function levelOf(value: number): RelationLevel {
  if (value <= 33) return "RUIM";
  if (value <= 66) return "MEDIO";
  return "BOM";
}

export function clampRelationValue(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : RELATION_DEFAULT;
  return Math.max(RELATION_MIN, Math.min(RELATION_MAX, n));
}

/** O par que ninguém tocou: médio em tudo, sem nota. */
export function emptyHouseRelation(fromKey: string, toKey: string): HouseRelation {
  return {
    fromKey,
    toKey,
    amizade: RELATION_DEFAULT,
    comercio: RELATION_DEFAULT,
    favores: RELATION_DEFAULT,
    note: "",
    updatedAt: "",
  };
}

/**
 * Uma frase pronta para o prompt e para a tela: "amizade boa, comércio médio…".
 * "Amizade" é feminino e "comércio" masculino, então o rótulo concorda com o
 * eixo — "amizade bom" denunciaria texto gerado por máquina.
 */
const LEVEL_FEM: Record<RelationLevel, string> = { RUIM: "ruim", MEDIO: "média", BOM: "boa" };
const EIXO_FEMININO: Record<RelationAxis, boolean> = { amizade: true, comercio: false, favores: false };

export function describeRelation(r: HouseRelation): string {
  const partes = RELATION_AXES.map((eixo) => {
    const nivel = levelOf(r[eixo]);
    const rotulo = EIXO_FEMININO[eixo] ? LEVEL_FEM[nivel] : RELATION_LEVEL_LABELS[nivel];
    return `${RELATION_AXIS_LABELS[eixo].toLowerCase()} ${rotulo}`;
  });
  const base = partes.join(", ");
  return r.note.trim() ? `${base}. ${r.note.trim()}` : `${base}.`;
}

/** Chave estável do par, para indexar sem ambiguidade. */
export function relationKey(fromKey: string, toKey: string): string {
  return `${fromKey}#${toKey}`;
}
