import type { NpcPublic } from "./identity.js";

/**
 * NPCs gerados do cânone por backend/scripts/seed-npc-codex.mjs, revisados e
 * commitados como canon. A Coroa, os 27 magos, generais e sacerdotes.
 *
 * Sem os campos do Mestre: secrets, fears, ambitions, redLines e
 * roleplayGuidance ficam em `rosterSecrets.ts`.
 */
export const ROSTER_CODEX: NpcPublic[] = [
  // Lady Celene NÃO entra aqui: ela já é a líder da Casa Valerius no
  // derivedCodex (affiliation casa-valerius) e "é a própria Coroa". Duplicá-la
  // sob "coroa" gravaria o estado vivo dela numa chave diferente da que o envio
  // resolve. A Coroa é representada aqui apenas pelo herdeiro, Alic.
  {
    id: "alic-valerius",
    name: "Alic Valerius",
    role: "Herdeiro da Coroa",
    tier: "MAJOR",
    affiliation: "coroa",
    location: "Asterhall",
    personality: "Observador, manipulador, sem empatia",
    speechStyle: "Silencioso e analítico",
    values: "Poder, controle, centralização do reino",
  },
  {
    id: "maelor-vespera",
    name: "Maelor Véspera",
    role: "O Trino da Ordem dos Três",
    tier: "MAJOR",
    affiliation: "ordem-dos-tres",
    location: "Vale da Coroa",
    personality: "Metódico, caloroso, silencioso",
    speechStyle: "Calmo e reflexivo",
    values: "Preservação do conhecimento, proteção do reino",
  },
  {
    id: "maera-vhal",
    name: "Maera Vhal",
    role: "A Mãe Rubra",
    tier: "MAJOR",
    affiliation: "ordem-dos-tres",
    location: "Marcas do Norte",
    personality: "Direta, severa, protetora",
    speechStyle: "Franca e contundente",
    values: "Sobrevivência, proteção dos vulneráveis",
  },
  {
    id: "solenne-arct",
    name: "Solenne Arct",
    role: "A Voz do Meio-Dia",
    tier: "MAJOR",
    affiliation: "ordem-dos-tres",
    location: "Asterhall",
    personality: "Formal, disciplinada, intolerante a mentiras",
    speechStyle: "Clara e direta",
    values: "Verdade, justiça, clareza",
  },
  {
    id: "edran-folha-palida",
    name: "Edran Folha-Pálida",
    role: "O Guardião das Raízes",
    tier: "MAJOR",
    affiliation: "ordem-dos-tres",
    location: "Picos da Nuvem Eterna",
    personality: "Gentil, implacável com destruição ambiental",
    speechStyle: "Calmo e ponderado",
    values: "Vida, equilíbrio, natureza",
  },
  {
    id: "kaelen-drakorys",
    name: "Kaelen Drakorys",
    role: "A Donzela das Cinzas, coroada Rainha-Dragã de Krythos",
    tier: "MAJOR",
    affiliation: "casa-drakorys",
    location: "Krythos",
    personality:
      "Fervorosa, magnética, absolutamente convicta; uma visionária que ouve o chamado dos dragões (arquétipo Joana d'Arc). Jovem, sem medo da morte, arrasta multidões pela fé.",
    speechStyle:
      "Profética e inflamada, em metáforas de cinza, escama e chama; chama os outros líderes de 'regentes de pó' e fala como quem já venceu.",
    values:
      "O retorno dos dragões do Mar de Bronze e Krythos como o trono verdadeiro; a convicção acima da política; os seus, a quem trata com ternura.",
  },
];
