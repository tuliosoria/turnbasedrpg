import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("enhances a free-write card, preserves the text, and starts it", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    fireEvent.click(await screen.findByRole("button", { name: /Criar minha carta/i }));
    fireEvent.change(await screen.findByLabelText(/O que sua Casa deseja realizar/i), { target: { value: "Quero uma muralha na capital" } });
    fireEvent.click(screen.getByRole("button", { name: /Aprimorar com IA/i }));
    const desc = await screen.findByLabelText("Descrição") as HTMLTextAreaElement;
    expect(desc.value).toBe("Quero uma muralha na capital");
    fireEvent.click(screen.getByRole("button", { name: /Iniciar projeto/i }));
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

  it("warns and requires GM approval when the player edits a rule", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    fireEvent.click(await screen.findByRole("button", { name: /Criar minha carta/i }));
    fireEvent.change(await screen.findByLabelText(/O que sua Casa deseja realizar/i), { target: { value: "Rede secreta entre portos" } });
    fireEvent.click(screen.getByRole("button", { name: /Aprimorar com IA/i }));
    fireEvent.change(await screen.findByLabelText(/Duração/i), { target: { value: "5" } });
    expect(await screen.findByText(/enviada ao mestre para aprovação/i)).toBeInTheDocument();
  });
});

describe("HouseProjectsPanel — finished projects", () => {
  function finishedView() {
    const base = {
      id: "x", campaignId: "c", houseId: "h", publicDescription: "", category: "MILITARY",
      durationTurns: 3, turnsCompleted: 3, lastProcessedTurnId: 3, costs: [], requirements: [],
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
      risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
      aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null,
      templateId: null, createdBy: "PLAYER", createdAtTurn: 1, createdAt: "", updatedAt: "", completedAt: "",
    };
    return {
      slotLimit: 1, stability: 3, templates: [], recommended: [], favors: [],
      projects: [
        { ...base, id: "ok", title: "Fortaleza", description: "d", status: "COMPLETED", outcome: "SUCCESS", outcomeNarrative: "As muralhas se ergueram firmes." },
        { ...base, id: "bad", title: "Aqueduto", description: "d", status: "FAILED", outcome: "FAILURE", outcomeNarrative: "O cerco interrompeu as obras." },
      ],
    };
  }

  it("shows success and failure badges with the AI narrative", async () => {
    const stub = { getProjects: async () => finishedView() } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );
    expect(await screen.findByText("Concluído com êxito")).toBeInTheDocument();
    expect(screen.getByText("Fracassou")).toBeInTheDocument();
    expect(screen.getByText("As muralhas se ergueram firmes.")).toBeInTheDocument();
    expect(screen.getByText("O cerco interrompeu as obras.")).toBeInTheDocument();
  });
});

describe("carta que precisa de uma Casa alvo", () => {
  // Sem perguntar com quem, a carta era gravada com alvo nulo e ficava
  // esperando a resposta de ninguém — catorze modelos nasciam travados.
  it("pergunta a Casa antes de começar, e manda a escolhida", async () => {
    const cliente = new MockApiClient();
    const token = await seedToken(cliente);
    const spy = vi.spyOn(cliente, "startProjectFromTemplate");
    render(
      <ApiProvider client={cliente}>
        <HouseProjectsPanel playerToken={token} houseName="Casa Teste" onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    await userEvent.type(screen.getByRole("textbox", { name: /Buscar/i }), "Presente Cerimonial");

    const iniciar = await screen.findByRole("button", { name: /^Iniciar$/i });
    await userEvent.click(iniciar);

    // Nada foi gravado ainda: primeiro o jogador diz com quem.
    expect(spy).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Enviar proposta/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("combobox", { name: /Casa/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Casa Khazdrun" }));
    await userEvent.click(screen.getByRole("button", { name: /Enviar proposta/i }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.any(String), {
        templateId: "enviar-um-presente-cerimonial",
        targetHouseKey: "casa-khazdrun",
      }),
    );
  });
});
