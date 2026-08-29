import { PUBLICO, SEATS, isWorldFactKind, quoteIsGrounded, type WorldFact, type WorldFactKind } from "@ravenloft/content";

export const FACT_EXTRACTION_SYSTEM_PROMPT = [
  "Você lê o texto de um turno de uma campanha de RPG político e extrai os FATOS que a campanha não pode esquecer.",
  "",
  "Um fato é algo que aconteceu e que muda o que os personagens podem dizer depois: quem enviou tropa e quanta, quem firmou pacto com quem, quem deve o quê a quem, quem morreu ou assumiu, e que regra a Coroa impôs sobre quem.",
  "",
  "Regras:",
  "1. Só registre o que o TEXTO AFIRMA. Não deduza, não complete, não interprete. Se o texto não diz o número, o fato não tem número.",
  "2. Toda entrada precisa de uma CITAÇÃO LITERAL do texto — copiada caractere por caractere, com pelo menos vinte caracteres. A citação é conferida contra o texto e a entrada é DESCARTADA se não bater.",
  "3. Opinião de personagem não é fato. Se alguém na cena ACHA, DESCONFIA ou ACUSA, isso não entra. Só entra o que o narrador afirma ter acontecido.",
  "4. Um resumo por fato, uma frase, com número, prazo e lugar quando o texto os der.",
  "5. 'partes' são as Casas envolvidas, pelas chaves da lista. Deixe VAZIO quando o fato vale para o reino inteiro — um edito, uma data, uma coroação.",
  "6. Prefira poucos fatos densos a muitos fatos rasos. Uma cena inteira pode render um fato, ou nenhum.",
  "",
  `Chaves de Casa válidas: ${SEATS.map((s) => s.key).join(", ")}`,
  "",
  'Responda SOMENTE com JSON: { "fatos": [ { "kind": "MILITAR"|"PACTO"|"DIVIDA"|"SUCESSAO"|"DECRETO", "partes": ["chave"], "resumo": "uma frase", "citacao": "trecho literal do texto" } ] }',
  'Nenhum fato encontrado é uma resposta válida: { "fatos": [] }.',
].join("\n");

export interface FactExtractionInput {
  turnNumber: number;
  publicEvent: string;
  publicResult: string;
  houseResults: Record<string, string>;
  /** Do id da Casa do jogador para a chave de sede, para as partes saírem certas. */
  seatOfHouseId: (houseId: string) => string | null;
}

/** Um pedaço do turno, com quem pode saber dele. */
export interface FactBlock {
  /** "PUBLICO" ou a chave da sede dona do segredo. */
  visibility: string;
  rotulo: string;
  texto: string;
}

/**
 * O turno fatiado em blocos, um por audiência.
 *
 * Uma chamada por bloco, e não uma pelo turno inteiro. O motivo é medido: com o
 * turno inteiro (3.071 tokens de entrada) o modelo gastou 3.584 tokens de
 * raciocínio numa tentativa e estourou 5.000 em duas outras, devolvendo nada.
 * Blocos menores mantêm o raciocínio numa faixa em que ele termina.
 *
 * De quebra, a visibilidade deixa de ser dedução: cada chamada já sabe de qual
 * audiência é o texto que está lendo.
 */
export function turnBlocks(input: FactExtractionInput): FactBlock[] {
  const blocos: FactBlock[] = [];
  const publico = [input.publicEvent, input.publicResult].filter((t) => t?.trim()).join("\n\n");
  if (publico.trim()) {
    blocos.push({ visibility: PUBLICO, rotulo: "O que o reino inteiro soube", texto: publico });
  }
  for (const [houseId, texto] of Object.entries(input.houseResults)) {
    const sede = input.seatOfHouseId(houseId);
    if (!sede || !texto?.trim()) continue;
    blocos.push({ visibility: sede, rotulo: `O que aconteceu com ${sede}, que só ela sabe`, texto });
  }
  return blocos;
}

export function buildFactExtractionUser(turnNumber: number, bloco: FactBlock): string {
  return [`Turno ${turnNumber}.`, `${bloco.rotulo}:\n${bloco.texto.trim()}`, "Extraia os fatos."].join("\n\n");
}

interface FatoBruto {
  kind?: unknown;
  partes?: unknown;
  resumo?: unknown;
  citacao?: unknown;
}

const CHAVES = new Set(SEATS.map((s) => s.key));

/**
 * O JSON do modelo vira fatos, e o que não se sustenta é jogado fora.
 *
 * O descarte por citação é a peça central: como não há aprovação humana por
 * fato, é aqui — em código, com um `includes` — que se decide se o modelo
 * inventou. Ele pode escrever o resumo que quiser; a citação ou está no texto
 * do Mestre ou o fato não existe.
 */
export function parseFacts(
  raw: string,
  ctx: { bloco: FactBlock; turnNumber: number; campaignId: string; now: string; id: () => string },
): { facts: WorldFact[]; descartados: number } {
  let obj: { fatos?: unknown };
  try {
    const texto = raw.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio === -1 || fim === -1) return { facts: [], descartados: 0 };
    obj = JSON.parse(texto.slice(inicio, fim + 1)) as { fatos?: unknown };
  } catch {
    return { facts: [], descartados: 0 };
  }

  const brutos = Array.isArray(obj.fatos) ? (obj.fatos as FatoBruto[]) : [];
  const facts: WorldFact[] = [];
  let descartados = 0;

  for (const b of brutos) {
    const resumo = typeof b.resumo === "string" ? b.resumo.trim() : "";
    const citacao = typeof b.citacao === "string" ? b.citacao.trim() : "";
    if (!resumo || !isWorldFactKind(b.kind)) {
      descartados++;
      continue;
    }

    // A citação é conferida contra o bloco que gerou esta chamada, e só contra
    // ele. Um fato "extraído" do resultado privado de Khazdrun cuja citação na
    // verdade veio do texto público seria classificado como segredo por engano.
    if (!quoteIsGrounded(citacao, ctx.bloco.texto)) {
      descartados++;
      continue;
    }
    // Uma chave inventada apontaria o fato para uma Casa que não existe, e o
    // seletor o entregaria a ninguém. Some a parte, o fato fica.
    const partes = Array.isArray(b.partes)
      ? [...new Set((b.partes as unknown[]).filter((p): p is string => typeof p === "string" && CHAVES.has(p)))]
      : [];

    facts.push({
      id: ctx.id(),
      campaignId: ctx.campaignId,
      turnNumber: ctx.turnNumber,
      kind: b.kind as WorldFactKind,
      parties: partes,
      visibility: ctx.bloco.visibility,
      summary: resumo.slice(0, 400),
      quote: citacao.slice(0, 600),
      status: "ATIVO",
      supersededBy: null,
      createdAt: ctx.now,
    });
  }

  return { facts, descartados };
}
