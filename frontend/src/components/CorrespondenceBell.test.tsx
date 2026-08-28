import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { CorrespondenceBell } from "./CorrespondenceBell";
import { savePlayerSession, clearPlayerSession } from "../auth/playerSession";

/** Espia a rota: com MemoryRouter, navegar não mexe em window.location. */
function Onde() {
  const l = useLocation();
  return <div data-testid="rota">{l.pathname + l.search}</div>;
}

async function montar(client: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CorrespondenceBell />
          <Onde />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("CorrespondenceBell", () => {
  afterEach(() => clearPlayerSession());

  // O cabeçalho aparece na landing e na wiki, onde não há sessão. Se o sino
  // exigisse o contexto de API ali, derrubaria a página inteira.
  it("não renderiza nada sem sessão de jogador, e nem toca na API", async () => {
    const client = new MockApiClient();
    const spy = vi.spyOn(client, "countIncomingLetters");
    await montar(client);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("some quando não há carta — sino zerado ensina a não olhar", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockResolvedValue({ cartas: 0, turnNumber: 7, remetentes: [] });
    await montar(client);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("avisa e leva ao turno quando uma Casa escreveu", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockResolvedValue({
      cartas: 2, turnNumber: 7,
      remetentes: [
        { houseKey: "casa-karasoy", houseName: "Casa Karasoy", person: "Selma Karasoy", preview: "Prometi força a Asterhall.", turnNumber: 7 },
        { houseKey: "ordem-do-sino", houseName: "Ordem do Sino", person: "Othran Sete-Tintas", preview: "A conta não fecha.", turnNumber: 7 },
      ],
    });
    await montar(client);
    await userEvent.click(await screen.findByRole("button", { name: /2 Casas escreveram para você/i }));

    // Quem escreveu, e não só quantas: um "2" apontava para o palheiro.
    expect(await screen.findByText(/Selma Karasoy — Casa Karasoy/)).toBeInTheDocument();
    expect(screen.getByText(/A conta não fecha/)).toBeInTheDocument();
  });

  it("falha em silêncio: um contador quebrado não pode derrubar a navegação", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockRejectedValue(new Error("500"));
    await montar(client);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("o clique leva à conversa", () => {
  // O aviso levava a /game e parava ali: o jogador chegava na página e ainda
  // tinha de caçar quem lhe escreveu, que é metade do problema.
  it("navega para a aba de cartas já apontando a Casa", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockResolvedValue({
      cartas: 1, turnNumber: 7,
      remetentes: [{ houseKey: "casa-euralune", houseName: "Casa Euralune", person: null, preview: "Recusamos a torre.", turnNumber: 7 }],
    });
    await montar(client);
    await userEvent.click(await screen.findByRole("button", { name: /Uma Casa escreveu/i }));
    await userEvent.click(await screen.findByText(/Casa Euralune/));

    const rota = await screen.findByTestId("rota");
    expect(rota.textContent).toContain("/game");
    expect(rota.textContent).toContain("aba=cartas");
    expect(rota.textContent).toContain("casa=casa-euralune");
  });
});
