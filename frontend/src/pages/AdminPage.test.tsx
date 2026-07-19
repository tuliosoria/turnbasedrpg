import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { AdminPage } from "./AdminPage";
import type { ApiClient } from "../api/client";
import type { AdminDashboard } from "../types/api";

const draftDashboard: AdminDashboard = {
  turnId: 2,
  turnStatus: "DRAFT",
  publicEvent: "",
  privateInfo: { "house-1": "Sussurros sob a neve." },
  cards: [],
  result: null,
  houses: [
    {
      houseId: "house-1",
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
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  submissions: [],
};

const lockedDashboard: AdminDashboard = {
  ...draftDashboard,
  turnStatus: "LOCKED",
  publicEvent: "A neve fecha os portões.",
  result: null,
};

function makeClient(dashboard: AdminDashboard = draftDashboard): ApiClient {
  return {
    getCampaign: vi.fn(),
    getHouseExample: vi.fn(),
    createAccountAndHouse: vi.fn(),
    login: vi.fn(),
    getGame: vi.fn(),
    submitOrder: vi.fn(),
    adminLogin: vi.fn().mockResolvedValue({ adminToken: "admin-token" }),
    getAdminDashboard: vi.fn().mockResolvedValue(dashboard),
    adminComposeTurn: vi.fn().mockResolvedValue(undefined),
    adminOpenTurn: vi.fn().mockResolvedValue(undefined),
    adminLockTurn: vi.fn(),
    adminUnlockTurn: vi.fn(),
    adminDraftPrivateInfo: vi.fn().mockResolvedValue({ "house-1": "Informação privada da IA." }),
    adminDraftResolution: vi.fn().mockResolvedValue({
      publicResult: "Resultado público da IA.",
      houseResults: { "house-1": "Resultado privado da IA." },
      attributeDeltas: { "house-1": { controle: 1 } },
      discoveries: ["Um sino enterrado guia os mortos."],
    }),
    adminApplyResolution: vi.fn(),
    adminEditHouse: vi.fn(),
  } as ApiClient;
}

describe("AdminPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("logs in and shows draft compose controls", async () => {
    const client = makeClient();
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminPage />
        </MemoryRouter>
      </ApiProvider>,
    );

    await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(client.getAdminDashboard).toHaveBeenCalledWith("admin-token"));
    expect(screen.getByRole("heading", { name: /painel do turno 2/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/evento público/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/informação privada para Casa Nevasca/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir turno/i })).toBeInTheDocument();
  });

  it("keeps drafted private info visible after the AI action returns", async () => {
    const client = makeClient();
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminPage />
        </MemoryRouter>
      </ApiProvider>,
    );

    await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByLabelText(/informação privada para Casa Nevasca/i);
    await userEvent.click(screen.getByRole("button", { name: /rascunhar informações/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/informação privada para Casa Nevasca/i)).toHaveValue("Informação privada da IA."),
    );
  });

  it("keeps drafted resolution visible after the AI action returns", async () => {
    const client = makeClient(lockedDashboard);
    sessionStorage.setItem("ravenloft.admin", "admin-token");
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminPage />
        </MemoryRouter>
      </ApiProvider>,
    );

    await screen.findByRole("heading", { name: /rodar turno/i });
    await userEvent.click(screen.getByRole("button", { name: /rascunhar resolução/i }));

    await waitFor(() => expect(screen.getByLabelText("Resultado público")).toHaveValue("Resultado público da IA."));
    expect(screen.getByLabelText(/resultado privado para Casa Nevasca/i)).toHaveValue("Resultado privado da IA.");
    expect(screen.getByLabelText("Descobertas")).toHaveValue("Um sino enterrado guia os mortos.");
  });
});
