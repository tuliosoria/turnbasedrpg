import type { NpcIdentity } from "./codex.js";

/**
 * NPCs gerados do cânone por backend/scripts/seed-npc-codex.mjs, revisados e
 * commitados como canon. A Coroa, os 27 magos, generais e sacerdotes.
 */
export const ROSTER_CODEX: NpcIdentity[] = [
  // Lady Celene NÃO entra aqui: ela já é a líder da Casa Valerius no
  // derivedCodex (affiliation casa-valerius) e "é a própria Coroa". Duplicá-la
  // sob "coroa" gravaria o estado vivo dela numa chave diferente da que o envio
  // resolve. A Coroa é representada aqui apenas pelo herdeiro, Alic.
  {
    "id": "alic-valerius",
    "name": "Alic Valerius",
    "role": "Herdeiro da Coroa",
    "tier": "MAJOR",
    "affiliation": "coroa",
    "location": "Asterhall",
    "personality": "Observador, manipulador, sem empatia",
    "speechStyle": "Silencioso e analítico",
    "values": "Poder, controle, centralização do reino",
    "fears": "Ser visto como fraco, não conseguir se tornar rei",
    "ambitions": "Coroar-se e governar como um soberano absoluto",
    "redLines": "Não aceitar desrespeito à sua autoridade",
    "secrets": "Manipula sua mãe e outros para acelerar sua coroação.",
    "roleplayGuidance": "Interpretar como alguém que observa mais do que fala, sempre avaliando como tirar vantagem das situações."
  },
  {
    "id": "maelor-vespera",
    "name": "Maelor Véspera",
    "role": "O Trino da Ordem dos Três",
    "tier": "MAJOR",
    "affiliation": "ordem-dos-tres",
    "location": "Vale da Coroa",
    "personality": "Metódico, caloroso, silencioso",
    "speechStyle": "Calmo e reflexivo",
    "values": "Preservação do conhecimento, proteção do reino",
    "fears": "Perder o controle sobre a magia, falhar em proteger Valdren",
    "ambitions": "Manter a Ordem unida e eficaz",
    "redLines": "Não permitir que a magia cause danos irreversíveis",
    "secrets": "As três vozes em sua mente têm intenções e opiniões divergentes.",
    "roleplayGuidance": "Interpretar com uma dualidade entre a autoridade do Trino e a complexidade das três personalidades."
  },
  {
    "id": "maera-vhal",
    "name": "Maera Vhal",
    "role": "A Mãe Rubra",
    "tier": "MAJOR",
    "affiliation": "ordem-dos-tres",
    "location": "Marcas do Norte",
    "personality": "Direta, severa, protetora",
    "speechStyle": "Franca e contundente",
    "values": "Sobrevivência, proteção dos vulneráveis",
    "fears": "Perder a capacidade de proteger os que ama",
    "ambitions": "Usar magia para salvar vidas, mesmo a um alto custo",
    "redLines": "Não aceitar a morte de inocentes sem lutar",
    "secrets": "Perdeu a sensação de calor em sua mão esquerda como preço de sua magia.",
    "roleplayGuidance": "Interpretar com uma forte presença e um senso de urgência, sempre pronta para agir em defesa dos outros."
  },
  {
    "id": "solenne-arct",
    "name": "Solenne Arct",
    "role": "A Voz do Meio-Dia",
    "tier": "MAJOR",
    "affiliation": "ordem-dos-tres",
    "location": "Asterhall",
    "personality": "Formal, disciplinada, intolerante a mentiras",
    "speechStyle": "Clara e direta",
    "values": "Verdade, justiça, clareza",
    "fears": "Ocultar verdades que podem levar a catástrofes",
    "ambitions": "Fortalecer a autoridade da Coroa e a verdade nos tratados",
    "redLines": "Não aceitar mentiras ou manipulações",
    "secrets": "Tem um passado que a liga a um escândalo que poderia manchar sua reputação.",
    "roleplayGuidance": "Interpretar com uma postura de autoridade e um compromisso inabalável com a verdade."
  },
  {
    "id": "edran-folha-palida",
    "name": "Edran Folha-Pálida",
    "role": "O Guardião das Raízes",
    "tier": "MAJOR",
    "affiliation": "ordem-dos-tres",
    "location": "Picos da Nuvem Eterna",
    "personality": "Gentil, implacável com destruição ambiental",
    "speechStyle": "Calmo e ponderado",
    "values": "Vida, equilíbrio, natureza",
    "fears": "Destruição dos ecossistemas, perda de biodiversidade",
    "ambitions": "Proteger a natureza e promover a harmonia entre os seres vivos",
    "redLines": "Não aceitar a destruição de florestas e habitats",
    "secrets": "Possui um profundo respeito e conexão com a natureza que muitos desconhecem.",
    "roleplayGuidance": "Interpretar como alguém que valoriza a vida e a natureza, sempre pronto para defender o equilíbrio."
  }
];
