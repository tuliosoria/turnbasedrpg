import { givenName } from "@ravenloft/content";
import { escalaAbsurda } from "../src/ai/diplomacy/escala";
import { conferirOrdem, extrairPrazo, MARCADOR_PEDIDO } from "./gerar-snapshot-turno.mjs";

/**
 * Métricas de uma carta gerada, sem modelo nenhum.
 *
 * São sinais para decidir onde olhar, não notas: cada uma devolve também o
 * trecho que a disparou, porque tom e voz não cabem em número e o relatório
 * precisa deixar o Mestre conferir a leitura.
 */

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavras = (s) => fold(s).match(/[a-z0-9]+/g) ?? [];
const frases = (s) => String(s ?? "").split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter(Boolean);

const TAM_SHINGLE = 5;
const shingles = (texto) => {
  const w = palavras(texto);
  const out = new Set();
  for (let i = 0; i + TAM_SHINGLE <= w.length; i++) out.add(w.slice(i, i + TAM_SHINGLE).join(" "));
  return out;
};

/** Fração dos trechos de cinco palavras da resposta que a Casa já escreveu neste fio. */
export function reciclagem(resposta, anterioresDaCasa) {
  const dela = shingles(resposta);
  if (!dela.size) return 0;
  const ja = new Set(anterioresDaCasa.flatMap((c) => [...shingles(c)]));
  let repetidos = 0;
  for (const s of dela) if (ja.has(s)) repetidos++;
  return repetidos / dela.size;
}

const VAZIAS = new Set(("a o e é as os um uma de do da dos das em no na nos nas ao aos à às por para com sem que se não nao mais mas " +
  "como seu sua seus suas nosso nossa nossos nossas vosso vossa vossos vossas este esta isso isto aquele aquela ele ela eles elas " +
  "vos nos lhe lhes me te já ja quando onde entre sobre até ate pelo pela pelos pelas").split(" "));
const conteudo = (w) => w.length >= 3 && !VAZIAS.has(w);

const contar = (texto, termo) => {
  const alvo = ` ${palavras(texto).join(" ")} `;
  return alvo.split(` ${termo} `).length - 1;
};

/**
 * Os termos que o fio martelou (≥ 3 vezes) e quantas vezes voltam na resposta.
 * Pares de palavras de conteúdo ("vau negro") e palavras longas ("tecido").
 * `ignorar`: os nomes das duas Casas — dizer "Solarion" três vezes numa carta
 * a Solarion é endereçamento, não repetição.
 * `recebida`: termo que a carta de agora trouxe é o assunto. Pesquisadores
 * mandados "ao Vau Negro" pedem resposta que fale do Vau Negro.
 */
export function termosBatidos(fioAnterior, resposta, limite = 5, ignorar = [], recebida = "") {
  const dosNomes = new Set(ignorar.flatMap(palavras));
  const assunto = ` ${palavras(recebida).join(" ")} `;
  const candidatos = new Set();
  for (const carta of fioAnterior) {
    const w = palavras(carta);
    w.forEach((p, i) => {
      if (p.length >= 6 && conteudo(p)) candidatos.add(p);
      const q = w[i + 1];
      if (q && conteudo(p) && conteudo(q)) candidatos.add(`${p} ${q}`);
    });
  }
  return [...candidatos]
    .map((termo) => ({ termo, noFio: fioAnterior.reduce((n, c) => n + contar(c, termo), 0) }))
    .filter((t) => t.noFio >= 3 && !t.termo.split(" ").every((w) => dosNomes.has(w)) && !assunto.includes(` ${t.termo} `))
    .sort((a, b) => b.noFio - a.noFio || b.termo.length - a.termo.length || a.termo.localeCompare(b.termo))
    .slice(0, limite)
    .map((t) => ({ ...t, naResposta: contar(resposta, t.termo) }));
}

/**
 * Perguntas e pedidos da carta recebida, e quais a resposta ecoa.
 * Proxy lexical: um terço das palavras-chave da frase presentes na resposta.
 */
