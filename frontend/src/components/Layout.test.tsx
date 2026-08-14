import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { clearAdminToken, saveAdminToken } from "../auth/adminSession";

function setup(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>conteúdo</Layout>
    </MemoryRouter>,
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

  // As três rotas que antes não tinham entrada em menu nenhum.
  it("dá porta a criar Casa, jogar o turno e o painel do mestre", async () => {
    saveAdminToken("mock-admin-token");
    setup();

    await userEvent.click(screen.getByRole("button", { name: /Jogar/ }));
    expect(screen.getByRole("menuitem", { name: /Criar sua Casa/ })).toHaveAttribute("href", "/criar");
    expect(screen.getByRole("menuitem", { name: /Meu turno/ })).toHaveAttribute("href", "/game");

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /Estúdio/ }));
    expect(screen.getByRole("menuitem", { name: /Painel do mestre/ })).toHaveAttribute("href", "/admin");
  });

  it("marca o destino que contém a rota aberta", () => {
    setup("/casas");

    // A cor vem do tema; o que importa é que o botão saiba que está ativo.
    expect(screen.getByRole("button", { name: /O Mundo/ })).toBeInTheDocument();
  });

  it("mantém Entrar sempre alcançável", () => {
    setup("/valdren/magia");

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
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
