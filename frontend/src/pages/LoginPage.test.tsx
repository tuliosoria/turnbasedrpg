import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../App";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { clearPlayerSession } from "../auth/playerSession";
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

async function renderAt(api: MockApiClient, path: string) {
  await act(async () => {
    render(
      <ApiProvider client={api}>
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppRoutes />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("entrada do jogador", () => {
  beforeEach(() => {
    clearPlayerSession();
  });

  // Quem clicava em "Adicionar Canônico" deslogado era mandado ao login e
  // depois despejado em /game, sem nunca chegar onde quis ir.
  it("devolve o jogador à página que ele tentou abrir", async () => {
    const api = new MockApiClient();
    const account = await api.createAccountAndHouse(houseInput);
    clearPlayerSession();

    await renderAt(api, "/canonico");

    const campo = screen.getByLabelText(/código do jogador/i);
    await userEvent.type(campo, account.playerCode);
    const formulario = campo.closest("form") as HTMLFormElement;
    await act(async () => {
      await userEvent.click(within(formulario).getByRole("button", { name: "Entrar" }));
    });

    expect(await screen.findByText(/Adicionar Canônico/)).toBeInTheDocument();
  });

  it("leva ao turno quando o jogador entra pela porta da frente", async () => {
    const api = new MockApiClient();
    const account = await api.createAccountAndHouse(houseInput);
    clearPlayerSession();

    await renderAt(api, "/login");

    const campo = screen.getByLabelText(/código do jogador/i);
    await userEvent.type(campo, account.playerCode);
    const formulario = campo.closest("form") as HTMLFormElement;
    await act(async () => {
      await userEvent.click(within(formulario).getByRole("button", { name: "Entrar" }));
    });

    expect(await screen.findByRole("heading", { name: "Sua Casa" })).toBeInTheDocument();
  });
});
