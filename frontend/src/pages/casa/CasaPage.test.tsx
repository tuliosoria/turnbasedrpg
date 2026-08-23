import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import type { ApiClient } from "../../api/client";
import { CasaPage } from "./CasaPage";

const ASTERIA = [
  "Alguns passageiros conseguiram sobreviver, mas dezenas morreram era o fim do navio Asteria.",
  "Entre os mortos confirmados estão Lorde Thrain Khazdrun, senhor de Khar-Durak;",
  "Aylin Karasoy, líder da Casa Karasoy.",
].join("\n");

function clientWith(chronicle: string): ApiClient {
  const mock = new MockApiClient();
  return Object.assign(Object.create(Object.getPrototypeOf(mock)), mock, {
    getChronicle: async () => chronicle,
    getVisualGallery: async () => [
      { id: "emb", entityId: "emblem-casa-khazdrun", storageUrl: "https://img/emb.png", thumbnailUrl: null },
    ],
    listVisualEntities: async () => [{ id: "emblem-casa-khazdrun", canonicalName: "Brasão — Casa Khazdrun" }],
    getWiki: async () => [],
  }) as ApiClient;
}

async function setup(chave: string, chronicle = ASTERIA) {
  await act(async () => {
    render(
      <ApiProvider client={clientWith(chronicle)}>
        <MemoryRouter initialEntries={[`/casa/${chave}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/casa/:chave" element={<CasaPage />} />
            <Route path="/casas" element={<p>lista de Casas</p>} />
          </Routes>
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("CasaPage", () => {
  it("mostra o brasão, a sede e a população canônica", async () => {
    await setup("casa-khazdrun");

    expect(screen.getByRole("heading", { name: "Casa Khazdrun" })).toBeInTheDocument();
    expect(screen.getByText("Sede em Khar-Durak")).toBeInTheDocument();
    expect(screen.getByText("150.000 habitantes")).toBeInTheDocument();
    expect(screen.getByAltText("Brasão da Casa Khazdrun")).toHaveAttribute("src", "https://img/emb.png");
  });

  it("lista as figuras da Casa", async () => {
    await setup("casa-khazdrun");
    expect(screen.getByText("Figuras importantes")).toBeInTheDocument();
  });

  /**
   * O dossiê da Casa é público e não exige sessão. Antecipar o que cada figura
   * persegue — e pior, o que ela esconde — entregava a mesa de graça.
   */
  it("não entrega o que as figuras querem nem o que escondem", async () => {
    await setup("casa-khazdrun");
    expect(screen.getByText("Figuras importantes")).toBeInTheDocument();
    expect(screen.queryByText("Esconde")).not.toBeInTheDocument();
    expect(screen.queryByText("Quer")).not.toBeInTheDocument();
    expect(screen.queryByText("Busca")).not.toBeInTheDocument();
  });

  it("leva da figura à ficha onde está a história dela", async () => {
    await setup("casa-khazdrun");
    const [link] = screen.getAllByRole("link", { name: "Ver a história" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/personagens/"));
  });

  /**
   * O erro que esta página existe para não cometer: apresentar como vivo
   * alguém que a campanha já matou.
   */
  it("marca como morto quem a crônica declara morto", async () => {
    await setup("casa-khazdrun");
    expect(screen.getAllByText("morto").length).toBeGreaterThan(0);
  });

  it("não marca ninguém quando a crônica está vazia", async () => {
    await setup("casa-khazdrun", "");
    expect(screen.queryByText("morto")).not.toBeInTheDocument();
  });

  it("redireciona chave desconhecida para a lista", async () => {
    await setup("casa-inexistente");
    expect(screen.getByText("lista de Casas")).toBeInTheDocument();
  });
  it("liga a Casa à crônica, que é onde o mundo é descrito", async () => {
    await setup("casa-khazdrun");

    const link = await screen.findByRole("link", { name: /As Casas na crônica/i });
    expect(link).toHaveAttribute("href", "/valdren/casas");
  });
});
