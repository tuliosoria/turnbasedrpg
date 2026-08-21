import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminLivingTab } from "./AdminLivingTab";

async function setup() {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("admin-test");
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <AdminLivingTab adminToken={adminToken} busy={false} />
      </ApiProvider>,
    );
  });
  return client;
}

describe("AdminLivingTab", () => {
  it("lista os personagens do Codex e salva o estado vivo", async () => {
    const client = await setup();
    await waitFor(() => expect(screen.getByLabelText("Humor agora")).toBeInTheDocument());

    await act(async () => { await userEvent.type(screen.getByLabelText("Humor agora"), "preocupado"); });
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Salvar estado vivo/ })); });

    await waitFor(() => expect(screen.getByText("Estado salvo.")).toBeInTheDocument());

    const dynamics = await client.adminListNpcDynamics("mock-admin-token");
    expect(dynamics[0].mood).toBe("preocupado");
  });

  it("mostra a memória e as relações que o Relationship Engine gravaria", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    // Pré-grava um estado vivo com relação e memória.
    await client.adminPutNpcDynamic(adminToken, {
      affiliation: "casa-solarion", id: "farao-gloriandur", mood: "", location: "", objective: "", concerns: "", loyalty: "",
      relations: { "casa-vargen": { trust: 30, respect: 55, fear: 20, resentment: 40, obligation: 5, summary: "Gente de fronteira." } },
      memory: [{ turnNumber: 3, description: "Vargen ignorou um alerta.", impact: "-confiança" }], updatedAt: "",
    });

    await act(async () => {
      render(
        <ApiProvider client={client}>
          <AdminLivingTab adminToken={adminToken} busy={false} />
        </ApiProvider>,
      );
    });

    // Seleciona o NPC que tem estado; a memória e a relação aparecem.
    await waitFor(() => expect(screen.getByLabelText("Personagem")).toBeInTheDocument());
    await act(async () => { await userEvent.click(screen.getByLabelText("Personagem")); });
    await act(async () => { await userEvent.click(await screen.findByRole("option", { name: /Faraó Gloriandur/ })); });

    expect(await screen.findByText(/Vargen ignorou um alerta/)).toBeInTheDocument();
    expect(screen.getByText(/confiança 30/)).toBeInTheDocument();
  });
});
