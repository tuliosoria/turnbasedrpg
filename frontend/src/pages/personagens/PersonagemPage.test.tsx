import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { PersonagemPage } from "./PersonagemPage";

async function setup(path: string) {
  await act(async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
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
});
