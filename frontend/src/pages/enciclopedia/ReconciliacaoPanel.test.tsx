import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WikiEntry } from "@ravenloft/content";
import { ReconciliacaoPanel, suggestMatch } from "./ReconciliacaoPanel";

function entry(entryId: string, title: string, section = "casas"): WikiEntry {
  return { entryId, section, title, body: "", order: 0, updatedAt: "" };
}

const ENTRIES = [
  entry("w1", "Ordem do Sino"),
  entry("w2", "Khar-Durak"),
  entry("w3", "Príncipe Alic Valerius"),
];

/**
 * The real wiki titles, verbatim from shared/src/defaultWiki.ts, in the shapes
 * the seeded entity names actually have to survive: `Nome — Epíteto` titles and
 * `Nome (Outro nome)` entity names. The near-miss houses are here on purpose —
 * "Casa Euralune" and "Casa Solarion" must not be mistaken for the cities.
 */
const REAL_ENTRIES = [
  entry("c1", "Khar-Durak — A Cidade da Montanha Viva", "cidades"),
  entry("c2", "Ninho Alto — A Cidade das Asas", "cidades"),
  entry("c3", "Sahra-Lun — Oásis das Sete Sombras", "cidades"),
  entry("c4", "Clã Mandíbula de Osso — O Povo que Quebrou as Correntes"),
  entry("c5", "Casa Euralune — Os Senhores do Céu"),
  entry("c6", "Casa Solarion — Os Olhos do Meio-Dia"),
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
    expect(suggestMatch("Casa Valerius", ENTRIES)).toBeNull();
    expect(suggestMatch("", ENTRIES)).toBeNull();
  });

  it("matches a title whose epithet follows an em dash", () => {
    expect(suggestMatch("Khar-Durak", REAL_ENTRIES)?.entryId).toBe("c1");
    expect(suggestMatch("Clã Mandíbula de Osso", REAL_ENTRIES)?.entryId).toBe("c4");
  });

  it("does not truncate a name at a hyphen that is not a separator", () => {
    // "Khar-Durak" is one word, not "Khar" with an epithet.
    expect(suggestMatch("Khar-Durak", [entry("z", "Khar — A Fenda Antiga")])).toBeNull();
    expect(suggestMatch("Sahra-Lun", [entry("z", "Sahra — Nada a Ver")])).toBeNull();
  });

  it("matches through the entity's own parenthetical", () => {
    expect(suggestMatch("Euralune (Ninho Alto)", REAL_ENTRIES)?.entryId).toBe("c2");
    expect(suggestMatch("Solarion (Sahra-Lun)", REAL_ENTRIES)?.entryId).toBe("c3");
  });

  it("prefers the whole name over a parenthetical head", () => {
    const entries = [...REAL_ENTRIES, entry("c7", "Euralune (Ninho Alto)", "cidades")];
    expect(suggestMatch("Euralune (Ninho Alto)", entries)?.entryId).toBe("c7");
  });

  it("still declines the seeded entities that have no verbete at all", () => {
    for (const name of [
      "Príncipe Alic Valerius",
      "Lady Celene Valerius",
      "Mapa Oficial de Valdren",
      "Elfos de Solarion",
      "Elfos de Sahra-Lun",
      "Gnomos de Euralune",
    ]) {
      expect(suggestMatch(name, REAL_ENTRIES)).toBeNull();
    }
  });

  it("declines rather than guessing when two entries share a head", () => {
    const entries = [entry("a", "Ferrum — A Cidade"), entry("b", "Ferrum — A Casa")];
    expect(suggestMatch("Ferrum", entries)).toBeNull();
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

  it("offers a working manual picker when nothing matches", async () => {
    const onLink = vi.fn();
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e9", canonicalName: "Mapa Oficial de Valdren" }]}
        entries={REAL_ENTRIES}
        onLink={onLink}
      />,
    );
    expect(screen.getByText("Mapa Oficial de Valdren")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Vincular a/ })).not.toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: "Escolher verbete" });
    await userEvent.click(picker);
    await userEvent.type(picker, "Ninho");
    await userEvent.click(screen.getByRole("option", { name: "Ninho Alto — A Cidade das Asas" }));
    expect(onLink).toHaveBeenCalledWith("e9", "c2");
  });

  it("keeps the picker as a secondary option next to a suggestion", async () => {
    const onLink = vi.fn();
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e1", canonicalName: "Khar-Durak" }]}
        entries={REAL_ENTRIES}
        onLink={onLink}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Vincular a Khar-Durak — A Cidade da Montanha Viva" }),
    ).toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: "Vincular a outro verbete" });
    await userEvent.click(picker);
    await userEvent.type(picker, "Meio-Dia");
    await userEvent.click(screen.getByRole("option", { name: "Casa Solarion — Os Olhos do Meio-Dia" }));
    expect(onLink).toHaveBeenCalledWith("e1", "c6");
  });

  it("lists every unlinked entity", () => {
    render(
      <ReconciliacaoPanel
        unlinked={[
          { id: "e1", canonicalName: "Khar-Durak" },
          { id: "e9", canonicalName: "Mapa Oficial de Valdren" },
        ]}
        entries={REAL_ENTRIES}
        onLink={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Vincular a Khar-Durak — A Cidade da Montanha Viva" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mapa Oficial de Valdren")).toBeInTheDocument();
    // Both rows can be resolved by hand; neither is a dead end.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });
});
