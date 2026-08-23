import { SEATS } from "../diplomacy/geography.js";
import { mentionsHouse } from "./houseAssets.js";
import { fold } from "./mortality.js";
import { fullCodex } from "../npc/codex.js";

/** O mínimo que um verbete precisa ter para ser analisado. */
export interface VerbeteAnalisavel {
  entryId: string;
  title: string;
  body: string;
}

export interface PersonagemDoElenco {
  id: string;
  nome: string;
}

export interface Mencoes {
  /** Ids de personagens citados, na ordem do elenco. */
  personagens: string[];
  /** Chaves de Casas citadas, na ordem de SEATS. */
  casas: string[];
}

export interface Detector {
  mencoesEm(verbete: VerbeteAnalisavel): Mencoes;
}

const TAMANHO_MINIMO = 4;

/**
 * As palavras que o corpus escreve em minúscula no meio de uma frase.
 *
 * É assim que o detector separa nome próprio de palavra comum sem depender de
 * uma lista mantida à mão — que envelheceria e sumiria junto com quem a
 * escreveu. Nomes com epíteto são o motivo: "Nima Olhos de Cinza" tentaria
 * casar por "olhos", "Rokan Pedra Oca" por "pedra". Se o texto de Valdren usa
 * a palavra em minúscula em algum lugar, ela não serve para identificar
 * ninguém.
 */
function palavrasComuns(verbetes: VerbeteAnalisavel[]): Set<string> {
  const comuns = new Set<string>();
  const corpus = verbetes.map((v) => `${v.title}\n${v.body}`).join("\n");
  for (const achado of corpus.matchAll(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]{3,}/g)) {
    const palavra = achado[0];
    if (palavra[0] !== palavra[0].toLowerCase()) continue;
    // Início de frase não conta: ali a minúscula pode ser só descuido de
    // digitação, e não prova que a palavra é comum.
    const antes = corpus.slice(Math.max(0, achado.index - 2), achado.index);
    if (/(^|[.!?:\n])\s*$/.test(antes)) continue;
    comuns.add(fold(palavra));
  }
  return comuns;
}

/** Um termo só vale se for exclusivo: dois donos mandariam o leitor ao errado. */
function vocabularioDoElenco(
  elenco: PersonagemDoElenco[],
  comuns: Set<string>,
): Map<string, string> {
  const dono = new Map<string, string>();
  const disputados = new Set<string>();
  for (const pessoa of elenco) {
    for (const termo of fold(pessoa.nome).split(/\s+/)) {
      if (termo.length < TAMANHO_MINIMO || comuns.has(termo)) continue;
      if (dono.has(termo) && dono.get(termo) !== pessoa.id) disputados.add(termo);
      dono.set(termo, pessoa.id);
    }
  }
  for (const termo of disputados) dono.delete(termo);
  return dono;
}

function escapar(termo: string): string {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Descobre quem é citado em cada verbete da crônica.
 *
 * O corpus inteiro é necessário para decidir o que é palavra comum, então a
 * construção é separada da consulta: monta-se o vocabulário uma vez e depois
 * pergunta-se verbete a verbete.
 */
export function construirDetector(
  verbetes: VerbeteAnalisavel[],
  elenco: PersonagemDoElenco[] = fullCodex().map((n) => ({ id: n.id, nome: n.name })),
): Detector {
  const dono = vocabularioDoElenco(elenco, palavrasComuns(verbetes));
  const ordem = new Map(elenco.map((p, i) => [p.id, i]));

  return {
    mencoesEm(verbete) {
      const texto = `${verbete.title}\n${verbete.body}`;
      const dobrado = fold(texto);
      const achados = new Set<string>();
      for (const [termo, id] of dono) {
        // A borda de palavra evita que "Kaelen" case "Kael".
        if (new RegExp(`\\b${escapar(termo)}\\b`).test(dobrado)) achados.add(id);
      }
      return {
        personagens: [...achados].sort((a, b) => (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0)),
        casas: SEATS.filter((s) => mentionsHouse(texto, s.key)).map((s) => s.key),
      };
    },
  };
}
