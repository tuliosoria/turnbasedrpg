import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn(async () => ({ StatusCode: 202 }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { send = sendMock; },
  InvokeCommand: class { constructor(public input: any) {} },
}));

import { invokeWorker } from "./invokeWorker";

describe("invokeWorker", () => {
  it("invokes the worker function asynchronously with the payload", async () => {
    await invokeWorker("worker-fn", "us-east-1", { campaignId: "winter-dead", generationId: "g1" });
    const calls = sendMock.mock.calls as any[];
    const cmd = calls[0][0];
    expect(cmd.input.FunctionName).toBe("worker-fn");
    expect(cmd.input.InvocationType).toBe("Event");
    expect(JSON.parse(cmd.input.Payload)).toEqual({ campaignId: "winter-dead", generationId: "g1" });
  });
});
