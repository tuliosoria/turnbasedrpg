/**
 * As abas de /game.
 *
 * A página era uma rolagem só, com seis blocos grandes empilhados. Tudo estava
 * lá e nada era achável: comprar informação no Porto exigia rolar até Projetos,
 * descobrir que existe uma aba Biblioteca dentro dele, e então buscar "Porto"
 * numa lista de setenta cartas. Três níveis de profundidade para uma ação que o
 * jogador faz todo turno.
 *
 * A ordem é a do uso: primeiro o que ele veio fazer, depois o que ele consulta.
 */
export interface GameTab {
  value: string;
  label: string;
  /** O que a aba resolve, para o jogador que ainda não sabe onde clicar. */
  hint: string;
}

export const GAME_TABS: GameTab[] = [
  { value: "turno", label: "O Turno", hint: "Ler o evento e escrever suas ordens" },
  { value: "casa", label: "Minha Casa", hint: "Atributos, ativos e o que a Casa tem" },
  { value: "projetos", label: "Projetos", hint: "Obras, espionagem e o Porto Cinzento" },
  { value: "pactos", label: "Pactos", hint: "Alianças, acordos e favores" },
  { value: "cartas", label: "Correspondência", hint: "Escrever às Casas e ler o que chegou" },
  { value: "historico", label: "Histórico", hint: "Os turnos que já passaram" },
];

export const DEFAULT_GAME_TAB = "turno";

export function isGameTab(v: string | null): boolean {
  return !!v && GAME_TABS.some((t) => t.value === v);
}

export function gameTabOf(v: string | null): string {
  return isGameTab(v) ? (v as string) : DEFAULT_GAME_TAB;
}
