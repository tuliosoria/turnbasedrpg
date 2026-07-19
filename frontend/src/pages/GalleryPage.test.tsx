import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { GalleryPage } from "./GalleryPage";

async function setup(client: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GalleryPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("GalleryPage", () => {
  it("shows an empty state when there are no images", async () => {
    await setup(new MockApiClient());
    expect(await screen.findByText(/Nenhuma imagem foi registrada ainda/i)).toBeInTheDocument();
  });

  it("renders generated turn images", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminGenerateTurnImage(adminToken, "event", "prompt do evento");

    await setup(client);

    await waitFor(() => {
      const images = screen.getAllByRole("img").filter((node) => node.getAttribute("src")?.includes("event"));
      expect(images.length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Evento/)).toBeInTheDocument();
  });
});
