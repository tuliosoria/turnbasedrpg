import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EstudioTab } from "./EstudioTab";
import { clearAdminToken } from "../../auth/adminSession";

async function setup(isAdmin: boolean) {
  const client = new MockApiClient();
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <EstudioTab isAdmin={isAdmin} />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
  return client;
}

async function generateFreeConcept() {
  await act(async () => {
    await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "um castelo nevado");
  });
  // Two steps by design: the author reviews the exact prompt before any image
  // is paid for. There is no one-click generate.
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeEnabled());
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: "Gerar imagem" }));
  });
}

describe("EstudioTab", () => {
  afterEach(() => clearAdminToken());

  it("generates a free concept (no entity) and shows the image", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(
      () => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(),
      { timeout: 8000 },
    );
  });


  it("hides the canonize button for non-admins", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(() => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(), { timeout: 8000 });
    expect(screen.queryByRole("button", { name: /cânone/i })).not.toBeInTheDocument();
  });

  // Esconder o botão sem explicar fazia o recurso parecer inexistente.
  it("explica por que não há botão de cânone, em vez de só omiti-lo", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(() => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(), { timeout: 8000 });

    expect(screen.getByText(/Só o GM adiciona imagens ao cânone/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entre como GM" })).toHaveAttribute("href", "/admin");
  });

  it("não mostra o aviso de GM para quem já é GM", async () => {
    await setup(true);
    await generateFreeConcept();
    await waitFor(() => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(), { timeout: 8000 });

    expect(screen.queryByText(/Só o GM adiciona imagens ao cânone/i)).not.toBeInTheDocument();
  });

  it("exige um nome antes de canonizar um canônico novo", async () => {
    // Sem nome a imagem entrava no acervo sem entidade e sumia do seletor.
    await setup(true);
    await generateFreeConcept();
    const btn = await screen.findByRole("button", { name: /Adicionar ao cânone/ }, { timeout: 8000 });
    expect(btn).toBeDisabled();
  });

  it("canoniza um canônico novo depois de nomeado", async () => {
    await setup(true);
    await generateFreeConcept();
    const nome = await screen.findByRole("textbox", { name: "Nome do canônico" }, { timeout: 8000 });
    await act(async () => { await userEvent.type(nome, "Ordu-Yildiz"); });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Adicionar ao cânone/ }));
    });
    await waitFor(() => expect(screen.getByText("Adicionada ao cânone.")).toBeInTheDocument());
  });

  it("requires preparing the prompt before an image can be generated", async () => {
    await setup(false);
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "uma muralha");
    });
    // No one-click generate: the review step is mandatory, which is what makes
    // the removed post-hoc validator unnecessary.
    expect(screen.queryByRole("button", { name: "Gerar imagem" })).not.toBeInTheDocument();
  });

  it("shows the exact prompt and the canon applied before spending anything", async () => {
    await setup(false);
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "uma muralha");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
    });

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Prompt final" })).toBeInTheDocument());
    expect(screen.getByText("Cânone aplicado")).toBeInTheDocument();
    expect((screen.getByRole("textbox", { name: "Prompt final" }) as HTMLTextAreaElement).value).toContain("CENA A ILUSTRAR");
  });

  it("discards a prepared prompt when the request changes, so a stale prompt cannot be sent", async () => {
    await setup(false);
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "uma muralha");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeInTheDocument());

    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), " nevada");
    });

    expect(screen.queryByRole("button", { name: "Gerar imagem" })).not.toBeInTheDocument();
  });
});
describe("seletor de entidade", () => {
  it("mostra a opção escolhida no campo, não o rótulo", async () => {
    // O valor da opção era string vazia. Para o MUI isso é "nada selecionado":
    // o rótulo não sobe e cobre o texto da opção, então o campo lia "Entidade"
    // independentemente do que estivesse escolhido.
    await setup(false);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Entidade" })).toHaveTextContent("Adicionar Novo Canônico"),
    );
  });

  it("envia entityId nulo quando 'Adicionar Novo Canônico' está escolhido", async () => {
    // O sentinela nunca pode vazar para a API como se fosse um id de entidade.
    const client = await setup(false);
    const spy = vi.spyOn(client, "enhanceVisualPrompt");

    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "uma muralha");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Preparar prompt" }));
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ entityId: null }));
  });
});
