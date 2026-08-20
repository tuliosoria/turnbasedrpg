/**
 * As Histórias Contadas: verbetes da Enciclopédia narrados em áudio. Lista
 * curada — os arquivos vivem no S3. Quando forem muitas, dá para migrar isto
 * para um registro no backend.
 */
export interface HistoriaContada {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  /** Narrador, para alternarmos as vozes entre uma história e outra. */
  voice: string;
  /** Verbete de origem na Enciclopédia, quando houver. */
  section?: string;
  /** Duração aproximada, para o ouvinte saber no que está entrando. */
  duration?: string;
}

const BUCKET = "https://ravenloft-images-825081952316.s3.us-east-1.amazonaws.com";

export const HISTORIAS: HistoriaContada[] = [
  {
    id: "as-dezesseis-casas",
    title: "As Dezesseis Casas de Valdren",
    description:
      "Quem manda em cada canto da ilha: território, sede, brasão e o lema que cada Casa jurou. Dos Valerius em Asterhall à Ordem dos Três na Torre de Véspera.",
    audioUrl: `${BUCKET}/audio/casas-charon.mp3`,
    voice: "Charon",
    section: "casas",
    duration: "6 min",
  },
  {
    id: "as-brumas",
    title: "As Brumas",
    description:
      "Nenhuma explicação sobre as Brumas é aceita por todo o reino — e entrar nelas sem necessidade é apostar a própria existência.",
    audioUrl: `${BUCKET}/audio/brumas-charon.mp3`,
    voice: "Charon",
    section: "brumas",
    duration: "35 s",
  },
];
