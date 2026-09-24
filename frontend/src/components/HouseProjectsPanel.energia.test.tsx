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

/** Inicia o primeiro projeto da biblioteca e abre a aba de ativos. */
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

/** Inicia dois projetos e abre a aba de ativos. */
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

  it("deixa o jogador pôr Energia num projeto ativo", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Energia neste projeto: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Sem distribuição, o projeto anda um turno/i)).toBeInTheDocument();
  });

  it("sem distribuição, a tela diz que o projeto anda — é o que o turno faz", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Sem distribuição, o projeto anda um turno/i)).toBeInTheDocument();
    expect(screen.queryByText(/fica parado/i)).not.toBeInTheDocument();
  });

  it("depois de distribuir, o projeto sem Energia é o que fica parado", async () => {
    const token = await comCartaAtiva(client);
    await client.setEnergia(token, { porProjeto: {} });
    montar(client, token);
    expect(await screen.findByText(/fica parado/i)).toBeInTheDocument();
  });

  it("não deixa distribuir sem ter mexido em nada — congelaria todos os projetos", async () => {
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

  it("o botão de distribuir aparece quando há projeto ativo", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByRole("button", { name: /Distribuir Energia/i })).toBeInTheDocument();
  });

  it("recusa alocação acima dos três pontos do turno", async () => {
    const token = await comCartaAtiva(client);
    const ativos = await client.getProjects(token);
    const carta = ativos.projects.find((p) => p.status === "ACTIVE")!;
    await expect(client.setEnergia(token, { porProjeto: { [carta.id]: 9 } })).rejects.toThrow();
  });
  it("ao mexer num projeto, os outros passam a dizer que ficam parados", async () => {
    await comDuasCartasAtivas(client);
    // Antes de mexer, o padrão vale para as duas.
    await waitFor(() => expect(screen.getAllByText(/Sem distribuição, o projeto anda um turno/i)).toHaveLength(2));

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "1" } });

    // Assim que um ponto sai do lugar, a distribuição pendente passa a valer:
    // a carta que ficou em zero nao anda mais, e a tela precisa dizer isso.
    await waitFor(() => expect(screen.getByText(/fica parado/i)).toBeInTheDocument());
    expect(screen.queryByText(/Sem distribuição, o projeto anda um turno/i)).not.toBeInTheDocument();
  });
});

/**
 * Defeito 2, na tela: a alocação gravada pode ter sobrevivido a uma carta que
 * mudou (`refeita: true`, ou devolvida ao Mestre). O servidor já recorta o
 * que serve para o teto atual — o painel só precisa contar por quê, para o
 * jogador redistribuir a Energia livre em vez de achar que ela sumiu.
 *
 * A subclasse só troca `getProjects`, sem tocar em `mockClient.ts`: o mock
 * não é o que este defeito corrige, é só quem fornece os dados de teste.
 */
class ClienteComAjuste extends MockApiClient {
  ajustes: { id: string; title: string; de: number; para: number }[] = [];
  async getProjects(token: string) {
    const base = await super.getProjects(token);
    return { ...base, energia: { ...base.energia, ajustes: this.ajustes } };
  }
}

describe("Energia recortada por mudança na carta (defeito 2, na tela)", () => {
  let client: ClienteComAjuste;
  beforeEach(() => {
    client = new ClienteComAjuste();
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("avisa quando o servidor recortou uma alocação gravada, citando a carta e os números", async () => {
    const token = await comCartaAtiva(client);
    client.ajustes = [{ id: "x", title: "Guarda de Elite", de: 3, para: 0 }];
    montar(client, token);
    expect(await screen.findByText(/Guarda de Elite/)).toBeInTheDocument();
    expect(screen.getByText(/tinha 3 e agora aceita 0/)).toBeInTheDocument();
  });

  it("sem ajuste nenhum, não mostra aviso — nada mudou para explicar", async () => {
    await comCartaAtiva(client);
    expect(screen.queryByText(/mudou desde que você distribuiu/i)).not.toBeInTheDocument();
  });
});
