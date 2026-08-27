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
  { label: "As Casas", to: "/casas", hint: "As dezesseis potências, com dossiê e brasão", tambem: ["/casa"] },
  { label: "Personagens", to: "/personagens", hint: "O elenco de Valdren, com retrato e ficha" },
  { label: "Histórias Contadas", to: "/historias", hint: "Os verbetes de Valdren, narrados em áudio" },
  { label: "Galeria", to: "/galeria", hint: "As imagens da campanha, turno a turno" },
];

/**
 * As portas do jogo, uma por aba de /game.
 *
 * "Meu turno" levava a /game e parava ali: para chegar ao Porto Cinzento o
 * jogador tinha de saber que existe uma aba Projetos, dentro dela uma
 * Biblioteca, e dentro dela a categoria certa. Agora que cada aba tem URL
 * própria, o menu leva direto — e a barra passa a anunciar o que o jogo tem,
 * em vez de esconder atrás de um destino só.
 */
export const PLAY_LINKS: NavLink[] = [
  { label: "Meu turno", to: "/game?aba=turno", hint: "Ler o evento e escrever suas ordens", tambem: ["/game"] },
  { label: "Minha Casa", to: "/game?aba=casa", hint: "Atributos, ativos e o que a Casa tem" },
  { label: "Projetos", to: "/game?aba=projetos", hint: "Obras, tropas, economia e sociedade" },
  { label: "Espiões e o Porto", to: "/game?aba=espioes", hint: "Comprar informação no Porto Cinzento e plantar rumores" },
  { label: "Pactos e favores", to: "/game?aba=pactos", hint: "Alianças, acordos comerciais e quem lhe deve" },
  { label: "Correspondência", to: "/game?aba=cartas", hint: "Escrever às Casas e ler o que chegou" },
  { label: "Criar sua Casa", to: "/criar", hint: "Fundar uma Grande Casa e entrar na campanha" },
  { label: "Adicionar Canônico", to: "/canonico", hint: "Propor um personagem, lugar ou fato para o mundo" },
  { label: "Guia de campanha", to: `/valdren/${CAMPAIGN_GUIDE_SECTION}`, hint: "Jogar Valdren em D&D 5.5" },
];

/** Só para o GM. O jogador nunca vê este destino. */
export const STUDIO_LINKS: NavLink[] = [
  { label: "Painel do mestre", to: "/admin", hint: "O turno: cartas, correspondência e resolução" },
  { label: "As Casas", to: "/admin?tab=casas", hint: "Casas, relações entre elas e NPCs vivos" },
  // O Estúdio e as Entidades saíram da Enciclopédia pública: viviam numa rota
  // de jogador separados apenas por um isAdmin invisível.
  { label: "Construir mundo", to: "/admin?tab=mundo", hint: "Bíblia, cânone, prompts e o Estúdio de imagens" },
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
