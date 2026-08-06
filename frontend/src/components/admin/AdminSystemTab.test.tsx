import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { AdminSystemTab } from "./AdminSystemTab";

function renderWith(aiStatus: any) {
  const client = { adminAiStatus: vi.fn().mockResolvedValue(aiStatus) } as any;
  render(
    <ApiProvider client={client}>
      <AdminSystemTab busy={false} runAction={vi.fn()} adminToken="t" />
    </ApiProvider>,
  );
  return client;
}

describe("AdminSystemTab — status da IA", () => {
  it("shows operational status and the model", async () => {
    const client = renderWith({ configured: true, status: "OK", model: "gpt-4o-mini" });
    await waitFor(() => expect(screen.getByText("Operacional")).toBeInTheDocument());
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(client.adminAiStatus).toHaveBeenCalledWith("t");
  });

  it("shows a down status with the quota reason", async () => {
    renderWith({ configured: true, status: "DOWN", model: "gpt-4o-mini", code: "AI_QUOTA", message: "quota" });
    await waitFor(() => expect(screen.getByText("Fora do ar")).toBeInTheDocument());
    expect(screen.getByText(/Cota da OpenAI excedida/i)).toBeInTheDocument();
  });

  it("shows not-configured when there is no key", async () => {
    renderWith({ configured: false, status: "NOT_CONFIGURED", model: "gpt-4o-mini" });
    await waitFor(() => expect(screen.getByText("Não configurada")).toBeInTheDocument());
  });
});
