import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { LandingPage } from "./LandingPage";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  await act(async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LandingPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("LandingPage", () => {
  // As rotas de entrar na campanha só existiam aqui e no menu nenhum; o hero
  // é agora a porta principal, então os destinos precisam estar certos.
  it("leva a criar Casa e a explorar Valdren pelo hero", async () => {
    await setup();

    const criar = screen.getAllByRole("link", { name: "Criar sua Casa" });
    expect(criar.length).toBeGreaterThan(0);
    expect(criar[0]).toHaveAttribute("href", "/criar");
    expect(screen.getByRole("link", { name: "Explorar Valdren" })).toHaveAttribute("href", "/valdren");
  });

  it("dá uma porta para o guia de campanha", async () => {
    await setup();

    expect(screen.getByRole("link", { name: /Jogar em D&D 5.5/i })).toHaveAttribute(
      "href",
      "/valdren/campanha-dnd",
    );
  });

  it("mostra o hero em vídeo com o título da campanha", async () => {
    await setup();

    expect(screen.getByTestId("hero-video")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("explica como se joga em quatro passos", async () => {
    await setup();

    expect(screen.getByText("Funde a sua Casa")).toBeInTheDocument();
    expect(screen.getByText("Aja a cada turno")).toBeInTheDocument();
    expect(screen.getByText("O mundo responde")).toBeInTheDocument();
    expect(screen.getByText("Acompanhe a crônica")).toBeInTheDocument();
  });
});
