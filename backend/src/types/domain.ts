export interface Config {
  tableName: string;
  campaignId: string;
  adminCodeHash: string;
  tokenSigningSecret: string;
  allowedOrigin: string;
  tokenTtlSeconds: number;
  openAiApiKey: string;
  openAiModel: string;
  imagesBucket: string;
}

export interface HandlerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
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
