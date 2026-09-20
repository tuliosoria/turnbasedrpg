import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const portraitsScript = resolve(repoRoot, "backend/scripts/seed-npc-portraits.mjs");
const emblemsScript = resolve(repoRoot, "backend/scripts/seed-house-emblems.mjs");

function runWithout(script, names) {
  const env = { ...process.env };
  for (const name of names) delete env[name];
  return execFileSync(process.execPath, [script], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

describe("portrait and emblem seed defaults", () => {
  it("does not hardcode Desktop paths or an AWS account bucket", () => {
    const portraits = readFileSync(portraitsScript, "utf8");
    const emblems = readFileSync(emblemsScript, "utf8");

    expect(portraits).not.toMatch(/Desktop/);
    expect(portraits).not.toMatch(/homedir/);
    expect(portraits).not.toMatch(/825081952316/);
    expect(emblems).not.toMatch(/825081952316/);
    expect(emblems).not.toMatch(/Desktop/);
  });

  it("refuses to run portraits seed without IMAGES_BUCKET and PORTRAITS_DIR", () => {
    expect(() => runWithout(portraitsScript, ["IMAGES_BUCKET", "PORTRAITS_DIR"])).toThrow(/IMAGES_BUCKET|PORTRAITS_DIR/);
  });

  it("refuses to run emblems seed without IMAGES_BUCKET", () => {
    expect(() => runWithout(emblemsScript, ["IMAGES_BUCKET"])).toThrow(/IMAGES_BUCKET/);
  });
});
