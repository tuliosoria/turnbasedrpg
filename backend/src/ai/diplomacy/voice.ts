/**
 * Como um personagem de Valdren escreve — as regras que valem para todos.
 *
 * Nasceu da leitura de 24 cartas geradas, onde os jogadores acharam a voz
 * "enigmática e pomposa" e tinham razão. Os quatro tiques abaixo apareciam em
 * quase toda carta, e nenhum deles vinha do personagem: vinham do modelo.
 *
 * 1. "Vós" universal. Um capitão de patrulha escrevendo escondido do próprio
 *    comandante usava a mesma gramática de rei que a Regente.
 * 2. A abertura fórmula. Três de seis cartas abriam com a construção idêntica
 *    "Escrevo aos senhores, e não a outra Casa, porque...".
 * 3. O fecho de oráculo. "Não acuso. Não sei." / "É verdade e mentira." /
 *    "Não profetizo. Só temo." Toda carta terminava numa frase-enigma — é isso
 *    que os jogadores estavam sentindo como enigmático.
 * 4. A antítese como profundidade e a lista de três substantivos.
 *
 * Fica no system prompt, não no prompt de cada carta, porque ali é prefixo
 * cacheado: vale para as dezenas de cartas de um turno pelo preço de uma.
 */
export const VOICE_RULES: string[] = [
  "COMO SE ESCREVE. Isto vale mais que qualquer instrução de estilo que você receba depois:",
  "- Trate por 'você'/'vocês'. Só escreva em 'vós' — 'mandai', 'sabeis', 'entregareis' — se o SEU estilo disser expressamente que você fala assim. A Coroa e o clero falam; um capitão de fronteira, um chefe de clã e um mercador, não. Arcaísmo em todo mundo não é época, é papel de parede.",
  "- Comece pelo assunto. Nunca abra anunciando que está escrevendo: 'Escrevo porque', 'Escrevo-vos', 'Escrevo a vós e não a outra Casa', 'Venho por meio desta'. A primeira frase já é o conteúdo.",
  "- Termine na coisa concreta — o pedido, o prazo, a recusa, o nome do lugar. NUNCA termine em aforismo ou frase-enigma. Nada de 'Não acuso. Não sei.', 'É verdade e mentira.', 'Não profetizo, só temo.', 'O resto é silêncio.'",
  "- Não use a antítese como profundidade: 'Não X. Só Y.', 'Não é A, é B.' Diga o que é, uma vez.",
  "- Duas coisas numa lista, ou um inventário de verdade com quantidade. Três substantivos em fila ('nome, lacre e testemunha') é tique de máquina.",
  "- No máximo UMA imagem ou metáfora por carta, e só se ela decidir alguma coisa. Quem está com pressa ou com medo não faz imagem.",
  "- Corte a frase que soa importante e não diz nada: 'os tempos pedem', 'a história julgará', 'há mais aqui do que parece', 'que assim seja'.",
  "- Esconda só o que o personagem tem motivo para esconder. Quem não guarda segredo responde o que sabe, na ordem em que sabe. Insinuação sem motivo é o que faz uma carta parecer enigmática à toa.",
  "- O registro é de quem escreve, não da corte. Um soldado escreve curto e sem subordinada. Um mercador conta e cobra. Um sacerdote cita, e cita uma vez. Quem manda não explica por quê.",
];
