import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CanonicoPage } from "./CanonicoPage";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { loadPlayerSession, savePlayerSession } from "../auth/playerSession";
import type { CreateHouseInput } from "../types/api";

const houseInput: CreateHouseInput = {
  displayName: "Elira",
  name: "Casa Nevasca",
  motto: "Sob a neve, resistimos.",
  emblem: { icon: "lobo", color1: "#7f1d1d", color2: "#1e3a5f" },
  leaderName: "Dama Elira",
  heirName: "Tomas",
  castleName: "Castelo Nevasca",
  townsText: "Aldeias sob pinheiros negros.",
  historyText: "Uma linhagem marcada pelo inverno.",
  specialty: "Patrulhas na neve",
  weakness: "Celeiros vazios",
  attributes: { riqueza: 2, recursos: 3, soldados: 2, controle: 3 },
};

async function login(api: MockApiClient) {
  const account = await api.createAccountAndHouse(houseInput);
  savePlayerSession({
    playerToken: account.playerToken,
    houseId: account.houseId,
    displayName: account.displayName,
  });
  return account;
}

async function renderPage(api: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={api}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CanonicoPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("CanonicoPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the submission form to a logged-in player", async () => {
    const api = new MockApiClient();
    await login(api);
    await renderPage(api);
    expect(await screen.findByLabelText(/o que você quer tornar canônico/i)).toBeTruthy();
  });

  it("lists the house's own submissions with their status", async () => {
    const api = new MockApiClient();
    const account = await login(api);
    const preview = await api.playerCanonPreview(account.playerToken, "Sera de Vargen.");
    await api.playerCanonSubmit(account.playerToken, {
      rawText: "Sera de Vargen.",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: preview.proposal,
      review: preview.review,
    });

    await renderPage(api);

    expect(await screen.findByText(/Aguardando o Mestre/i)).toBeTruthy();
    expect(screen.getAllByText("Sera de Vargen.").length).toBeGreaterThan(0);
  });

  it("refreshes the list after a successful submission through the form", async () => {
    const api = new MockApiClient();
    await login(api);
    await renderPage(api);

    expect(await screen.findByText(/Você ainda não propôs nada\./i)).toBeTruthy();

    await userEvent.type(
      screen.getByLabelText(/o que você quer tornar canônico/i),
      "Bram, o ferreiro de Vargen.",
    );
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));
    await screen.findByRole("button", { name: /enviar ao mestre/i });
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));

    expect(await screen.findByText(/Aguardando o Mestre/i)).toBeTruthy();
    expect(screen.getAllByText("Bram, o ferreiro de Vargen.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Você ainda não propôs nada\./i)).toBeNull();
  });

  it("clears the session and redirects to /login when the token is expired", async () => {
    const api = new MockApiClient();
    savePlayerSession({ playerToken: "token-invalido", houseId: "casa-x", displayName: "Elira" });

    await act(async () => {
      render(
        <ApiProvider client={api}>
          <MemoryRouter
            initialEntries={["/canonico"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route path="/canonico" element={<CanonicoPage />} />
              <Route path="/login" element={<div>Tela de acesso</div>} />
            </Routes>
          </MemoryRouter>
        </ApiProvider>,
      );
    });

    expect(await screen.findByText(/Tela de acesso/i)).toBeTruthy();
    expect(loadPlayerSession()).toBeNull();
  });
});
