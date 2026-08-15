import { CAMPAIGN_GUIDE_SECTION } from "@ravenloft/content";
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
  { label: "As Casas", to: "/casas", hint: "As dezesseis potências, com dossiê e brasão" },
  { label: "Personagens", to: "/personagens", hint: "O elenco de Valdren, com retrato e ficha" },
  { label: "Galeria", to: "/galeria", hint: "As imagens da campanha, turno a turno" },
];

export const PLAY_LINKS: NavLink[] = [
  { label: "Criar sua Casa", to: "/criar", hint: "Fundar uma Grande Casa e entrar na campanha" },
  { label: "Meu turno", to: "/game", hint: "Ler o evento e escrever suas ordens" },
  { label: "Guia de campanha", to: `/valdren/${CAMPAIGN_GUIDE_SECTION}`, hint: "Jogar Valdren em D&D 5.5" },
];

/** Só para o GM. O jogador nunca vê este destino. */
export const STUDIO_LINKS: NavLink[] = [
  { label: "Painel do mestre", to: "/admin", hint: "Turnos, Casas e resolução" },
  { label: "Acervo visual", to: "/enciclopedia", hint: "Canônicos, entidades e o Estúdio de imagens" },
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
