import { PASSO_POR_TURNO, type ProjectCard } from "@ravenloft/content";

/**
 * Onde a carta estará depois do fechamento, contado como o motor conta
 * (`backend/src/projects/processTurn.ts`): só carta ACTIVE anda, e anda o passo
 * grátis mais a Energia, sem passar do total.
 */
export interface Previa {
  andadas: number;
  gratis: number;
  comEnergia: number;
  depois: number;
  total: number;
  conclui: boolean;
}

export function previaDoFechamento(
  carta: Pick<ProjectCard, "status" | "turnsCompleted" | "durationTurns">,
  energia: number,
): Previa {
  const andadas = carta.turnsCompleted;
  const total = carta.durationTurns;
  const falta = Math.max(0, total - andadas);
  if (carta.status !== "ACTIVE") {
    return { andadas, gratis: 0, comEnergia: 0, depois: andadas, total, conclui: false };
  }
  const gratis = Math.min(PASSO_POR_TURNO, falta);
  const comEnergia = Math.min(Math.max(0, energia), falta - gratis);
  const depois = andadas + gratis + comEnergia;
  return { andadas, gratis, comEnergia, depois, total, conclui: depois >= total };
}

/**
 * Cartas de um mesmo fechamento são resolvidas em sequência, com milissegundos
 * de diferença. Quinze minutos separam com folga um fechamento do próximo.
 */
export const JANELA_DO_FECHAMENTO_MS = 15 * 60 * 1000;

function resolvidaComData(c: ProjectCard): c is ProjectCard & { resolvedAt: string } {
  return (c.status === "COMPLETED" || c.status === "FAILED") && typeof c.resolvedAt === "string" && c.resolvedAt !== "";
}

/**
 * O que a revelação mostra. Sem `vistoEm` (primeiro acesso neste aparelho), só
 * o último fechamento: revelar a campanha inteira seria uma parede, não um
 * momento.
 */
export function cartasParaRevelar(cartas: ProjectCard[], vistoEm: string | null): ProjectCard[] {
  const comData = cartas.filter(resolvidaComData);
  let escolhidas: typeof comData;
  if (vistoEm) {
    escolhidas = comData.filter((c) => c.resolvedAt > vistoEm);
  } else {
    const ultima = comData.reduce((max, c) => (c.resolvedAt > max ? c.resolvedAt : max), "");
    if (!ultima) return [];
    const corte = new Date(Date.parse(ultima) - JANELA_DO_FECHAMENTO_MS).toISOString();
    escolhidas = comData.filter((c) => c.resolvedAt >= corte);
  }
  return [...escolhidas].sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
}

export const EVENTO_REVELACAO = "valdren:revelacao-vista";

/**
 * Cada aba lembra o próprio "visto". Cartas do mesmo fechamento são resolvidas
 * uma a uma, segundos umas das outras; com uma marca só por Casa, fechar a
 * revelação de Projetos escondia para sempre a carta de Espiões resolvida
 * segundos antes.
 */
export type RecorteDaRevelacao = "projetos" | "espioes";

export function recorteDe(category: string): RecorteDaRevelacao {
  return category === "INTELLIGENCE" ? "espioes" : "projetos";
}

const chave = (houseId: string, recorte: RecorteDaRevelacao) => `valdren.revelacao.${houseId}.${recorte}`;

export function lerVistoEm(houseId: string, recorte: RecorteDaRevelacao): string | null {
  try {
    return localStorage.getItem(chave(houseId, recorte));
  } catch {
    return null;
  }
}

export function gravarVistoEm(houseId: string, recorte: RecorteDaRevelacao, quando: string): void {
  try {
    localStorage.setItem(chave(houseId, recorte), quando);
  } catch {
    // Sem storage a revelação simplesmente volta na próxima visita.
  }
  window.dispatchEvent(new Event(EVENTO_REVELACAO));
}
