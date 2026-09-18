import { SEATS, houseProfileFor, type NpcDynamic, houseRoster, codexBySeat, personaFor, selectFactsForLetter, describeFacts, type HouseRelation, type WorldFact } from "@ravenloft/content";
import { faltas, outreachTone, sobras, type OutreachPlan } from "./outreach";
import { VOICE_RULES } from "./voice";
import { TRADE_SCALE_RULES } from "./escala";
import { CRISIS_RULES } from "./crise";
import { STAGE_RULES } from "./estagio";
import { READABILITY_RULES } from "./leitura";
import { estadoInterior, historicoDaRelacao } from "./estado";
import { descreverCompromissos, descreverFio, type Dossie } from "./dossie";
import { ladoDaSede } from "./lados";

export const OUTREACH_SYSTEM_PROMPT = [
  "Você escreve como a chancelaria de uma Grande Casa de Valdren, uma campanha política de fantasia sombria.",
  "Esta carta é uma INICIATIVA sua: ninguém lhe escreveu antes. Você está procurando a outra Casa por vontade própria.",
  "",
  "Regras:",
  "1. Diga logo por que está escrevendo. Uma carta que leva três parágrafos para chegar ao ponto já falhou.",
  // A regra 2 pedia PROPOSTA CONCRETA em toda carta, e a 3 mandava trocar o que
  // sobra pelo que falta. Somadas ao formato de saída, que exigia os campos
  // "oferta" e "pedido", uma Casa não tinha como escrever nada que não fosse
  // uma nota de mercadoria: nem aviso, nem ameaça, nem luto, nem cobrança.
  "2. Uma carta tem UM assunto, e ele nem sempre é um negócio. Pode ser um aviso, uma ameaça, uma cobrança de dívida, um pedido de socorro, uma acusação, uma condolência, uma oferta de informação, uma proposta de aliança — ou uma troca de mercadoria. Escolha o que a sua Casa realmente quer desta outra AGORA, e escreva sobre isso.",
  "3. Seja concreto no que o assunto pedir. Se for negócio, diga quantidade e prazo. Se for ameaça, diga o que acontece e quando. Se for aviso, diga o que você viu e onde. Vago é o defeito; mercadoria não é a cura.",
  "4. Você só sabe o que esta Casa saberia: o cânone público e os acontecimentos públicos. Nada de segredos de outras Casas nem da Coroa.",
  "5. Sem cabeçalho de e-mail, sem títulos, sem narração de cena. Uma carta, no máximo 200 palavras, em português.",
  "6. Termine com a assinatura de quem fala pela Casa — e ela precisa ser uma das pessoas que a lista abaixo diz existirem, ou a chancelaria sem nome próprio.",
  "",
  ...STAGE_RULES,
  "",
  ...READABILITY_RULES,
  "",
  // O razão de favores nasce daqui, e por isso "troca" existe — mas OPCIONAL.
  // Enquanto era obrigatório, ele obrigava a carta inteira a ser um escambo
  // para ter o que declarar.
  'Responda SOMENTE com JSON: { "carta": "o texto da carta", "troca": null ou { "oferta": "o que você oferece, em poucas palavras", "pedido": "o que você quer em troca, em poucas palavras" } }.',
  'Preencha "troca" APENAS quando a carta propuser de fato um escambo — o destinatário vai aceitar ou recusar aquilo com um botão. Carta de aviso, ameaça ou acusação tem "troca": null, e isso é o certo, não uma falha.',
  "",
  ...VOICE_RULES,
  "",
  ...TRADE_SCALE_RULES,
  "",
  ...CRISIS_RULES,
].join("\n");

export interface OutreachContext {
  plan: OutreachPlan;
  /** Como a Casa que escreve vê a Casa do jogador. */
  relation: HouseRelation | null;
  /** O evento público do turno, para a carta soar deste momento. */
  publicEvent: string;
  /** A ordem que o jogador escreveu no turno anterior, quando o motivo é essa. */
  lastOrder: string;
  /**
   * O registro do que aconteceu na campanha.
   *
   * A resposta a carta já recebia isto desde o começo; a carta proativa, não —
   * e era ela justamente quem escrevia sem nenhum texto ao qual reagir. As três
   * cartas de abertura do Turno 9 saíram sem saber da aliança orc-Krythos, das
   * máquinas de cerco na estrada, nem da oferta da Ordem dos Três.
   */
  worldFacts?: WorldFact[];
  /**
   * Tudo que as duas Casas já se escreveram, e o que já combinaram.
   *
   * Faltava por inteiro: a carta proativa escrevia para quem ela conhece há
   * cinco turnos sem ver uma linha da conversa. Lady Miriel Ferrumor reabriu um
   * encontro que ela mesma tinha marcado, sem lembrar de tê-lo marcado.
   */
  dossie?: Dossie;
  /** A memória viva de quem escreve: humor, o que teme, o que quer. */
  npcDynamic?: NpcDynamic | null;
}

