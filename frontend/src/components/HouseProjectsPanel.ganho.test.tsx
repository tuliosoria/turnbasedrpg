import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockApiClient } from "../api/mockClient";
import { ApiProvider } from "../api/ApiProvider";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

async function semear(client: MockApiClient, attributes = { riqueza: 3, recursos: 3, soldados: 2, controle: 2 }) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes,
  } as never);
  return acc.playerToken;
}

function montar(client: MockApiClient, token: string) {
  render(
    <ApiProvider client={client}>
      <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
    </ApiProvider>,
  );
}

describe("HouseProjectsPanel mostra o ganho", () => {
  let client: MockApiClient;
  beforeEach(() => {
    client = new MockApiClient();
    // O jsdom não implementa window.confirm, e o botão Iniciar passa por ele.
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("escreve o ganho ao lado do custo na biblioteca", async () => {
    // Antes deste trabalho a carta mostrava título, descrição, duração e custo,
    // e nada sobre o que o jogador ia receber. Ele escolhia às cegas.
    const token = await semear(client);
    montar(client, token);
    fireEvent.click(await screen.findByText("Biblioteca"));
    const ganhos = await screen.findAllByText(/^Ganho: /);
    expect(ganhos.length).toBeGreaterThan(0);
  });

  it("nenhuma carta da biblioteca aparece sem ganho mecânico", async () => {
    const token = await semear(client);
    montar(client, token);
    fireEvent.click(await screen.findByText("Biblioteca"));
    await screen.findAllByText(/^Ganho: /);
    expect(screen.queryByText(/Ganho: Sem ganho mecânico/)).toBeNull();
  });

  it("separa o que o motor garante do que o Mestre honra narrando", async () => {
    const token = await semear(client);
    montar(client, token);
    fireEvent.click(await screen.findByText("Biblioteca"));
    const narrativos = await screen.findAllByText(/O Mestre honra na narrativa:/);
    expect(narrativos.length).toBeGreaterThan(0);
  });

  it("mostra no projeto ativo o que está sendo construído", async () => {
    const token = await semear(client);
    montar(client, token);
    fireEvent.click(await screen.findByText("Biblioteca"));
    const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
    fireEvent.click(iniciar[0]);
    await waitFor(() => expect(screen.getByText(/Projetos Ativos \(1\//i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Projetos Ativos \(1\//i));
    expect(await screen.findByText(/^Ao concluir: /)).toBeInTheDocument();
  });

  it("avisa do teto sem desabilitar o botão", async () => {
    // Decisão 4 do Mestre: o jogador nunca é impedido de usar a carta. O aviso
    // informa; quem decide é ele.
    const token = await semear(client, { riqueza: 5, recursos: 3, soldados: 1, controle: 1 });
    montar(client, token);
    fireEvent.click(await screen.findByText("Biblioteca"));
    const avisos = await screen.findAllByText(/já está no teto/);
    expect(avisos.length).toBeGreaterThan(0);
    const botoes = screen.getAllByRole("button", { name: "Iniciar" });
    expect(botoes.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });
});
