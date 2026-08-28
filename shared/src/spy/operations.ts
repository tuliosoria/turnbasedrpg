/**
 * Uma operação de espionagem.
 *
 * Era carta de projeto, e não devia ser: um projeto constrói algo permanente e
 * é julgado no fim, enquanto uma operação devolve informação uma vez e carrega
 * um segundo eixo que projeto nenhum tem — ser descoberta. Misturar as duas
 * coisas fazia "comprar um rumor" e "erguer um aqueduto" ocuparem a mesma
 * mecânica, com o mesmo formulário e o mesmo tipo de fracasso.
 *
 * A decisão que a feature existe para provocar é uma só: quanto você paga. E
 * ela só é uma decisão se pagar mais NÃO for estritamente melhor — por isso o
 * nível sobe o teto da recompensa e a gravidade do fracasso ao mesmo tempo.
 * Boca de taverna erra barato; documento roubado custa o pescoço do agente.
 */
export const SPY_LEVELS = ["BOCA", "TESTEMUNHA", "PROVA"] as const;
export type SpyLevel = (typeof SPY_LEVELS)[number];

export function isSpyLevel(v: unknown): v is SpyLevel {
  return typeof v === "string" && (SPY_LEVELS as readonly string[]).includes(v);
}

export interface SpyTier {
  level: SpyLevel;
  label: string;
  /** O que se compra, em uma linha. */
  quem: string;
  custoRecursos: number;
  custoRiqueza: number;
  /** Mostrado ANTES de confirmar: risco escondido é armadilha, não escolha. */
  seDerCerto: string;
  seDerErrado: string;
}

export const SPY_TIERS: Record<SpyLevel, SpyTier> = {
  BOCA: {
    level: "BOCA",
    label: "Boca de taverna",
    quem: "Marinheiros, estivadores e criados que falam quando bebem.",
    custoRecursos: 1,
    custoRiqueza: 0,
    seDerCerto: "Você ouve a direção geral do que já se comenta: quem anda com quem, o que ninguém mais nega. Sem nome, sem data.",
    seDerErrado: "Você compra boato. A informação chega errada — e nada na carta avisa que ela é errada.",
  },
  TESTEMUNHA: {
    level: "TESTEMUNHA",
    label: "Alguém que estava lá",
    quem: "Um escrivão, um cocheiro, um guarda do turno da noite.",
    custoRecursos: 2,
    custoRiqueza: 0,
    seDerCerto: "Um detalhe verificável: um nome, uma data, um número que só quem estava lá saberia.",
    seDerErrado: "A pergunta volta pela mesma boca que a vendeu. O alvo fica sabendo que alguém perguntou por ele.",
  },
  PROVA: {
    level: "PROVA",
    label: "Documento ou testemunha disposta a repetir",
    quem: "Cópia de registro, livro de serviço, alguém que assina o que diz.",
    custoRecursos: 2,
    custoRiqueza: 1,
    seDerCerto: "Prova que serve numa acusação diante das Casas: cópia, registro ou testemunha que repete diante de terceiros.",
    seDerErrado: "Seu agente é pego com o que carregava. Sob o edito da Casa do Ouro isso é traição declarada — e ele pode falar.",
  },
};

export const SPY_QUESTION_MAX = 400;

export const SPY_STATUSES = ["EM_CURSO", "RESOLVIDA"] as const;
export type SpyStatus = (typeof SPY_STATUSES)[number];

export interface SpyOperation {
  id: string;
  campaignId: string;
  houseId: string;
  turnNumber: number;
  /** O que a Casa quer saber, nas palavras dela. */
  question: string;
  level: SpyLevel;
  /** Casa, pessoa ou lugar sob observação. Vazio quando a pergunta é do mundo. */
  targetKey: string;
  status: SpyStatus;
  /** Preenchido pelo Mestre ou pela IA ao resolver. */
  outcome: "SUCESSO" | "FRACASSO" | null;
  /** O que a Casa descobriu, ou o que deu errado. */
  report: string;
  createdAt: string;
  resolvedAt: string | null;
}

export function tierOf(level: SpyLevel): SpyTier {
  return SPY_TIERS[level];
}

/** O que a operação custa, no formato que o motor de atributos entende. */
export function spyCost(level: SpyLevel): { recursos: number; riqueza: number } {
  const t = SPY_TIERS[level];
  return { recursos: t.custoRecursos, riqueza: t.custoRiqueza };
}

/**
 * Se a Casa consegue pagar.
 *
 * Recusar depois de gravar seria cobrar por uma operação que não aconteceu, e
 * é o tipo de erro que só aparece quando o jogador reclama.
 */
export function canAffordSpy(
  attrs: { riqueza: number; recursos: number },
  level: SpyLevel,
): { ok: boolean; reason?: string } {
  const c = spyCost(level);
  if (attrs.recursos < c.recursos) {
    return { ok: false, reason: `Faltam Recursos: esta operação custa ${c.recursos} e sua Casa tem ${attrs.recursos}.` };
  }
  if (attrs.riqueza < c.riqueza) {
    return { ok: false, reason: `Falta Riqueza: esta operação custa ${c.riqueza} e sua Casa tem ${attrs.riqueza}.` };
  }
  return { ok: true };
}

/** Uma linha para o Mestre ler na fila, sem abrir a operação. */
export function describeOperation(op: SpyOperation): string {
  const t = SPY_TIERS[op.level];
  return `${t.label}${op.targetKey ? ` sobre ${op.targetKey}` : ""}: ${op.question.slice(0, 120)}`;
}
