import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { PersonagemPage } from "./PersonagemPage";
import type { ApiClient } from "../../api/client";

async function setup(path: string, client: ApiClient = new MockApiClient()) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/personagens/:id" element={<PersonagemPage />} />
          </Routes>
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("PersonagemPage", () => {
  it("renders the codex identity for a known character", async () => {
    await setup("/personagens/principe-setimo");
    expect(await screen.findByRole("heading", { level: 4, name: /Príncipe Sétimo/ })).toBeInTheDocument();
    expect(screen.getByText(/Temperamento/)).toBeInTheDocument();
    // Sem asset correspondente no mock, mostra o marcador de retrato.
    expect(screen.getByText(/Retrato em breve/)).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown id", async () => {
    await setup("/personagens/nao-existe");
    expect(await screen.findByText(/Personagem não encontrado/)).toBeInTheDocument();
  });

  // A entidade e3 do mock é um personagem publicado pelo Adicionar Canônico:
  // não está no Codex, então a ficha precisa vir do acervo.
  it("monta a ficha de um personagem aprovado no cânone", async () => {
    await setup("/personagens/e3");
    expect(await screen.findByRole("heading", { level: 4, name: /Princesa Akumon/ })).toBeInTheDocument();
    expect(screen.getByText(/herdeira de Solarion/i)).toBeInTheDocument();
    expect(screen.getByText("do cânone")).toBeInTheDocument();
    // A Casa que propôs o personagem situa a ficha na sede do mapa.
    expect(screen.getByText("Casa Solarion")).toBeInTheDocument();
  });

  it("mostra o verbete publicado e leva à Enciclopédia", async () => {
    const client = new MockApiClient();
    client.getWiki = async () => [
      { entryId: "wiki-canon-akumon", section: "casas", title: "Princesa Akumon", body: "Herdeira de Solarion.", order: 999, updatedAt: "" },
    ];
    await setup("/personagens/e3", client);
    expect(await screen.findByText("Herdeira de Solarion.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver na Enciclopédia/ })).toHaveAttribute("href", "/valdren/casas");
  });

  // Sem o verbete a ficha não pode sumir: degrada para os traços da entidade.
  it("degrada para os traços quando o verbete não é encontrado", async () => {
    await setup("/personagens/e3");
    expect(await screen.findByText(/manto solar bordado a ouro/)).toBeInTheDocument();
  });

  /**
   * A rota reusa a mesma instância entre uma ficha e outra. Enquanto a carga do
   * novo personagem não volta, o anterior não pode continuar em cena: sem
   * limpar o estado, um NPC do Codex aparecia com o chip "do cânone" e o
   * verbete de quem foi visitado antes.
   */
  it("não herda o cânone da ficha anterior ao trocar de personagem", async () => {
    const client = new MockApiClient();
    const router = createMemoryRouter(
      [{ path: "/personagens/:id", element: <PersonagemPage /> }],
      { initialEntries: ["/personagens/e3"], future: { v7_relativeSplatPath: true } },
    );
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </ApiProvider>,
      );
    });
    expect(await screen.findByText("do cânone")).toBeInTheDocument();

    // A segunda ficha fica pendurada, congelando a tela no instante em que o
    // estado anterior ainda estaria lá se não tivesse sido limpo.
    client.getVisualEntityAssets = () => new Promise(() => {});
    await act(async () => {
      await router.navigate("/personagens/principe-setimo");
    });

    expect(screen.getByRole("heading", { level: 4, name: /Príncipe Sétimo/ })).toBeInTheDocument();
    expect(screen.queryByText("do cânone")).not.toBeInTheDocument();
  });

  // A arte que o jogador envia tem proporção livre: preencher a moldura 2:3
  // cortava a cabeça de uma imagem alta (a de Mithrakar era 1080x2340).
  it("mostra o retrato inteiro em vez de recortá-lo na moldura", async () => {
    await setup("/personagens/e1");
    const img = await screen.findByRole("img", { name: /Alic Valerius/ });
    expect(img).toHaveStyle({ objectFit: "contain" });
  });
});
