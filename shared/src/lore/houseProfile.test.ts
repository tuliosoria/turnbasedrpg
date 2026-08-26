import { describe, expect, it } from "vitest";
import { SEATS } from "../diplomacy/geography.js";
import { HOUSE_PROFILE, houseProfileFor } from "./houseProfile.js";

describe("HOUSE_PROFILE", () => {
  it("cobre as dezesseis potências, sem sobra nem falta", () => {
    expect(Object.keys(HOUSE_PROFILE).sort()).toEqual(SEATS.map((s) => s.key).sort());
  });

  it("explica os quatro atributos de cada Casa", () => {
    for (const [key, p] of Object.entries(HOUSE_PROFILE)) {
      for (const campo of ["wealth", "resources", "soldiers", "control"] as const) {
        expect(p[campo].trim(), `${key}.${campo}`).not.toBe("");
      }
    }
  });

  // A escassez é o que obriga uma Casa a negociar com quem ela detesta. Se
  // ninguém precisa de nada, a mesa política morre.
  it("declara escassez em pelo menos metade das Casas", () => {
    const comFalta = Object.values(HOUSE_PROFILE).filter((p) => /falta|depende|não produz|escass|contad/i.test(p.resources));
    expect(comFalta.length).toBeGreaterThanOrEqual(8);
  });

  it("devolve null para uma sede desconhecida", () => {
    expect(houseProfileFor("casa-inventada")).toBeNull();
    expect(houseProfileFor("casa-khazdrun")).not.toBeNull();
  });
});
