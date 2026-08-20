import { describe, expect, it } from "vitest";
import { LEADER_PERSONAS } from "../diplomacy/leaders.js";
import { derivedCodex, fullCodex, identityFromPersona } from "./codex.js";
import { NPC_BIOGRAPHIES } from "../lore/biographies.js";

describe("NPC Codex derivado", () => {
  const codex = derivedCodex();

  it("promove os dezesseis líderes a Major NPC", () => {
    const majors = codex.filter((n) => n.tier === "MAJOR");
    expect(majors.length).toBe(Object.keys(LEADER_PERSONAS).length);
  });

  it("traz as demais figuras como Relevantes", () => {
    expect(codex.some((n) => n.tier === "RELEVANT")).toBe(true);
    // O elenco é grande; o Codex derivado sozinho já passa de oitenta.
    expect(codex.length).toBeGreaterThan(80);
  });

  it("não duplica o líder que também aparece no elenco da Casa", () => {
    const byKey = codex.map((n) => `${n.affiliation}:${n.id}`);
    expect(new Set(byKey).size).toBe(byKey.length);
  });

  it("dá a todo NPC uma afiliação e uma localização", () => {
    for (const n of codex) {
      expect(n.affiliation.trim()).not.toBe("");
      expect(n.location.trim()).not.toBe("");
    }
  });

  it("carrega a persona política do líder na identidade", () => {
    const solarion = identityFromPersona("casa-solarion", LEADER_PERSONAS["casa-solarion"]);
    expect(solarion.tier).toBe("MAJOR");
    expect(solarion.affiliation).toBe("casa-solarion");
    expect(solarion.ambitions).toBe(LEADER_PERSONAS["casa-solarion"].wants);
    expect(solarion.redLines).toBe(LEADER_PERSONAS["casa-solarion"].refuses);
    // A postura com a Coroa não se perde: entra na orientação de roleplay.
    expect(solarion.roleplayGuidance).toMatch(/Coroa/);
  });

  // O segredo de uma figura (hides) precisa virar segredo do NPC, não sumir.
  it("leva o segredo de uma figura para o campo secrets", () => {
    const relevant = derivedCodex().find((n) => n.tier === "RELEVANT" && n.secrets.trim() !== "");
    expect(relevant).toBeDefined();
  });

  /**
   * A ficha pública mostrava uma linha só por personagem. A biografia é
   * autorada à parte e precisa chegar tanto ao cânone derivado das Casas
   * quanto ao roster, sem que nenhuma chave fique órfã.
   */
  it("sobrepõe a biografia autorada no Codex completo", () => {
    const full = fullCodex();
    const keys = new Set(full.map((n) => `${n.affiliation}:${n.id}`));
    for (const key of Object.keys(NPC_BIOGRAPHIES)) {
      expect(keys.has(key), `biografia órfã: ${key}`).toBe(true);
    }
    const comBiografia = full.filter((n) => (n.biography ?? "").trim() !== "");
    expect(comBiografia.length).toBe(Object.keys(NPC_BIOGRAPHIES).length);
  });
});