export function eco(recebida, resposta) {
  const alvos = frases(recebida).filter((f) => f.includes("?") || MARCADOR_PEDIDO.test(f));
  const semEco = [];
  for (const f of alvos) {
    const { chaves, achadas } = conferirOrdem(f, resposta);
    if (!chaves.length || achadas.length / chaves.length < 1 / 3) semEco.push(f);
  }
  return { total: alvos.length, respondidas: alvos.length - semEco.length, semEco };
}

// Nome próprio: maiúscula inicial, hífen interno, sequência ligada por espaço
// ou conector minúsculo. Mesmo desenho do índice de primeira menção.
const TOKEN_NOME = String.raw`\p{Lu}[\p{Ll}]*(?:['’]\p{L}[\p{Ll}]*)*(?:-(?:\p{Lu}|\p{Ll})[\p{Ll}]*)*`;
const NOME = new RegExp(`${TOKEN_NOME}(?:(?:[ \\t]+(?:de|do|da|dos|das|e)[ \\t]+|[ \\t]+)${TOKEN_NOME})*`, "gu");

/**
 * Nomes próprios da resposta que não aparecem em lugar nenhum do que se conhece.
 * `conhecidos` aceita nomes e textos inteiros (o fio, a carta recebida). Só
 * conta nome no MEIO da frase — "Depois" abrindo parágrafo não é personagem.
 */
export function nomesForaDoCanone(resposta, conhecidos) {
  const acervo = ` ${palavras(conhecidos.join(" \n ")).join(" ")} `;
  const out = new Set();
  for (const m of String(resposta ?? "").matchAll(NOME)) {
    const antes = resposta.slice(0, m.index).trimEnd();
    if (!antes || /[.!?:\n—"«]$/.test(antes)) continue;
    const nome = m[0];
    const chave = palavras(nome).join(" ");
    if (!chave || acervo.includes(` ${chave} `)) continue;
    out.add(nome);
  }
  return [...out];
}

// Mais largo que o detector do cânone de propósito: "caiu"/"cair" entram, e a
// posse ("de Thorgul") não é retirada — um falso negativo foi o que deixou
// Thorgul morto em duas cartas. Em troca, a palavra de morte tem de vir LOGO
// depois do nome (até quatro palavras) e não pode ser ameaça ("será morto"):
// "Asterhall caiu, e Kaelen se fez coroar" e "gente de Thorgul será morta"
// dispararam o critério à toa na primeira medição.
const MORTE = "(?:morreu|morrera|morto|morta|pereceu|falecid[oa]|tombou|caiu|cair|caido|caida|abatid[oa]|decapitad[oa]|enterrad[oa]|sepultad[oa])";
const AMEACA = /\b(?:sera|serao|seria|seriam|sejam?|fosse|for)\s+(?:\S+\s+)?$/;

/** Pessoas vivas que a resposta dá como mortas, com a frase que o diz. */
export function morteAfirmada(resposta, vivos) {
  const out = [];
  for (const nome of vivos) {
    const primeiro = givenName(nome);
    if (!primeiro) continue;
    const re = new RegExp(`\\b${primeiro}\\b((?:\\W+\\w+){0,4}?)\\W+${MORTE}\\b`, "g");
    for (const f of String(resposta ?? "").match(/[^.!?]+[.!?]?/g) ?? []) {
      const d = fold(f);
      const hit = [...d.matchAll(re)].some((m) => !AMEACA.test(`${m[1]} `.replace(/^\W+/, "")));
      if (hit) out.push({ nome, frase: f.trim() });
    }
  }
  return out;
}

export function medirCarta({ resposta, recebida, anterioresDaCasa, fioAnterior, nomesConhecidos, vivos, motivos, casas = [] }) {
  const texto = String(resposta ?? "");
  return {
    tamanho: texto.length,
    vazia: !texto.trim(),
    reciclagem: reciclagem(texto, anterioresDaCasa),
    termosBatidos: termosBatidos(fioAnterior, texto, 5, casas, recebida),
    eco: eco(recebida, texto),
    prazos: extrairPrazo(texto),
    escala: escalaAbsurda(texto),
    nomesForaDoCanone: nomesForaDoCanone(texto, [...nomesConhecidos, ...fioAnterior, recebida]),
    morteAfirmada: morteAfirmada(texto, vivos),
    motivosRevisor: motivos ?? [],
  };
}
