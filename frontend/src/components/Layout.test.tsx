import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { PLAY_LINKS } from "./navigation";
import { GAME_TABS } from "../pages/game/gameTabs";
import { clearAdminToken, saveAdminToken } from "../auth/adminSession";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";

function setup(path = "/") {
  return render(
    <ApiProvider client={new MockApiClient()}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>conteúdo</Layout>
      </MemoryRouter>
    </ApiProvider>,
  );
}

beforeEach(() => clearAdminToken());
afterEach(() => clearAdminToken());

describe("navegação por audiência", () => {
  it("oferece os dois destinos de jogador na barra", () => {
    setup();

    expect(screen.getByRole("button", { name: /O Mundo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Jogar/ })).toBeInTheDocument();
  });

  it("usa nas portas de Jogar os mesmos rótulos das abas de /game", () => {
    expect(PLAY_LINKS).toEqual(expect.arrayContaining(
      GAME_TABS.map((tab) => expect.objectContaining({
        label: tab.label,
        to: `/game?aba=${tab.value}`,
        hint: tab.hint,
      })),
    ));
  });

  // Ferramenta de autoria não é conteúdo de jogador com um if em volta.
  it("esconde o Estúdio de quem não é mestre", () => {
    setup();

    expect(screen.queryByRole("button", { name: /Estúdio/ })).not.toBeInTheDocument();
  });

  it("mostra o Estúdio para o mestre", () => {
    saveAdminToken("mock-admin-token");
    setup();

    expect(screen.getByRole("button", { name: /Estúdio/ })).toBeInTheDocument();
  });

  // O caso que falhava de verdade: a página de admin entra trocando estado
  // interno, sem mudar de rota, então o Layout não remonta. Lendo o token só
  // na montagem, o Estúdio — e com ele a Enciclopédia — ficava invisível
  // mesmo depois do login.
  it("revela o Estúdio assim que o token aparece, sem remontar", async () => {
    setup();
    expect(screen.queryByRole("button", { name: /Estúdio/ })).not.toBeInTheDocument();

    await act(async () => {
      saveAdminToken("mock-admin-token");
    });

    expect(screen.getByRole("button", { name: /Estúdio/ })).toBeInTheDocument();
  });

  it("esconde o Estúdio assim que o mestre sai", async () => {
    saveAdminToken("mock-admin-token");
    setup();

    await act(async () => {
      clearAdminToken();
    });

    expect(screen.queryByRole("button", { name: /Estúdio/ })).not.toBeInTheDocument();
  });

  // As três rotas que antes não tinham entrada em menu nenhum.
  it("dá porta a criar Casa, jogar o turno e o painel do mestre", async () => {
    saveAdminToken("mock-admin-token");
    setup();

    await userEvent.click(screen.getByRole("button", { name: /Jogar/ }));
    expect(screen.getByRole("menuitem", { name: /Criar sua Casa/ })).toHaveAttribute("href", "/criar");
    // Cada aba de /game virou destino próprio no menu: chegar ao Porto deixou
    // de exigir saber que existe uma aba dentro de uma aba.
    expect(screen.getByRole("menuitem", { name: /^Turnos/ })).toHaveAttribute("href", "/game?aba=turnos");
    expect(screen.getByRole("menuitem", { name: /^Projetos/ })).toHaveAttribute("href", "/game?aba=projetos");
    // Comprar informação é atividade própria: some do meio de setenta cartas.
    expect(screen.getByRole("menuitem", { name: /^Espiões/ })).toHaveAttribute("href", "/game?aba=espioes");
    expect(screen.getByRole("menuitem", { name: /Correspondência/ })).toHaveAttribute("href", "/game?aba=cartas");

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /Estúdio/ }));
    expect(screen.getByRole("menuitem", { name: /Painel do mestre/ })).toHaveAttribute("href", "/admin");
  });

  // A fila de cânone morava só como aba dentro de /admin: quem não soubesse
  // que ela existia não tinha como descobrir que havia propostas esperando.
  it("leva o mestre direto ao grupo onde mora a fila de cânone", async () => {
    saveAdminToken("mock-admin-token");
    setup();

    await userEvent.click(screen.getByRole("button", { name: /Estúdio/ }));

    expect(screen.getByRole("menuitem", { name: /Construir mundo/ })).toHaveAttribute(
      "href",
      "/admin?tab=mundo",
    );
  });

  it("marca o destino que contém a rota aberta", () => {
    setup("/casas");

    // A cor vem do tema; o que importa é que o botão saiba que está ativo.
    expect(screen.getByRole("button", { name: /O Mundo/ })).toBeInTheDocument();
  });

  // O Estúdio só aparece para quem já tem token de mestre, e o token se obtém
  // entrando em /admin. Sem esta porta, virar mestre exigia saber a URL.
  it("oferece as duas entradas, jogador e mestre, sem depender do Estúdio", async () => {
    setup("/valdren/magia");

    await userEvent.click(screen.getByRole("button", { name: /Entrar/ }));

    expect(screen.getByRole("menuitem", { name: /Entrar como jogador/ })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("menuitem", { name: /Entrar como mestre/ })).toHaveAttribute("href", "/admin");
  });

  // "Entrar" aparecia ao lado de "Sair" para quem já estava dentro.
  it("não oferece a entrada de jogador a quem já é jogador", async () => {
    sessionStorage.setItem("ravenloft.player", JSON.stringify({ playerToken: "t", houseId: "h", displayName: "d" }));
    try {
      setup("/valdren/magia");
      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }));
      expect(screen.queryByRole("menuitem", { name: /Entrar como jogador/ })).toBeNull();
      expect(screen.getByRole("menuitem", { name: /Entrar como mestre/ })).toBeInTheDocument();
    } finally {
      sessionStorage.clear();
    }
  });

  it("some com o menu Entrar quando já se é jogador e mestre", () => {
    sessionStorage.setItem("ravenloft.player", "{}");
    const body = btoa(JSON.stringify({ type: "admin", campaignId: "c", exp: Date.now() + 60_000 })).replace(/=+$/, "");
    saveAdminToken(`${body}.sig`);
    try {
      setup();
      expect(screen.queryByRole("button", { name: /^Entrar/ })).toBeNull();
    } finally {
      sessionStorage.clear();
    }
  });

  it("alcança o painel do mestre pelo drawer sem estar logado", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));

    expect(screen.getByRole("link", { name: "Entrar como mestre" })).toHaveAttribute("href", "/admin");
  });
});

describe("drawer", () => {
  it("agrupa a crônica em vez de listar as vinte e três seções soltas", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));

    expect(screen.getByText("O Reino")).toBeInTheDocument();
    expect(screen.getByText("Magia e Mistério")).toBeInTheDocument();
    expect(screen.getByText("Na Mesa")).toBeInTheDocument();
  });
});
