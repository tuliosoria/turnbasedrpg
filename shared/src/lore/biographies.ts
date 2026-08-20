/**
 * A história de cada NPC do Codex, em prosa, para a ficha pública.
 *
 * O Codex derivado das Casas carrega uma linha de descrição por figura, o que
 * deixa a ficha vaga demais para servir de leitura. Estas biografias são
 * autoradas sobre esse cânone: nunca o contradizem, apenas o desdobram em
 * origem, feridas, laços e a posição de cada um na crise atual.
 *
 * A chave é `${affiliation}:${id}`, a mesma que `fullCodex` usa para desempate
 * — só o id colidiria entre Casas.
 *
 * Personagens que jogadores adicionaram pelo Adicionar Canônico não entram
 * aqui: eles não passam pelo Codex, e o texto deles é do jogador.
 */
export const NPC_BIOGRAPHIES: Record<string, string> = {};

/** A biografia de um NPC, ou string vazia quando ainda não foi autorada. */
export function biographyFor(affiliation: string, id: string): string {
  return NPC_BIOGRAPHIES[`${affiliation}:${id}`] ?? "";
}
