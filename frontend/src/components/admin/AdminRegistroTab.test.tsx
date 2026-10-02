import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminRegistroTab } from "./AdminRegistroTab";

describe("AdminRegistroTab", () => {
  it("mostra o erro quando a primeira carga falha", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("code");
    vi.spyOn(client, "listWorldFacts").mockRejectedValue(new Error("registro fora do ar"));
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <AdminRegistroTab adminToken={adminToken} />
        </ApiProvider>,
      );
    });
    expect(await screen.findByText("registro fora do ar")).toBeInTheDocument();
  });
});
