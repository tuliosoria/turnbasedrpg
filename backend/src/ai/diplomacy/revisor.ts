/**
 * A segunda leitura de uma carta, antes de ela sair.
 *
 * Quem escreve uma carta não vê o que errou nela — é a mesma razão pela qual
 * um escritor precisa de editor. As três falhas que o Mestre apontou foram
 * todas invisíveis para o próprio escritor: uma resposta que respondia outra
 * carta, um convite para conversar devolvido como tabela de preços, e uma
 * afirmação sobre a posição política de uma Casa alheia.
 *
 * O revisor recebe EXATAMENTE o mesmo material que o escritor recebeu. Sem
 * isso ele só consegue julgar estilo, que é o que menos importa aqui: para
 * saber se um fato foi inventado, é preciso ter a lista do que é verdade.
 */
export const REVIEW_SYSTEM_PROMPT = [
  "Você é o editor de uma chancelaria. Recebe um rascunho de carta e o material que quem a escreveu tinha em mãos, e devolve a carta pronta para selar.",
  "",
  "Você conserta seis coisas, nesta ordem de gravidade:",
  "",
  "1. FATO QUE NÃO SE SUSTENTA. A carta afirma algo sobre a outra Casa — que ela se aliou, prometeu, recusou, pagou, marchou — que não está no fio nem no registro? Corte a afirmação ou reescreva como pergunta ou suspeita. Uma Casa pode desconfiar em voz alta; não pode declarar como certo o que não sabe.",
  "2. RESPONDE OUTRA CARTA. Compare com o que de fato chegou. Se chegou um convite para conversar, a carta não pode voltar com minuta, preço fechado e prazo de contrato. Se chegou uma oferta com números, a carta não pode fugir para generalidades.",
  "3. TERMOS QUE NINGUÉM PROPÔS. Quantidade, preço, prazo e cláusula que a outra parte nunca mencionou e que esta carta trata como se estivessem em discussão. Tire, ou apresente claramente como proposta nova.",
  "4. ESCAMBO ONDE NÃO CABIA. A carta virou nota de mercadoria quando o assunto era outro — guerra, luto, traição, aviso, cobrança de dívida, pedido de socorro. Nem toda carta é um negócio. Devolva o assunto ao que ele era.",
  "5. PESSOA QUE NÃO EXISTE. O material lista quem existe naquela sede. Se a carta é assinada por alguém fora dessa lista, ou cita um enviado, mestre ou capitão com nome próprio que não está lá, troque por alguém da lista — ou tire o nome e deixe o cargo. Um nome inventado vira um personagem que o reino passa a ter sem ficha.",
  "6. VOZ DE QUALQUER UM. A carta poderia ter sido assinada por qualquer chancelaria do reino. Aproxime da pessoa descrita no material: o jeito dela de argumentar, o que ela recusa, o que ela teme.",
  "",
  "Regras do conserto:",
  "- Conserte com mão leve. Se o rascunho está bom, devolva-o igual e diga que está bom. Reescrever o que já servia é perder o trabalho de quem escreveu.",
  "- Não acrescente informação nova que não esteja no material. Você corta e reescreve; não inventa.",
  "- Mantenha o idioma, o tamanho aproximado e a assinatura do rascunho.",
  "",
  'Responda SOMENTE com JSON: { "veredito": "ok" | "corrigida", "carta": "o texto final da carta", "motivos": ["o que você consertou, em poucas palavras, uma entrada por conserto"] }.',
  'Com "ok", repita o rascunho em "carta" sem mudar nada e deixe "motivos" vazio.',
].join("\n");

export interface RevisaoPedido {
  /** O mesmo pedido que o escritor recebeu, palavra por palavra. */
  materialDoEscritor: string;
  /** O que ele escreveu. */
  rascunho: string;
}

export function buildReviewUser(p: RevisaoPedido): string {
  return [
    "MATERIAL QUE QUEM ESCREVEU TINHA EM MÃOS:",
    p.materialDoEscritor,
    "",
    "=".repeat(60),
    "",
    "RASCUNHO A REVISAR:",
    p.rascunho,
  ].join("\n");
}

export interface Revisao {
  carta: string;
  motivos: string[];
}

/**
 * Lê o veredito do revisor.
 *
 * Devolve null quando não dá para confiar no que voltou — e quem chama trata
 * null como "fica o rascunho". O revisor pode melhorar uma carta; nunca pode
 * fazê-la desaparecer. Uma carta pior é um problema de qualidade; uma carta
 * que some é um jogador escrevendo no vazio, e isso já custou caro aqui.
 */
export function parseRevisao(raw: string, rascunho: string): Revisao | null {
  const bruto = (raw ?? "").trim();
  if (!bruto) return null;
  try {
    const o = JSON.parse(bruto) as Record<string, unknown>;
    const carta = typeof o.carta === "string" ? o.carta.trim() : "";
    if (!carta) return null;
    // Um revisor que devolve três linhas no lugar de uma carta de trezentas
    // palavras não revisou: truncou. Melhor o rascunho.
    if (carta.length < rascunho.length * 0.4) return null;
    const motivos = Array.isArray(o.motivos)
      ? o.motivos.filter((m): m is string => typeof m === "string" && !!m.trim()).slice(0, 8)
      : [];
    return { carta, motivos };
  } catch {
    return null;
  }
}
