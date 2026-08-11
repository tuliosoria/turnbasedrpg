import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EnciclopediaPage } from "./EnciclopediaPage";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

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

  it("renders the galeria with canonical images", async () => {
    await setup(new MockApiClient());
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

  it("hides Estúdio tab without admin token", async () => {
    clearAdminToken();
    await setup(new MockApiClient());
    expect(screen.queryByRole("tab", { name: "Estúdio" })).not.toBeInTheDocument();
  });

  it("shows Estúdio tab with admin token", async () => {
    saveAdminToken("admin-test-token");
    await setup(new MockApiClient());
    expect(screen.getByRole("tab", { name: "Estúdio" })).toBeInTheDocument();
  });

  it("runs a generation to completion in the estudio", async () => {
    saveAdminToken("admin-test-token");
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Estúdio" })); });

    await act(async () => {
      await userEvent.click(await screen.findByRole("combobox", { name: "Entidade" }));
    });
    await act(async () => {
      await userEvent.click(await screen.findByRole("option", { name: "Príncipe Alic Valerius" }));
    });
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "retrato heróico");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
    });

    await waitFor(() => expect(screen.getByText("Score de consistência: 75")).toBeInTheDocument(), { timeout: 8000 });
  });
});
