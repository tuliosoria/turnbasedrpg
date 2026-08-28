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

/**
 * Onde a história e o presente discordam.
 *
 * Três camadas falam de relação — o texto histórico, esta matriz e o estado
 * vivo de cada NPC — e nada garante que concordem. Divergência não é defeito:
 * uma Casa pode ter superado uma ferida que a outra ainda cobra, e é disso que
 * a carta vive. Mas o Mestre precisa VER a divergência para decidir se ela é
 * intencional ou se ele esqueceu de mexer num dial depois de um turno.
 */
export interface RelationDivergence {
  fromKey: string;
  toKey: string;
  /** "perdoado" quando há ferida antiga e boa relação hoje; "rompido" no inverso. */
  kind: "perdoado" | "rompido";
  explanation: string;
}

// "guerra" ficou de fora de propósito: duas Casas podem ter lutado uma guerra
// JUNTAS, e o termo sozinho não diz de que lado cada uma estava. Só entram
// palavras que só fazem sentido como dano de uma à outra.
const FERIDA = /ferida|rivalidad|traiç|mágoa|magoa|sangue|dívida|divida|inimiz/i;
const LAÇO = /aliança|alianca|pacto|amizade|casamento|irmand|apoio mútuo|apoio mutuo/i;

/**
 * Compara o texto histórico de um par com a relação atual.
 *
 * Só olha amizade: é o eixo em que passado e presente se contradizem de forma
 * legível. Comércio e favores mudam por motivo prático o tempo todo, e apontar
 * cada variação viraria ruído que o Mestre aprende a ignorar.
 */
export function findDivergence(
  relation: HouseRelation,
  historyText: string,
): RelationDivergence | null {
  const t = historyText.trim();
  if (!t) return null;
  const nivel = levelOf(relation.amizade);
  const base = { fromKey: relation.fromKey, toKey: relation.toKey };

  if (FERIDA.test(t) && nivel === "BOM") {
    return {
      ...base,
      kind: "perdoado",
      explanation: "A história entre elas registra ferida, e a amizade hoje está boa. Se foi perdão, a carta deve dizer isso; se você esqueceu de baixar o dial, é agora.",
    };
  }
  if (LAÇO.test(t) && !FERIDA.test(t) && nivel === "RUIM") {
    return {
      ...base,
      kind: "rompido",
      explanation: "A história registra laço, e a amizade hoje está ruim. Algo recente quebrou — vale existir no turno, ou o dial está baixo sem motivo.",
    };
  }
  return null;
}