/**
 * O pedido ao modelo para escrever uma carta não solicitada.
 *
 * Fica separado da resposta a carta (`housePrompt`) porque o problema é outro:
 * ali existe um texto ao qual reagir, e aqui não existe nada — se não dermos um
 * motivo nomeado e as duas despensas, o modelo escreve saudações.
 */
/**
 * Quem, de verdade, pode assinar uma carta desta sede.
 *
 * A carta proativa recebia só a despensa da Casa — quanto ferro, quanto grão —
 * e nenhuma pessoa. Sem alguém real para assinar, o modelo inventava: Gharun
 * Casco-Negro, Iria Valtane, Maera de Lunaval, Edrik Morn, Derrik Vael, Ser
 * Alaric Veyne. Nenhum existe no Codex, e cada um deles é um personagem que a
 * campanha passa a ter sem ficha, sem retrato e sem memória viva.
 *
 * O caminho de resposta nunca teve esse problema porque sempre recebeu a
 * persona do líder e a ficha de quem respondia.
 */
function quemAssina(seatKey: string, seatName: string): string {
  const persona = personaFor(seatKey);
  const gente = [
    ...(persona ? [`${persona.leaderName} — ${persona.title}`] : []),
    ...codexBySeat(seatKey).map((n) => `${n.name} — ${n.role}`),
    ...houseRoster(seatKey).map((c) => `${c.name} — ${c.role}`),
  ];
  const vistos = new Set<string>();
  const lista = gente.filter((g) => !vistos.has(g) && vistos.add(g));

  if (lista.length === 0) {
    return `QUEM ASSINA: nenhuma pessoa desta sede está registrada no cânone. Assine como "Pela chancelaria de ${seatName}", sem inventar nome próprio.`;
  }
  return [
    "QUEM ASSINA. Estas são as pessoas que existem nesta sede:",
    ...lista.map((g) => `- ${g}`),
    "",
    `Assine com UMA delas, escolhendo quem faria sentido tratar deste assunto. Se nenhuma servir, assine "Pela chancelaria de ${seatName}", sem nome próprio.`,
    "NUNCA invente um nome. Um nome inventado vira um personagem que o reino passa a ter sem ficha, e o Mestre precisa depois decidir quem é essa pessoa que ele nunca criou.",
  ].join("\n");
}

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
    const despensa =
      `${plan.toHouseName}: ${dele.resources}\n\n` +
      `O que lhes sobra: ${sobras(dele).join(", ") || "pouco"}. O que lhes falta: ${faltas(dele).join(", ") || "nada declarado"}.`;
    parts.push(
      plan.kind === "ESCASSEZ"
        ? `${despensa}\n\nPeça o que lhes sobra. Ofereça o que lhe sobra. Não peça o que falta aos dois.`
        : `${despensa}\n\nIsto informa o que é possível. Não transforme a carta num escambo só porque as despensas encaixam.`,
    );
  }

  // O lado vem ANTES do tom e do evento: é o que decide se a carta ameaça ou
  // corteja, e chegava tarde demais para o modelo levar em conta.
  const lado = ladoDaSede(plan.fromSeatKey);
  if (lado) parts.push(lado);

  if (ctx.dossie) {
    const fio = descreverFio(ctx.dossie, plan.toHouseName, plan.fromSeatName);
    if (fio) parts.push(fio);
    const comp = descreverCompromissos(ctx.dossie);
    if (comp) parts.push(comp);
  }

  const fatos = describeFacts(
    selectFactsForLetter(ctx.worldFacts ?? [], { seats: [plan.fromSeatKey, plan.toSeatKey ?? ""] }),
    (k) => SEATS.find((s) => s.key === k)?.name ?? k,
  );
  if (fatos) parts.push(`O que já aconteceu e não se discute:\n${fatos}`);

  const dentro = estadoInterior(personaFor(plan.fromSeatKey), ctx.npcDynamic ?? null);
  if (dentro) parts.push(dentro);
  if (ctx.dossie) {
    const rel = historicoDaRelacao(ctx.dossie.fio, ctx.npcDynamic ?? null, plan.toHouseId, plan.toHouseName);
    if (rel) parts.push(rel);
  }

  parts.push(quemAssina(plan.fromSeatKey, plan.fromSeatName));

  parts.push(outreachTone(ctx.relation));
  if (ctx.publicEvent.trim()) parts.push(`O que está acontecendo no reino:\n${ctx.publicEvent.trim().slice(0, 1200)}`);
  if (ctx.lastOrder.trim() && plan.kind === "ORDEM") {
    // Só o que uma Casa de fora perceberia: a ordem inteira é privada.
    parts.push(`O que ${plan.toHouseName} fez, na parte que se tornou visível:\n${ctx.lastOrder.trim().slice(0, 600)}`);
  }

  parts.push(`Escreva a carta de ${plan.fromSeatName} a ${plan.toHouseName}.`);
  return parts.join("\n\n");
}
