export interface Config {
  tableName: string;
  campaignId: string;
  adminCodeHash: string;
  tokenSigningSecret: string;
  allowedOrigin: string;
  tokenTtlSeconds: number;
  openAiApiKey: string;
  openAiModel: string;
  /** Image model settings. Configurable so the campaign can trade cost against
   *  fidelity without a code change — quality in particular is a direct cost lever. */
  openAiImageModel: string;
  openAiImageSize: string;
  openAiImageQuality: string;
  imagesBucket: string;
  visualWorkerFunctionName: string;
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
