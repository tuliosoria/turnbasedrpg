import type { Attributes, TurnResult, TurnStatus } from "@ravenloft/content";
import type { AdminDashboard } from "../types/api";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };

/** Resolução vazia para um turno que ainda não tem resultado gravado. */
export function resultadoEmBranco(houses: { houseId: string }[]): TurnResult {
  return {
    publicResult: "",
    houseResults: Object.fromEntries(houses.map((house) => [house.houseId, ""])),
    attributeDeltas: Object.fromEntries(houses.map((house) => [house.houseId, { ...emptyAttributes }])),
    discoveries: [],
  };
}

/** O que o Mestre pode estar no meio de escrever. */
export interface CamposEditaveis {
  publicEvent: string;
  privateInfo: Record<string, string>;
  resolution: TurnResult | null;
  discoveriesText: string;
  worldLore: string;
  worldVisualDirectives: string;
}

/**
 * A última cópia que o painel carregou. Serve para distinguir "o Mestre digitou"
 * de "o campo ainda está como veio". Sem isso, recarregar o selo (espião
 * resolvido, cânone despachado) devolvia o texto do servidor por cima do que
 * estava aberto.
 */
export interface CopiaCarregada {
  turnId: number | null;
  turnStatus: TurnStatus | null;
  publicEvent: string;
  privateInfo: Record<string, string>;
  resolutionKey: string;
  discoveriesText: string;
  worldLore: string;
  worldVisualDirectives: string;
  /** A bíblia ainda não chegou. A primeira resposta entra inteira. */
  bibliaPronta: boolean;
}

export function copiaInicial(): CopiaCarregada {
  return {
    turnId: null,
    turnStatus: null,
    publicEvent: "",
    privateInfo: {},
    resolutionKey: "",
    discoveriesText: "",
    worldLore: "",
    worldVisualDirectives: "",
    bibliaPronta: false,
  };
}

/** Só o que o formulário edita. `attributeChanges` nasce no servidor, ao aplicar. */
export function chaveDaResolucao(r: TurnResult | null): string {
  if (!r) return "";
  return JSON.stringify({
    publicResult: r.publicResult,
    houseResults: r.houseResults,
    attributeDeltas: r.attributeDeltas,
    discoveries: r.discoveries,
  });
}

function escolher(atual: string, carregado: string, proximo: string, forcar: boolean): { valor: string; carregado: string } {
  if (!forcar && atual !== carregado) return { valor: atual, carregado };
  return { valor: proximo, carregado: proximo };
}

/**
 * Atualiza o painel sem apagar o que diverge da última cópia carregada.
 *
 * Troca de turno (número ou estado) é outro formulário: o que estava digitado
 * pertencia ao turno anterior, e a cópia do servidor entra inteira. No mesmo
 * turno, cada campo limpo acompanha o servidor — é assim que o selo reconta
 * sem congelar a tela.
 */
export function preservarCampos(
  atual: CamposEditaveis,
  carregado: CopiaCarregada,
  next: AdminDashboard,
): { campos: CamposEditaveis; carregado: CopiaCarregada } {
  const forcar = carregado.turnId !== next.turnId || carregado.turnStatus !== next.turnStatus;
  const evento = escolher(atual.publicEvent, carregado.publicEvent, next.publicEvent, forcar);

  const chaves = new Set([
    ...Object.keys(atual.privateInfo),
    ...Object.keys(carregado.privateInfo),
    ...Object.keys(next.privateInfo),
  ]);
  const privateInfo: Record<string, string> = {};
  const privateCarregado: Record<string, string> = {};
  for (const chave of chaves) {
    const info = escolher(atual.privateInfo[chave] ?? "", carregado.privateInfo[chave] ?? "", next.privateInfo[chave] ?? "", forcar);
    privateInfo[chave] = info.valor;
    privateCarregado[chave] = info.carregado;
  }

  const nextResult = next.result ?? resultadoEmBranco(next.houses);
  const nextKey = chaveDaResolucao(nextResult);
  const manterResolucao = !forcar && chaveDaResolucao(atual.resolution) !== carregado.resolutionKey;
  const descobertas = escolher(atual.discoveriesText, carregado.discoveriesText, nextResult.discoveries.join("\n"), forcar);

  return {
    campos: {
      ...atual,
      publicEvent: evento.valor,
      privateInfo,
      resolution: manterResolucao ? atual.resolution : nextResult,
      discoveriesText: descobertas.valor,
    },
    carregado: {
      ...carregado,
      turnId: next.turnId,
      turnStatus: next.turnStatus,
      publicEvent: evento.carregado,
      privateInfo: privateCarregado,
      resolutionKey: manterResolucao ? carregado.resolutionKey : nextKey,
      discoveriesText: descobertas.carregado,
    },
  };
}

/** A bíblia não é do turno. A primeira carga entra; depois, texto digitado fica. */
export function preservarBiblia(
  atual: Pick<CamposEditaveis, "worldLore" | "worldVisualDirectives">,
  carregado: CopiaCarregada,
  lore: string,
  directives: string,
): { worldLore: string; worldVisualDirectives: string; carregado: CopiaCarregada } {
  if (!carregado.bibliaPronta) {
    return {
      worldLore: lore,
      worldVisualDirectives: directives,
      carregado: { ...carregado, worldLore: lore, worldVisualDirectives: directives, bibliaPronta: true },
    };
  }
  const l = escolher(atual.worldLore, carregado.worldLore, lore, false);
  const d = escolher(atual.worldVisualDirectives, carregado.worldVisualDirectives, directives, false);
  return {
    worldLore: l.valor,
    worldVisualDirectives: d.valor,
    carregado: { ...carregado, worldLore: l.carregado, worldVisualDirectives: d.carregado },
  };
}
