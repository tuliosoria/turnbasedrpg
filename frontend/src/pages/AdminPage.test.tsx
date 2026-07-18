import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { AdminPage } from "./AdminPage";

function renderPage(client: MockApiClient) {
  render(
    <ApiProvider client={client}>
      <MemoryRouter><AdminPage /></MemoryRouter>
    </ApiProvider>,
  );
}

describe("AdminPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("logs in and shows the choices dashboard", async () => {
    const client = new MockApiClient();
    const claim = await client.claimHouse("vargen", "Elira");
    const game = await client.getGame(claim.playerToken);
    await client.submitChoice(claim.playerToken, 1, game.cards[0].id);
    renderPage(client);

    await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(screen.getByText("Defender a Ponte")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /bloquear turno/i })).toBeInTheDocument();
  });
});
