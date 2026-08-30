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
  { value: "turnos", label: "Turnos", hint: "O turno aberto e todos os que já passaram" },
  { value: "casa", label: "Minha Casa", hint: "Atributos, ativos e o que a Casa tem" },
  { value: "projetos", label: "Projetos", hint: "Obras, tropas, economia e sociedade" },
  { value: "espioes", label: "Espiões", hint: "Comprar informação no Porto Cinzento e plantar rumores" },
  { value: "pactos", label: "Pactos", hint: "Alianças, acordos e favores" },
  { value: "cartas", label: "Correspondência", hint: "Escrever às Casas e ler o que chegou" },
];

export const DEFAULT_GAME_TAB = "turnos";

/**
 * Onde as abas antigas foram parar.
 *
 * "O Turno" e "Histórico" eram a mesma coisa partida em duas: quem abria a
 * primeira via só o turno corrente — e quando o Mestre ainda não o tinha
 * aberto, via um aviso vazio e concluía que o jogo tinha sumido. Os sete turnos
 * anteriores estavam a uma aba de distância, sem nada que dissesse isso.
 *
 * Os dois valores continuam entrando: há link salvo e há o menu do site
 * apontando para ?aba=turno.
 */
const ABAS_ANTIGAS: Record<string, string> = { turno: "turnos", historico: "turnos" };

export function isGameTab(v: string | null): boolean {
  return !!v && GAME_TABS.some((t) => t.value === v);
}

export function gameTabOf(v: string | null): string {
  if (isGameTab(v)) return v as string;
  if (v && ABAS_ANTIGAS[v]) return ABAS_ANTIGAS[v];
  return DEFAULT_GAME_TAB;
}
