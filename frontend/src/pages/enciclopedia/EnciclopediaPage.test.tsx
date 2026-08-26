import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EnciclopediaPage } from "./EnciclopediaPage";
import { clearAdminToken } from "../../auth/adminSession";

async function setup(client: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <EnciclopediaPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("EnciclopediaPage", () => {
  afterEach(() => clearAdminToken());

  it("opens on the acervo, framed as the whole Valdren encyclopedia", async () => {
    const client = new MockApiClient();
    await client.adminSeedWiki("mock-admin-token");
    await setup(client);
    expect(screen.getByRole("heading", { name: "Valdren — Enciclopédia" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acervo" })).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByText(/0 de \d+ verbetes com cânone visual/),
    ).toBeInTheDocument();
  });

  it("renders the galeria with canonical images", async () => {
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Imagens" })); });
    await waitFor(() => {
      const imgs = screen.getAllByRole("img");
      expect(imgs.length).toBeGreaterThan(0);
    });
  });

  // Entidades e Estúdio moraram aqui, numa rota pública, separados do conteúdo
  // de jogador só por um isAdmin invisível. Mudaram para o painel do Mestre.
  it("não expõe mais as ferramentas de Mestre na rota pública", async () => {
    await setup(new MockApiClient());
    expect(screen.queryByRole("tab", { name: "Entidades" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Estúdio" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Acervo", "Imagens"]);
  });
});
