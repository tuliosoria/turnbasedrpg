import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "./api/ApiProvider";
import { MockApiClient } from "./api/mockClient";
import { AppRoutes } from "./App";

describe("App routing", () => {
  it("renders the landing page at /", async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRoutes /></MemoryRouter>
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Valdren/i })).toBeInTheDocument(),
    );
  });

  it("redirects /enciclopedia to the player chronicle", async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/enciclopedia"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </MemoryRouter>
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /A crônica de Valdren/i })).toBeInTheDocument(),
    );
  });

  it("redirects /game to /login without a session", async () => {
    sessionStorage.clear();
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/game"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRoutes /></MemoryRouter>
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /entrar com seu código/i })).toBeInTheDocument(),
    );
  });

  it("resolve a rota preguiçosa de /admin", async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
        <MemoryRouter initialEntries={["/admin"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </MemoryRouter>
      </ApiProvider>,
    );
    expect(await screen.findByRole("heading", { name: /Administração/i })).toBeInTheDocument();
  });
});
