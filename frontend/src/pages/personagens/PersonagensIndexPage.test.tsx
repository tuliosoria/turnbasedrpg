import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { PersonagensIndexPage } from "./PersonagensIndexPage";

async function setup() {
  await act(async () => {
    render(
      <ApiProvider client={new MockApiClient()}>
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
});
