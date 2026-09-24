import { describe, expect, it } from "vitest";
import { publicObservations } from "./publicObservation";

const houses = [{ houseId: "khazdrun-wxey", name: "Khazdrun" }, { houseId: "solarion-k0hc", name: "Solarion" }];

describe("reação ao turno anterior", () => {
  it("usa só o resultado público, nunca o resultado privado da Casa", () => {
    const turn = {
      status: "RESOLVED", result: {
        publicResult: "Khazdrun enviou cem homens à Marcha. Solarion manteve a estrada aberta.",
        houseResults: { "khazdrun-wxey": "Khazdrun infiltrou espiões em Ferrum." },
      },
      privateInfo: { "solarion-k0hc": "Solarion prepara um golpe secreto." },
    } as never;
    const result = publicObservations(turn, houses);
    expect(result["khazdrun-wxey"]).toBe("Khazdrun enviou cem homens à Marcha.");
    expect(result["solarion-k0hc"]).toBe("Solarion manteve a estrada aberta.");
    expect(JSON.stringify(result)).not.toMatch(/espiões|golpe secreto/);
  });

  it("não fabrica reação a uma ordem quando o resultado público não cita a Casa", () => {
    expect(publicObservations({ status: "RESOLVED", result: { publicResult: "Asterhall resistiu." } } as never, houses)).toEqual({});
    expect(publicObservations({ status: "OPEN", result: { publicResult: "Khazdrun marcha." } } as never, houses)).toEqual({});
  });
});
