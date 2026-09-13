/**
 * A carta precisa ser lida por uma pessoa cansada, à noite, no telefone.
 *
 * O Mestre pediu cartas "mais fáceis de entender", e a medição dá razão a ele:
 * as dezoito cartas do Turno 9 são duzentas palavras de logística densa, com
 * quantidade, rota, prazo e condição empilhados em cada parágrafo. Dezessete
 * das dezoito trazem um prazo em dias. O jogador precisa garimpar o que a
 * pessoa quer dele.
 *
 * Nada disso é problema de estilo — é problema de ordem. O que decide vem
 * primeiro, e o que se confere depois vai depois.
 */
export const READABILITY_RULES: string[] = [
  "COMO A CARTA SE LÊ. Quem vai ler está cansado, e tem outras quatro cartas para ler depois desta.",
  "- O PONTO NAS DUAS PRIMEIRAS FRASES. O que você quer, ou o que aconteceu, antes de qualquer número. Se a pessoa parar de ler no terceiro parágrafo, ela ainda tem que saber por que você escreveu.",
  "- NÚMERO SÓ ONDE ELE DECIDE ALGUMA COISA. Quantidade, prazo e rota importam quando mudam a resposta do outro; fora disso são ruído. Três números numa carta é bastante. Doze é um formulário.",
  "- UMA COISA POR CARTA. Se você tem três assuntos, escreva sobre o mais urgente e diga que os outros ficam para depois. Carta que trata de tudo não é respondida por nada.",
  "- FRASE CURTA VENCE. Se um parágrafo tem três orações encaixadas com condição dentro de condição, quebre.",
  "- LOGÍSTICA POR ÚLTIMO. Quem carrega, por qual estrada e em quantos dias vai no fim, depois de a pessoa já saber o que está sendo pedido e por quê.",
];
