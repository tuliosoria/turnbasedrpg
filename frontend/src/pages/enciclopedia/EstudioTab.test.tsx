import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EstudioTab } from "./EstudioTab";
import { EntidadesTab } from "./EntidadesTab";

/**
 * O Estúdio e as Entidades saíram da Enciclopédia pública para o painel do
 * Mestre (Mundo). Continuam com os mesmos testes de comportamento — só mudaram
 * de endereço.
 */
async function montar(no: React.ReactNode) {
  await act(async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{no}</MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("ferramentas visuais do Mestre", () => {
  it("lista as entidades do canon", async () => {
    await montar(<EntidadesTab />);
    expect(await screen.findByText("Príncipe Alic Valerius")).toBeInTheDocument();
  });

  it("leva uma geração de conceito livre até o fim", async () => {
    await montar(<EstudioTab isAdmin />);
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "retrato heróico");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeEnabled());
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gerar imagem" }));
    });
    await waitFor(() => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(), { timeout: 8000 });
  });
});
