import { act } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { LivroCapituloPage } from "./LivroCapituloPage";

async function seedBook(client: MockApiClient) {
  const { adminToken } = await client.adminLogin("admin-test");
  const c1 = await client.adminCreateBookChapter(adminToken, {
    part: "prologo", order: 0, title: "O velho começa a escrever", body: "# Prólogo\n\nEu escrevo isto velho.", status: "publicado",
  });
  const c2 = await client.adminCreateBookChapter(adminToken, {
    part: "parte-1", order: 0, title: "A forja e a leva", body: "O ferro cantava.", status: "publicado",
  });
  const draft = await client.adminCreateBookChapter(adminToken, {
    part: "parte-1", order: 1, title: "Ainda rascunho", body: "Segredo.", status: "rascunho",
  });
  return { c1, c2, draft };
}

async function setup(client: MockApiClient, chapterId: string) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[`/livro/${chapterId}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/livro" element={<div>ÍNDICE DO LIVRO</div>} />
            <Route path="/livro/:chapterId" element={<LivroCapituloPage />} />
          </Routes>
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("página de capítulo de O Livro", () => {
  it("renderiza o markdown de um capítulo publicado", async () => {
    const client = new MockApiClient();
    const { c1 } = await seedBook(client);
    await setup(client, c1.chapterId);

    expect(await screen.findByText("Eu escrevo isto velho.")).toBeInTheDocument();
  });

  it("mostra link para o próximo capítulo", async () => {
    const client = new MockApiClient();
    const { c1 } = await seedBook(client);
    await setup(client, c1.chapterId);

    const next = await screen.findByRole("link", { name: /A forja e a leva/ });
    expect(next).toBeInTheDocument();
  });

  it("redireciona ao índice quando o capítulo é rascunho", async () => {
    const client = new MockApiClient();
    const { draft } = await seedBook(client);
    await setup(client, draft.chapterId);

    expect(await screen.findByText("ÍNDICE DO LIVRO")).toBeInTheDocument();
  });

  it("redireciona ao índice quando o capítulo não existe", async () => {
    const client = new MockApiClient();
    await seedBook(client);
    await setup(client, "inexistente");

    expect(await screen.findByText("ÍNDICE DO LIVRO")).toBeInTheDocument();
  });
});
