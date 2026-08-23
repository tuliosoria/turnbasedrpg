import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { ORDER_TEXT_MAX } from "@ravenloft/content";
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

/** Cria a Casa e planta ativos nela, como uma carta concluída faria. */
async function comAtivos(assets: string[]) {
  const client = new MockApiClient();
  const account = await client.createAccountAndHouse(houseInput);
  savePlayerSession({
    playerToken: account.playerToken,
    houseId: account.houseId,
    displayName: account.displayName,
  });
  const casas = (client as unknown as { houses: Map<string, { assets?: string[] }> }).houses;
  casas.get(account.houseId)!.assets = assets;
  return client;
}

async function montarJogo(client: MockApiClient) {
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
  return client;
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

  // O limite existia só no servidor: o jogador escrevia demais e levava um erro
  // sem saber qual era o teto nem quanto cortar.
  it("mostra ao jogador quantos caracteres cabem na ordem", async () => {
    await setup();
    const campo = await screen.findByRole("textbox", { name: /sua ordem/i });
    expect(screen.getByText(new RegExp(`0 de ${ORDER_TEXT_MAX.toLocaleString("pt-BR")} caracteres`))).toBeInTheDocument();
    await userEvent.type(campo, "Patrulhar.");
    expect(screen.getByText(new RegExp(`10 de ${ORDER_TEXT_MAX.toLocaleString("pt-BR")} caracteres`))).toBeInTheDocument();
    expect(campo).toHaveAttribute("maxlength", String(ORDER_TEXT_MAX));
  });

  it("renders the House image gallery when the house has images", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse({
      ...houseInput,
      images: ["data:image/png;base64,ZZ"],
    });
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
    expect(await screen.findByAltText("Imagem 1 da Casa")).toBeInTheDocument();
  });

  it("shows previous private result above the result image with a private label", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    await client.adminLockTurn("mock-admin-token");
    await client.adminGenerateTurnImage("mock-admin-token", "result");
    await client.adminApplyResolution("mock-admin-token", {
      publicResult: "As muralhas resistiram ao primeiro ataque.",
      houseResults: { [account.houseId]: "Somente sua Casa sabe que o portão leste quase caiu." },
      attributeDeltas: {},
      discoveries: [],
    });
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

    const publicResult = await screen.findByText("As muralhas resistiram ao primeiro ataque.");
    const privateLabel = screen.getByText("Informação Privada");
    const privateResult = screen.getByText("Somente sua Casa sabe que o portão leste quase caiu.");
    const resultImage = screen.getByAltText("Ilustração do resultado do turno 1");

    expect(publicResult.compareDocumentPosition(privateLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(privateLabel.compareDocumentPosition(privateResult) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(privateResult.compareDocumentPosition(resultImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the per-turn attribute changes for the player's house", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    await client.adminLockTurn("mock-admin-token");
    await client.adminApplyResolution("mock-admin-token", {
      publicResult: "O conselho reagiu com dureza.",
      houseResults: { [account.houseId]: "Sua influência diminuiu." },
      attributeDeltas: { [account.houseId]: { controle: -1 } },
      discoveries: [],
    });
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

    expect(await screen.findByText("Mudanças na sua Casa")).toBeInTheDocument();
    expect(screen.getByText("Controle 3 → 2 (−1)")).toBeInTheDocument();
  });

  it("shows past turns as tabs with the most recent selected by default", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    const { adminToken } = await client.adminLogin("admin-test");

    // Turn 1 (starter turn is already OPEN)
    await client.adminLockTurn(adminToken);
    await client.adminApplyResolution(adminToken, {
      publicResult: "Resultado público do turno 1",
      houseResults: { [account.houseId]: "Privado do turno 1" },
      attributeDeltas: {},
      discoveries: [],
    });

    // Turn 2
    await client.adminComposeTurn(adminToken, { publicEvent: "Evento 2", privateInfo: {} });
    await client.adminOpenTurn(adminToken);
    await client.adminLockTurn(adminToken);
    await client.adminApplyResolution(adminToken, {
      publicResult: "Resultado público do turno 2",
      houseResults: { [account.houseId]: "Privado do turno 2" },
      attributeDeltas: {},
      discoveries: [],
    });

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

    expect(await screen.findByRole("tab", { name: /Turno 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Turno 2/ })).toBeInTheDocument();
    expect(screen.getByText(/Resultado público do turno 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Turno 1/ }));
    expect(screen.getByText(/Resultado público do turno 1/)).toBeInTheDocument();
  });

  it("renders current and previous narrative Markdown in the player view", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    await client.adminLockTurn("mock-admin-token");
    await client.adminApplyResolution("mock-admin-token", {
      publicResult: "**O portão norte** resistiu.\n\n*Mas a neve ficou negra.*",
      houseResults: {
        [account.houseId]: "Você sabe que **o herdeiro** viu *uma sombra*.",
      },
      attributeDeltas: {},
      discoveries: [],
    });
    await client.adminComposeTurn("mock-admin-token", {
      publicEvent: "**Asterhall** treme sob *sinos distantes*.\n\nAs estradas se fecham.",
      privateInfo: {
        [account.houseId]: "Sua Casa ouve **um segredo** nas *catacumbas*.",
      },
    });
    await client.adminOpenTurn("mock-admin-token");
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

    expect((await screen.findByText("O portão norte")).tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("Mas a neve ficou negra.").tagName.toLowerCase()).toBe("em");
    expect(screen.getByText("o herdeiro").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("uma sombra").tagName.toLowerCase()).toBe("em");
    expect(screen.getByText("Asterhall").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("sinos distantes").tagName.toLowerCase()).toBe("em");
    expect(screen.getByText("um segredo").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("catacumbas").tagName.toLowerCase()).toBe("em");
  });
  it("mostra a Energia livre do turno no bloco da Casa", async () => {
    await setup();

    expect(await screen.findByText(/Energia deste turno: 3 de 3/)).toBeInTheDocument();
  });

  it("desconta da Energia livre o que a Casa já distribuiu", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    savePlayerSession({ playerToken: account.playerToken, houseId: account.houseId, displayName: account.displayName });
    await client.startProjectFromTemplate(account.playerToken, { templateId: "contratar-uma-companhia-mercenaria" });
    const antes = await client.getProjects(account.playerToken);
    const carta = antes.projects.find((p) => p.status === "ACTIVE");
    if (!carta) throw new Error("esperava uma carta ativa para distribuir Energia");
    await client.setEnergia(account.playerToken, { porProjeto: { [carta.id]: 1 } });

    await act(async () => {
      render(
        <ApiProvider client={client}>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <GamePage />
          </MemoryRouter>
        </ApiProvider>,
      );
    });

    expect(await screen.findByText(/Energia deste turno: 2 de 3/)).toBeInTheDocument();
  });
  it("sem ativos, explica de onde eles vêm em vez de mostrar seção vazia", async () => {
    await setup();

    expect(await screen.findByText(/Sua Casa ainda não tem ativos/i)).toBeInTheDocument();
  });

  it("mostra um chip por ativo da Casa", async () => {
    const client = await comAtivos(["Aqueduto", "Frota de Guerra"]);
    await montarJogo(client);

    expect(await screen.findByText("Aqueduto")).toBeInTheDocument();
    expect(screen.getByText("Frota de Guerra")).toBeInTheDocument();
    expect(screen.queryByText(/ainda não tem ativos/i)).not.toBeInTheDocument();
  });

  it("agrupa ativo repetido num chip só, com a contagem", async () => {
    const client = await comAtivos(["Milícia Local", "Aqueduto", "Milícia Local"]);
    await montarJogo(client);

    // Dois chips iguais lado a lado pareceriam bug. O jogador pode rodar a mesma
    // carta duas vezes, entao repetido e um caso real.
    expect(await screen.findByText("Milícia Local ×2")).toBeInTheDocument();
    expect(screen.getByText("Aqueduto")).toBeInTheDocument();
    expect(screen.queryByText("Milícia Local")).not.toBeInTheDocument();
  });
});
