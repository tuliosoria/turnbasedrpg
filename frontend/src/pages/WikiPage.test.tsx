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
});
