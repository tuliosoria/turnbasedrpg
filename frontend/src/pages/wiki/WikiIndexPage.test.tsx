import { act } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { WikiIndexPage } from "./WikiIndexPage";

async function setup(client = new MockApiClient()) {
  const { adminToken } = await client.adminLogin("admin-test");
  await client.adminCreateWikiEntry(adminToken, {
    section: "governo",
    title: "A Coroa",
    body: "Quem senta no trono.",
    order: 0,
  });
  await client.adminCreateWikiEntry(adminToken, {
    section: "magia",
    title: "Magia em Valdren",
    body: "Rara, não fraca.",
    order: 0,
  });

  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={["/valdren"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WikiIndexPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
  return client;
}

describe("índice da crônica", () => {
  it("mostra os grupos que têm conteúdo", async () => {
    await setup();

    expect(await screen.findByText("O Reino")).toBeInTheDocument();
    expect(screen.getByText("Magia e Mistério")).toBeInTheDocument();
  });

  // Uma seção listada e vazia é uma promessa que a wiki não cumpre.
  it("omite grupos sem nenhuma seção povoada", async () => {
    await setup();

    expect(screen.queryByText("Na Mesa")).not.toBeInTheDocument();
  });

  it("leva de cada seção à sua página", async () => {
    await setup();

    expect(await screen.findByRole("link", { name: /Governo/ })).toHaveAttribute(
      "href",
      "/valdren/governo",
    );
  });

  it("conta quantos verbetes existem", async () => {
    await setup();

    expect(await screen.findByText(/2 verbetes/)).toBeInTheDocument();
  });

  // Campanha nova não tem crônica; a página precisa dizer isso em vez de
  // parecer quebrada.
  it("explica o vazio quando ainda não há verbete nenhum", async () => {
    await act(async () => {
      render(
        <ApiProvider client={new MockApiClient()}>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <WikiIndexPage />
          </MemoryRouter>
        </ApiProvider>,
      );
    });

    expect(await screen.findByText(/Ainda não há verbetes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conhecer as dezesseis Casas/ })).toHaveAttribute(
      "href",
      "/casas",
    );
  });
});
