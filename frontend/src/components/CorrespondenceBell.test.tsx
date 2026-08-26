import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { CorrespondenceBell } from "./CorrespondenceBell";
import { savePlayerSession, clearPlayerSession } from "../auth/playerSession";

async function montar(client: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CorrespondenceBell />
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
    vi.spyOn(client, "countIncomingLetters").mockResolvedValue({ cartas: 0, turnNumber: 7 });
    await montar(client);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("avisa e leva ao turno quando uma Casa escreveu", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockResolvedValue({ cartas: 2, turnNumber: 7 });
    await montar(client);
    const link = await screen.findByRole("link", { name: /2 Casas escreveram para você/i });
    expect(link).toHaveAttribute("href", "/game");
  });

  it("falha em silêncio: um contador quebrado não pode derrubar a navegação", async () => {
    const client = new MockApiClient();
    savePlayerSession({ playerToken: "t", houseId: "h", displayName: "P" } as never);
    vi.spyOn(client, "countIncomingLetters").mockRejectedValue(new Error("500"));
    await montar(client);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
