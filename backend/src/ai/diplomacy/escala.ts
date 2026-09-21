/**
 * Quanto cabe numa carroça — a âncora que faltava às cartas de comércio.
 *
 * Sem ela, o modelo escrevia números que soam impressionantes e não existem:
 * uma carta de Valerius ofereceu "8.000 sacas de trigo" por "300 toneladas de
 * ferro", em dois comboios. São quase quinhentas carroças de boi por comboio,
 * duas vezes, numa estrada de inverno com orcs acampados no caminho.
 *
 * O problema não é o modelo ignorar a Idade Média: é ele não ter com o que
 * comparar. Quando o contexto ancorava — a Euralune negociando correio —, ele
 * escreveu "seis tubos selados por viagem, de no máximo duas libras cada", que
 * é exatamente a escala certa.
 *
 * A defesa central aqui não é o teto, é a EXIGÊNCIA DE DIZER O TRANSPORTE. Um
 * modelo que precisa escrever "seiscentas carroças" percebe sozinho que errou;
 * um que só escreve "300 toneladas" não percebe nada.
 */
/**
 * Só entra quando a carta fala de carga.
 *
 * Era incondicional, e um bloco inteiro sobre quantos bois puxam uma carroça,
 * presente em toda carta, empurra o modelo a arranjar uma carroça para puxar.
 * Uma ameaça não precisa saber a capacidade de uma barcaça de rio.
 */
export const TRADE_SCALE_RULES: string[] = [
  "ESCALA, quando a carta falar de carga. Valdren é medieval: tudo viaja em lombo de mula, carroça de boi, barcaça de rio ou navio de cabotagem. Uma mula leva o peso de um homem; uma carroça de dois bois, o de cinco ou seis, e faz três léguas por dia — metade no inverno, e o inverno é agora. Uma barcaça leva o que vinte carroças levariam, e só onde há rio.",
  "NUNCA escreva 'toneladas'. Use o que o mundo usa: barras e lingotes, sacas, fardos, toras, barris, cabeças de gado. E DIGA COMO A CARGA VIAJA — quantas carroças, quantas mulas, quantos dias. Uma entrega sem transporte é uma entrega que ninguém pode cumprir, e se a conta der em centenas de carroças o número está errado: uma Casa move de dez a trinta por comboio.",
  "Prefira o pequeno e o específico ao grande e redondo. 'Quarenta barras marcadas por guilda' vale mais que 'trezentas toneladas', porque quarenta barras alguém consegue imaginar sendo descarregadas.",
];

/**
 * A fiscalização da escala, em código — porque a troca nunca passou pelo revisor.
 *
 * As regras acima são conselho ao escritor, e a carta que ele escreve ainda tem
 * uma segunda leitura. A TROCA não tem: ela viaja num campo separado do JSON,
 * vira Favor pendente e chega ao jogador com botão de aceitar sem ninguém ter
 * relido. Foi assim que "8.000 sacas de trigo por 300 toneladas de ferro" ficou
 * três semanas na tela de Khazdrun, oferecida pela Coroa.
 *
 * Conferido com número na mão, e não por mais uma regra de prompt: é a parte que
 * não pode alucinar, como o dossiê. Os limites são largos de propósito — só
 * pegam o que nenhuma estrada de Valdren comporta, e deixam passar o que a
 * campanha já negociou de verdade (1.000 peles curtidas é um pacto de pé).
 */
const MERCADORIA = /^(sacas?|sacos?|barras?|lingotes?|toras?|fardos?|barris|barricas?|rolos?|peles?|cabecas?|arcas?|quintais|frascos?|globos?|tubos?|caixas?)$/;
const TRANSPORTE = /^(carrocas?|mulas?|bois|barcacas?|navios?|gales?|carros?)$/;
/** Em carroça de boi, milhares de unidades são centenas de carroças. */
const LIMITE_MERCADORIA = 2000;
/** "Uma Casa move de dez a trinta por comboio" — cem já é outra ordem de coisa. */
const LIMITE_TRANSPORTE = 100;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Devolve o que está fora de escala, em poucas palavras, ou null quando passa.
 *
 * Dinheiro fica de fora da conta: marco de ouro não viaja em carroça, e carta
 * de crédito em milhares de marcos é rotina de uma Casa que empresta.
 */
export function escalaAbsurda(texto: string): string | null {
  const t = semAcento(texto ?? "");
  if (!t.trim()) return null;
  if (/toneladas?\b/.test(t)) return "fala em toneladas";
  for (const m of t.matchAll(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(\s*mil\b)?\s+(?:de\s+)?([a-z]+)/g)) {
    const base = Number(m[1].replace(/[.\s]/g, ""));
    const valor = m[2] ? base * 1000 : base;
    const unidade = m[3];
    if (!Number.isFinite(valor)) continue;
    if (MERCADORIA.test(unidade) && valor >= LIMITE_MERCADORIA) return `${valor} ${unidade}`;
    if (TRANSPORTE.test(unidade) && valor >= LIMITE_TRANSPORTE) return `${valor} ${unidade}`;
  }
  return null;
}

/**
 * Encurta sem cortar palavra no meio.
 *
 * Era `slice(0, 120)`, e o razão do jogador exibia "entregues em Raven's Cross
 * por seis carroças e doze mulas em o" e "a conta atual de Maelor Véspe". Uma
 * oferta que termina no meio de um nome não é uma oferta que alguém aceita.
 */
export function encurtar(texto: string, limite = 160): string {
  const t = (texto ?? "").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  const inteiro = espaco > limite * 0.6 ? corte.slice(0, espaco) : corte;
  return `${inteiro.replace(/[\s,;:.]+$/, "")}…`;
}
