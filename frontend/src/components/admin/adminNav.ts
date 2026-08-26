/**
 * A navegação do painel do Mestre.
 *
 * Antes eram doze abas numa fileira só, que rolava horizontalmente: o Mestre
 * tinha de lembrar qual caixa guardava o quê antes de conseguir procurar. Agora
 * o primeiro nível responde "o que eu estou fazendo agora" — rodando o turno,
 * mexendo nas Casas, construindo mundo, mexendo no sistema — e só depois disso
 * aparece a segunda fileira.
 *
 * O grupo "Turno" não tem seções de propósito: ler as cartas, despachar as
 * aprovações e escrever o resultado é uma sequência, e sub-abas obrigariam a
 * pular de um lado para o outro no meio do trabalho. Lá as partes ficam
 * empilhadas na ordem em que se usa.
 */
export interface AdminSection {
  value: string;
  label: string;
}

export interface AdminGroup {
  value: string;
  label: string;
  /** Vazio quando o grupo é uma página empilhada, sem segunda fileira. */
  sections: AdminSection[];
}

export const ADMIN_GROUPS: AdminGroup[] = [
  { value: "turno", label: "Turno", sections: [] },
  {
    value: "casas",
    label: "Casas",
    sections: [
      { value: "casas", label: "Casas" },
      { value: "relacoes", label: "Relações" },
      { value: "vivos", label: "Vivos" },
    ],
  },
  {
    value: "mundo",
    label: "Mundo",
    sections: [
      { value: "biblia", label: "Bíblia" },
      { value: "canonico", label: "Canônico" },
      { value: "prompts", label: "Prompts" },
      { value: "acervo", label: "Acervo" },
      { value: "entidades", label: "Entidades" },
      { value: "estudio", label: "Estúdio" },
    ],
  },
  { value: "sistema", label: "Sistema", sections: [] },
];

export const DEFAULT_GROUP = "turno";

/**
 * Onde cada aba antiga foi parar.
 *
 * O painel guarda a aba em `?tab=`, então há links salvos e abas abertas
 * apontando para os doze valores velhos. Quebrar isso seria perder o marcador
 * de página de quem já usa o app. "galeria" e "senhas" nunca fizeram nada —
 * caem no turno, como qualquer valor desconhecido.
 */
const LEGACY: Record<string, { group: string; section?: string }> = {
  turnos: { group: "turno" },
  projetos: { group: "turno" },
  correspondencia: { group: "turno" },
  casas: { group: "casas", section: "casas" },
  relacoes: { group: "casas", section: "relacoes" },
  vivos: { group: "casas", section: "vivos" },
  historia: { group: "mundo", section: "biblia" },
  canonico: { group: "mundo", section: "canonico" },
  prompts: { group: "mundo", section: "prompts" },
  sistema: { group: "sistema" },
};

export function groupOf(value: string | null): AdminGroup {
  const direct = ADMIN_GROUPS.find((g) => g.value === value);
  if (direct) return direct;
  const legacy = value ? LEGACY[value] : undefined;
  if (legacy) return ADMIN_GROUPS.find((g) => g.value === legacy.group) ?? ADMIN_GROUPS[0];
  return ADMIN_GROUPS.find((g) => g.value === DEFAULT_GROUP) ?? ADMIN_GROUPS[0];
}

/**
 * A seção a mostrar dentro do grupo: a pedida, a herdada do link antigo, ou a
 * primeira. Grupos empilhados devolvem string vazia.
 */
export function sectionOf(groupValue: string | null, sectionValue: string | null): string {
  const group = groupOf(groupValue);
  if (group.sections.length === 0) return "";
  if (sectionValue && group.sections.some((s) => s.value === sectionValue)) return sectionValue;
  const legacy = groupValue ? LEGACY[groupValue] : undefined;
  if (legacy?.section && group.sections.some((s) => s.value === legacy.section)) return legacy.section;
  return group.sections[0].value;
}
