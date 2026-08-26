import { SEATS, distanceKm, houseProfileFor, seatOf } from "@ravenloft/content";

/**
 * O mapa como argumento de negociação.
 *
 * Sem isto a IA sabe o que as duas Casas têm e não sabe onde elas ficam, então
 * negocia no vazio: propõe encontro sem lugar, rota sem trajeto, posto sem
 * chão. Foi o que travou Solarion e Euralune por dois turnos — Euralune pediu
 * "chão de ninguém" e ninguém, dos dois lados, soube dizer onde isso ficaria.
 */
export interface NeutralGround {
  key: string;
  name: string;
  seat: string;
  fromA: number;
  fromB: number;
  /** O que se encontra lá, para a proposta ter motivo além da distância. */
  oQueTem: string;
}

/**
 * As sedes mais equilibradas entre duas Casas.
 *
 * Equidistância sozinha daria um ponto no mapa; o que faz uma proposta boa é o
 * lugar ter função. Por isso vai junto o que a sede produz — um pacto sobre
 * mensageiros pede a casa dos correios, não um descampado no meio.
 */
export function neutralGroundBetween(aKey: string, bKey: string, limite = 3): NeutralGround[] {
  return SEATS.filter((s) => s.key !== aKey && s.key !== bKey)
    .map((s) => {
      const fromA = distanceKm(aKey, s.key);
      const fromB = distanceKm(bKey, s.key);
      const perfil = houseProfileFor(s.key);
      return fromA == null || fromB == null
        ? null
        : { key: s.key, name: s.name, seat: s.seat, fromA, fromB, oQueTem: perfil?.resources ?? "" };
    })
    .filter((x): x is NeutralGround => x !== null)
    .sort((x, y) => Math.abs(x.fromA - x.fromB) - Math.abs(y.fromA - y.fromB))
    .slice(0, limite);
}

/** O bloco de texto que entra no prompt. Vazio quando falta uma das sedes. */
export function buildGeographyBlock(aKey: string | null, bKey: string | null, aName: string, bName: string): string {
  if (!aKey || !bKey) return "";
  const km = distanceKm(aKey, bKey);
  if (km == null) return "";

  const a = seatOf(aKey);
  const b = seatOf(bKey);
  const meio = neutralGroundBetween(aKey, bKey);

  const linhas = [
    `Onde vocês ficam: ${a?.seat ?? aName} e ${b?.seat ?? bName}, a ${km} km um do outro.`,
    "",
    "Chão de ninguém entre as duas — use quando a conversa pedir encontro, posto, rota ou entreposto,",
    "e prefira o lugar cuja função sirva ao assunto (correio para pacto de mensageiros, porto para frete):",
    ...meio.map((m) => `- ${m.seat} (${m.name}): ${m.fromA} km de ${aName}, ${m.fromB} km de ${bName}. ${m.oQueTem}`),
    "",
    "Proposta com lugar nomeado vale mais que proposta sem: 'que se construa no meio do caminho' é uma",
    "intenção; 'no posto de Raven's Cross, a doze dias das suas torres' é um acordo. Nomeie.",
  ];
  return linhas.join("\n");
}
