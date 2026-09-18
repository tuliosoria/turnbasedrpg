import { describe, expect, it } from "vitest";
import * as content from "./index.js";
import { GM_SECTIONS, gmSectionLabel } from "./gm.js";

describe("pacote público @ravenloft/content", () => {
  it("não exporta a semente da Bíblia do Mestre", () => {
    expect("DEFAULT_GM_ENTRIES" in content).toBe(false);
    expect("defaultGm" in content).toBe(false);
  });
});

describe("rótulos públicos das seções do Mestre", () => {
  it("não nomeiam Othmar nem o Rei Branco", () => {
    const rotulos = GM_SECTIONS.map((s) => s.label).join("\n");
    expect(rotulos).not.toMatch(/Othmar|Rei Branco/i);
    expect(gmSectionLabel("ancoras")).not.toMatch(/Othmar|Rei Branco/i);
  });
});
