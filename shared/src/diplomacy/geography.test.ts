import { describe, it, expect } from "vitest";
import { SEATS, distanceKm, bandFor, budgetBetween, seatOf, seatKeyForHouseId } from "./geography.js";

import { travelDays } from "./geography.js";

/**
 * As coordenadas são conferidas contra a geografia declarada no atlas, não
 * contra os tempos de viagem: `travelDays` é calibrado a partir daqueles
 * números, então testá-los seria tautológico. O que pode estar errado é onde
 * marquei cada sede no mapa.
 */
describe("posição das sedes confere com a geografia canônica", () => {
  const at = (k: string) => SEATS.find((s) => s.key === k)!;

  it("Rimewatch é a sede mais ao norte", () => {
    // "a última grande fortaleza antes das geleiras"
    const northernmost = [...SEATS].sort((a, b) => a.y - b.y)[0];
    expect(northernmost.key).toBe("casa-rimerberg");
  });

  it("Sahra-Lun fica a leste de Asterhall, no deserto", () => {
    expect(at("casa-solarion").x).toBeGreaterThan(at("casa-valerius").x);
  });

  it("Khar-Durak fica a oeste de Asterhall, na costa", () => {
    expect(at("casa-khazdrun").x).toBeLessThan(at("casa-valerius").x);
  });

  it("Rok'thar é a sede mais a leste, nas Florestas Orientais", () => {
    const easternmost = [...SEATS].sort((a, b) => b.x - a.x)[0];
    expect(easternmost.key).toBe("grande-casa-ulgar");
  });

  it("Akrathos fica ao sul, na ilha de Krythos", () => {
    expect(at("casa-drakorys").y).toBeGreaterThan(at("casa-valerius").y);
  });

  it("Ordu-Yildiz fica entre Aurivale e Sahra-Lun nas planícies do sul", () => {
    expect(at("casa-karasoy").x).toBeGreaterThan(at("casa-auremont").x);
    expect(at("casa-karasoy").x).toBeLessThan(at("casa-solarion").x);
  });
});

describe("tempo de viagem", () => {
  it("reproduz o atlas a partir de Asterhall", () => {
    // Calibrado, portanto exato por construção — o teste existe para travar a
    // calibragem, não para descobri-la.
    expect(travelDays("casa-valerius", "casa-rimerberg")).toBeCloseTo(15, 0);
    expect(travelDays("casa-valerius", "ordem-do-sino")).toBeCloseTo(1.5, 0);
  });

  it("faz Rimewatch cara de alcançar venha a carta de onde vier", () => {
    // O custo é o da ponta mais difícil: a geleira atrasa a carta em qualquer rota.
    expect(travelDays("casa-solarion", "casa-rimerberg")!).toBeGreaterThan(15);
  });

  it("mantém o mar barato: Akrathos está longe em km e perto em dias", () => {
    // O atlas: "4 dias até o porto e 2 de navio". Distância reta engana aqui.
    expect(distanceKm("casa-valerius", "casa-drakorys")!)
      .toBeGreaterThan(distanceKm("casa-valerius", "casa-rimerberg")!);
    expect(travelDays("casa-valerius", "casa-drakorys")!)
      .toBeLessThan(travelDays("casa-valerius", "casa-rimerberg")!);
  });
});

describe("distanceKm", () => {
  it("é simétrica", () => {
    expect(distanceKm("casa-solarion", "casa-karasoy")).toBe(distanceKm("casa-karasoy", "casa-solarion"));
  });

  it("devolve null para uma Casa desconhecida", () => {
    expect(distanceKm("casa-solarion", "casa-inexistente")).toBeNull();
  });

  it("dá zero para a mesma Casa", () => {
    expect(distanceKm("casa-solarion", "casa-solarion")).toBe(0);
  });
});

