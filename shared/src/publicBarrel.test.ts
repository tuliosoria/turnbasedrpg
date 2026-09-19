import { describe, expect, it } from "vitest";
import * as content from "./index.js";
import * as gmCodex from "./gmCodex.js";
import { GM_SECTIONS, gmSectionLabel } from "./gm.js";

describe("pacote público @ravenloft/content", () => {
  it("não exporta a semente da Bíblia do Mestre", () => {
    expect("DEFAULT_GM_ENTRIES" in content).toBe(false);
    expect("defaultGm" in content).toBe(false);
  });

  it("não reexporta o Codex completo nem os segredos de personagem", () => {
    expect("fullCodex" in content).toBe(false);
    expect("derivedCodex" in content).toBe(false);
    expect("CHARACTER_SECRETS" in content).toBe(false);
    expect("ROSTER_SECRETS" in content).toBe(false);
    expect("houseRoster" in content).toBe(false);
    expect("characterFor" in content).toBe(false);
    expect("npcFor" in content).toBe(false);
    expect("addressableNpcs" in content).toBe(false);
    expect("codexBySeat" in content).toBe(false);
    expect("codexNpcBySeatAndId" in content).toBe(false);
  });
});

describe("entrada @ravenloft/content/gm-codex", () => {
  it("exporta o Codex completo e os segredos para o Mestre e a IA", () => {
    expect(typeof gmCodex.fullCodex).toBe("function");
    expect(typeof gmCodex.CHARACTER_SECRETS).toBe("object");
    expect(typeof gmCodex.houseRoster).toBe("function");
    expect(typeof gmCodex.characterFor).toBe("function");
    expect(typeof gmCodex.addressableNpcs).toBe("function");
  });
});

describe("rótulos públicos das seções do Mestre", () => {
  it("não nomeiam Othmar nem o Rei Branco", () => {
    const rotulos = GM_SECTIONS.map((s) => s.label).join("\n");
    expect(rotulos).not.toMatch(/Othmar|Rei Branco/i);
    expect(gmSectionLabel("ancoras")).not.toMatch(/Othmar|Rei Branco/i);
  });
});
