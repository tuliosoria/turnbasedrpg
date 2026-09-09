/**
 * Como se escreve uma carta quando o céu não abre.
 *
 * As regras de voz existentes ensinam o modelo a não ser pomposo. Não ensinam
 * urgência — e a partir do Turno 8 Valdren deixou de ser um tabuleiro de
 * comércio. O sol não nasce há semanas, a capital está incomunicável, e há uma
 * rainha estrangeira subindo o rio com máquinas de cerco.
 *
 * Sem isto, o modelo continua escrevendo cartas de negociação de trigo com a
 * cortesia de um trimestre normal, porque é o que os exemplos anteriores do
 * fio ensinam. As Casas precisam soar como gente decidindo em que lado ficar
 * antes que a decisão seja tomada por elas.
 *
 * Estas regras entram DEPOIS das de voz e não as revogam: continua proibido o
 * aforismo, o "vós" fora de personagem e a metáfora empilhada. Desespero não é
 * licença para floreio — é a razão de o floreio sumir.
 */
export const CRISIS_RULES: string[] = [
  "O MOMENTO. Valdren está no escuro. O sol não nasce há semanas e ninguém sabe quando volta; Asterhall está sob ataque e incomunicável há três semanas; a Rainha-Dragã de Krythos sobe o rio aliada aos orcs, com máquinas de quebrar muralha. Nenhuma Casa escreve hoje como escrevia no trimestre passado.",
  "- ESCREVA COM PRESSA. Frases mais curtas, menos cortesia de abertura, prazos mais apertados. Uma Casa que pede trinta dias hoje pede dez. Quem tem estoque conta os dias dele em voz alta.",
  "- PERGUNTE DE QUE LADO O OUTRO ESTÁ. É a pergunta que todo mundo está fazendo e quase ninguém fez por escrito ainda: Coroa, Krythos, ou nenhum dos dois. Faça-a com todas as letras, e diga o que a sua Casa faz com cada resposta.",
  "- PERGUNTE O QUE ELES VÃO FAZER, e não o que eles acham. 'Vocês vão mandar homens?' vale mais que 'qual a vossa leitura da situação'.",
  "- A SOLARION SE PERGUNTA SOBRE O CÉU. Foi a única Casa que acertou a data e avisou antes, e agora todo mundo quer o número que ela não tem: quanto tempo mais dura o escuro. Quem escreve a Solarion pergunta isso, e paga para saber — em grão, em passagem, em silêncio, no que tiver.",
  "- MEDO É CONCRETO. Não escreva 'tempos sombrios'. Escreva o celeiro que dá para vinte dias, o gado que morreu de pé no estábulo, o óleo que acabou, o filho que está na muralha, a estrada que ninguém mais anda de noite.",
  "- CORTE A CERIMÔNIA. Nada de saudação longa, votos de prosperidade ou desejos ao final. Uma Casa com medo vai ao ponto no primeiro parágrafo e assina no último.",
  "- NÃO PROFETIZE. Ninguém em Valdren sabe o que é aquilo no céu, ninguém sabe quando acaba, e ninguém deve escrever como se soubesse. Especular em voz alta é permitido; anunciar o fim do mundo com certeza, não.",
];
