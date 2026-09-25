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
const chave = (houseId: string) => `valdren.revelacao.${houseId}`;

export function lerVistoEm(houseId: string): string | null {
  try {
    return localStorage.getItem(chave(houseId));
  } catch {
    return null;
  }
}

export function gravarVistoEm(houseId: string, quando: string): void {
  try {
    localStorage.setItem(chave(houseId), quando);
  } catch {
    // Sem storage a revelação simplesmente volta na próxima visita.
  }
  window.dispatchEvent(new Event(EVENTO_REVELACAO));
}
