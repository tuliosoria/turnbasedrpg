import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EstudioTab } from "./EstudioTab";
import { clearAdminToken } from "../../auth/adminSession";

async function setup(isAdmin: boolean) {
  const client = new MockApiClient();
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <EstudioTab isAdmin={isAdmin} />
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

  it("lets an admin add the image to the canon", async () => {
    await setup(true);
    await generateFreeConcept();
    const btn = await screen.findByRole("button", { name: /Adicionar ao cânone/ }, { timeout: 8000 });
    await act(async () => { await userEvent.click(btn); });
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