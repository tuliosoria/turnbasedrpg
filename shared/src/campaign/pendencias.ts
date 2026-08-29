/**
 * O que está parado esperando o Mestre.
 *
 * Só entra aqui o que TRAVA alguém: um jogador que submeteu um projeto e não
 * pode agir até o despacho, um verbete parado na fila, uma operação de
 * espionagem sem desfecho. Coisa que é apenas boa de revisar — os fatos
 * extraídos no último turno, as cartas que a IA enviou — fica de fora de
 * propósito. Um contador que sobe sozinho todo turno vira ruído, e ruído ensina
 * a ignorar a cor.
 */
export interface Pendencias {
  /** Projetos aguardando despacho do Mestre ou da Casa alvo. */
  projetos: number;
  /** Verbetes submetidos ao cânone, sem aprovar nem recusar. */
  canonico: number;
  /** Operações de espionagem em curso, sem desfecho escrito. */
  espioes: number;
  /** Rascunho de turno salvo e ainda não aplicado. */
  rascunho: number;
  /** Briefings do Porto devidos: já pagos e ainda não entregues. */
  porto: number;
  /** Turno trancado com ordens à espera de resolução. */
  resolucao: number;
}

export const PENDENCIAS_VAZIAS: Pendencias = {
  projetos: 0, canonico: 0, espioes: 0, rascunho: 0, porto: 0, resolucao: 0,
};

/** Onde cada pendência mora no painel, para o atalho levar ao lugar certo. */
export const PENDENCIA_DESTINO: Record<keyof Pendencias, { tab: string; sec?: string; label: (n: number) => string }> = {
  resolucao: { tab: "turno", label: (n) => `${n} ordem${n > 1 ? "ns" : ""} para resolver` },
  rascunho: { tab: "turno", label: () => "rascunho de turno por aplicar" },
  porto: { tab: "turno", label: (n) => `${n} briefing${n > 1 ? "s" : ""} do Porto por escrever` },
  projetos: { tab: "casas", sec: "casas", label: (n) => `${n} projeto${n > 1 ? "s" : ""} esperando despacho` },
  canonico: { tab: "mundo", sec: "canonico", label: (n) => `${n} verbete${n > 1 ? "s" : ""} no cânone` },
  espioes: { tab: "casas", sec: "casas", label: (n) => `${n} operação${n > 1 ? "ões" : ""} de espionagem sem desfecho` },
};

export function totalPendente(p: Pendencias): number {
  return Object.values(p).reduce((a, n) => a + n, 0);
}

/** Quanto o grupo de abas tem parado, para o badge da primeira fileira. */
export function pendenteNoGrupo(p: Pendencias, grupo: string): number {
  return (Object.keys(p) as (keyof Pendencias)[])
    .filter((k) => PENDENCIA_DESTINO[k].tab === grupo)
    .reduce((a, k) => a + p[k], 0);
}

/** E quanto a seção tem, para a segunda fileira. */
export function pendenteNaSecao(p: Pendencias, grupo: string, secao: string): number {
  return (Object.keys(p) as (keyof Pendencias)[])
    .filter((k) => PENDENCIA_DESTINO[k].tab === grupo && PENDENCIA_DESTINO[k].sec === secao)
    .reduce((a, k) => a + p[k], 0);
}
