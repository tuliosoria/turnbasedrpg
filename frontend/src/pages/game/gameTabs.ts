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

/** `?aba=turno` ainda chega de link salvo; `historico` também. */
const ABAS_ANTIGAS: Record<string, string> = { turno: "turnos", historico: "turnos" };

export function isGameTab(v: string | null): boolean {
  return !!v && GAME_TABS.some((t) => t.value === v);
}

export function gameTabOf(v: string | null): string {
  if (isGameTab(v)) return v as string;
  if (v && ABAS_ANTIGAS[v]) return ABAS_ANTIGAS[v];
  return DEFAULT_GAME_TAB;
}
