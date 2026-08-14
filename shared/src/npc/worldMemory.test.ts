import { describe, expect, it } from "vitest";
import { deriveWorldEvents, inAudience, npcKnows, type WorldEvent } from "./worldMemory.js";

const gnomo = { affiliation: "casa-euralune", id: "brannic-euralune" };
const sacerdote = { affiliation: "ordem-do-sino", id: "edras-fulgrim" };

function event(over: Partial<WorldEvent>): WorldEvent {
  return { id: "e", turnNumber: 4, description: "", visibility: "PUBLICO", propagation: "IMEDIATO", ...over };
}

describe("npcKnows", () => {
  // O núcleo: um segredo do GM nunca vira conhecimento de NPC.
  it("nunca revela um segredo do GM", () => {
    const e = event({ visibility: "GM", propagation: "IMEDIATO" });
    expect(npcKnows(gnomo, e, 999)).toBe(false);
  });

  it("dá conhecimento público imediato a todos no turno", () => {
    const e = event({ visibility: "PUBLICO", propagation: "IMEDIATO" });
    expect(npcKnows(gnomo, e, 4)).toBe(true);
    expect(npcKnows(sacerdote, e, 4)).toBe(true);
  });

  it("não deixa ninguém saber antes do turno em que o fato acontece", () => {
    expect(npcKnows(gnomo, event({ turnNumber: 5 }), 4)).toBe(false);
  });

  // O exemplo da spec: Alic ataca Ninho Alto em segredo dos gnomos.
  it("o círculo interno sabe na hora; os de fora só depois da propagação", () => {
    const ataque = event({ visibility: "CASA:casa-euralune", propagation: "MENSAGEIROS", turnNumber: 4 });

    // Os gnomos sabem no mesmo turno.
    expect(npcKnows(gnomo, ataque, 4)).toBe(true);
    // O sacerdote de fora ainda não, no turno do ataque.
    expect(npcKnows(sacerdote, ataque, 4)).toBe(false);
    // Mas sabe um turno depois, quando os mensageiros chegam.
    expect(npcKnows(sacerdote, ataque, 5)).toBe(true);
  });

  it("um fato desconhecido nunca vaza para fora do círculo", () => {
    const segredo = event({ visibility: "CASA:casa-euralune", propagation: "DESCONHECIDO" });
    expect(npcKnows(gnomo, segredo, 999)).toBe(true); // o próprio círculo sabe
    expect(npcKnows(sacerdote, segredo, 999)).toBe(false); // ninguém de fora, jamais
  });

  it("rumor demora mais que mensageiros", () => {
    const rumor = event({ visibility: "CASA:casa-euralune", propagation: "RUMOR", turnNumber: 4 });
    expect(npcKnows(sacerdote, rumor, 5)).toBe(false); // 1 turno não basta
    expect(npcKnows(sacerdote, rumor, 6)).toBe(true); // 2 turnos, sim
  });

  it("um fato dirigido a um NPC só é conhecido por ele (até vazar)", () => {
    const carta = event({ visibility: "NPC:brannic-euralune", propagation: "DESCONHECIDO" });
    expect(npcKnows(gnomo, carta, 999)).toBe(true);
    expect(npcKnows(sacerdote, carta, 999)).toBe(false);
  });
});

describe("deriveWorldEvents", () => {
  const houseKeyOf = (id: string) => (id === "eur-1" ? "casa-euralune" : null);

  it("faz o evento público virar um fato público imediato", () => {
    const events = deriveWorldEvents({ turnId: 4, publicEvent: "Os sinos de Asterhall tocaram." }, houseKeyOf);
    expect(events).toHaveLength(1);
    expect(events[0].visibility).toBe("PUBLICO");
    expect(events[0].propagation).toBe("IMEDIATO");
  });

  it("faz a info privada de uma Casa virar segredo dela, que vaza por mensageiros", () => {
    const events = deriveWorldEvents({ turnId: 4, privateInfo: { "eur-1": "Preparamos a defesa em segredo." } }, houseKeyOf);
    const priv = events.find((e) => e.visibility === "CASA:casa-euralune");
    expect(priv).toBeDefined();
    expect(priv?.propagation).toBe("MENSAGEIROS");
  });

  it("traz o resultado e as descobertas da resolução", () => {
    const events = deriveWorldEvents(
      { turnId: 4, result: { publicResult: "Ninho Alto resistiu.", discoveries: ["Uma rota secreta foi revelada."] } },
      houseKeyOf,
    );
    expect(events.some((e) => e.description.includes("resistiu"))).toBe(true);
    expect(events.some((e) => e.description.includes("rota secreta") && e.propagation === "RUMOR")).toBe(true);
  });
});

describe("inAudience", () => {
  it("casa e organização casam pela afiliação", () => {
    expect(inAudience(gnomo, "CASA:casa-euralune")).toBe(true);
    expect(inAudience(gnomo, "CASA:casa-solarion")).toBe(false);
    expect(inAudience(sacerdote, "ORG:ordem-do-sino")).toBe(true);
  });

  it("público inclui todos, GM não inclui NPC nenhum", () => {
    expect(inAudience(gnomo, "PUBLICO")).toBe(true);
    expect(inAudience(gnomo, "GM")).toBe(false);
  });
});
