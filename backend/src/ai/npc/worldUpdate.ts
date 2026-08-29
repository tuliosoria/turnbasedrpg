import {
  applyImpact,
  deriveWorldEvents,
  fullCodex,
  npcKnows,
  type NpcDynamic,
  type NpcIdentity,
  type Turn,
} from "@ravenloft/content";
import { IMPACT_SYSTEM_PROMPT, buildImpactUser, parseImpact } from "./impact";

export interface WorldUpdateDeps {
  /** Teto de NPCs por turno; o padrão serve, o teste usa outro. */
  maxNpcs?: number;
  chat: (system: string, user: string, json: boolean, maxTokens: number) => Promise<string>;
  getDynamic: (affiliation: string, id: string) => Promise<NpcDynamic>;
  putDynamic: (dynamic: NpcDynamic) => Promise<void>;
  houseKeyOf: (houseId: string) => string | null;
  /**
   * Quem os jogadores procuraram por carta nos turnos recentes, como chaves
   * `afiliação:id`. Entra por injeção para que este módulo continue sem tocar
   * o banco.
   */
  recentlyContacted?: () => Promise<Set<string>>;
  /**
   * O último turno em que cada NPC teve estado vivo escrito, por chave
   * `afiliação:id`. Quem não aparece nunca foi tocado.
   *
   * É uma consulta só, e não noventa `getDynamic`: a esmagadora maioria do
   * Codex não tem linha nenhuma, e perguntar por cada um seria pagar noventa
   * leituras para descobrir oitenta e quatro ausências.
   */
  lastTouched?: () => Promise<Map<string, number>>;
  now?: () => string;
}

export interface WorldUpdateResult {
  candidates: number;
  changed: number;
  /** Quantos NPCs o modelo deixou sem resposta. Zero é o esperado. */
  vazias: number;
}

/**
 * O Relationship Engine, disparado quando um turno é aplicado.
 *
 * Não roda sobre os 200 NPCs: seleciona os que tomaram conhecimento de algum
 * fato deste turno (npcKnows) e só sobre eles pergunta ao modelo. Cada impacto
 * é validado e gravado, idempotente por (NPC, turno), para que reprocessar um
 * turno não empilhe mudança. Roda DEPOIS da resolução já estar gravada: uma
 * falha aqui não desfaz o turno.
 */
/** Quantos NPCs ganham estado vivo novo por turno. */
export const MAX_NPCS_POR_TURNO = 20;

export async function updateNpcWorld(deps: WorldUpdateDeps, turn: Turn): Promise<WorldUpdateResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const events = deriveWorldEvents(turn, deps.houseKeyOf);
  if (events.length === 0) return { candidates: 0, changed: 0, vazias: 0 };

  const codex: NpcIdentity[] = fullCodex();
  let changed = 0;
  let vazias = 0;
  const candidates: NpcIdentity[] = [];

  // Um teto por turno, e não os noventa do Codex: um evento que toca todo mundo
  // viraria noventa chamadas de IA numa aplicação de turno. Quem fica de fora
  // não perde nada de imediato — o estado vivo é remontado quando alguém
  // escreve —, mas a ORDEM decide quem nunca chega a vez, e é o que muda abaixo.
  const procurados = deps.recentlyContacted ? await deps.recentlyContacted() : new Set<string>();

  const candidatosBrutos = codex
    .map((npc) => ({ npc, known: events.filter((e) => npcKnows(npc, e, turn.turnId)) }))
    .filter((x) => x.known.length > 0);

  // Ordenar por "quantos eventos ele conhece" parecia razoável e não era.
  //
  // Os eventos de um turno são quase todos PUBLICO, e `inAudience` devolve true
  // para todo mundo quando a visibilidade é pública — medido no turno 6: 90 de
  // 90 candidatos, todos conhecendo os mesmos 7 eventos. O sort comparava 7 com
  // 7 noventa vezes e não decidia nada, então o slice pegava os 20 primeiros na
  // ordem fixa do Codex, turno após turno. Os outros 70 nunca chegavam a vez.
  //
  // O empate agora é desfeito por duas coisas que de fato variam: quem os
  // jogadores procuraram, e há quanto tempo a pessoa não é tocada. O primeiro
  // critério importa porque o estado vivo só é lido quando alguém escreve para
  // aquele NPC — e das 13 pessoas já procuradas por carta, uma tinha estado.
  const tocados = deps.lastTouched ? await deps.lastTouched() : new Map<string, number>();
  const chave = (npc: NpcIdentity) => `${npc.affiliation}:${npc.id}`;

  const porRelevancia = candidatosBrutos
    .map((x) => ({
      ...x,
      procurado: procurados.has(chave(x.npc)),
      // Quem nunca foi tocado conta como turno 0, e por isso entra antes de
      // quem foi processado no turno passado.
      ultimoTurno: tocados.get(chave(x.npc)) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.procurado) - Number(a.procurado) ||
        a.ultimoTurno - b.ultimoTurno ||
        b.known.length - a.known.length,
    )
    .slice(0, deps.maxNpcs ?? MAX_NPCS_POR_TURNO);

  for (const { npc, known } of porRelevancia) {
    candidates.push(npc);

    let dynamic = await deps.getDynamic(npc.affiliation, npc.id);
    // Não reprocessa o que já foi processado neste turno para este NPC.
    if (dynamic.memory.some((m) => m.turnNumber === turn.turnId)) continue;

    let raw: string;
    try {
      // 1600, e não 600: o raciocínio sai do mesmo orçamento da resposta.
      // Medido em seis chamadas reais — Lyra Euralune voltou `finish=length` e
      // VAZIA a 600, e afetada a 1600. A resposta em si ocupa ~600 caracteres.
      raw = await deps.chat(IMPACT_SYSTEM_PROMPT, buildImpactUser({ identity: npc, dynamic, events: known.map((e) => e.description) }), true, 1600);
    } catch {
      // Uma falha num NPC não derruba os outros nem o turno.
      continue;
    }

    // Resposta vazia NÃO é "não foi afetado".
    //
    // `parseImpact("")` devolve `{ affected: false }`, e por isso um estouro de
    // orçamento era indistinguível de uma decisão do modelo: o motor gravava
    // silenciosamente "este NPC não mudou" para quem nunca chegou a responder.
    // Foi assim que 84 dos 90 ficaram sem estado vivo sem ninguém perceber.
    if (!raw.trim()) {
      vazias++;
      continue;
    }

    const impact = parseImpact(raw);
    if (!impact.affected) continue;

    dynamic = applyImpact(dynamic, impact, turn.turnId, now());
    await deps.putDynamic(dynamic);
    changed++;
  }

  // Um silêncio do modelo é falha de orçamento, não decisão de enredo: precisa
  // aparecer no log do Mestre em vez de virar um NPC que "não mudou".
  if (vazias > 0) {
    console.warn(`Relationship Engine: ${vazias} de ${candidates.length} NPCs sem resposta do modelo (orçamento de tokens?).`);
  }
  return { candidates: candidates.length, changed, vazias };
}
