import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { PersonagensIndexPage } from "./PersonagensIndexPage";
import type { ApiClient } from "../../api/client";

async function setup(client: ApiClient = new MockApiClient()) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PersonagensIndexPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("PersonagensIndexPage", () => {
  it("lists a Major NPC under its seat with a link to the character page", async () => {
    await setup();
    const link = await screen.findByRole("link", { name: /Príncipe Sétimo/ });
    expect(link).toHaveAttribute("href", "/personagens/principe-setimo");
  });

  it("marks Major NPCs as principais", async () => {
    await setup();
    expect((await screen.findAllByText("principal")).length).toBeGreaterThan(0);
  });

  // Aprovar um personagem no cânone e não o ver no elenco era o buraco: a lista
  // vinha só do Codex estático, que nenhuma aprovação alcança.
  it("lista um personagem aprovado no cânone sob a Casa que o propôs", async () => {
    await setup();
    const link = await screen.findByRole("link", { name: /Princesa Akumon/ });
    expect(link).toHaveAttribute("href", "/personagens/e3");
    expect(screen.getByText("do cânone")).toBeInTheDocument();
  });

  it("não repete quem já está no Codex, e a carta leva ao verbete do cânone", async () => {
    const client = new MockApiClient();
    const [entity] = await client.listVisualEntities();
    client.listVisualEntities = async () => [
      { ...entity, id: "duplicado", canonicalName: "Príncipe Sétimo", wikiEntryId: "w1", entityType: "CHARACTER" },
    ];
    await setup(client);
    const links = await screen.findAllByRole("link", { name: /Príncipe Sétimo/ });
    expect(links).toHaveLength(1);
    // O esboço do Codex não pode sequestrar a carta: o retrato e o verbete
    // aprovados estão na entidade do cânone.
    expect(links[0]).toHaveAttribute("href", "/personagens/duplicado");
  });

  // Uma Casa que não corresponde a nenhuma sede do mapa não pode sumir do elenco.
  it("agrupa à parte o personagem cuja Casa não tem sede", async () => {
    const client = new MockApiClient();
    const [entity] = await client.listVisualEntities();
    client.listVisualEntities = async () => [
      { ...entity, id: "sem-sede", canonicalName: "Andarilho Sem Nome", wikiEntryId: "w1", entityType: "CHARACTER", houseId: "casa-inventada-zzzz" },
    ];
    await setup(client);
    expect(await screen.findByRole("link", { name: /Andarilho Sem Nome/ })).toBeInTheDocument();
    expect(screen.getByText("Outros nomes do cânone")).toBeInTheDocument();
  });
  it("traz a casca do Mundo, para não ser mais um beco sem saída", async () => {
    await setup();

    const casca = await screen.findByRole("navigation", { name: /O Mundo/i });
    expect(within(casca).getByRole("link", { name: "A crônica" })).toHaveAttribute("href", "/valdren");
    expect(within(casca).getByRole("link", { name: "As Casas" })).toHaveAttribute("href", "/casas");
  });
});
