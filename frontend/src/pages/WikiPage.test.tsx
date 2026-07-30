import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { WikiPage } from "./WikiPage";

async function setup(client: MockApiClient, path = "/valdren/casas") {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/valdren/:section" element={<WikiPage />} />
          </Routes>
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("WikiPage", () => {
  it("shows an empty state when the section has no entries", async () => {
    await setup(new MockApiClient());
    expect(await screen.findByText(/Nada foi registrado nesta seção ainda/i)).toBeInTheDocument();
  });

  it("renders entries for the current section only", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, { section: "casas", title: "Casa Vargen", body: "Os lobos do norte.", order: 0 });
    await client.adminCreateWikiEntry(adminToken, { section: "brumas", title: "Fronteira", body: "Névoa perpétua.", order: 0 });

    await setup(client, "/valdren/casas");

    expect(await screen.findByText("Casa Vargen")).toBeInTheDocument();
    expect(screen.getByText("Os lobos do norte.")).toBeInTheDocument();
    expect(screen.queryByText("Névoa perpétua.")).not.toBeInTheDocument();
  });

  it("renders the Censo section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "censo",
      title: "Censo Canônico de Valdren",
      body: "Valdren possui aproximadamente **2.000.000 de habitantes**.",
      order: 0,
    });

    await setup(client, "/valdren/censo");

    expect(await screen.findByRole("heading", { name: "Censo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Censo Canônico de Valdren" })).toBeInTheDocument();
    expect(screen.getByText("2.000.000 de habitantes").tagName.toLowerCase()).toBe("strong");
  });

  it("renders the Guerras section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "guerras",
      title: "As Guerras de Valdren",
      body: "A Guerra das Cinco Bandeiras deixou tratados antigos.",
      order: 0,
    });

    await setup(client, "/valdren/guerras");

    expect(await screen.findByRole("heading", { name: "Guerras" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "As Guerras de Valdren" })).toBeInTheDocument();
    expect(screen.getByText(/Cinco Bandeiras/)).toBeInTheDocument();
  });

  it("renders the Os Magos section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "os-magos",
      title: "Os Vinte e Sete Magos da Ordem dos Três",
      body: "A Ordem mantém **vinte e sete magos** plenamente iniciados.",
      order: 0,
    });

    await setup(client, "/valdren/os-magos");

    expect(await screen.findByRole("heading", { name: "Os Magos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Os Vinte e Sete Magos da Ordem dos Três" })).toBeInTheDocument();
    expect(screen.getByText("vinte e sete magos").tagName.toLowerCase()).toBe("strong");
  });

  it("renders the Expedição section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "expedicao",
      title: "A Expedição Além das Brumas",
      body: "A **Trigésima Terceira Expedição** partirá no Dia Entre os Anos.",
      order: 0,
    });

    await setup(client, "/valdren/expedicao");

    expect(await screen.findByRole("heading", { name: "Expedição" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A Expedição Além das Brumas" })).toBeInTheDocument();
    expect(screen.getByText("Trigésima Terceira Expedição").tagName.toLowerCase()).toBe("strong");
  });

  it("renders an entry image above the body text", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "geografia",
      title: "Atlas de Valdren",
      body: "Mapa público do reino.",
      order: 0,
      imageUrl: "/valdren-map.png",
    } as never);

    await setup(client, "/valdren/geografia");

    const image = await screen.findByAltText("Imagem de Atlas de Valdren");
    const body = screen.getByText("Mapa público do reino.");
    expect(image.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders multiple entry images for illustrated Houses", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "casas",
      title: "Casa Euralune — Os Senhores do Céu",
      body: "Cavaleiros das alturas.",
      order: 0,
      imageUrls: ["/houses/euralune.jpg", "/houses/euralune-2.jpg"],
    } as never);

    await setup(client, "/valdren/casas");

    expect(await screen.findByAltText("Imagem 1 de Casa Euralune — Os Senhores do Céu")).toBeInTheDocument();
    expect(screen.getByAltText("Imagem 2 de Casa Euralune — Os Senhores do Céu")).toBeInTheDocument();
  });

  it("renders markdown body formatting instead of raw markdown text", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "casas",
      title: "Casa Karasoy",
      body: `> **Lema:** As estrelas lembram.

### Cultura

A Casa protege **rotas antigas**.

- Caminhos sob o deserto
- Guardiãs da estrela`,
      order: 0,
      imageUrls: ["/houses/karasoy.jpg"],
    });

    await setup(client, "/valdren/casas");

    expect(await screen.findByAltText("Imagem de Casa Karasoy")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cultura", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("rotas antigas").tagName.toLowerCase()).toBe("strong");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Caminhos sob o deserto",
      "Guardiãs da estrela",
    ]);
    expect(screen.queryByText(/\*\*rotas antigas\*\*/)).not.toBeInTheDocument();
  });
});
