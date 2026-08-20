import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCanonTab } from "./AdminCanonTab";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";

async function setup() {
  const api = new MockApiClient();
  const acc = await api.createAccountAndHouse({
    displayName: "Sera", name: "Casa Vargen", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "F", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as never);
  const playerToken = acc.playerToken;
  const { adminToken } = await api.adminLogin("admin");
  const preview = await api.playerCanonPreview(playerToken, "Sera de Vargen, batedora.");
  await api.playerCanonSubmit(playerToken, {
    rawText: "Sera de Vargen, batedora.", rawImageUrl: null, rawImageKey: null, proposal: preview.proposal, review: preview.review,
  });
  const onError = vi.fn();
  render(
    <ApiProvider client={api}>
      <AdminCanonTab adminToken={adminToken} busy={false} onError={onError} />
    </ApiProvider>,
  );
  return { api, adminToken, onError };
}

async function setupWithConflict() {
  const api = new MockApiClient();
  const acc = await api.createAccountAndHouse({
    displayName: "Solarion", name: "Casa Solarion", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "F", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as never);
  const playerToken = acc.playerToken;
  const { adminToken } = await api.adminLogin("admin");
  // Semeia o cânone para que ao menos um id em conflito resolva para um título.
  await api.adminSeedWiki(adminToken);
  const wiki = await api.getWiki();
  const preview = await api.playerCanonPreview(playerToken, "Quero trocar o nome do líder — isso gera conflito.");
  await api.playerCanonSubmit(playerToken, {
    rawText: "Quero trocar o nome do líder — isso gera conflito.",
    rawImageUrl: null, rawImageKey: null, proposal: preview.proposal, review: preview.review,
  });
  // O verbete que o parecer referencia e que de fato existe na enciclopédia.
  const knownEntry = wiki.find((e) => preview.review?.conflictingEntryIds.includes(e.entryId));
  const onError = vi.fn();
  render(
    <ApiProvider client={api}>
      <AdminCanonTab adminToken={adminToken} busy={false} onError={onError} />
    </ApiProvider>,
  );
  return { api, adminToken, onError, knownEntry };
}

describe("AdminCanonTab", () => {
  it("lists pending submissions with the author's house", async () => {
    await setup();
    const matches = await screen.findAllByText(/Sera de Vargen/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("Sera")).toBeTruthy();
    expect(screen.getByRole("button", { name: /aprovar e publicar/i })).toBeTruthy();
  });

  it("approves the submission and removes it from the pending list", async () => {
    const { api, adminToken } = await setup();
    await screen.findAllByText(/Sera de Vargen/);
    await userEvent.click(screen.getByRole("button", { name: /aprovar e publicar/i }));
    await waitFor(async () => {
      const all = await api.adminCanonList(adminToken);
      expect(all[0].status).toBe("APPROVED");
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /aprovar e publicar/i })).toBeNull();
      expect(screen.getByText("Publicado na Enciclopédia")).toBeTruthy();
    });
  });

  it("applies edits to the verbete before approving", async () => {
    const { api, adminToken } = await setup();
    await screen.findAllByText(/Sera de Vargen/);
    const verbete = screen.getByLabelText(/verbete/i);
    await userEvent.clear(verbete);
    await userEvent.type(verbete, "Verbete revisado pelo Mestre.");
    await userEvent.click(screen.getByRole("button", { name: /aprovar e publicar/i }));
    await waitFor(async () => {
      const all = await api.adminCanonList(adminToken);
      expect(all[0].status).toBe("APPROVED");
      expect(all[0].proposal.body).toBe("Verbete revisado pelo Mestre.");
    });
    const wiki = await api.getWiki();
    expect(wiki.some((e) => e.body === "Verbete revisado pelo Mestre.")).toBe(true);
  });

  it("keeps the reject button disabled until a note is typed", async () => {
    await setup();
    await screen.findAllByText(/Sera de Vargen/);
    expect(screen.getByRole("button", { name: /recusar/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/nota para o jogador/i), "   ");
    expect(screen.getByRole("button", { name: /recusar/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/nota para o jogador/i), "Conflita.");
    expect(screen.getByRole("button", { name: /recusar/i })).toBeEnabled();
  });

  it("rejects with the typed note", async () => {
    const { api, adminToken } = await setup();
    await screen.findAllByText(/Sera de Vargen/);
    await userEvent.type(screen.getByLabelText(/nota para o jogador/i), "Conflita com o cerco.");
    await userEvent.click(screen.getByRole("button", { name: /recusar/i }));
    await waitFor(async () => {
      const all = await api.adminCanonList(adminToken);
      expect(all[0].status).toBe("REJECTED");
      expect(all[0].gmNote).toBe("Conflita com o cerco.");
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /recusar/i })).toBeNull();
      expect(screen.getByText("Recusado")).toBeTruthy();
    });
  });

  it("mostra ao Mestre os verbetes em conflito pelo título, resolvendo os ids", async () => {
    const { knownEntry } = await setupWithConflict();
    await screen.findByRole("button", { name: /aprovar e publicar/i });
    // O verbete que existe aparece pelo título, não pelo id cru.
    expect(await screen.findByText(knownEntry!.title)).toBeTruthy();
    expect(screen.queryByText(knownEntry!.entryId)).toBeNull();
  });

  it("degrada com elegância quando um id em conflito não existe mais", async () => {
    await setupWithConflict();
    await screen.findByRole("button", { name: /aprovar e publicar/i });
    // O id que não resolve não vaza cru nem quebra a tela: some ou vira aviso.
    expect(screen.queryByText("wiki-removido-999")).toBeNull();
    expect(screen.getByText(/verbete removido|não encontrado/i)).toBeTruthy();
  });
});
