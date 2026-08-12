import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanonSheet } from "./CanonSheet";
import { newVisualEntity } from "@ravenloft/content";

function makeEntity() {
  const e = newVisualEntity({
    id: "e1", campaignId: "winter-dead", entityType: "CITY",
    canonicalName: "Khar-Durak", slug: "khar-durak",
    publicDescription: "Cidade da Montanha Viva",
  });
  e.immutableTraits = [
    { id: "t1", text: "escavada na montanha", source: "AUTHORED", originAssetId: null, createdAt: "" },
    { id: "t2", text: "mar verde-escuro", source: "DISCOVERED", originAssetId: "a9", createdAt: "" },
  ];
  return e;
}

describe("CanonSheet", () => {
  it("shows each trait with its provenance badge", () => {
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={vi.fn()} />);
    expect(screen.getByText("escavada na montanha")).toBeInTheDocument();
    expect(screen.getByText("mar verde-escuro")).toBeInTheDocument();
    expect(screen.getByText("Descoberto")).toBeInTheDocument();
  });

  it("adds a new trait and saves it as AUTHORED", async () => {
    const onSave = vi.fn();
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={onSave} />);

    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Novo traço imutável" }), "portão de pedra monumental");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const traits = onSave.mock.calls[0][0].immutableTraits;
    expect(traits).toHaveLength(3);
    expect(traits[2]).toMatchObject({ text: "portão de pedra monumental", source: "AUTHORED" });
  });

  it("removes a trait", async () => {
    const onSave = vi.fn();
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={onSave} />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Remover traço: escavada na montanha" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });

    expect(onSave.mock.calls[0][0].immutableTraits).toHaveLength(1);
  });

  it("keeps added traits distinct after an earlier one is removed", async () => {
    const onSave = vi.fn();
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={onSave} />);
    const field = screen.getByRole("textbox", { name: "Novo traço imutável" });

    await act(async () => {
      await userEvent.type(field, "portão de pedra");
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Remover traço: escavada na montanha" }));
    });
    await act(async () => {
      await userEvent.type(field, "docas inundadas");
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });

    const traits = onSave.mock.calls[0][0].immutableTraits;
    expect(traits.map((t: { text: string }) => t.text)).toEqual([
      "mar verde-escuro",
      "portão de pedra",
      "docas inundadas",
    ]);
    expect(new Set(traits.map((t: { id: string }) => t.id)).size).toBe(3);
  });

  it("hides editing controls for non-admins", () => {
    render(<CanonSheet entity={makeEntity()} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Salvar cânone" })).not.toBeInTheDocument();
    expect(screen.getByText("escavada na montanha")).toBeInTheDocument();
  });
});
