import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminProjectsTab } from "./AdminProjectsTab";

describe("AdminProjectsTab", () => {
  it("lists projects and approves a pending one", async () => {
    const client = new MockApiClient();
    const acc = await client.createAccountAndHouse({
      displayName: "P", name: "Casa X", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
      leaderName: "L", heirName: "H", castleName: "F", townsText: "", historyText: "", specialty: "", weakness: "",
      attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
    } as any);
    await client.startProjectFromTemplate(acc.playerToken, { templateId: "contratar-a-ordem-dos-tres" });

    render(
      <ApiProvider client={client}>
        <AdminProjectsTab adminToken="mock-admin-token" busy={false} onError={vi.fn()} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Contratar a Ordem dos Três/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Aprovar/i }));
    await waitFor(() => expect(screen.getAllByText(/ACTIVE/i).length).toBeGreaterThan(0));
  });
});
