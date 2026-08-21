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
    id: "introducao",
    title: "Valdren — Introdução para um Novo Jogador",
    description:
      "Comece por aqui. As Brumas que cercam a ilha, Asterhall e as Casas que sustentam o reino, os Colossos enterrados no gelo, o preço da magia — e a pergunta que percorre as Cinco Estradas agora que o inverno chegou cedo.",
    audioUrl: `${BUCKET}/audio/valdren-introducao.mp3`,
    voice: "Fenrir",
    section: "visao-geral",
    duration: "23 min",
  },
];
