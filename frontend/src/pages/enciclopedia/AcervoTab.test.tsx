import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WikiEntry } from "@ravenloft/content";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AcervoTab, firstPopulatedSection, loreSummary, entityTypeForSection } from "./AcervoTab";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

const TOKEN = "mock-admin-token";

async function setup(isAdmin: boolean, client = new MockApiClient()) {
  await client.adminSeedWiki(TOKEN);
  if (isAdmin) saveAdminToken(TOKEN);
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <AcervoTab isAdmin={isAdmin} />
      </ApiProvider>,
    );
  });
  return client;
}

function coverage(): { covered: number; total: number } {
  const text = screen.getByText(/\d+ de \d+ verbetes com cânone visual/).textContent ?? "";
  const m = /(\d+) de (\d+)/.exec(text);
  if (!m) throw new Error(`coverage line not parseable: ${text}`);
  return { covered: Number(m[1]), total: Number(m[2]) };
}

function entry(entryId: string, section: string, title: string): WikiEntry {
  return { entryId, section, title, body: "", order: 0, updatedAt: "" };
}

describe("firstPopulatedSection", () => {
  it("skips sections that have no entries", () => {
    expect(firstPopulatedSection([entry("w1", "casas", "Casa Valerius")])).toBe("casas");
  });

  it("keeps WIKI_SECTIONS ordering among populated sections", () => {
    const entries = [entry("w1", "casas", "A"), entry("w2", "geografia", "B")];
    // "geografia" precedes "casas" in WIKI_SECTIONS.
    expect(firstPopulatedSection(entries)).toBe("geografia");
  });

  it("returns null when there are no entries at all", () => {
    expect(firstPopulatedSection([])).toBeNull();
  });
});

describe("entityTypeForSection", () => {
  it("uses the obvious type when the section names one", () => {
    expect(entityTypeForSection("casas")).toBe("HOUSE");
    expect(entityTypeForSection("cidades")).toBe("CITY");
    expect(entityTypeForSection("geografia")).toBe("REGION");
    expect(entityTypeForSection("povos")).toBe("ANCESTRY");
  });

  it("falls back to SCENE for sections with no entity-shaped subject", () => {
    expect(entityTypeForSection("costumes")).toBe("SCENE");
    expect(entityTypeForSection("qualquer-coisa")).toBe("SCENE");
  });
});

describe("loreSummary", () => {
  it("skips the markdown metadata block and takes the first prose paragraph", () => {
    const body = "> **Lema:** “Todo nome merece um último toque.”\n\n### Por que o Sino?\n\nA religião ensina que o mundo começou com um som.\n\nOutro parágrafo.";
    expect(loreSummary(body)).toBe("A religião ensina que o mundo começou com um som.");
  });

  it("strips markdown emphasis", () => {
    expect(loreSummary("Os **Ferrumor** descendem de _Caladris_.")).toBe(
      "Os Ferrumor descendem de Caladris.",
    );
  });

  it("truncates long paragraphs on a word boundary", () => {
    const long = `${"palavra ".repeat(80)}fim.`;
    const out = loreSummary(long);
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/palavr…$/);
  });

  it("returns an empty string when there is no prose", () => {
    expect(loreSummary("")).toBe("");
    expect(loreSummary("### Só um título\n\n- item\n- item")).toBe("");
  });
});

