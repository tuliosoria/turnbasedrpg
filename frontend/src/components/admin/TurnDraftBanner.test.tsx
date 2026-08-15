import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { TurnDraftBanner } from "./TurnDraftBanner";

const HOUSES = [
  { houseId: "h-ouro", name: "Casa do Ouro" },
  { houseId: "h-khaz", name: "Casa Khazdrun" },
];

async function setup(onLoad = vi.fn()) {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("code");
  client.setTurnDraftForTest({
    publicEvent: "Drakorys denuncia a Coroa.",
    // Uma chave por nome de Casa, outra por houseId — as duas devem casar.
    privateInfo: { "Casa do Ouro": "Vejam a rota vigiada.", "h-khaz": "O resíduo arcano confirma." },
    note: "Racional: primeira fratura aberta.",
    createdAt: "2026-08-15T12:00:00.000Z",
  });
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <TurnDraftBanner adminToken={adminToken} houses={HOUSES} onLoad={onLoad} />
      </ApiProvider>,
    );
  });
  return { client, onLoad };
}

describe("TurnDraftBanner", () => {
  it("mostra o rascunho pendente com a nota e o evento público", async () => {
    await setup();
    expect(await screen.findByText(/Rascunho de turno pendente/)).toBeInTheDocument();
    expect(screen.getByText(/Drakorys denuncia a Coroa/)).toBeInTheDocument();
    expect(screen.getByText(/primeira fratura aberta/)).toBeInTheDocument();
  });

  it("carrega nos campos, mapeando info privada por nome e por id", async () => {
    const { onLoad } = await setup();
    await screen.findByText(/Rascunho de turno pendente/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Carregar nos campos/ })); });
    expect(onLoad).toHaveBeenCalledWith("Drakorys denuncia a Coroa.", {
      "h-ouro": "Vejam a rota vigiada.",
      "h-khaz": "O resíduo arcano confirma.",
    });
  });

  it("descarta o rascunho e some", async () => {
    const { client } = await setup();
    await screen.findByText(/Rascunho de turno pendente/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Descartar rascunho/ })); });
    await waitFor(() => expect(screen.queryByText(/Rascunho de turno pendente/)).not.toBeInTheDocument());
    const { draft } = await client.adminGetTurnDraft("mock-admin-token");
    expect(draft).toBeNull();
  });
});
