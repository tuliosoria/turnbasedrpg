/**
 * As narrações da Enciclopédia: um vídeo (imagem de fundo + narração) por
 * entrada. Por ora é uma lista curada; os arquivos ficam no S3. Quando houver
 * muitas, dá para migrar isto para um registro no backend.
 */
export interface Narracao {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  poster?: string;
}

const BUCKET = "https://ravenloft-images-825081952316.s3.us-east-1.amazonaws.com";

export const NARRACOES: Narracao[] = [
  {
    id: "brumas",
    title: "As Brumas",
    description:
      "Nenhuma explicação sobre as Brumas é aceita por todo o reino — entrar nelas sem necessidade é apostar a própria existência.",
    videoUrl: `${BUCKET}/audio/brumas-charon.mp4`,
    poster: `${BUCKET}/visual/msi96d7f-2/original.png?v=1786065321123`,
  },
];
