import { describe, it, expect } from "vitest";
import { confiabilidadeDoPorto, briefingsDoPorto, CARTAS_DO_PORTO, TEMPLATE_RUMOR_FALSO } from "./porto";
import type { ProjectCard } from "./projects.js";

function carta(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "c1",
    campaignId: "winter-dead",
    houseId: "solarion-k0hc",
    title: "Rumores do Porto",
    description: "",
    publicDescription: "",
    category: "INTELLIGENCE",
    status: "COMPLETED",
    durationTurns: 1,
    turnsCompleted: 1,
    lastProcessedTurnId: 7,
    costs: [],
    requirements: [],
    completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [],
    complications: [],
    targetHouseId: null,
    requiresTargetApproval: false,
    requiresGmApproval: false,
    aiBalanceStatus: null,
    aiBalanceExplanation: null,
    playerOriginalRequest: null,
    gmNotes: null,
    templateId: "rumores-do-porto-movimentos-de-tropas",
    createdBy: "PLAYER",
    createdAt: "",
    updatedAt: "",
    ...over,
  } as ProjectCard;
}

describe("confiabilidadeDoPorto", () => {
  /**
   * A escala existe porque o Mestre pediu que o Controle mudasse a qualidade da
   * informação. Os três valores reais da partida (Khazdrun 1, Solarion 2, Do
   * Ouro 3) caem em degraus distintos de propósito: a regra se manifesta já no
   * primeiro uso, sem afinação.
   */
  it("sobe em quatro degraus conforme o Controle", () => {
    expect(confiabilidadeDoPorto(0)).toBe("DUVIDOSA");
    expect(confiabilidadeDoPorto(1)).toBe("DUVIDOSA");
    expect(confiabilidadeDoPorto(2)).toBe("PARCIAL");
    expect(confiabilidadeDoPorto(3)).toBe("FIRME");
    expect(confiabilidadeDoPorto(4)).toBe("CERTEIRA");
    expect(confiabilidadeDoPorto(5)).toBe("CERTEIRA");
  });

  it("aguenta valor fora da escala sem quebrar", () => {
    expect(confiabilidadeDoPorto(-3)).toBe("DUVIDOSA");
    expect(confiabilidadeDoPorto(99)).toBe("CERTEIRA");
  });
});

describe("briefingsDoPorto", () => {
  it("descreve a compra concluída no turno pedido", () => {
    const b = briefingsDoPorto([carta()], 7, { "solarion-k0hc": 2 });

    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      houseId: "solarion-k0hc",
      tipo: "MILITAR",
      confiabilidade: "PARCIAL",
      envenenadoPor: null,
    });
  });

  it("ignora carta concluída em outro turno", () => {
    expect(briefingsDoPorto([carta({ lastProcessedTurnId: 6 })], 7, {})).toEqual([]);
  });

  it("ignora carta que ainda não concluiu", () => {
    expect(briefingsDoPorto([carta({ status: "ACTIVE" })], 7, {})).toEqual([]);
  });

  it("ignora carta que não é do Porto", () => {
    expect(briefingsDoPorto([carta({ templateId: "construir-um-aqueduto" })], 7, {})).toEqual([]);
  });

  it("uma Casa que comprou dois tipos recebe dois briefings", () => {
    const b = briefingsDoPorto(
      [
        carta({ id: "c1", templateId: "rumores-do-porto-movimentos-de-tropas" }),
        carta({ id: "c2", templateId: "rumores-do-porto-vozes-do-norte" }),
      ],
      7,
      { "solarion-k0hc": 2 },
    );

    expect(b.map((x) => x.tipo).sort()).toEqual(["BRUMAS", "MILITAR"]);
  });

  /**
   * O detalhe que o Mestre chamou de interessante: uma Casa inimiga planta um
   * rumor falso e a vítima compra mentira achando que comprou verdade.
   */
  it("envenena a compra da vítima quando alguém plantou rumor contra ela", () => {
    const b = briefingsDoPorto(
      [
        carta(),
        carta({
          id: "c2",
          houseId: "do-ouro-g0gg",
          templateId: TEMPLATE_RUMOR_FALSO,
          targetHouseId: "casa-solarion",
        }),
      ],
      7,
      { "solarion-k0hc": 2 },
    );

    const alvo = b.find((x) => x.houseId === "solarion-k0hc");
    expect(alvo?.envenenadoPor).toBe("do-ouro-g0gg");
  });

  /**
   * O veneno é do turno: um rumor plantado há três turnos já passou. Sem isso,
   * uma única carta de veneno envenenaria a vítima para sempre.
   */
  it("rumor plantado em outro turno não envenena", () => {
    const b = briefingsDoPorto(
      [
        carta(),
        carta({
          id: "c2",
          houseId: "do-ouro-g0gg",
          templateId: TEMPLATE_RUMOR_FALSO,
          targetHouseId: "casa-solarion",
          lastProcessedTurnId: 5,
        }),
      ],
      7,
      {},
    );

    expect(b[0].envenenadoPor).toBeNull();
  });

  it("rumor contra outra Casa não atinge quem comprou", () => {
    const b = briefingsDoPorto(
      [
        carta(),
        carta({
          id: "c2",
          houseId: "do-ouro-g0gg",
          templateId: TEMPLATE_RUMOR_FALSO,
          targetHouseId: "casa-khazdrun",
        }),
      ],
      7,
      {},
    );

    expect(b[0].envenenadoPor).toBeNull();
  });

  /**
   * Plantar rumor sem alvo não pode envenenar ninguém — a carta exige alvo, mas
   * um registro antigo ou corrompido não deve derrubar a composição do turno.
   */
  /**
   * Os dois lados falam línguas diferentes: a carta guarda a chave da sede e a
   * Casa guarda o id do banco. Sem normalizar, o veneno nunca pegaria — e o
   * bug seria silencioso, porque a compra chegaria como verdade.
   */
  it("casa a chave da sede com o id do banco de quem comprou", () => {
    const b = briefingsDoPorto(
      [
        carta({ houseId: "do-ouro-g0gg", templateId: "rumores-do-porto-tratos-e-traicoes" }),
        carta({
          id: "c2",
          houseId: "khazdrun-wxey",
          templateId: TEMPLATE_RUMOR_FALSO,
          targetHouseId: "casa-do-ouro",
        }),
      ],
      7,
      {},
    );

    expect(b[0].envenenadoPor).toBe("khazdrun-wxey");
  });

  it("rumor sem alvo não envenena ninguém", () => {
    const b = briefingsDoPorto(
      [carta(), carta({ id: "c2", templateId: TEMPLATE_RUMOR_FALSO, targetHouseId: null })],
      7,
      {},
    );

    expect(b[0].envenenadoPor).toBeNull();
  });

  it("Casa sem Controle conhecido cai no degrau mais baixo", () => {
    expect(briefingsDoPorto([carta()], 7, {})[0].confiabilidade).toBe("DUVIDOSA");
  });
});

describe("o catálogo do Porto", () => {
  it("cobre os quatro tipos que o Mestre pediu", () => {
    expect(Object.values(CARTAS_DO_PORTO).sort()).toEqual(["BRUMAS", "COMERCIAL", "MILITAR", "POLITICA"]);
  });
});
