import { describe, expect, it } from "vitest";
import type { Turn } from "@ravenloft/content";
import { buildHouseSituation } from "./situation";

function turn(over: Partial<Turn>): Turn {
  return {
    turnId: 1,
    status: "RESOLVED",
    publicEvent: "",
    privateInfo: {},
    ...over,
  } as Turn;
}

describe("buildHouseSituation", () => {
  it("pega a fatia do evento público que menciona a Casa", () => {
    const turns = [
      turn({ turnId: 4, publicEvent: "A Casa do Ouro rompeu com a Coroa de Alic. Karasoy enviou tropas." }),
    ];
    const s = buildHouseSituation({ houseName: "Casa do Ouro", turns });
    expect(s).toMatch(/rompeu com a Coroa/);
    // Não arrasta a frase que é de outra Casa.
    expect(s).not.toMatch(/Karasoy enviou tropas/);
  });

  it("inclui descobertas e resultado público que citam a Casa", () => {
    const turns = [
      turn({
        turnId: 4,
        publicEvent: "",
        result: {
          publicResult: "Ferrumor perdeu dois navios na travessia.",
          houseResults: {},
          attributeDeltas: {},
          discoveries: ["Um estaleiro secreto de Ferrumor foi revelado."],
        },
      }),
    ];
    const s = buildHouseSituation({ houseName: "Casa Ferrumor", turns });
    expect(s).toMatch(/perdeu dois navios/);
    expect(s).toMatch(/estaleiro secreto/);
  });

  it("dá vazio quando nada do turno menciona a Casa", () => {
    const turns = [turn({ turnId: 4, publicEvent: "A neve fechou os portões de Asterhall." })];
    expect(buildHouseSituation({ houseName: "Casa Euralune", turns })).toBe("");
  });

  // As três Casas de jogador sabem o que a info privada lhes diz.
  it("junta a info privada e o resultado privado quando é Casa de jogador", () => {
    const turns = [
      turn({
        turnId: 4,
        publicEvent: "",
        privateInfo: { "ouro-123": "Vocês decidiram, em segredo, financiar a rebelião." },
        result: { publicResult: "", houseResults: { "ouro-123": "Seu ouro chegou aos rebeldes." }, attributeDeltas: {}, discoveries: [] },
      }),
    ];
    const s = buildHouseSituation({ houseName: "Casa do Ouro", turns, houseId: "ouro-123" });
    expect(s).toMatch(/financiar a rebelião/);
    expect(s).toMatch(/chegou aos rebeldes/);
  });

  it("não repete a mesma linha que aparece em evento e resolução", () => {
    const turns = [
      turn({ turnId: 4, publicEvent: "Karasoy marchou para o norte.", result: { publicResult: "Karasoy marchou para o norte.", houseResults: {}, attributeDeltas: {}, discoveries: [] } }),
    ];
    const s = buildHouseSituation({ houseName: "Casa Karasoy", turns });
    expect(s.match(/marchou para o norte/g)?.length).toBe(1);
  });
});
