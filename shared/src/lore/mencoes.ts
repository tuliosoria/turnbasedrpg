import { SEATS } from "../diplomacy/geography.js";
import { houseTerms } from "./houseAssets.js";
import { NPC_BIOGRAPHIES } from "./biographies.js";
import { HOUSE_CHARACTERS } from "./characters.js";
import { fold, givenName, nameKey } from "./mortality.js";
import { fullCodex, type NpcTier } from "../npc/codex.js";

/** O mínimo que um verbete precisa ter para ser analisado. */
export interface VerbeteAnalisavel {
  entryId: string;
  title: string;
  body: string;
}

export interface PersonagemDoElenco {
  id: string;
  nome: string;
  /** Usado só para desempatar registros duplicados da mesma pessoa. */
  tier?: NpcTier;
}

/** Um pedaço de texto: ou é prosa, ou é o nome de alguém com ficha. */
export type Trecho =
  | { tipo: "texto"; valor: string }
  | { tipo: "pessoa"; valor: string; id: string };

export interface Mencoes {
  /** Ids de personagens citados, na ordem do elenco. */
  personagens: string[];
  /** Chaves de Casas citadas, na ordem de SEATS. */
  casas: string[];
}

export interface Detector {
  mencoesEm(verbete: VerbeteAnalisavel): Mencoes;
  /**
   * Quebra um bloco de texto em prosa e nomes, para virar link na tela.
   *
   * Só a PRIMEIRA menção de cada pessoa vira trecho de pessoa. Um parágrafo que
   * repete "Elara" seis vezes não precisa de seis links — precisa de um, e o
   * resto do texto continua sendo texto.
   */
  trechos(texto: string): Trecho[];
}

const TAMANHO_MINIMO = 4;

/**
 * O corpus que o detector usa quando não há verbetes carregados.
 *
 * A wiki é a melhor fonte, mas ela chega por rede e só na página dela. Uma
 * carta ou o texto de um turno precisam decidir o que é nome próprio sem
 * esperar por nenhuma requisição, e as biografias do cânone são exatamente a
 * prosa portuguesa densa de que o filtro de palavra comum precisa — é lá que
 * "pedra", "lobo" e "cinza" aparecem em minúscula e deixam de ser gente.
 */
export function corpusDoCanone(): VerbeteAnalisavel[] {
  const verbetes: VerbeteAnalisavel[] = [];
  for (const [id, texto] of Object.entries(NPC_BIOGRAPHIES)) {
    verbetes.push({ entryId: `bio:${id}`, title: "", body: texto });
  }
  for (const [chave, elenco] of Object.entries(HOUSE_CHARACTERS)) {
    for (const p of elenco) {
      verbetes.push({ entryId: `ficha:${chave}:${p.name}`, title: "", body: p.description ?? "" });
    }
  }
  return verbetes;
}

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
const RANK: Record<NpcTier, number> = { MAJOR: 0, RELEVANT: 1, MINOR: 2 };

/**
 * Junta os registros que descrevem a mesma pessoa antes de procurar ambiguidade.
 *
 * Sem isto, alguém listado duas vezes disputa o próprio nome consigo mesmo e
 * some — foi o que aconteceu com Alic Valerius, que aparece pela Casa e pela
 * Coroa. Quando há empate real, fica a ficha mais central.
 */
function umRegistroPorPessoa(elenco: PersonagemDoElenco[]): PersonagemDoElenco[] {
  const melhor = new Map<string, PersonagemDoElenco>();
  for (const pessoa of elenco) {
    const chave = nameKey(pessoa.nome);
    const atual = melhor.get(chave);
    if (!atual) {
      melhor.set(chave, pessoa);
      continue;
    }
    const antes = RANK[atual.tier ?? "MINOR"];
    const agora = RANK[pessoa.tier ?? "MINOR"];
    if (agora < antes) melhor.set(chave, pessoa);
  }
  return [...melhor.values()];
}

export function construirDetector(
  verbetes: VerbeteAnalisavel[],
  elencoBruto: PersonagemDoElenco[] = fullCodex().map((n) => ({ id: n.id, nome: n.name, tier: n.tier })),
): Detector {
  const elenco = umRegistroPorPessoa(elencoBruto);
  const comuns = palavrasComuns(verbetes);
  const casas = vocabularioDasCasas(comuns);
  // Um nome que também batiza uma Casa ou uma cidade pertence ao lugar: o
  // texto que diz "Karasoy" quase sempre fala da Casa, não da pessoa.
  const topônimos = new Set([...casas.values()].flat());
  const dono = vocabularioDoElenco(elenco, comuns, topônimos);
  const ordem = new Map(elenco.map((p, i) => [p.id, i]));

  const casa = (termo: string) => new RegExp(`\\b${escapar(termo)}\\b`);

  return {
    trechos(texto) {
      const dobrado = fold(texto);
      // `fold` decompõe e recompõe: em português ele preserva o comprimento,
      // mas se algum dia não preservar, os índices apontariam para o lugar
      // errado e o link cairia no meio de outra palavra. Melhor não linkar.
      if (!texto || dobrado.length !== texto.length) {
        return texto ? [{ tipo: "texto", valor: texto }] : [];
      }

      const marcas: { inicio: number; fim: number; id: string }[] = [];
      for (const [termo, id] of dono) {
        const achado = new RegExp(`\\b${escapar(termo)}\\b`).exec(dobrado);
        if (achado) marcas.push({ inicio: achado.index, fim: achado.index + termo.length, id });
      }
      marcas.sort((a, b) => a.inicio - b.inicio);

      const partes: Trecho[] = [];
      let cursor = 0;
      for (const marca of marcas) {
        // Dois nomes não podem ocupar o mesmo pedaço de texto.
        if (marca.inicio < cursor) continue;
        if (marca.inicio > cursor) partes.push({ tipo: "texto", valor: texto.slice(cursor, marca.inicio) });
        partes.push({ tipo: "pessoa", valor: texto.slice(marca.inicio, marca.fim), id: marca.id });
        cursor = marca.fim;
      }
      if (cursor < texto.length) partes.push({ tipo: "texto", valor: texto.slice(cursor) });
      return partes;
    },

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
