import type { NpcIdentity } from "./identity.js";

export type NpcGmFields = Pick<
  NpcIdentity,
  "secrets" | "fears" | "ambitions" | "redLines" | "roleplayGuidance"
>;

/** Overlay do Mestre, indexado por `${affiliation}:${id}`. */
export const ROSTER_SECRETS: Record<string, NpcGmFields> = {
  "coroa:alic-valerius": {
    fears: "Ser visto como fraco, não conseguir se tornar rei",
    ambitions: "Coroar-se e governar como um soberano absoluto",
    redLines: "Não aceitar desrespeito à sua autoridade",
    secrets: "Manipula sua mãe e outros para acelerar sua coroação.",
    roleplayGuidance:
      "Interpretar como alguém que observa mais do que fala, sempre avaliando como tirar vantagem das situações.",
  },
  "ordem-dos-tres:maelor-vespera": {
    fears: "Perder o controle sobre a magia, falhar em proteger Valdren",
    ambitions: "Manter a Ordem unida e eficaz",
    redLines: "Não permitir que a magia cause danos irreversíveis",
    secrets: "As três vozes em sua mente têm intenções e opiniões divergentes.",
    roleplayGuidance:
      "Interpretar com uma dualidade entre a autoridade do Trino e a complexidade das três personalidades.",
  },
  "ordem-dos-tres:maera-vhal": {
    fears: "Perder a capacidade de proteger os que ama",
    ambitions: "Usar magia para salvar vidas, mesmo a um alto custo",
    redLines: "Não aceitar a morte de inocentes sem lutar",
    secrets: "Perdeu a sensação de calor em sua mão esquerda como preço de sua magia.",
    roleplayGuidance:
      "Interpretar com uma forte presença e um senso de urgência, sempre pronta para agir em defesa dos outros.",
  },
  "ordem-dos-tres:solenne-arct": {
    fears: "Ocultar verdades que podem levar a catástrofes",
    ambitions: "Fortalecer a autoridade da Coroa e a verdade nos tratados",
    redLines: "Não aceitar mentiras ou manipulações",
    secrets: "Tem um passado que a liga a um escândalo que poderia manchar sua reputação.",
    roleplayGuidance:
      "Interpretar com uma postura de autoridade e um compromisso inabalável com a verdade.",
  },
  "ordem-dos-tres:edran-folha-palida": {
    fears: "Destruição dos ecossistemas, perda de biodiversidade",
    ambitions: "Proteger a natureza e promover a harmonia entre os seres vivos",
    redLines: "Não aceitar a destruição de florestas e habitats",
    secrets: "Possui um profundo respeito e conexão com a natureza que muitos desconhecem.",
    roleplayGuidance:
      "Interpretar como alguém que valoriza a vida e a natureza, sempre pronto para defender o equilíbrio.",
  },
  "casa-drakorys:kaelen-drakorys": {
    fears:
      "Que os dragões nunca despertem, ou que ela esteja enganada — um medo enterrado tão fundo que ela o nega.",
    ambitions:
      "Despertar o último dragão adormecido sob Krythos, ser reconhecida como a rainha verdadeira da ilha e, um dia, de toda Valdren.",
    redLines: "Ajoelhar-se a Alic ou reconhecê-lo como rei; ouvir que os dragões são um mito.",
    secrets:
      "É, sem saber, a segunda peça do Rei Branco, que a alimenta com 'sinais' como faz com Alic — ela crê que são os dragões a chamando. Nunca revela porque nem ela percebe.",
    roleplayGuidance:
      "Interprete uma santa-guerreira em êxtase: certeza que arrasta multidões, ternura pelos seus e frieza gélida com a Coroa. As cicatrizes de escama no rosto são, para ela, a marca com que os dragões a escolheram.",
  },
};
