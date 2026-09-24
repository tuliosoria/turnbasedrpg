import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../scripts/world-bible-seed.mjs");
const seedSource = readFileSync(seedPath, "utf8");

describe("world-bible seed", () => {
  it("keeps the named exports reset-campaign imports", () => {
    expect(seedSource).toMatch(/export const SEED_LORE = `/);
    expect(seedSource).toMatch(/export const SEED_VISUAL_DIRECTIVES = `/);
  });

  it("does not teach Ravenloft or Inverno dos Mortos as the setting", () => {
    expect(seedSource).not.toMatch(/Ravenloft/i);
    expect(seedSource).not.toMatch(/Inverno dos Mortos/i);
  });

  it("frames Valdren as the original setting", () => {
    expect(seedSource).toMatch(/Valdren/);
    expect(seedSource).toMatch(/Brumas/);
    expect(seedSource).toMatch(/Asterhall/);
  });
});
