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

  it("depois de distribuir, o projeto sem Energia extra ainda anda pelo passo livre — não fica parado", async () => {
    // O motor (processTurn.ts) dá o passo livre a toda carta ATIVA, com
    // Energia ou sem. "fica parado" era a mentira que empurrava o jogador a
    // gastar Energia por medo, na carta errada.
    const token = await comCartaAtiva(client);
    await client.setEnergia(token, { porProjeto: {} });
    montar(client, token);
    expect(await screen.findByText(/passo livre/i)).toBeInTheDocument();
    expect(screen.queryByText(/fica parado/i)).not.toBeInTheDocument();
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
  it("ao mexer num projeto, os outros passam a dizer que andam só pelo passo livre — não que ficam parados", async () => {
    await comDuasCartasAtivas(client);
    // Antes de mexer, o padrão vale para as duas.
    await waitFor(() => expect(screen.getAllByText(/Sem distribuição, o projeto anda um turno/i)).toHaveLength(2));

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "1" } });

    // Assim que um ponto sai do lugar, a distribuição pendente passa a valer:
    // a carta que ficou em zero deixa de andar pelo padrão implícito, mas o
    // passo livre do turno continua sendo dela — a tela não pode dizer que ela
    // "fica parada".
    await waitFor(() => expect(screen.getByText(/passo livre/i)).toBeInTheDocument());
    expect(screen.queryByText(/fica parado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem distribuição, o projeto anda um turno/i)).not.toBeInTheDocument();
  });
});

/**
 * Defeito 2, na tela: a alocação gravada pode ter sobrevivido a uma carta que
 * mudou (`refeita: true`, ou devolvida ao Mestre). O servidor (e o mock, que
 * espelha o mesmo recorte) já corta o que serve para o teto atual — o painel
 * só precisa contar por quê, para o jogador redistribuir a Energia livre em
 * vez de achar que ela sumiu.
 *
 * Cenário real, sem subclasse nem dado fabricado: inicia uma carta de dois
 * turnos (teto 1 em 0/2), distribui o único ponto que ela aceita, e então
 * `refazerProjeto` reescreve a carta com prazo de um turno — o mesmo caminho
 * de reparação de bug que a campanha usa. O `MockApiClient` de verdade é quem
 * computa o ajuste, porque agora ele clampa como o backend.
 */
async function cartaReescritaPorRefazer(client: MockApiClient) {
  const token = await semear(client);
  await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
  const antes = await client.getProjects(token);
  const carta = antes.projects.find((p) => p.status === "ACTIVE")!;
  await client.setEnergia(token, { porProjeto: { [carta.id]: 1 } }); // válido: duração 2, teto 1
  await client.refazerProjeto(token, { projectId: carta.id }); // reescreve: duração 1 — teto cai para 0
  return { token, carta };
}

describe("Energia recortada por mudança na carta (defeito 2, na tela)", () => {
  let client: MockApiClient;
  beforeEach(() => {
    client = new MockApiClient();
    vi.stubGlobal("confirm", () => true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("avisa quando uma carta refeita torna a alocação gravada obsoleta, citando a carta e os números", async () => {
    const { token, carta } = await cartaReescritaPorRefazer(client);
    montar(client, token);
    // O título da carta também aparece no card dela, então o aviso é
    // localizado pelo texto que só ele tem, e o título é conferido dentro dele
    // — em vez de `findByText(título)`, que bate em mais de um lugar na tela.
    const aviso = (await screen.findByText(/tinha 1 e agora aceita 0/)).closest('[role="alert"]');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain(carta.title);
  });

  it("sem ajuste nenhum, não mostra aviso — nada mudou para explicar", async () => {
    await comCartaAtiva(client);
    expect(screen.queryByText(/mudou desde que você distribuiu/i)).not.toBeInTheDocument();
  });
});
