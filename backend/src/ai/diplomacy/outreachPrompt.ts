import { houseProfileFor, type HouseRelation } from "@ravenloft/content";
import { faltas, outreachTone, sobras, type OutreachPlan } from "./outreach";
import { VOICE_RULES } from "./voice";
import { TRADE_SCALE_RULES } from "./escala";

export const OUTREACH_SYSTEM_PROMPT = [
  "Você escreve como a chancelaria de uma Grande Casa de Valdren, uma campanha política de fantasia sombria.",
  "Esta carta é uma INICIATIVA sua: ninguém lhe escreveu antes. Você está procurando a outra Casa por vontade própria.",
  "",
  "Regras:",
  "1. Diga logo por que está escrevendo. Uma carta que leva três parágrafos para chegar ao ponto já falhou.",
  "2. Faça uma PROPOSTA concreta: o que você oferece, o que você quer em troca, em que quantidade e prazo. Nada de 'estreitar laços' sem dizer com o quê.",
  "3. Nunca peça o que a outra Casa também declara faltar. Peça o que ela tem de sobra e ofereça o que sobra em você.",
  "4. Você só sabe o que esta Casa saberia: o cânone público e os acontecimentos públicos. Nada de segredos de outras Casas nem da Coroa.",
  "5. Sem cabeçalho de e-mail, sem títulos, sem narração de cena. Uma carta, no máximo 200 palavras, em português.",
  "6. Termine com a assinatura de quem fala pela Casa.",
  "",
  // O razão de favores existia e nunca teve um único registro, porque a única
  // coisa que o enchia era um projeto concluído com efeito de favor, e nenhum
  // jamais concluiu. A carta é a torneira natural: é assim que dívida política
  // nasce numa mesa de verdade.
  'Responda SOMENTE com JSON: { "carta": "o texto da carta", "oferta": "o que você oferece, em poucas palavras", "pedido": "o que você quer em troca, em poucas palavras" }.',
  'A "oferta" e o "pedido" precisam bater exatamente com o que a carta diz. São o que o destinatário vai aceitar ou recusar com um botão.',
  "",
  ...VOICE_RULES,
  "",
  ...TRADE_SCALE_RULES,
].join("\n");

export interface OutreachContext {
  plan: OutreachPlan;
  /** Como a Casa que escreve vê a Casa do jogador. */
  relation: HouseRelation | null;
  /** O evento público do turno, para a carta soar deste momento. */
  publicEvent: string;
  /** A ordem que o jogador escreveu no turno anterior, quando o motivo é essa. */
  lastOrder: string;
}

/**
 * O pedido ao modelo para escrever uma carta não solicitada.
 *
 * Fica separado da resposta a carta (`housePrompt`) porque o problema é outro:
 * ali existe um texto ao qual reagir, e aqui não existe nada — se não dermos um
 * motivo nomeado e as duas despensas, o modelo escreve saudações.
 */
export function buildOutreachUser(ctx: OutreachContext): string {
  const { plan } = ctx;
  const meu = houseProfileFor(plan.fromSeatKey);
  const dele = plan.toSeatKey ? houseProfileFor(plan.toSeatKey) : null;
  const parts: string[] = [
    `Você é a chancelaria de ${plan.fromSeatName}. Escreve a ${plan.toHouseName}, que não lhe escreveu.`,
    `Por que você está escrevendo: ${plan.motive}`,
  ];

  if (meu) {
    parts.push(
      `A sua Casa: ${meu.resources}\nRiqueza: ${meu.wealth}\nSoldados: ${meu.soldiers}\n\n` +
        `O que lhe sobra: ${sobras(meu).join(", ") || "pouco"}. O que lhe falta: ${faltas(meu).join(", ") || "nada declarado"}.`,
    );
  }
  if (dele) {
    parts.push(
      `${plan.toHouseName}: ${dele.resources}\n\n` +
        `O que lhes sobra: ${sobras(dele).join(", ") || "pouco"}. O que lhes falta: ${faltas(dele).join(", ") || "nada declarado"}.\n\n` +
        `Peça o que lhes sobra. Ofereça o que lhe sobra. Não peça o que falta aos dois.`,
    );
  }

  parts.push(outreachTone(ctx.relation));
  if (ctx.publicEvent.trim()) parts.push(`O que está acontecendo no reino:\n${ctx.publicEvent.trim().slice(0, 1200)}`);
  if (ctx.lastOrder.trim() && plan.kind === "ORDEM") {
    // Só o que uma Casa de fora perceberia: a ordem inteira é privada.
    parts.push(`O que ${plan.toHouseName} fez, na parte que se tornou visível:\n${ctx.lastOrder.trim().slice(0, 600)}`);
  }

  parts.push(`Escreva a carta de ${plan.fromSeatName} a ${plan.toHouseName}.`);
  return parts.join("\n\n");
}
