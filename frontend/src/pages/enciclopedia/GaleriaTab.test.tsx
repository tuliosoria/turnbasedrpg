import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { GaleriaTab } from "./GaleriaTab";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

async function setup() {
  const client = new MockApiClient();
  saveAdminToken("mock-admin-token");
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <GaleriaTab />
      </ApiProvider>,
    );
  });
  return client;
}

describe("GaleriaTab style reference", () => {
  afterEach(() => clearAdminToken());

  it("lets an admin designate a canonical image as the style reference", async () => {
    // A reference image pins palette and lighting far harder than wording can,
    // and the style bible ships with none.
    const client = await setup();
    await waitFor(() => expect(screen.getAllByRole("img").length).toBeGreaterThan(0));

    await act(async () => {
      await userEvent.click(screen.getAllByRole("button", { name: "Usar como referência de estilo" })[0]);
    });

    await waitFor(async () => {
      const bible = await client.getVisualStyleBible();
      expect(bible.referenceAssetIds).toHaveLength(1);
    });
  });

  it("marks the image that is currently the style reference", async () => {
    const client = await setup();
    await waitFor(() => expect(screen.getAllByRole("img").length).toBeGreaterThan(0));

    await act(async () => {
      await userEvent.click(screen.getAllByRole("button", { name: "Usar como referência de estilo" })[0]);
    });

    await waitFor(() => expect(screen.getByText("Referência de estilo")).toBeInTheDocument());
    const bible = await client.getVisualStyleBible();
    expect(bible.referenceAssetIds[0]).toBeTruthy();
  });

  it("tells the author when no style reference is set", async () => {
    await setup();
    await waitFor(() =>
      expect(screen.getByText(/Nenhuma imagem definida como referência de estilo/)).toBeInTheDocument(),
    );
  });
});
