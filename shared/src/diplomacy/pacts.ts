import { RELATION_MAX, RELATION_MIN, type RelationAxis } from "./houseRelations.js";
import type { FactKind } from "./models.js";

/**
 * O que muda quando um pacto é aceito.
 *
 * Os três registros da diplomacia já existiam — Favor, CampaignFact e
 * HouseRelation — e nenhum se movia quando um acordo fechava. Uma aliança
 * firmada numa carta não mexia numa única linha do jogo: ficava sendo prosa.
 * Aqui está a ponte, e ela é deliberadamente pequena.
 *
 * Os deltas são modestos de propósito. Um pacto não vira amizade de repente, e
 * o Mestre continua sendo a fonte da verdade no painel — isto só impede que o
 * mundo fique parado enquanto as Casas combinam coisas.
 */
export const PACT_KINDS = ["ALIANCA", "ACORDO"] as const;
export type PactKind = (typeof PACT_KINDS)[number];

export function isPactKind(v: unknown): v is PactKind {
  return typeof v === "string" && (PACT_KINDS as readonly string[]).includes(v);
}

/** Quanto cada eixo anda ao fechar. Aliança pesa mais que acordo comercial. */
export const PACT_DELTAS: Record<PactKind, Partial<Record<RelationAxis, number>>> = {
  ALIANCA: { amizade: 20, comercio: 10, favores: 15 },
  ACORDO: { amizade: 8, comercio: 20, favores: 5 },
};

/** E quanto desanda quando o Mestre revoga um pacto que existia. */
export const PACT_BREAK_DELTAS: Record<PactKind, Partial<Record<RelationAxis, number>>> = {
  ALIANCA: { amizade: -30, comercio: -15, favores: -25 },
  ACORDO: { amizade: -12, comercio: -30, favores: -8 },
};

export function applyDeltas(
  atual: Record<RelationAxis, number>,
  deltas: Partial<Record<RelationAxis, number>>,
): Record<RelationAxis, number> {
  const saida = { ...atual };
  for (const [eixo, d] of Object.entries(deltas) as [RelationAxis, number][]) {
    saida[eixo] = Math.max(RELATION_MIN, Math.min(RELATION_MAX, saida[eixo] + d));
  }
  return saida;
}

/**
 * O nome do ativo que o pacto deixa.
 *
 * Um pacto que não deixa nada no mundo é uma frase. A embaixada é o que faz o
 * jogador olhar a ficha da Casa e ver que aquela carta aconteceu — e é o que dá
 * ao Mestre um objeto para atacar, tomar ou fechar num turno futuro.
 */
export function pactAssetName(kind: PactKind, lugar: string | null): string {
  const onde = lugar?.trim();
  if (kind === "ALIANCA") return onde ? `Embaixada em ${onde}` : "Aliança firmada";
  return onde ? `Entreposto em ${onde}` : "Acordo comercial";
}

/**
 * O lugar citado no resumo do pacto.
 *
 * A carta nomeia a sede ("o posto de Raven's Cross"), e é dela que sai o nome
 * do ativo. Procuramos entre as sedes conhecidas em vez de adivinhar por
 * pontuação: um resumo cita números, prazos e mercadorias, e qualquer heurística
 * de "primeira maiúscula" pegaria a coisa errada.
 */
export function placeInSummary(summary: string, seatNames: string[], excluir?: string | null): string | null {
  const texto = summary.toLowerCase();
  // A própria capital não conta. Um acordo cita as duas pontas da rota, e sem
  // isto o pacto rendia "Entreposto em Solythar" a quem já governa Solythar —
  // um ativo que não diz nada e não pode ser tomado de ninguém.
  const proibido = excluir?.trim().toLowerCase();
  let achado: string | null = null;
  for (const nome of seatNames) {
    if (!nome || (proibido && nome.toLowerCase() === proibido)) continue;
    if (texto.includes(nome.toLowerCase())) {
      // O nome mais longo ganha: "Raven's Cross" antes de "Raven".
      if (!achado || nome.length > achado.length) achado = nome;
    }
  }
  return achado;
}

/** Um PEDIDO aceito vira o quê. Aliança quando o texto fala de aliança. */
export function pactKindFor(summary: string): PactKind {
  return /alian[çc]a|pacto|embaixada|defesa m[úu]tua/i.test(summary) ? "ALIANCA" : "ACORDO";
}

/** Só proposta em aberto pode ser respondida. */
export function isAnswerable(kind: FactKind, status: string): boolean {
  return kind === "PEDIDO" && status === "ATIVO";
}

/**
 * O preço político de um pacto.
 *
 * Um teto de pactos seria uma regra artificial: "sua Casa só administra três".
 * A verdade da mesa é outra e mais interessante — você não pode se aliar a todo
 * mundo porque os seus aliados se odeiam. Fechar com Krythos afasta a Coroa;
 * fechar com quem a Coroa persegue afasta quem serve à Coroa.
 *
 * A conta sai da própria matriz de relações, então o Mestre continua sendo o
 * dono: quem ele marcou como inimigo de alguém é quem vai se ofender. Nada de
 * lista de blocos escrita à parte, que envelheceria em duas semanas de campanha.
 */
export interface Fallout {
  /** Casa que se ofende. */
  seatKey: string;
  /** Quanto a amizade dela com quem fechou o pacto cai. */
  amizade: number;
}

/**
 * Quem se ofende quando `comQuem` fecha um pacto, e o quanto.
 *
 * Só olha inimizade declarada: relação intocada é médio, e médio não gera
 * ofensa. Uma Casa que não tem opinião sobre Krythos não se importa que você
 * negocie com Krythos.
 */
export function politicalFallout(
  comQuem: string,
  kind: PactKind,
  relations: { fromKey: string; toKey: string; amizade: number }[],
  limiar = 33,
): Fallout[] {
  const peso = kind === "ALIANCA" ? 1 : 0.5;
  return relations
    .filter((r) => r.toKey === comQuem && r.amizade <= limiar && r.fromKey !== comQuem)
    .map((r) => ({
      seatKey: r.fromKey,
      // Quanto mais fundo o ódio, mais cara a companhia: inimizade total custa
      // o dobro de uma desconfiança que mal cruza a linha.
      amizade: -Math.round(((limiar + 1 - r.amizade) / (limiar + 1)) * 20 * peso),
    }))
    .filter((f) => f.amizade < 0);
}
