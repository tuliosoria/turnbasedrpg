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
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Galeria" })); });
    await waitFor(() => {
      const imgs = screen.getAllByRole("img");
      expect(imgs.length).toBeGreaterThan(0);
    });
  });

  it("shows entidades when the tab is selected", async () => {
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Entidades" })); });
    expect(await screen.findByText("Príncipe Alic Valerius")).toBeInTheDocument();
  });

  it("shows Estúdio tab even without admin token", async () => {
    clearAdminToken();
    await setup(new MockApiClient());
    expect(screen.getByRole("tab", { name: "Estúdio" })).toBeInTheDocument();
  });

  it("runs a free-concept generation to completion in the estudio", async () => {
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Estúdio" })); });
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "retrato heróico");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
    });
    await waitFor(
      () => expect(screen.getByText(/Passou na verificação de consistência/)).toBeInTheDocument(),
      { timeout: 8000 },
    );
  });
});
