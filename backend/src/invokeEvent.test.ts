import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn(async () => ({ StatusCode: 202 }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { send = sendMock; },
  InvokeCommand: class { constructor(public input: any) {} },
}));

import { invokeEvent } from "./invokeEvent";

describe("invokeEvent", () => {
  it("invoca a função em Event com o payload", async () => {
    await invokeEvent("outreach-fn", { turnId: 9, publicEvent: "A marcha partiu." }, "us-east-1");
    const cmd = (sendMock.mock.calls as any[])[0][0];
    expect(cmd.input.FunctionName).toBe("outreach-fn");
    expect(cmd.input.InvocationType).toBe("Event");
    expect(JSON.parse(cmd.input.Payload)).toEqual({ turnId: 9, publicEvent: "A marcha partiu." });
  });
});
