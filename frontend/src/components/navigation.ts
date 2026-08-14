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
