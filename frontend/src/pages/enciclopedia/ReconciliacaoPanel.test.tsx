import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WikiEntry } from "@ravenloft/content";
import { ReconciliacaoPanel, suggestMatch } from "./ReconciliacaoPanel";

function entry(entryId: string, title: string): WikiEntry {
  return { entryId, section: "casas", title, body: "", order: 0, updatedAt: "" };
}

const ENTRIES = [
  entry("w1", "Ordem do Sino"),
  entry("w2", "Khar-Durak"),
  entry("w3", "Príncipe Alic Valerius"),
];

describe("suggestMatch", () => {
  it("matches an exact title", () => {
    expect(suggestMatch("Ordem do Sino", ENTRIES)?.entryId).toBe("w1");
  });

  it("ignores case and accents", () => {
    expect(suggestMatch("principe alic valerius", ENTRIES)?.entryId).toBe("w3");
    expect(suggestMatch("PRÍNCIPE ALIC VALERIUS", ENTRIES)?.entryId).toBe("w3");
  });

  it("trims surrounding whitespace", () => {
    expect(suggestMatch("  Khar-Durak  ", ENTRIES)?.entryId).toBe("w2");
  });

  it("returns null when nothing matches exactly", () => {
    expect(suggestMatch("Khar-Durak — A Cidade da Montanha Viva", ENTRIES)).toBeNull();
    expect(suggestMatch("Casa Valerius", ENTRIES)).toBeNull();
    expect(suggestMatch("", ENTRIES)).toBeNull();
  });
});

describe("ReconciliacaoPanel", () => {
  it("renders nothing when there are no unlinked entities", () => {
    const { container } = render(
      <ReconciliacaoPanel unlinked={[]} entries={ENTRIES} onLink={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers a link button for a matched entity", async () => {
    const onLink = vi.fn();
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e1", canonicalName: "Ordem do Sino" }]}
        entries={ENTRIES}
        onLink={onLink}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Vincular a Ordem do Sino" }));
    expect(onLink).toHaveBeenCalledWith("e1", "w1");
  });

  it("says so when no wiki entry corresponds", () => {
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e9", canonicalName: "Mapa Oficial de Valdren" }]}
        entries={ENTRIES}
        onLink={() => {}}
      />,
    );
    expect(screen.getByText("Mapa Oficial de Valdren")).toBeInTheDocument();
    expect(screen.getByText("Sem verbete correspondente")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists every unlinked entity", () => {
    render(
      <ReconciliacaoPanel
        unlinked={[
          { id: "e1", canonicalName: "Khar-Durak" },
          { id: "e9", canonicalName: "Mapa Oficial de Valdren" },
        ]}
        entries={ENTRIES}
        onLink={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Vincular a Khar-Durak" })).toBeInTheDocument();
    expect(screen.getByText("Sem verbete correspondente")).toBeInTheDocument();
  });
});
