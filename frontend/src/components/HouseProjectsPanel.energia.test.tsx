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

function montar(client: MockApiClient, token: string, extra: { categoria?: string; excluirCategoria?: string; houseId?: string } = {}) {
  render(
    <ApiProvider client={client}>
      <HouseProjectsPanel playerToken={token} onChanged={() => {}} {...extra} />
    </ApiProvider>,
  );
}

async function comCartaAtiva(client: MockApiClient) {
  const token = await semear(client);
  montar(client, token);
  fireEvent.click(await screen.findByText("Biblioteca"));
  const iniciar = await screen.findAllByRole("button", { name: /Iniciar/i });
  fireEvent.click(iniciar[0]);
  fireEvent.click(await screen.findByText(/Em andamento \(1\)/i));
  return token;
}

async function cartaReescritaPorRefazer(client: MockApiClient) {
  const token = await semear(client);
  await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
  const antes = await client.getProjects(token);
  const carta = antes.projects.find((p) => p.status === "ACTIVE")!;
  await client.setEnergia(token, { porProjeto: { [carta.id]: 1 } }); // válido: duração 2, teto 1
  await client.refazerProjeto(token, { projectId: carta.id }); // reescreve: duração 1 — teto cai para 0
  return { token, carta };
}

describe("Energia no painel de cartas", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); vi.stubGlobal("confirm", () => true); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("mostra o cofre com a Energia do turno", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText("3 de 3 livres")).toBeInTheDocument();
  });

  // Revisão final: o Card do MUI tem overflow hidden, e um ancestral assim
  // vira a caixa de rolagem do sticky — o cofre rolava junto e sumia.
  it("nenhum ancestral do cofre corta o overflow, ou ele não gruda ao rolar", async () => {
    await comCartaAtiva(client);
    const cofre = (await screen.findByText("3 de 3 livres")).closest("[data-cofre]");
    expect(cofre).not.toBeNull();
    const cortam: string[] = [];
    for (let el = cofre!.parentElement; el && el !== document.body; el = el.parentElement) {
      const o = getComputedStyle(el);
      if ([o.overflow, o.overflowX, o.overflowY].some((v) => v === "hidden" || v === "auto" || v === "scroll")) cortam.push(el.className);
    }
    expect(cortam).toEqual([]);
  });

  it("tocar em + desconta do cofre na hora e grava sem botão", async () => {
    const gravar = vi.spyOn(client, "setEnergia");
    await comCartaAtiva(client);
    const mais = await screen.findByRole("button", { name: /^Pôr Energia em / });
    fireEvent.click(mais);
    expect(await screen.findByText("2 de 3 livres")).toBeInTheDocument();
    await waitFor(() => expect(gravar).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(screen.queryByRole("button", { name: /Distribuir Energia/i })).toBeNull();
  });

  it("sem Energia nenhuma, a carta ainda anda: a prévia mostra o passo grátis", async () => {
    await comCartaAtiva(client);
    expect(await screen.findByText(/Fim do turno: → 1 de /)).toBeInTheDocument();
  });

  // Review Focus 1, no painel: Espiões grava sem apagar a Energia das obras.
  it("grava o mapa inteiro mesmo numa aba recortada", async () => {
    const token = await semear(client);
    // Duas cartas de 3 turnos: uma obra (Projetos) e uma rede de informantes (Espiões).
    const obra = await client.startProjectFromTemplate(token, { templateId: "recrutar-companhias-errantes" });
    await client.setEnergia(token, { porProjeto: { [obra.id]: 1 } });
    await client.startProjectFromTemplate(token, { templateId: "estabelecer-uma-rede-de-informantes" });
    const gravar = vi.spyOn(client, "setEnergia");
    montar(client, token, { categoria: "INTELLIGENCE" });
    fireEvent.click(await screen.findByRole("button", { name: /^Pôr Energia em / }));
    await waitFor(() => expect(gravar).toHaveBeenCalled(), { timeout: 2000 });
    expect(gravar.mock.calls[0][1].porProjeto[obra.id]).toBe(1);
  });

  it("avisa quando uma carta refeita torna a alocação gravada obsoleta, citando a carta e os números", async () => {
    const { token, carta } = await cartaReescritaPorRefazer(client);
    montar(client, token);
    // O título também aparece na carta; o aviso é achado pelo texto que só ele tem.
    const aviso = (await screen.findByText(/tinha 1 e agora aceita 0/)).closest('[role="alert"]');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain(carta.title);
  });
});
