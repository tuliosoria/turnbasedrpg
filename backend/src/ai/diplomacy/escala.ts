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
export const TRADE_SCALE_RULES: string[] = [
  "ESCALA DO MUNDO. Valdren é medieval: não há motor, guindaste nem estrada asfaltada. Tudo que se negocia viaja em lombo de mula, carroça de boi, barcaça de rio ou navio de cabotagem.",
  "- Uma mula ou cavalo de carga leva o peso de um homem adulto. Uma carroça de dois bois leva o de cinco ou seis, e faz umas três léguas por dia em estrada boa — metade no inverno, e o inverno é agora.",
  "- Uma barcaça de rio leva o que vinte carroças levariam. Um navio de cabotagem, o que uma vila inteira produz numa estação. Barcaça e navio só servem onde há rio navegável ou porto, e o mapa diz onde há.",
  "- NUNCA escreva 'toneladas'. Ninguém em Valdren pesa assim. Use as medidas que o mundo usa: lingotes e barras de ferro, sacas de grão, fardos de pele, toras, barris, quintais, cabeças de gado.",
  "- Sempre que propuser uma entrega, DIGA COMO ELA VIAJA: quantas carroças, quantas mulas, quantos barcos, e quantos dias leva. Uma oferta sem transporte é uma oferta que ninguém pode cumprir — e se a conta der em centenas de carroças, o número está errado e você deve baixá-lo.",
  "- Uma Casa move numa entrega o que um comboio de dez a trinta carroças carrega. Mais que isso exige rio ou mar, precisa de escolta, e é assunto de campanha inteira, não de uma carta.",
  "- Prefira o pequeno e o específico ao grande e redondo. 'Quarenta barras marcadas por guilda' vale mais numa mesa que 'trezentas toneladas', porque quarenta barras alguém consegue imaginar sendo descarregadas.",
];
