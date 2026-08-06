import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export interface WorkerPayload { campaignId: string; generationId: string }

let cached: LambdaClient | null = null;
function client(region?: string): LambdaClient {
  if (!cached) cached = new LambdaClient(region ? { region } : {});
  return cached;
}

export async function invokeWorker(functionName: string, region: string | undefined, payload: WorkerPayload): Promise<void> {
  await client(region).send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}
