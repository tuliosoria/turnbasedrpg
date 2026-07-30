import { describe, expect, it } from "vitest";
import { parseExpeditionEntry } from "../../scripts/generate-valdren-wiki.mjs";

describe("generate-valdren-wiki helpers", () => {
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