describe("AcervoTab", () => {
  afterEach(() => clearAdminToken());

  it("shows a loading state until both requests resolve", async () => {
    const client = new MockApiClient();
    await client.adminSeedWiki(TOKEN);
    vi.spyOn(client, "listVisualEntities").mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <AcervoTab isAdmin={false} />
        </ApiProvider>,
      );
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error with a retry that recovers", async () => {
    const client = new MockApiClient();
    await client.adminSeedWiki(TOKEN);
    const spy = vi.spyOn(client, "getWiki").mockRejectedValueOnce(new Error("rede caiu"));
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <AcervoTab isAdmin={false} />
        </ApiProvider>,
      );
    });
    expect(screen.getByText("rede caiu")).toBeInTheDocument();
    spy.mockRestore();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    });
    expect(screen.getByText(/verbetes com cânone visual/)).toBeInTheDocument();
  });

  it("shows the coverage line over the whole wiki", async () => {
    await setup(false);
    const { covered, total } = coverage();
    // The two seeded visual entities are unlinked, so nothing is covered yet.
    expect(covered).toBe(0);
    expect(total).toBeGreaterThan(100);
  });

  it("marks entries that have no visual entity", async () => {
    await setup(false);
    expect(screen.getAllByText("visual ✗").length).toBeGreaterThan(0);
    expect(screen.getAllByText("lore ✓").length).toBe(screen.getAllByText("visual ✗").length);
  });

  it("switches sections", async () => {
    await setup(false);
    expect(screen.getByText("Valdren, o reino-ilha")).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "As Casas" }));
    });
    expect(screen.getByText("Casa Valerius — O Sangue da Coroa")).toBeInTheDocument();
    expect(screen.queryByText("Valdren, o reino-ilha")).not.toBeInTheDocument();
  });

  it("lets an admin promote a lore entry into a visual entity", async () => {
    const client = await setup(true);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Religiões" }));
    });
    const row = screen.getByText("Ordem do Sino — Os Guardiões do Último Nome").closest("li");
    expect(row).not.toBeNull();
    await act(async () => {
      await userEvent.click(
        within(row as HTMLElement).getByRole("button", { name: "Criar entidade visual" }),
      );
    });

    // The canon sheet for the new entity opens straight away.
    expect(await screen.findByText("Traços imutáveis")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Ordem do Sino — Os Guardiões do Último Nome");

    const created = (await client.listVisualEntities()).find(
      (e) => e.canonicalName === "Ordem do Sino — Os Guardiões do Último Nome",
    );
    expect(created).toBeDefined();
    expect(created?.wikiEntryId).toBeTruthy();
    expect(created?.entityType).toBe("HOUSE");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    });
    expect(coverage().covered).toBe(1);
    expect(within(row as HTMLElement).getByText("visual ✓")).toBeInTheDocument();
  });

  it("saves canon edits from the dialog", async () => {
    const client = await setup(true);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "As Casas" }));
    });
    const row = screen.getByText("Casa Valerius — O Sangue da Coroa").closest("li") as HTMLElement;
    await act(async () => {
      await userEvent.click(within(row).getByRole("button", { name: "Criar entidade visual" }));
    });
    await screen.findByText("Traços imutáveis");
    await act(async () => {
      await userEvent.type(
        screen.getByRole("textbox", { name: "Novo traço imutável" }),
        "coroa de ferro",
      );
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });
    await waitFor(async () => {
      const saved = (await client.listVisualEntities()).find(
        (e) => e.canonicalName === "Casa Valerius — O Sangue da Coroa",
      );
      expect(saved?.immutableTraits.map((t) => t.text)).toContain("coroa de ferro");
    });
  });

  it("keeps trait identity when the same sheet is saved twice", async () => {
    const client = await setup(true);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "As Casas" }));
    });
    const row = screen.getByText("Casa Vargen — Os Lobos da Fronteira").closest("li") as HTMLElement;
    await act(async () => {
      await userEvent.click(within(row).getByRole("button", { name: "Criar entidade visual" }));
    });
    await screen.findByText("Traços imutáveis");
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Novo traço imutável" }), "pelagem cinza");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    const traitId = async () => {
      const e = (await client.listVisualEntities()).find(
        (x) => x.canonicalName === "Casa Vargen — Os Lobos da Fronteira",
      );
      return e?.immutableTraits[0]?.id;
    };
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });
    const first = await traitId();
    expect(first).toBeTruthy();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });
    // Re-saving must patch the same trait, not replace it: a fresh id would
    // reset the trait's provenance and drop the asset it was discovered from.
    expect(await traitId()).toBe(first);
  });

  it("hides entity creation from non-admins", async () => {
    await setup(false);
    expect(screen.queryByRole("button", { name: "Criar entidade visual" })).not.toBeInTheDocument();
  });

  it("still lets a non-admin read the canon sheet of a covered entry", async () => {
    const client = new MockApiClient();
    await client.adminSeedWiki(TOKEN);
    const entries = await client.getWiki();
    const target = entries.find((e) => e.section === "casas");
    await client.createVisualEntity(TOKEN, {
      canonicalName: target!.title,
      entityType: "HOUSE",
      wikiEntryId: target!.entryId,
    });
    await setup(false, client);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "As Casas" }));
    });
    const row = screen.getByText(target!.title).closest("li") as HTMLElement;
    expect(within(row).getByText("visual ✓")).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(within(row).getByRole("button", { name: /Ver cânone visual/ }));
    });
    expect(await screen.findByText("Traços imutáveis")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar cânone" })).not.toBeInTheDocument();
  });

  it("lists seeded entities that have no verbete and links them", async () => {
    const client = new MockApiClient();
    await client.adminSeedWiki(TOKEN);
    await client.adminCreateWikiEntry(TOKEN, {
      section: "cidades",
      title: "Khar-Durak",
      body: "A cidade anã.",
      order: 99,
    });
    await setup(true, client);

    expect(screen.getByText("Entidades sem verbete")).toBeInTheDocument();
    expect(screen.getByText("Príncipe Alic Valerius")).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Vincular a Khar-Durak" }));
    });
    await waitFor(async () => {
      const linked = (await client.listVisualEntities()).find((e) => e.id === "e2");
      expect(linked?.wikiEntryId).toBeTruthy();
    });
    // Once linked it leaves the unlinked list and counts towards coverage.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Vincular a Khar-Durak" })).not.toBeInTheDocument(),
    );
    expect(coverage().covered).toBe(1);
  });

  it("hides the reconciliation panel from non-admins", async () => {
    await setup(false);
    expect(screen.queryByText("Entidades sem verbete")).not.toBeInTheDocument();
  });
});
