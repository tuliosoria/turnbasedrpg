import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockApiClient } from "../api/mockClient";
import { ApiProvider } from "../api/ApiProvider";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

async function semear(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
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

/** Inicia a primeira carta da biblioteca e abre a aba de ativos. */
async function comCartaAtiva(client: MockApiClient) {
  const token = await semear(client);
  montar(client, token);
  fireEvent.click(await screen.findByText("Biblioteca"));
  const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(iniciar[0]);
  await waitFor(() => expect(screen.getByText(/Projetos Ativos \(1\//i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Projetos Ativos \(1\//i));
  return token;
}

/** Inicia duas cartas e abre a aba de ativos. */
async function comDuasCartasAtivas(client: MockApiClient) {
  const token = await semear(client);
  montar(client, token);
  fireEvent.click(await screen.findByText("Biblioteca"));
  const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(iniciar[0]);
  await waitFor(() => expect(screen.getByText(/Projetos Ativos \(1\//i)).toBeInTheDocument());
  fireEvent.click(await screen.findByText("Biblioteca"));
  const denovo = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(denovo[1]);
  await waitFor(() => expect(screen.getByText(/Projetos Ativos \(2\//i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Projetos Ativos \(2\//i));
  return token;
}

describe("Energia no painel de projetos", () => {
  let client: MockApiClient;
  beforeEach(() => {
    client = new MockApiClient();
    // O jsdom não implementa window.confirm, e o botão Iniciar passa por ele.
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("mostra a Energia do turno assim que a tela abre", async () => {
    const token = await semear(client);
    montar(client, token);
    expect(await screen.findByText(/Energia: 3\/3/)).toBeInTheDocument();
  });

  it("deixa o jogador pôr Energia numa carta ativa", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Energia nesta carta: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Sem distribuição, a carta anda um turno/i)).toBeInTheDocument();
  });

  it("sem distribuição, a tela diz que a carta anda — é o que o turno faz", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Sem distribuição, a carta anda um turno/i)).toBeInTheDocument();
    expect(screen.queryByText(/fica parada/i)).not.toBeInTheDocument();
  });

  it("depois de distribuir, a carta sem Energia é a que fica parada", async () => {
    const token = await comCartaAtiva(client);
    await client.setEnergia(token, { porProjeto: {} });
    montar(client, token);
    expect(await screen.findByText(/fica parada/i)).toBeInTheDocument();
  });

  it("não deixa distribuir sem ter mexido em nada — congelaria todas as cartas", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByRole("button", { name: /Distribuir Energia/i })).toBeDisabled();
  });

  it("grava a alocação e desconta do saldo do turno", async () => {
    const token = await comCartaAtiva(client);
    const ativos = await client.getProjects(token);
    const carta = ativos.projects.find((p) => p.status === "ACTIVE")!;

    await client.setEnergia(token, { porProjeto: { [carta.id]: 2 } });
    const depois = await client.getProjects(token);
    expect(depois.energia.porProjeto[carta.id]).toBe(2);
  });

  it("o botão de distribuir aparece quando há carta ativa", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByRole("button", { name: /Distribuir Energia/i })).toBeInTheDocument();
  });

  it("recusa alocação acima dos três pontos do turno", async () => {
    const token = await comCartaAtiva(client);
    const ativos = await client.getProjects(token);
    const carta = ativos.projects.find((p) => p.status === "ACTIVE")!;
    await expect(client.setEnergia(token, { porProjeto: { [carta.id]: 9 } })).rejects.toThrow();
  });
  it("ao mexer numa carta, as outras passam a dizer que ficam paradas", async () => {
    await comDuasCartasAtivas(client);
    // Antes de mexer, o padrão vale para as duas.
    await waitFor(() => expect(screen.getAllByText(/Sem distribuição, a carta anda um turno/i)).toHaveLength(2));

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "1" } });

    // Assim que um ponto sai do lugar, a distribuição pendente passa a valer:
    // a carta que ficou em zero nao anda mais, e a tela precisa dizer isso.
    await waitFor(() => expect(screen.getByText(/fica parada/i)).toBeInTheDocument());
    expect(screen.queryByText(/Sem distribuição, a carta anda um turno/i)).not.toBeInTheDocument();
  });
});
