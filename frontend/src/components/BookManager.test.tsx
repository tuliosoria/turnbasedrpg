import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { BookManager } from "./BookManager";

async function setup() {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("qualquer");
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <BookManager token={adminToken} />
      </ApiProvider>,
    );
  });
  return { client, token: adminToken };
}

describe("BookManager", () => {
  it("começa vazio e semeia o livro a partir do manuscrito", async () => {
    await setup();
    const seed = await screen.findByRole("button", { name: /Carregar o livro/i });
    await act(async () => {
      await userEvent.click(seed);
    });
    // Depois de semear, aparece ao menos o prólogo e capítulos das partes.
    await waitFor(() => expect(screen.getAllByText(/Prólogo/i).length).toBeGreaterThan(0));
    expect(screen.getByText("Parte I — O Norte Morto")).toBeInTheDocument();
  });

  it("cria um novo capítulo pelo formulário", async () => {
    const { client, token } = await setup();
    await userEvent.type(screen.getByLabelText("Título"), "Um capítulo de teste");
    await userEvent.type(screen.getByLabelText("Conteúdo"), "Corpo do capítulo.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Adicionar capítulo/i }));
    });
    await waitFor(async () => {
      const chapters = await client.adminListBook(token);
      expect(chapters.some((c) => c.title === "Um capítulo de teste")).toBe(true);
    });
  });

  it("reordena capítulos dentro de uma parte", async () => {
    const { client, token } = await setup();
    await client.adminCreateBookChapter(token, { part: "parte-1", order: 0, title: "Alfa", body: "a", status: "publicado" });
    await client.adminCreateBookChapter(token, { part: "parte-1", order: 1, title: "Beta", body: "b", status: "publicado" });
    // Re-render pega a lista já semeada externamente: recarrega.
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <BookManager token={token} />
        </ApiProvider>,
      );
    });
    const beta = await screen.findAllByText("Beta");
    const card = beta[0].closest("[data-chapter]") as HTMLElement;
    const up = within(card).getByRole("button", { name: /Subir/i });
    await act(async () => {
      await userEvent.click(up);
    });
    await waitFor(async () => {
      const chapters = (await client.adminListBook(token)).filter((c) => c.part === "parte-1");
      const alfa = chapters.find((c) => c.title === "Alfa")!;
      const betaC = chapters.find((c) => c.title === "Beta")!;
      expect(betaC.order).toBeLessThan(alfa.order);
    });
  });
});
