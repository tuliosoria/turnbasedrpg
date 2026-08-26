export interface Config {
  tableName: string;
  campaignId: string;
  adminCodeHash: string;
  tokenSigningSecret: string;
  allowedOrigin: string;
  tokenTtlSeconds: number;
  openAiApiKey: string;
  openAiModel: string;
  /** O modelo da diplomacia, onde a carta precisa comparar duas despensas. */
  openAiDiplomacyModel: string;
  /** Image model settings. Configurable so the campaign can trade cost against
   *  fidelity without a code change — quality in particular is a direct cost lever. */
  openAiImageModel: string;
  openAiImageSize: string;
  openAiImageQuality: string;
  /** Empty string means: do not send the parameter at all. */
  openAiImageInputFidelity: string;
  /**
   * Settings for image calls made INSIDE the request/response cycle (House
   * emblems, turn images). API Gateway caps a synchronous request at 30s, so
   * these must stay fast — they cannot follow the worker's slow, high-quality
   * settings.
   */
  openAiSyncImageModel: string;
  openAiSyncImageSize: string;
  openAiSyncImageQuality: string;
  imagesBucket: string;
  visualWorkerFunctionName: string;
  /**
   * Segredo dedicado que autoriza APENAS enviar um rascunho de turno (nada
   * mais). Deixa um agente externo (Claude) propor o turno sem receber o código
   * de admin. Vazio = ingestão de rascunho por token desabilitada (só admin).
   */
  draftIngestToken: string;
}

export interface HandlerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  rawBody?: Buffer;
  pathParams: Record<string, string>;
  sourceIp?: string;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
