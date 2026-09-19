import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "admin" || name === "enciclopedia") continue;
      out.push(...walk(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe("grafo de import do jogador", () => {
  it("não importa fullCodex, a semente do Mestre nem o mock estático", () => {
    const files = walk(SRC);
    const ofensas: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = relative(SRC, file).replaceAll("\\", "/");
      if (rel === "api/mockClient.ts" || rel === "pages/AdminPage.tsx") continue;
      if (/\bfullCodex\b/.test(src)) ofensas.push(`${rel}: fullCodex`);
      if (/\bDEFAULT_GM_ENTRIES\b/.test(src)) ofensas.push(`${rel}: DEFAULT_GM_ENTRIES`);
      if (/\bhouseRoster\b/.test(src)) ofensas.push(`${rel}: houseRoster`);
      if (/\bCHARACTER_SECRETS\b/.test(src)) ofensas.push(`${rel}: CHARACTER_SECRETS`);
      if (/\bROSTER_SECRETS\b/.test(src)) ofensas.push(`${rel}: ROSTER_SECRETS`);
      if (/from ["']@ravenloft\/content\/gm-codex["']/.test(src)) ofensas.push(`${rel}: @ravenloft/content/gm-codex`);
      if (/from ["']@ravenloft\/content\/gm-seed["']/.test(src)) ofensas.push(`${rel}: @ravenloft/content/gm-seed`);
      if (rel !== "api/index.ts" && /from ["']\.\/mockClient["']/.test(src)) {
        ofensas.push(`${rel}: import estático de mockClient`);
      }
    }
    expect(ofensas).toEqual([]);
  });
});
