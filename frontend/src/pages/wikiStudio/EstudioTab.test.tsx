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
async function montar(no: React.ReactNode, client = new MockApiClient()) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{no}</MemoryRouter>
      </ApiProvider>,
    );
  });
  return client;
}

describe("ferramentas visuais do Mestre", () => {
  it("lista as entidades do canon", async () => {
    await montar(<EntidadesTab />);
    expect(await screen.findByText("Príncipe Alic Valerius")).toBeInTheDocument();
  });

  it("leva uma geração de conceito livre até o fim", async () => {
    await montar(<EstudioTab />);
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

  it("ao trocar a entidade, esquece a imagem anterior e o contexto que falhou", async () => {
    const client = new MockApiClient();
    const preview = client.previewVisualContext.bind(client);
    client.previewVisualContext = async (input) => {
      if (input.entityId === "e2") throw new Error("contexto indisponível");
      return preview(input);
    };
    client.getVisualGeneration = async (id) =>
      ({
        id,
        status: "COMPLETED",
        outputAssetIds: ["a1"],
        entityId: "e1",
        model: "gpt-image-1",
        size: "1536x1024",
        quality: "medium",
        error: null,
      }) as Awaited<ReturnType<MockApiClient["getVisualGeneration"]>>;

    await montar(<EstudioTab />, client);

    await userEvent.click(screen.getByRole("combobox", { name: "Entidade" }));
    await userEvent.click(await screen.findByRole("option", { name: "Príncipe Alic Valerius" }));
    expect(await screen.findByText(/identidade canônica existente/)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "retrato");
    await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Gerar imagem" }));
    expect(await screen.findByRole("button", { name: "Adicionar ao cânone" })).toBeInTheDocument();
    expect(screen.getByAltText("Retrato do Príncipe Alic.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Entidade" }));
    await userEvent.click(await screen.findByRole("option", { name: "Khar-Durak" }));

    expect(await screen.findByText("contexto indisponível")).toBeInTheDocument();
    expect(screen.queryByText(/identidade canônica existente/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar ao cânone" })).toBeNull();
    expect(screen.queryByAltText("Retrato do Príncipe Alic.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Gerar imagem" })).toBeNull();
  });
});
