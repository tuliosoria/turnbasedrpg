import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeDocClient } from "./db/dynamo";
import { route } from "./router";
import type { HandlerRequest } from "./types/domain";

const config = loadConfig();
const doc = makeDocClient(process.env.AWS_REGION);
const chat = config.openAiApiKey ? makeChatFn(config.openAiApiKey, config.openAiModel) : undefined;
const deps = { doc, config, chat };

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  let body: unknown;
  if (event.body) {
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body);
    } catch {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ code: "INVALID_BODY", message: "JSON inválido." }) };
    }
  }

  const req: HandlerRequest = {
    method,
    path: event.rawPath,
    headers: event.headers ?? {},
    body,
    pathParams: {},
  };

  const res = await route(deps, req);
  return {
    statusCode: res.status,
    headers: corsHeaders(),
    body: res.body === undefined ? "" : JSON.stringify(res.body),
  };
}
