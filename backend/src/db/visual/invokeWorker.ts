import { invokeEvent } from "../../invokeEvent";

export interface WorkerPayload { campaignId: string; generationId: string }

export async function invokeWorker(functionName: string, region: string | undefined, payload: WorkerPayload): Promise<void> {
  await invokeEvent(functionName, payload, region);
}