describe("orçamento por distância", () => {
  it("Solarion e Karasoy são vizinhas o bastante para dois envios", () => {
    // O exemplo dado pelo autor: casas próximas trocam mais correspondência.
    const b = budgetBetween("casa-solarion", "casa-karasoy")!;
    expect(b.sends).toBe(2);
  });

  it("Solarion e Rimewatch ficam a um envio só", () => {
    const b = budgetBetween("casa-solarion", "casa-rimerberg")!;
    expect(b.sends).toBe(1);
    expect(b.band).toBe("EXTREMA");
  });

  it("Rimewatch está mais longe de Solarion do que Karasoy está", () => {
    expect(distanceKm("casa-solarion", "casa-rimerberg")!)
      .toBeGreaterThan(distanceKm("casa-solarion", "casa-karasoy")!);
  });

  it("as faixas cobrem toda a escala sem buraco", () => {
    expect(bandFor(0)).toBe("VIZINHA");
    expect(bandFor(3)).toBe("VIZINHA");
    expect(bandFor(3.1)).toBe("PROXIMA");
    expect(bandFor(8)).toBe("PROXIMA");
    expect(bandFor(14)).toBe("DISTANTE");
    expect(bandFor(9999)).toBe("EXTREMA");
  });

  it("devolve null quando uma das Casas não existe", () => {
    expect(budgetBetween("casa-solarion", "nada")).toBeNull();
  });
});

describe("seatOf", () => {
  it("encontra a sede pelo nome canônico", () => {
    expect(seatOf("casa-karasoy")?.seat).toBe("Ordu-Yildiz");
  });

  it("cobre as dezesseis Casas e ordens", () => {
    expect(SEATS).toHaveLength(16);
  });
});

describe("seatKeyForHouseId", () => {
  it("alcança a sede a partir do id sorteado da Casa do jogador", () => {
    expect(seatKeyForHouseId("solarion-k0hc")).toBe("casa-solarion");
  });

  it("aceita a Casa nomeada com e sem o prefixo Casa", () => {
    expect(seatKeyForHouseId("casa-solarion-ab12")).toBe("casa-solarion");
    expect(seatKeyForHouseId("karasoy-9zzz")).toBe("casa-karasoy");
  });

  // "casa-do-ouro" termina em quatro caracteres legítimos: cortar o sufixo
  // antes de tentar o id inteiro a transformaria em "casa-do" e perderia a sede.
  it("não confunde o fim do nome com o sufixo aleatório", () => {
    expect(seatKeyForHouseId("casa-do-ouro")).toBe("casa-do-ouro");
  });

  it("alcança ordens que não levam o prefixo Casa", () => {
    expect(seatKeyForHouseId("ordem-do-sino-4h2k")).toBe("ordem-do-sino");
  });

  /**
   * O jogador batiza a Casa pelo nome curto ("Ulgar", "Sino"), não pelo título
   * do wiki ("Grande Casa Ulgar", "Ordem do Sino"). Toda sede precisa ser
   * alcançável assim, ou os personagens daquela Casa caem no balde de fora.
   */
  it("alcança as dezesseis sedes a partir do nome curto da Casa", () => {
    const shortNames: Record<string, string> = {
      "casa-valerius": "valerius",
      "casa-rimerberg": "rimerberg",
      "casa-vargen": "vargen",
      "casa-euralune": "euralune",
      "casa-khazdrun": "khazdrun",
      "ordem-do-sino": "sino",
      "grande-casa-ulgar": "ulgar",
      "irmandade-dos-corvos": "corvos",
      "casa-ferrumor": "ferrumor",
      "cla-mandibula-de-osso": "mandibula-de-osso",
      "ordem-dos-tres": "tres",
      "casa-auremont": "auremont",
      "casa-karasoy": "karasoy",
      "casa-solarion": "solarion",
      "casa-do-ouro": "ouro",
      "casa-drakorys": "drakorys",
    };
    for (const seat of SEATS) {
      expect(seatKeyForHouseId(`${shortNames[seat.key]}-k0hc`)).toBe(seat.key);
    }
  });

  // Entidades publicadas antes da correção guardam o nome da Casa no lugar do
  // id, porque o campo vinha da IA em vez da sessão de quem enviou.
  it("aceita o nome da Casa onde se esperava o id", () => {
    expect(seatKeyForHouseId("Solarion")).toBe("casa-solarion");
    expect(seatKeyForHouseId("Do Ouro")).toBe("casa-do-ouro");
    expect(seatKeyForHouseId("Mandíbula de Osso")).toBe("cla-mandibula-de-osso");
  });

  it("devolve null quando a Casa não corresponde a nenhuma sede", () => {
    expect(seatKeyForHouseId("casa-inventada-zzzz")).toBeNull();
    expect(seatKeyForHouseId("")).toBeNull();
  });
});
