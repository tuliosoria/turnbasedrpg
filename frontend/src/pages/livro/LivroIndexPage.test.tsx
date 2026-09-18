import { act } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { LivroIndexPage } from "./LivroIndexPage";

async function seedBook(client: MockApiClient) {
  const { adminToken } = await client.adminLogin("admin-test");
  await client.adminCreateBookChapter(adminToken, {
    part: "prologo", order: 0, title: "O velho começa a escrever", body: "Corpo.", status: "publicado",
  });
  await client.adminCreateBookChapter(adminToken, {
    part: "parte-1", order: 0, title: "A forja e a leva", body: "Corpo.", status: "publicado",
  });
  await client.adminCreateBookChapter(adminToken, {
    part: "parte-1", order: 1, title: "Capítulo em rascunho", body: "Corpo.", status: "rascunho",
  });
  return adminToken;
}

async function setup(client = new MockApiClient()) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={["/livro"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LivroIndexPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
  return client;
}

describe("índice de O Livro", () => {
  it("lista capítulos publicados agrupados por parte", async () => {
    const client = new MockApiClient();
    await seedBook(client);
    await setup(client);

    expect(await screen.findByText("O velho começa a escrever")).toBeInTheDocument();
    expect(screen.getByText("A forja e a leva")).toBeInTheDocument();
    expect(screen.getByText("Prólogo")).toBeInTheDocument();
    expect(screen.getByText("Parte I — O Norte Morto")).toBeInTheDocument();
  });

  it("esconde capítulos em rascunho", async () => {
    const client = new MockApiClient();
    await seedBook(client);
    await setup(client);

    await screen.findByText("A forja e a leva");
    expect(screen.queryByText("Capítulo em rascunho")).not.toBeInTheDocument();
  });

  it("liga cada capítulo à sua página", async () => {
    const client = new MockApiClient();
    await seedBook(client);
    await setup(client);

    const link = await screen.findByRole("link", { name: /A forja e a leva/ });
    expect(link.getAttribute("href")).toMatch(/^\/livro\//);
  });

  it("explica o vazio quando nada foi publicado", async () => {
    await setup(new MockApiClient());
    expect(await screen.findByText(/ainda não/i)).toBeInTheDocument();
  });
});
