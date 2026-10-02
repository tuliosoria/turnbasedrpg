import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminSpyTab } from "./AdminSpyTab";

describe("AdminSpyTab", () => {
  it("mostra o erro quando a primeira carga falha", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("code");
    vi.spyOn(client, "adminListSpyOps").mockRejectedValue(new Error("sem rede"));
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <AdminSpyTab adminToken={adminToken} />
        </ApiProvider>,
      );
    });
    expect(await screen.findByText("sem rede")).toBeInTheDocument();
  });
});
