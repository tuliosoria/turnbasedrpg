import { describe, expect, it } from "vitest";
import { houseProfileFor, emptyHouseRelation } from "@ravenloft/content";
import { complementaridade, planOutreach, outreachTone, faltas, sobras, type OutreachInput } from "./outreach";

const base: OutreachInput = {
  players: [
    { houseId: "khazdrun-wxey", name: "Khazdrun", seatKey: "casa-khazdrun" },
    { houseId: "solarion-k0hc", name: "Solarion", seatKey: "casa-solarion" },
    { houseId: "do-ouro-g0gg", name: "Do Ouro", seatKey: "casa-do-ouro" },
  ],
  playerSeatKeys: new Set(["casa-khazdrun", "casa-solarion", "casa-do-ouro"]),
  relations: [],
  publicEvent: "",
  lastOrders: {},
  alreadyTalking: new Set(),
  limit: 3,
};

describe("complementaridade", () => {
  // O caso que originou tudo: Ulgar não tem ferro, Khazdrun funde ferro de
  // sobra. É esse encaixe que dá a um NPC motivo para escrever primeiro.
  it("acha o ferro que falta a Ulgar na sobra de Khazdrun", () => {
    const encaixe = complementaridade(houseProfileFor("grande-casa-ulgar"), houseProfileFor("casa-khazdrun"));
    expect(encaixe.join(" ")).toMatch(/ferro/);
  });

  it("não inventa encaixe quando falta a mesma coisa aos dois", () => {
    // Khazdrun não planta trigo; pedir alimento a ela seria o erro clássico.
    const encaixe = complementaridade(houseProfileFor("casa-khazdrun"), houseProfileFor("casa-khazdrun"));
    expect(encaixe).toEqual([]);
  });

  it("devolve vazio sem perfil", () => {
    expect(complementaridade(null, houseProfileFor("casa-khazdrun"))).toEqual([]);
    expect(complementaridade(houseProfileFor("casa-khazdrun"), null)).toEqual([]);
  });
});

describe("planOutreach", () => {
  it("entrega o número pedido de cartas", () => {
    const planos = planOutreach({ ...base, publicEvent: "A Marcha partiu." });
    expect(planos).toHaveLength(3);
  });

  it("nunca faz uma Casa de jogador escrever — quem escreve é NPC", () => {
    const planos = planOutreach({ ...base, publicEvent: "A Marcha partiu." });
    for (const p of planos) expect(base.playerSeatKeys.has(p.fromSeatKey)).toBe(false);
  });

  // Três cartas num jogador e nenhuma nos outros faria um abrir o turno com
  // correspondência e os outros com silêncio.
  it("espalha as cartas entre os jogadores", () => {
    const planos = planOutreach({ ...base, publicEvent: "A Marcha partiu." });
    expect(new Set(planos.map((p) => p.toHouseId)).size).toBe(3);
  });

  it("prefere escassez concreta a motivo genérico", () => {
    const planos = planOutreach({ ...base, publicEvent: "A Marcha partiu." });
    expect(planos[0].kind).toBe("ESCASSEZ");
    expect(planos[0].motive).toMatch(/precisa de/);
  });

  it("não escreve para quem já está em conversa viva no turno", () => {
    const planos = planOutreach({
      ...base,
      publicEvent: "A Marcha partiu.",
      alreadyTalking: new Set(base.players.map((p) => `${p.houseId}~grande-casa-ulgar`)),
    });
    expect(planos.every((p) => p.fromSeatKey !== "grande-casa-ulgar")).toBe(true);
  });

  it("sem evento e sem ordens, ainda acha motivo pela escassez", () => {
    const planos = planOutreach(base);
    expect(planos.length).toBeGreaterThan(0);
    expect(planos.every((p) => p.kind === "ESCASSEZ")).toBe(true);
  });
});

describe("outreachTone", () => {
  it("traduz a amizade em conduta, não em rótulo", () => {
    const ruim = { ...emptyHouseRelation("a", "b"), amizade: 5 };
    const bom = { ...emptyHouseRelation("a", "b"), amizade: 95 };
    expect(outreachTone(ruim)).toMatch(/frio/);
    expect(outreachTone(bom)).toMatch(/franqueza/);
    expect(outreachTone(null)).toMatch(/mal se conhecem/);
  });
});

describe("vocabulário de mercadorias", () => {
  // Casar frase com frase não funcionava: "O Vale da Coroa dá grão e o rio dá
  // transporte" virava uma string inteira que nunca batia com "falta ferro".
  it("separa o que a Casa tem do que lhe falta", () => {
    const valerius = houseProfileFor("casa-valerius");
    expect(sobras(valerius)).toContain("grão");
    expect(faltas(valerius)).toEqual(expect.arrayContaining(["ferro", "madeira"]));
  });

  it("não vende o que lhe falta, mesmo citado antes na frase", () => {
    // Khazdrun: "o porto traz peixe e sal. Falta alimento de lavoura".
    const khazdrun = houseProfileFor("casa-khazdrun");
    expect(sobras(khazdrun)).toContain("peixe");
    expect(sobras(khazdrun)).not.toContain("grão");
    expect(faltas(khazdrun)).toContain("grão");
  });

  it("entende escassez escrita sem a palavra falta", () => {
    // Ordem do Sino: "Não produz alimento nem metal."
    expect(faltas(houseProfileFor("ordem-do-sino"))).toEqual(expect.arrayContaining(["grão", "ferro"]));
  });
});

describe("variedade dos remetentes", () => {
  // Três cartas da Coroa no mesmo turno não é o mundo reagindo: é a mesma voz
  // repetida três vezes.
  it("não deixa a mesma Casa escrever duas vezes no turno", () => {
    const planos = planOutreach({ ...base, publicEvent: "A Marcha partiu." });
    expect(new Set(planos.map((p) => p.fromSeatKey)).size).toBe(planos.length);
  });
});
