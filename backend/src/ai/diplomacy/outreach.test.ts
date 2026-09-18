import { describe, expect, it } from "vitest";
import { houseProfileFor, emptyHouseRelation } from "@ravenloft/content";
import { complementaridade, planOutreach, outreachTone, faltas, sobras, type OutreachInput } from "./outreach";
import { ladoNaGuerra } from "./lados";

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

  it("prefere o evento à despensa quando o reino está acontecendo", () => {
    const planos = planOutreach({ ...base, publicEvent: "Asterhall está sob ataque e o sol não nasce." });
    expect(planos.every((p) => p.kind === "EVENTO")).toBe(true);
    expect(planos.some((p) => /propondo a troca/.test(p.motive))).toBe(false);
  });

  // A carta que o Mestre reprovou. A falta de tecido é real e continua valendo
  // como motivo; o que não pode voltar é ela virar proposta de comboio enquanto
  // Asterhall queima.
  it("em guerra, a falta do Clã vira pedido de socorro e não proposta de troca", () => {
    const planos = planOutreach({
      ...base,
      publicEvent: "Asterhall está sob ataque. Mortos caminham na neve. O sol não nasce.",
      limit: 9,
    });
    const paraSolarion = planos.filter((p) => p.toHouseId === "solarion-k0hc");
    expect(paraSolarion[0].kind).toBe("EVENTO");

    const escassez = paraSolarion.filter((p) => p.kind === "ESCASSEZ");
    for (const p of escassez) {
      expect(p.motive).not.toMatch(/propondo a troca/);
      expect(p.motive).toMatch(/não é negócio de estação/);
      expect(p.motive).toMatch(/Nada de tabela de entrega/);
    }
  });

  // Uma carta por turno é um conhecido mandando notícia, não um reino em
  // guerra. Três, e vindas de ângulos diferentes.
  it("dá três cartas a cada jogador, de remetentes diferentes", () => {
    const planos = planOutreach({
      ...base,
      publicEvent: "Asterhall está sob ataque.",
      lastOrders: { "solarion-k0hc": "Mandamos batedores ao Vau Negro." },
      limit: 9,
    });
    expect(planos).toHaveLength(9);
    for (const player of base.players) {
      expect(planos.filter((p) => p.toHouseId === player.houseId)).toHaveLength(3);
    }
    expect(new Set(planos.map((p) => p.fromSeatKey)).size).toBe(9);
  });

  // Três cartas do mesmo tipo são três vezes a mesma carta, com brasões
  // diferentes — o formulário de novo, agora no nível do turno.
  it("dá a carta escassa a quem é dela, em vez de deixá-la ser consumida", () => {
    const planos = planOutreach({
      ...base,
      publicEvent: "Asterhall está sob ataque.",
      lastOrders: { "solarion-k0hc": "Mandamos batedores ao Vau Negro." },
      relations: [{ ...emptyHouseRelation("casa-vargen", "solarion-k0hc") }],
      limit: 9,
    });
    // Só Vargen tem motivo para reagir à ordem de Solarion. Varrendo a lista de
    // uma vez, Vargen ia embora escrevendo a Khazdrun sobre o cerco — coisa que
    // qualquer uma das onze sedes poderia ter escrito — e a carta que só existia
    // para Solarion se perdia.
    const deSolarion = planos.filter((p) => p.toHouseId === "solarion-k0hc");
    expect(deSolarion.map((p) => p.kind)).toContain("ORDEM");
    expect(deSolarion.find((p) => p.kind === "ORDEM")?.fromSeatKey).toBe("casa-vargen");
  });

  // Uma caixa com três Casas leais à Coroa pedindo a mesma coisa não é um reino
  // em guerra: é a mesma carta três vezes.
  it("espalha as cartas de cada jogador por lados diferentes da guerra", () => {
    const planos = planOutreach({ ...base, publicEvent: "Asterhall está sob ataque.", limit: 9 });
    for (const player of base.players) {
      const lados = planos
        .filter((p) => p.toHouseId === player.houseId)
        .map((p) => ladoNaGuerra(p.fromSeatKey));
      expect(new Set(lados).size).toBe(3);
    }
  });

  // Antes a lista ordenada era varrida de uma vez: as primeiras sedes enchiam a
  // caixa do primeiro jogador, e as últimas sempre escreviam ao último.
  it("não deixa as mesmas sedes escrevendo sempre ao mesmo jogador", () => {
    const planos = planOutreach({ ...base, publicEvent: "Asterhall está sob ataque.", limit: 9 });
    const primeiraSede = planos.filter((p) => p.fromSeatKey === "casa-vargen");
    expect(primeiraSede).toHaveLength(1);
    expect(primeiraSede[0].toHouseId).toBe("khazdrun-wxey");
    // e o jogador seguinte não recebe a sede seguinte da lista por arrasto
    expect(planos.filter((p) => p.toHouseId === "solarion-k0hc")[0].fromSeatKey).not.toBe("casa-vargen");
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

  it("sem evento, a despensa ainda dá motivo: Mandíbula pede tecido a Solarion", () => {
    const planos = planOutreach({
      ...base,
      players: [{ houseId: "solarion-k0hc", name: "Solarion", seatKey: "casa-solarion" }],
      playerSeatKeys: new Set(["casa-solarion"]),
      publicEvent: "",
      limit: 20,
    });
    const m = planos.find((p) => p.fromSeatKey === "cla-mandibula-de-osso");
    expect(m?.kind).toBe("ESCASSEZ");
    expect(m?.motive).toMatch(/tecido/);
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
