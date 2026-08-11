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
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
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

  it("shows the consistency verdict on completion", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(
      () => expect(screen.getByText(/Passou na verificação de consistência/)).toBeInTheDocument(),
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
});
