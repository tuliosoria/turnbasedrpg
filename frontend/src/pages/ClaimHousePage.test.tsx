import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { ClaimHousePage } from "./ClaimHousePage";

function renderPage() {
  const client = new MockApiClient();
  render(
    <ApiProvider client={client}>
      <MemoryRouter><ClaimHousePage /></MemoryRouter>
    </ApiProvider>,
  );
  return client;
}

describe("ClaimHousePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("lists the six houses", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Casa Vargen")).toBeInTheDocument());
    expect(screen.getByText("Irmandade dos Corvos")).toBeInTheDocument();
  });

  it("claims a house and shows the generated code", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Casa Vargen")).toBeInTheDocument());
    const vargenButton = screen.getAllByRole("button", { name: /disponível/i })[0];
    await userEvent.click(vargenButton);
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() =>
      expect(screen.getByText(/seu código/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/vargen-/i)).toBeInTheDocument();
  });
});
