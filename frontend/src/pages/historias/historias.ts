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
}

const BUCKET = "https://ravenloft-images-825081952316.s3.us-east-1.amazonaws.com";

export const HISTORIAS: HistoriaContada[] = [
  {
    id: "as-brumas",
    title: "As Brumas",
    description:
      "Nenhuma explicação sobre as Brumas é aceita por todo o reino — e entrar nelas sem necessidade é apostar a própria existência.",
    audioUrl: `${BUCKET}/audio/brumas-charon.mp3`,
    voice: "Charon",
    section: "brumas",
  },
];
