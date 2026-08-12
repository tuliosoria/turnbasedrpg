import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeImageFn, makeImageEditFn } from "./ai/images";
import { makeImageStore } from "./storage/images";
import { makeDocClient } from "./db/dynamo";
import { route } from "./router";
import { invokeWorker } from "./db/visual/invokeWorker";
import type { HandlerRequest } from "./types/domain";

const config = loadConfig();
const region = process.env.AWS_REGION;
const doc = makeDocClient(region);
const chat = config.openAiApiKey ? makeChatFn(config.openAiApiKey, config.openAiModel) : undefined;
const imageOpts = { model: config.openAiImageModel, size: config.openAiImageSize, quality: config.openAiImageQuality };
const image = config.openAiApiKey ? makeImageFn(config.openAiApiKey, 28000, imageOpts) : undefined;
const imageStore = config.imagesBucket
  ? makeImageStore(config.imagesBucket, `https://${config.imagesBucket}.s3.${region ?? "us-east-1"}.amazonaws.com`, region)
  : undefined;
const imageEdit = config.openAiApiKey ? makeImageEditFn(config.openAiApiKey, 120000, imageOpts) : undefined;
const invokeVisualWorker = config.visualWorkerFunctionName
  ? (payload: { campaignId: string; generationId: string }) => invokeWorker(config.visualWorkerFunctionName, region, payload)
  : undefined;
const deps = { doc, config, chat, image, imageEdit, imageStore, invokeWorker: invokeVisualWorker };

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function headerValue(headers: Record<string, string | undefined>, name: string): string {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] ?? "";
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  let body: unknown;
  let rawBody: Buffer | undefined;
  if (event.body) {
    rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
    const contentType = headerValue(event.headers ?? {}, "content-type");
    if (!contentType || contentType.toLowerCase().startsWith("application/json")) {
      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ code: "INVALID_BODY", message: "JSON inválido." }) };
      }
    }
  }

  const req: HandlerRequest = {
    method,
    path: event.rawPath,
    headers: event.headers ?? {},
    body,
    rawBody,
    pathParams: {},
    sourceIp: event.requestContext.http.sourceIp,
  };

  const res = await route(deps, req);
  return {
    statusCode: res.status,
    headers: corsHeaders(),
    body: res.body === undefined ? "" : JSON.stringify(res.body),
  };
}
