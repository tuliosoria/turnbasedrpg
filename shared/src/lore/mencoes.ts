import { SEATS } from "../diplomacy/geography.js";
import { houseTerms } from "./houseAssets.js";
import { fold, givenName } from "./mortality.js";
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

/**
 * Só o nome próprio identifica a pessoa — nunca o sobrenome.
 *
 * O sobrenome falha de duas maneiras, e as duas apareceram no texto real de
 * Valdren. Ele nomeia lugares: "Torre de Véspera" fazia quatro verbetes
 * afirmarem que Maelor Véspera aparecia neles. E ele é dividido com gente que
 * não está no elenco: "Alaric Venn" oferecia um link que levava a Liora Venn,
 * despejando o leitor na pessoa errada.
 *
 * Isso custa alcance — quem for citado só pelo sobrenome não é achado. É o
 * preço certo: link ausente é uma oportunidade perdida, link errado é uma
 * afirmação falsa.
 */
function vocabularioDoElenco(
  elenco: PersonagemDoElenco[],
  comuns: Set<string>,
  topônimos: Set<string>,
): Map<string, string> {
  const dono = new Map<string, string>();
  const disputados = new Set<string>();
  for (const pessoa of elenco) {
    const termo = givenName(pessoa.nome);
    if (!termo || termo.length < TAMANHO_MINIMO) continue;
    if (comuns.has(termo) || topônimos.has(termo)) continue;
    if (dono.has(termo) && dono.get(termo) !== pessoa.id) disputados.add(termo);
    dono.set(termo, pessoa.id);
  }
  for (const termo of disputados) dono.delete(termo);
  return dono;
}

/**
 * Os termos que identificam cada Casa, já podados.
 *
 * `mentionsHouse` não serve aqui. Ela foi escrita para casar nome de entidade
 * e título de verbete — strings de poucas palavras — e procura por substring
 * crua. Solta no corpo de um verbete, "ouro" casava dentro de couro e tesouro,
 * e "ulgar" dentro de vulgar. Num texto longo a chance de uma substring de
 * quatro letras aparecer é quase certeza. Aqui os termos ganham borda de
 * palavra e passam pelo mesmo filtro de palavra comum dos personagens — que é
 * o que tira "ouro", o metal, do caminho.
 */
function vocabularioDasCasas(comuns: Set<string>): Map<string, string[]> {
  const porChave = new Map<string, string[]>();
  for (const seat of SEATS) {
    const termos = houseTerms(seat.key).filter((t) => {
      // Termo de duas palavras já é distintivo: "porto cinzento" não aparece
      // por acaso, mesmo que "porto" apareça.
      if (t.includes(" ")) return true;
      return !comuns.has(t);
    });
    if (termos.length > 0) porChave.set(seat.key, termos);
  }
  return porChave;
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
  const comuns = palavrasComuns(verbetes);
  const casas = vocabularioDasCasas(comuns);
  // Um nome que também batiza uma Casa ou uma cidade pertence ao lugar: o
  // texto que diz "Karasoy" quase sempre fala da Casa, não da pessoa.
  const topônimos = new Set([...casas.values()].flat());
  const dono = vocabularioDoElenco(elenco, comuns, topônimos);
  const ordem = new Map(elenco.map((p, i) => [p.id, i]));

  const casa = (termo: string) => new RegExp(`\\b${escapar(termo)}\\b`);

  return {
    mencoesEm(verbete) {
      const dobrado = fold(`${verbete.title}\n${verbete.body}`);
      const achados = new Set<string>();
      for (const [termo, id] of dono) {
        // A borda de palavra evita que "Kaelen" case "Kael".
        if (casa(termo).test(dobrado)) achados.add(id);
      }
      return {
        personagens: [...achados].sort((a, b) => (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0)),
        casas: SEATS.filter((s) => (casas.get(s.key) ?? []).some((t) => casa(t).test(dobrado))).map(
          (s) => s.key,
        ),
      };
    },
  };
}
