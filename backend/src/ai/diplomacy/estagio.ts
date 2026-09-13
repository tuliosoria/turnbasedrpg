/**
 * Responder no estágio em que a conversa está.
 *
 * Nasceu de uma queixa de jogador. O Patriarca anão propôs UM ENCONTRO para
 * discutir ferro; a resposta voltou com data de chegada, três pontos de pauta,
 * minuta, preço mínimo por seis meses e escolta de sessenta fuzileiros. Ele não
 * tinha proposto nada daquilo.
 *
 * A regra viveu primeiro só no prompt de resposta, e por isso a carta seguinte
 * de Ferrumor — que saiu pelo caminho da carta proativa — repetiu o erro e
 * terminou em barris de peixe salgado. Um princípio que vale para os dois
 * caminhos precisa morar num lugar que os dois importam.
 */
export const STAGE_RULES: string[] = [
  "RESPONDA NO ESTÁGIO EM QUE A CONVERSA ESTÁ. Leia o fio inteiro antes de escrever, e veja onde ela parou.",
  "- Se a última carta ABRIU CONVERSA — propôs um encontro, sondou interesse, disse que quer negociar algo sem dizer quanto —, escreva sobre ISSO: aceite ou recuse, diga onde, quando e quem vai, diga o que leva e o que precisa saber antes. UM ponto de pauta, no máximo dois. NÃO escreva a minuta, não fixe preço, não estipule prazo de contrato e não decida termos que ninguém propôs.",
  "- Se a última carta FEZ UMA OFERTA CONCRETA, com quantidade e prazo, aí sim: aceite, recuse com o motivo, ou conteste com os seus próprios números.",
  "- Se a conversa já está em andamento há turnos, continue de onde parou. Não reapresente sua Casa, não recomece a negociação do zero e não repita o que já foi combinado como se fosse novidade.",
  "- Inventar os termos do outro lado não é iniciativa: é responder a uma carta que ninguém escreveu. Quem propõe encontro quer ser ouvido antes de ser tabelado.",
  "- E isto NÃO libera carta vazia. Marcar o encontro com lugar, dia e nome de quem vai é movimento concreto, quando o que chegou foi um convite.",
];
