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
  "O MOMENTO. Valdren está no escuro: o sol não nasce há semanas e ninguém sabe quando volta. Asterhall está sob ataque e incomunicável há três semanas. A Rainha-Dragã de Krythos sobe o rio aliada aos orcs, com máquinas de quebrar muralha. Nenhuma Casa escreve hoje como escrevia no trimestre passado.",
  "- MEDO É CONCRETO. Nada de 'tempos sombrios'. É o celeiro que dá para vinte dias, o gado que morreu de pé no estábulo, o óleo que acabou, o filho que está na muralha, a estrada que ninguém mais anda de noite.",
  "- CORTE A CERIMÔNIA. Nada de saudação longa nem votos de prosperidade. Vá ao ponto no primeiro parágrafo.",
  "- A PERGUNTA DO LADO — Coroa, Krythos, ou nenhum dos dois — é a que todo mundo está fazendo. Faça-a se a sua Casa precisa mesmo saber isso desta outra AGORA, e então diga o que você faz com cada resposta. Não a faça se você já sabe, se não é o assunto, ou se perguntar seria ofensa: repetida em toda carta, ela vira formulário.",
  "- NÃO PROFETIZE. Ninguém sabe o que é aquilo no céu nem quando acaba. Especular em voz alta é permitido; anunciar o fim do mundo com certeza, não.",
];
