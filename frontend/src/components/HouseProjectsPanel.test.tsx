import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockApiClient } from "../api/mockClient";
import { ApiProvider } from "../api/ApiProvider";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

async function seedToken(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as any);
  return acc.playerToken;
}

describe("HouseProjectsPanel", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); });

  it("renders the library and starts a project", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    const start = await screen.findAllByRole("button", { name: /Iniciar/i });
    fireEvent.click(start[0]);
    await waitFor(() => expect(screen.getByText(/Projetos Ativos/i)).toBeInTheDocument());
  });

  it("shows recommended cards for the House", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Cartas recomendadas para sua Casa/i)).toBeInTheDocument());
  });
});
