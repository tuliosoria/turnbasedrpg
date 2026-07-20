import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { savePlayerSession } from "../auth/playerSession";
import { GamePage } from "./GamePage";
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

async function setup() {
  const client = new MockApiClient();
  const account = await client.createAccountAndHouse(houseInput);
  savePlayerSession({
    playerToken: account.playerToken,
    houseId: account.houseId,
    displayName: account.displayName,
  });
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GamePage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("GamePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the open turn and submits an order", async () => {
    await setup();

    expect(await screen.findByText("Casa Nevasca")).toBeInTheDocument();
    expect(screen.getByText(/A neve cobre as estradas de Baróvia/)).toBeInTheDocument();

    await userEvent.type(await screen.findByRole("textbox", { name: /sua ordem/i }), "Patrulhar a estrada e dividir os celeiros.");
    await userEvent.click(screen.getByRole("button", { name: /enviar ordem/i }));

    await waitFor(() =>
      expect(screen.getByText(/Ordem registrada\. Você pode editar enquanto o turno estiver aberto/i)).toBeInTheDocument(),
    );
  });
});
