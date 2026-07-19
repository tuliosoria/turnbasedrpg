import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { CreateHousePage } from "./CreateHousePage";

function renderPage(client: MockApiClient) {
  render(
    <ApiProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CreateHousePage />
      </MemoryRouter>
    </ApiProvider>,
  );
}

describe("CreateHousePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("creates a house and shows the generated player code", async () => {
    const client = new MockApiClient();
    const createSpy = vi.spyOn(client, "createAccountAndHouse");
    renderPage(client);

    await userEvent.type(screen.getByLabelText(/nome de exibição/i), "Elira");
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));

    await userEvent.type(screen.getByLabelText("Nome da Casa"), "Casa Nevasca");
    await userEvent.type(screen.getByLabelText("Lema"), "Sob a neve, resistimos.");
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));

    await waitFor(() => expect(screen.getByText(/pontos restantes/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Diminuir Riqueza" }));
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Aumentar Riqueza" }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));

    await userEvent.click(screen.getByRole("button", { name: /fundar a casa/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    expect(await screen.findByText(/guarde este código/i)).toBeInTheDocument();
    expect(screen.getByText(/^RVN-/)).toBeInTheDocument();
  });
});
