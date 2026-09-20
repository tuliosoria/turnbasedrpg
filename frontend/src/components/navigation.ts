import { CAMPAIGN_GUIDE_SECTION } from "@ravenloft/content";
import { GAME_TABS } from "../pages/game/gameTabs";
import type { NavLink } from "./NavMenu";

/**
 * A navegação, organizada por quem está pedindo — não por como o código está
 * dividido.
 *
 * Antes a barra listava Casas, Galeria, Enciclopédia e Campanha D&D como
 * irmãos, e "Enciclopédia" continha tanto conteúdo de jogador quanto as
 * ferramentas de autoria do GM, separadas só por um `isAdmin` invisível. Criar
 * Casa, jogar o turno e o painel do mestre não apareciam em lugar nenhum.
 *
 * Três destinos, cada um com um dono claro: o leitor, o jogador e o mestre.
 */

export const WORLD_LINKS: NavLink[] = [
  { label: "A crônica", to: "/valdren", hint: "As vinte e três seções da wiki de Valdren" },
  // Semeado e editável no painel, mas os dezoito capítulos estão em rascunho:
  // `/api/livro` devolve vazio, e um link no menu do jogador anunciaria uma
  // página que não tem nada dentro.
  { label: "O Livro", to: "/livro", hint: "O romance de Valdren, narrado em primeira pessoa", somenteMestre: true },
  { label: "As Casas", to: "/casas", hint: "As dezesseis potências, com dossiê e brasão", tambem: ["/casa"] },
  { label: "Personagens", to: "/personagens", hint: "O elenco de Valdren, com retrato e ficha" },
  { label: "Histórias Contadas", to: "/historias", hint: "Os verbetes de Valdren, narrados em áudio" },
  { label: "Galeria", to: "/galeria", hint: "As imagens da campanha, turno a turno" },
];

/**
 * As portas do jogo, uma por aba de /game.
 *
 * Os destinos de /game saem de GAME_TABS: um rótulo no menu e outro na aba
 * era o que fazia "Espiões" e "Espiões e o Porto" viverem ao mesmo tempo.
 */
export const PLAY_LINKS: NavLink[] = [
  ...GAME_TABS.map((t): NavLink => ({
    label: t.label,
    to: `/game?aba=${t.value}`,
    hint: t.hint,
    ...(t.value === "turnos" ? { tambem: ["/game"] } : {}),
  })),
  { label: "Criar sua Casa", to: "/criar", hint: "Fundar uma Grande Casa e entrar na campanha" },
  { label: "Guia de campanha", to: `/valdren/${CAMPAIGN_GUIDE_SECTION}`, hint: "Jogar Valdren em D&D 5.5" },
];

/** Só para o GM. O jogador nunca vê este destino. */
export const STUDIO_LINKS: NavLink[] = [
  { label: "Painel do mestre", to: "/admin", hint: "O turno: cartas, correspondência e resolução" },
  { label: "As Casas", to: "/admin?tab=casas", hint: "Casas, relações entre elas e NPCs vivos" },
  // O Estúdio e as Entidades saíram da Enciclopédia pública: viviam numa rota
  // de jogador separados apenas por um isAdmin invisível.
  { label: "Construir mundo", to: "/admin?tab=mundo", hint: "Bíblia, cânone, prompts e o Estúdio de imagens" },
  // Autoria de cânone é trabalho de mundo, não de turno: saiu do menu do
  // jogador e passou a viver aqui.
  //
  // São duas portas de propósito. O formulário de /canonico tem a revisão de
  // IA e a classificação automática de seção, e pede sessão de JOGADOR — o
  // verbete sai atribuído à Casa daquele código e entra na fila. A aba do
  // painel publica direto, sem fila e sem se passar por uma Casa.
  { label: "Adicionar Canônico", to: "/canonico", hint: "Escrever um verbete com revisão da IA (pede código de Casa)" },
  { label: "Fila do cânone", to: "/admin?tab=mundo&sec=canonico", hint: "Despachar propostas e publicar verbetes direto" },
];

/**
 * As portas de entrada.
 *
 * O painel do mestre precisa estar aqui, e não só dentro do Estúdio: o Estúdio
 * só aparece para quem já tem token de mestre, e o token se obtém entrando em
 * /admin. Deixar a entrada apenas lá dentro trancava a porta pelo lado de fora
 * — quem não soubesse a URL não tinha como virar mestre.
 */
export const ENTER_LINKS: NavLink[] = [
  { label: "Entrar como jogador", to: "/login", hint: "Com o código da sua Casa" },
  { label: "Entrar como mestre", to: "/admin", hint: "Com o código de admin" },
];

/**
 * Os destinos de "O Mundo" que esta pessoa pode ver.
 *
 * Esconder um link não tranca porta nenhuma — o que mantém O Livro fora do
 * alcance do jogador é o status `rascunho` dos capítulos, que faz a rota
 * pública devolver vazio. Isto aqui só evita anunciar no menu uma página que
 * ele abriria sem nada dentro.
 */
export function worldLinksPara(isAdmin: boolean): NavLink[] {
  return WORLD_LINKS.filter((l) => !l.somenteMestre || isAdmin);
}
