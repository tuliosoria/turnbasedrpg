import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CanonicoPage } from "./CanonicoPage";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { savePlayerSession } from "../auth/playerSession";
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
    });

    await renderPage(api);

    expect(await screen.findByText(/Aguardando o Mestre/i)).toBeTruthy();
    expect(screen.getAllByText("Sera de Vargen.").length).toBeGreaterThan(0);
  });
});
