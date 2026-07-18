import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { savePlayerSession } from "../auth/playerSession";
import { GamePage } from "./GamePage";

async function setup() {
  const client = new MockApiClient();
  const claim = await client.claimHouse("vargen", "Elira");
  savePlayerSession({
    playerToken: claim.playerToken, houseId: "vargen", displayName: "Elira",
  });
  render(
    <ApiProvider client={client}>
      <MemoryRouter><GamePage /></MemoryRouter>
    </ApiProvider>,
  );
  return client;
}

describe("GamePage", () => {
  beforeEach(() => sessionStorage.clear());

  it("renders the event and exactly three cards", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText(/A Estrada de Varn/)).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /escolher esta carta/i })).toHaveLength(3);
  });

  it("selects a card and shows a confirmation", async () => {
    await setup();
    await waitFor(() => expect(screen.getByText("Defender a Ponte")).toBeInTheDocument());
    const buttons = screen.getAllByRole("button", { name: /escolher esta carta/i });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getByText(/carta escolhida/i)).toBeInTheDocument());
  });
});
