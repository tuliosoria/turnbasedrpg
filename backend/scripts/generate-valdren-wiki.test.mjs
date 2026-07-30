import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseExpeditionEntry } from "../../scripts/generate-valdren-wiki.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("generate-valdren-wiki helpers", () => {
  it("can be imported when Node has no script argv", () => {
    const output = execFileSync(
      process.execPath,
      ["-e", "import('./scripts/generate-valdren-wiki.mjs').then(() => console.log('import ok'))"],
      { cwd: repoRoot, encoding: "utf8" },
    );

    expect(output.trim()).toBe("import ok");
  });

  it("preserves expedition dividers that are not in the source preamble", () => {
    const entry = parseExpeditionEntry(`# A Expedição Além das Brumas

# Visão geral

Texto público.

---

# Outra seção

Mais texto.`);

    expect(entry.body).toContain("# Visão geral");
    expect(entry.body).toContain("---");
    expect(entry.body).toContain("# Outra seção");
  });
});
