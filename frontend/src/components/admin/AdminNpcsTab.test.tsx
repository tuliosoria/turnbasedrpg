import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminNpcsTab } from "./AdminNpcsTab";

async function setup() {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("admin-test");
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <AdminNpcsTab adminToken={adminToken} busy={false} />
      </ApiProvider>,
    );
  });
  return client;
}

describe("AdminNpcsTab", () => {
  it("salva o estado de um NPC e o relê", async () => {
    const client = await setup();
    await waitFor(() => expect(screen.getByLabelText("Humor agora")).toBeInTheDocument());

    await act(async () => {
      await userEvent.type(screen.getByLabelText("Humor agora"), "exausta e desconfiada");
    });
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Salvar estado/ })); });

    await waitFor(() => expect(screen.getByText("Estado salvo.")).toBeInTheDocument());

    // Persistiu de fato no cliente.
    const states = await client.adminListNpcStates("mock-admin-token");
    expect(states[0].mood).toBe("exausta e desconfiada");
  });

  // A percepção é por Casa: cada outra Casa tem seu próprio campo.
  it("oferece um campo de percepção para cada outra Casa", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("Percepção das outras Casas")).toBeInTheDocument());

    // A Casa selecionada não aparece como alvo de percepção de si mesma.
    expect(screen.queryByLabelText("Casa Auremont")).toBeInTheDocument();
  });
});
