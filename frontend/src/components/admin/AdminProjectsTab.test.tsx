import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminProjectsTab } from "./AdminProjectsTab";

describe("AdminProjectsTab", () => {
  // Desde 2026-09-24 não há mesa de aprovação: a carta que antes esperava o
  // Mestre ("Contratar a Ordem dos Três") já chega aqui ativa.
  it("lists a card that used to need GM approval as already active", async () => {
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
    expect(screen.queryByRole("button", { name: /Aprovar/i })).toBeNull();
    expect(screen.getAllByText(/ACTIVE/i).length).toBeGreaterThan(0);
  });
});
