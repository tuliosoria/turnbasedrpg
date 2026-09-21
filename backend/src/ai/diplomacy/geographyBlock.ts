import { SEATS, distanceKm, houseProfileFor, seatOf } from "@ravenloft/content";

/**
 * O mapa como argumento de negociação.
 *
 * Sem isto a IA sabe o que as duas Casas têm e não sabe onde elas ficam, então
 * negocia no vazio: propõe encontro sem lugar, rota sem trajeto, posto sem
 * chão. Foi o que travou Solarion e Euralune por dois turnos — Euralune pediu
 * "chão de ninguém" e ninguém, dos dois lados, soube dizer onde isso ficaria.
 *
 * **O bloco chamava as cidades do meio do caminho de "chão de ninguém", e isso
 * era falso em quinze das dezesseis sedes.** O jogador de Khazdrun escreveu a
 * Karasoy; Karasoy respondeu mandando os batedores anões "entrarem por Ferrum",
 * enviando a própria emissária a Ferrum e prometendo pagar "por nomes em
 * Ferrum". Ferrum é a capital da Casa Ferrumor, do outro lado da ilha, e Karasoy
 * não manda lá. Na mesma rodada, Auremont marcou encontro na Torre de Véspera,
 * que é da Ordem dos Três, e a lista oferecia até Asterhall — sitiada e
 * incomunicável — como lugar bom para marcar.
 *
 * O modelo não inventou nada: obedeceu ao título. E o revisor não pega, porque
 * recebe o MESMO material — a premissa falsa chega junto, com cara de fato.
 *
 * Então o bloco passou a dizer de quem é cada lugar, que é a informação que
 * faltava. Ele continua nomeando cidade e distância: isso é o que ele resolveu
 * quando nasceu, e segue de pé.
 */
export interface CidadeDoCaminho {
  key: string;
  name: string;
  seat: string;
  fromA: number;
  fromB: number;
  /** O que se encontra lá, para a proposta ter motivo além da distância. */
  oQueTem: string;
}

/**
 * De quem é o lugar, e o que isso obriga.
 *
 * Raven's Cross é a única exceção, e é o cânone que a faz: "A Irmandade não
 * governa uma província. Sua sede é Raven's Cross, mas a cidade permanece
 * legalmente sob magistratura real." É por isso que o reino afixa carta aberta
 * ali e que meia campanha marca encontro ali — não porque seja terra de ninguém,
 * mas porque não é terra de Casa nenhuma.
 *
 * Para as ordens a linha para em dizer o que elas são. Prometer hospitalidade
 * em nome da Ordem dos Três ou do Sino seria trocar um fato inventado por outro.
 */
export function tutelaDe(key: string, name: string): string {
  if (key === "irmandade-dos-corvos") {
    return "cidade sob magistratura real, não província de Casa — é onde o reino afixa e lê o que é público";
  }
  if (key.startsWith("ordem-")) {
    return `sede da ${name}, que é ordem e não Casa: a ordem decide quem entra e não responde por estrada nem por cais`;
  }
  return `terra da ${name}: encontro, posto ou passagem ali dependem da licença dela`;
}

/**
 * As cidades mais equilibradas entre duas Casas.
 *
 * Equidistância sozinha daria um ponto no mapa; o que faz uma proposta boa é o
 * lugar ter função. Por isso vai junto o que a sede produz — um pacto sobre
 * mensageiros pede a casa dos correios, não um descampado no meio.
 */
export function cidadesNoMeioDoCaminho(aKey: string, bKey: string, limite = 3): CidadeDoCaminho[] {
  return SEATS.filter((s) => s.key !== aKey && s.key !== bKey)
    .map((s) => {
      const fromA = distanceKm(aKey, s.key);
      const fromB = distanceKm(bKey, s.key);
      const perfil = houseProfileFor(s.key);
      return fromA == null || fromB == null
        ? null
        : { key: s.key, name: s.name, seat: s.seat, fromA, fromB, oQueTem: perfil?.resources ?? "" };
    })
    .filter((x): x is CidadeDoCaminho => x !== null)
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
  const meio = cidadesNoMeioDoCaminho(aKey, bKey);

  const linhas = [
    `Onde vocês ficam: ${a?.seat ?? aName} e ${b?.seat ?? bName}, a ${km} km um do outro.`,
    "",
    "Cidades no meio do caminho, e de quem cada uma é — para marcar encontro, posto, rota ou entreposto,",
    "e prefira o lugar cuja função sirva ao assunto (correio para pacto de mensageiros, porto para frete):",
    ...meio.map((m) => `- ${m.seat} (${m.name}) — ${m.fromA} km de ${aName}, ${m.fromB} km de ${bName}. ${tutelaDe(m.key, m.name)}. ${m.oQueTem}`),
    "",
    "Cidade de terceiro não é chão de ninguém: quem manda nela é que concede encontro, posto e passagem.",
    "Não prometa em terra que não é sua.",
    "",
    "Proposta com lugar nomeado vale mais que proposta sem: 'que se construa no meio do caminho' é uma",
    "intenção; 'no posto de Raven's Cross, a doze dias das suas torres' é um acordo. Nomeie.",
  ];
  return linhas.join("\n");
}
