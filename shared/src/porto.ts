import type { ProjectCard } from "./projects.js";
import { seatKeyForHouseId } from "./diplomacy/geography.js";

/**
 * O Porto Cinzento — a regra de comprar rumores nas docas.
 *
 * Liga três sistemas que já existiam e não inventa nenhum: a carta é o gasto da
 * ação, `Turn.privateInfo` é o segredo que chega a cada Casa, e o prompt de
 * informação privada é quem escreve. Este módulo só decide **o quê** deve ser
 * escrito: de que tipo, com quanta confiança, e se é mentira plantada.
 */

export const TIPOS_DE_RUMOR = ["MILITAR", "POLITICA", "COMERCIAL", "BRUMAS"] as const;
export type TipoDeRumor = (typeof TIPOS_DE_RUMOR)[number];

/** Cada carta de compra é um tipo. A escolha do jogador é qual carta ele joga. */
export const CARTAS_DO_PORTO: Record<string, TipoDeRumor> = {
  "rumores-do-porto-movimentos-de-tropas": "MILITAR",
  "rumores-do-porto-tratos-e-traicoes": "POLITICA",
  "rumores-do-porto-carregamentos-e-escassez": "COMERCIAL",
  "rumores-do-porto-vozes-do-norte": "BRUMAS",
};

export const TEMPLATE_RUMOR_FALSO = "plantar-um-rumor-falso";

export const ROTULOS_DE_RUMOR: Record<TipoDeRumor, string> = {
  MILITAR: "movimentação de tropas, mercenários e navios",
  POLITICA: "alianças secretas, disputas entre Casas e traições",
  COMERCIAL: "carregamentos valiosos, escassez e oportunidades",
  BRUMAS: "rumores vindos do Norte, desaparecimentos e eventos estranhos",
};

export const CONFIABILIDADES = ["DUVIDOSA", "PARCIAL", "FIRME", "CERTEIRA"] as const;
export type Confiabilidade = (typeof CONFIABILIDADES)[number];

/**
 * O que o Mestre deve escrever em cada grau.
 *
 * Vive aqui, e não no prompt, porque é regra de jogo: o painel mostra o mesmo
 * texto ao Mestre que a IA recebe, e duas listas divergindo dariam ao mesmo
 * grau significados diferentes em telas diferentes.
 */
export const INSTRUCAO_POR_CONFIABILIDADE: Record<Confiabilidade, string> = {
  DUVIDOSA: "um boato solto de taverna, sem nomes nem números, que pode não dar em nada",
  PARCIAL: "o fato verdadeiro, mas incompleto — falta quem, ou falta quando",
  FIRME: "o fato com um nome ou um número, e uma reserva honesta sobre o resto",
  CERTEIRA: "o fato com detalhe e procedência, do jeito que só uma rede bem paga entrega",
};

/**
 * Confiabilidade a partir do Controle da Casa.
 *
 * Usa o `controle` da Casa, que é o atributo que existe. O Mestre falou em
 * "Controle sobre o Porto"; se um dia houver controle por território, esta
 * função troca de fonte sem mudar de forma.
 */
export function confiabilidadeDoPorto(controle: number): Confiabilidade {
  if (controle <= 1) return "DUVIDOSA";
  if (controle === 2) return "PARCIAL";
  if (controle === 3) return "FIRME";
  return "CERTEIRA";
}

export interface BriefingDoPorto {
  houseId: string;
  tipo: TipoDeRumor;
  confiabilidade: Confiabilidade;
  /**
   * Casa que plantou a mentira, ou null. Preenchido significa que a informação
   * entregue deve ser **falsa e plausível**: um rumor plantado por profissionais
   * chega com a mesma cara de verdade, então a vítima não é avisada de nada.
   */
  envenenadoPor: string | null;
}

function concluidaNoTurno(carta: ProjectCard, turnoResolvido: number): boolean {
  return carta.status === "COMPLETED" && carta.lastProcessedTurnId === turnoResolvido;
}

/**
 * Os briefings que o turno seguinte deve entregar.
 *
 * `turnoResolvido` é o turno que acabou de ser resolvido — quem compõe o turno
 * N pergunta pelo N-1. Não há marca de "entregue" em lugar nenhum: a função é
 * pura e derivada das cartas, então redesenhar o rascunho dá o mesmo resultado.
 */
export function briefingsDoPorto(
  cartas: ProjectCard[],
  turnoResolvido: number,
  controlePorCasa: Record<string, number>,
): BriefingDoPorto[] {
  // O veneno é do turno: um rumor plantado há três turnos já passou. Sem esta
  // janela, uma única carta de veneno envenenaria a vítima para sempre.
  // A vítima é indexada por chave de sede porque os dois lados falam línguas
  // diferentes: `targetHouseId` de uma carta de modelo guarda a chave da
  // geografia ("casa-solarion") enquanto `houseId` guarda o id do banco
  // ("solarion-k0hc"). Comparar cru nunca casaria, e o veneno jamais pegaria.
  const venenoPorVitima = new Map<string, string>();
  for (const c of cartas) {
    if (c.templateId !== TEMPLATE_RUMOR_FALSO) continue;
    if (!concluidaNoTurno(c, turnoResolvido)) continue;
    if (!c.targetHouseId) continue;
    const vitima = seatKeyForHouseId(c.targetHouseId);
    if (!vitima) continue;
    venenoPorVitima.set(vitima, c.houseId);
  }

  const briefings: BriefingDoPorto[] = [];
  for (const c of cartas) {
    const tipo = c.templateId ? CARTAS_DO_PORTO[c.templateId] : undefined;
    if (!tipo) continue;
    if (!concluidaNoTurno(c, turnoResolvido)) continue;
    briefings.push({
      houseId: c.houseId,
      tipo,
      // Casa sem Controle conhecido cai no degrau mais baixo: na dúvida, o Porto
      // entrega boato, nunca certeza.
      confiabilidade: confiabilidadeDoPorto(controlePorCasa[c.houseId] ?? 0),
      envenenadoPor: venenoPorVitima.get(seatKeyForHouseId(c.houseId) ?? "") ?? null,
    });
  }
  return briefings;
}
