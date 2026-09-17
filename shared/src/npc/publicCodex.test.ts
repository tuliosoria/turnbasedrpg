import { describe, expect, it } from "vitest";
import { HOUSE_CHARACTERS } from "../lore/characters.js";
import { fullCodex } from "./codex.js";
import { publicCodex } from "./publicCodex.js";

const vazado = (texto: string) =>
  /Rei Branco|Palius|Othmar|Casco Vermelho avançar/i.test(texto);

describe("publicCodex", () => {
  it("tem as mesmas pessoas que o Codex completo, sem os campos do Mestre", () => {
    const publico = publicCodex();
    const completo = fullCodex();
    expect(publico.map((n) => `${n.affiliation}:${n.id}`).sort()).toEqual(
      completo.map((n) => `${n.affiliation}:${n.id}`).sort(),
    );
    for (const n of publico) {
      expect(n).not.toHaveProperty("secrets");
      expect(n).not.toHaveProperty("fears");
      expect(n).not.toHaveProperty("ambitions");
      expect(n).not.toHaveProperty("redLines");
      expect(n).not.toHaveProperty("roleplayGuidance");
    }
  });

  it("não leva o segredo de Alic, Kaelen ou Karasoy", () => {
    expect(vazado(JSON.stringify(publicCodex()))).toBe(false);
    expect(vazado(JSON.stringify(HOUSE_CHARACTERS))).toBe(false);
  });
});

describe("fullCodex", () => {
  it("continua guardando o que só o Mestre e a IA podem ver", () => {
    const alic = fullCodex().find((n) => n.id === "alic-valerius");
    const kaelen = fullCodex().find((n) => n.id === "kaelen-drakorys");
    expect(alic?.secrets ?? "").not.toBe("");
    expect(kaelen?.secrets ?? "").toMatch(/Rei Branco/);
  });
});
