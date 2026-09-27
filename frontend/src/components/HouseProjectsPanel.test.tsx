import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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
    // O jsdom não implementa confirm, e Iniciar passa por ele. Sem isto a carta
    // nunca começava — e o teste antigo passava assim mesmo, casando o rótulo
    // "(0)" da aba.
    vi.stubGlobal("confirm", () => true);
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
    await waitFor(() => expect(screen.getByText(/Em andamento \(1\)/i)).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  // Teste pesado: renderiza, digita e submete. Passa sempre isolado; os 5s
  // padrão é que não sobrevivem à suíte inteira em paralelo — e quando ele
  // estoura, o DOM fica sujo e derruba o teste seguinte por tabela.
  it("enhances a free-write card, preserves the text, and starts it", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    fireEvent.click(await screen.findByRole("button", { name: /Propor um projeto próprio/i }));
    fireEvent.change(await screen.findByLabelText(/O que sua Casa deseja realizar/i), { target: { value: "Quero uma muralha na capital" } });
    fireEvent.click(screen.getByRole("button", { name: /Aprimorar com IA/i }));
    const desc = await screen.findByLabelText("Descrição") as HTMLTextAreaElement;
    expect(desc.value).toBe("Quero uma muralha na capital");
    fireEvent.click(screen.getByRole("button", { name: /Iniciar projeto/i }));
    await waitFor(() => expect(screen.getByText(/Em andamento \(1\)/i)).toBeInTheDocument());
  }, 20000);

  it("shows recommended cards for the House", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Projetos recomendados para sua Casa/i)).toBeInTheDocument());
  });

  it("não mostra a aba Favores: eles moram em Pactos", async () => {
    const stub = {
      getProjects: async () => ({
        slotLimit: 1, stability: 3, templates: [], recommended: [], projects: [],
        favors: [{
          id: "f1", campaignId: "c", fromHouseId: "h1", toHouseId: "h2",
          amount: 1, status: "PENDING", reason: "dívida de inverno", createdAt: "", updatedAt: "",
        }],
      }),
    } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: /Favores/ })).not.toBeInTheDocument();
    expect(screen.queryByText("dívida de inverno")).not.toBeInTheDocument();
  });

  it("omite o chip da categoria que a aba já excluiu", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} excluirCategoria="INTELLIGENCE" onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    expect(screen.getByRole("button", { name: "Militar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Espionagem" })).not.toBeInTheDocument();
  });

  // A mesa de aprovação saiu: editar a regra não manda a carta ao mestre.
  it("não avisa que a carta editada será enviada ao mestre", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    fireEvent.click(await screen.findByRole("button", { name: /Propor um projeto próprio/i }));
    fireEvent.change(await screen.findByLabelText(/O que sua Casa deseja realizar/i), { target: { value: "Rede secreta entre portos" } });
    fireEvent.click(screen.getByRole("button", { name: /Aprimorar com IA/i }));
    fireEvent.change(await screen.findByLabelText(/Duração/i), { target: { value: "5" } });
    expect(await screen.findByLabelText(/Duração/i)).toHaveValue(5);
    expect(screen.queryByText(/enviado ao mestre para aprovação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aprovação do mestre/i)).not.toBeInTheDocument();
  });

  const efeitosVazios = { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] };

  // Espiões conta só o recorte, mas a vaga é da Casa. Obra ocupando o teto
  // deixava Iniciar ligado e o servidor devolvia 409.
  it("trava o Iniciar de Espiões quando a vaga da Casa está em obra", async () => {
    const stub = {
      getProjects: async () => ({
        slotLimit: 1, stability: 3, recommended: [], favors: [],
        attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
        projects: [{
          id: "obra", campaignId: "c", houseId: "h", title: "Aqueduto", description: "d",
          publicDescription: "", category: "INFRASTRUCTURE", status: "ACTIVE",
          durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null, costs: [],
          requirements: [], completionEffects: efeitosVazios, risks: [], complications: [],
          targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
          aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null,
          gmNotes: null, templateId: null, createdBy: "PLAYER", createdAtTurn: 1,
          createdAt: "", updatedAt: "", completedAt: null,
        }],
        templates: [{
          id: "rumor", title: "Comprar um rumor", category: "INTELLIGENCE", durationTurns: 1,
          costs: [], requirements: [], description: "Um rumor no porto.",
          completionEffects: efeitosVazios, risks: [],
          requiresTargetApproval: false, requiresGmApproval: false,
        }],
      }),
    } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" categoria="INTELLIGENCE" onChanged={() => {}} />
      </ApiProvider>,
    );
    fireEvent.click(await screen.findByText("Catálogo de operações"));
    expect(await screen.findByText(/Limite de projetos ativos atingido/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Iniciar$/i })).toBeDisabled();
  });

  it("lista só a carta que espera a decisão do jogador", async () => {
    const base = {
      campaignId: "c", houseId: "h", description: "d", publicDescription: "",
      category: "MILITARY", durationTurns: 2, turnsCompleted: 0, lastProcessedTurnId: null,
      costs: [], requirements: [], completionEffects: efeitosVazios, risks: [], complications: [],
      targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
      aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null,
      gmNotes: null, templateId: null, createdBy: "GM", createdAtTurn: 1,
      createdAt: "", updatedAt: "", completedAt: null,
    };
    const stub = {
      getProjects: async () => ({
        slotLimit: 3, stability: 3, templates: [], recommended: [], favors: [],
        projects: [
          { ...base, id: "minha", title: "Decisão minha", status: "PENDING_PLAYER" },
          { ...base, id: "gm", title: "Na mesa do mestre", status: "PENDING_GM" },
          { ...base, id: "alvo", title: "Resposta da outra casa", status: "PENDING_TARGET" },
        ],
      }),
    } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );
    expect(await screen.findByText("Esperando sua decisão")).toBeInTheDocument();
    expect(screen.getByText("Decisão minha")).toBeInTheDocument();
    expect(screen.queryByText("Na mesa do mestre")).not.toBeInTheDocument();
    expect(screen.queryByText("Resposta da outra casa")).not.toBeInTheDocument();
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
    // A fracassada sobe para "Pode tentar de novo"; a concluída fica recolhida.
    expect(await screen.findByText("Pode tentar de novo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Concluídas \(1\)/ }));
    expect(screen.getByText("Concluído com êxito")).toBeInTheDocument();
    expect(screen.getByText("As muralhas se ergueram firmes.")).toBeInTheDocument();
    expect(screen.getByText("O cerco interrompeu as obras.")).toBeInTheDocument();
  });

  /**
   * A carta que fracassou precisa de um botão.
   *
   * O motor já garantia sucesso para carta `refeita` e a tela já sabia
   * explicá-la — mas nada nunca marcava uma carta como refeita, porque não
   * havia por onde pedir. O jogador via "Fracassou" e acabava ali.
   */
  it("deixa o jogador refazer a carta que fracassou", async () => {
    const refazer = vi.fn(async () => ({}) as any);
    const stub = { getProjects: async () => finishedView(), refazerProjeto: refazer } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );
    const botao = await screen.findByRole("button", { name: /Tentar de novo/i });
    fireEvent.click(botao);
    await waitFor(() => expect(refazer).toHaveBeenCalledWith("t", { projectId: "bad" }));
  });

  // A carta que deu certo não ganha segunda tentativa: seria repetir prêmio.
  it("não oferece nova tentativa à carta que deu certo", async () => {
    const stub = { getProjects: async () => finishedView(), refazerProjeto: vi.fn() } as any;
    render(
      <ApiProvider client={stub}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );
    await screen.findByText("Pode tentar de novo");
    fireEvent.click(screen.getByRole("button", { name: /Concluídas \(1\)/ }));
    expect(screen.getAllByRole("button", { name: /Tentar de novo/i })).toHaveLength(1);
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
    // A carta começa na hora — o botão é Iniciar, sem "aguardar a resposta".
    expect(spy).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^Iniciar$/i })).toBeDisabled();
    expect(within(dialog).queryByText(/aguardando a resposta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar proposta/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: /Casa/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Casa Khazdrun" }));
    await userEvent.click(within(dialog).getByRole("button", { name: /^Iniciar$/i }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.any(String), {
        templateId: "enviar-um-presente-cerimonial",
        targetHouseKey: "casa-khazdrun",
      }),
    );
  });
  /**
   * Sabotagem precisa de alvo mas não de licença. Se a tela reusasse o texto da
   * carta diplomática, o jogador leria "a carta fica aguardando a resposta
   * dela" — e acharia que a vítima seria consultada sobre ser enganada.
   */
  it("pede o alvo da sabotagem sem prometer resposta da vítima", async () => {
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
    await userEvent.type(screen.getByRole("textbox", { name: /Buscar/i }), "Plantar um Rumor Falso");

    await userEvent.click(await screen.findByRole("button", { name: /^Iniciar$/i }));

    expect(await screen.findByText(/Ela não será consultada nem avisada/i)).toBeInTheDocument();
    expect(screen.queryByText(/aguardando a resposta dela/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: /Casa/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Casa Khazdrun" }));
    await userEvent.click(screen.getByRole("button", { name: /^Começar$/i }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.any(String), {
        templateId: "plantar-um-rumor-falso",
        targetHouseKey: "casa-khazdrun",
      }),
    );
  });
});
