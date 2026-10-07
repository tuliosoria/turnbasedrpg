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

  it("apresenta legenda curta, alt descritivo e caminho para a crônica", async () => {
    const client = new MockApiClient();
    client.getGallery = async () => [{
      turnId: 1,
      publicEvent: "# Turno 1 — Inverno\n\nAs brumas avançam **sobre o Norte**. Uma segunda frase explica a crise.",
      eventImageUrl: "https://img.test/evento.jpg",
      publicResult: "",
    }];
    await setup(client);

    const imagem = await screen.findByRole("img", { name: "Ilustração do evento do turno 1" });
    expect(imagem).toHaveAttribute("src", "https://img.test/evento.jpg");
    expect(screen.getByText("As brumas avançam sobre o Norte. Uma segunda frase explica a crise.")).toBeInTheDocument();
    expect(screen.queryByText(/# Turno 1/)).toBeNull();
    expect(screen.getByRole("link", { name: /Explorar a crônica/i })).toHaveAttribute("href", "/valdren");
  });
});
