import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as content from "./index.js";
import * as gmCodex from "./gmCodex.js";
import { GM_SECTIONS, gmSectionLabel } from "./gm.js";

const SRC = dirname(fileURLToPath(import.meta.url));

/** Arquivos que o barrel público avalia. `import type` não entra no bundle. */
function publicSources(): string[] {
  const seen = new Set<string>();
  const stack = [resolve(SRC, "index.ts")];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8").replace(
      /import\s+type\s+(?:\{[^}]*\}|[A-Za-z0-9_]+)\s+from\s+["'][^"']+["'];?/g,
      "",
    );
    for (const match of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const abs = resolve(dirname(file), match[1]);
      const ts = abs.endsWith(".js") ? abs.replace(/\.js$/, ".ts") : `${abs}.ts`;
      if (!seen.has(ts)) stack.push(ts);
    }
  }
  return [...seen];
}

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

  it("não alcança recusa, desejo, postura com a Coroa nem desconfiança das personas", () => {
    for (const persona of Object.values(content.LEADER_PERSONAS)) {
      expect(persona).not.toHaveProperty("refuses");
      expect(persona).not.toHaveProperty("wants");
      expect(persona).not.toHaveProperty("crownStance");
      expect(persona).not.toHaveProperty("distrusts");
    }
    const fontes = publicSources();
    expect(fontes.some((f) => f.endsWith("/leaderSecrets.ts") || f.endsWith("/diplomacy/leaders.ts"))).toBe(false);
    const texto = fontes.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(texto).not.toMatch(/não reconhecerá Alic Valerius/);
    expect(texto).not.toMatch(/quem determinou a evacuação/);
    expect(texto).not.toMatch(/quem teve acesso à Asteria/);
  });
});

describe("entrada @ravenloft/content/gm-codex", () => {
  it("exporta o Codex completo e os segredos para o Mestre e a IA", () => {
    expect(typeof gmCodex.fullCodex).toBe("function");
    expect(typeof gmCodex.CHARACTER_SECRETS).toBe("object");
    expect(typeof gmCodex.houseRoster).toBe("function");
    expect(typeof gmCodex.characterFor).toBe("function");
    expect(typeof gmCodex.addressableNpcs).toBe("function");
    expect(gmCodex.personaFor("casa-drakorys")?.refuses).toMatch(/Alic Valerius/);
    expect(gmCodex.personaFor("casa-karasoy")?.wants).toMatch(/quem determinou a evacuação/);
    expect(gmCodex.personaFor("casa-khazdrun")?.crownStance).toMatch(/acesso à Asteria/);
    expect(gmCodex.LEADER_PERSONAS["casa-drakorys"].distrusts?.["casa-valerius"]).toBeTruthy();
  });
});

describe("rótulos públicos das seções do Mestre", () => {
  it("não nomeiam Othmar nem o Rei Branco", () => {
    const rotulos = GM_SECTIONS.map((s) => s.label).join("\n");
    expect(rotulos).not.toMatch(/Othmar|Rei Branco/i);
    expect(gmSectionLabel("ancoras")).not.toMatch(/Othmar|Rei Branco/i);
  });
});
