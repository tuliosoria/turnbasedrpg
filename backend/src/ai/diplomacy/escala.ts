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
