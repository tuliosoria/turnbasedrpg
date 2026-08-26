import { describe, expect, it } from "vitest";
import {
  RELATION_DEFAULT,
  clampRelationValue,
  describeRelation,
  emptyHouseRelation,
  levelOf,
  relationKey,
} from "./houseRelations.js";

describe("levelOf", () => {
  it("parte a escala em três faixas, com o meio largo o bastante para existir", () => {
    expect(levelOf(0)).toBe("RUIM");
    expect(levelOf(33)).toBe("RUIM");
    expect(levelOf(34)).toBe("MEDIO");
    expect(levelOf(66)).toBe("MEDIO");
    expect(levelOf(67)).toBe("BOM");
    expect(levelOf(100)).toBe("BOM");
  });

  it("põe o padrão no meio: quem nunca foi tocado não é amigo nem inimigo", () => {
    expect(levelOf(RELATION_DEFAULT)).toBe("MEDIO");
  });
});

describe("clampRelationValue", () => {
  it("prende aos limites em vez de recusar", () => {
    expect(clampRelationValue(-40)).toBe(0);
    expect(clampRelationValue(180)).toBe(100);
    expect(clampRelationValue(70.6)).toBe(71);
  });

  it("cai no padrão quando o valor não é número", () => {
    expect(clampRelationValue("bom")).toBe(RELATION_DEFAULT);
    expect(clampRelationValue(undefined)).toBe(RELATION_DEFAULT);
    expect(clampRelationValue(NaN)).toBe(RELATION_DEFAULT);
  });
});

describe("describeRelation", () => {
  it("concorda em gênero com cada eixo", () => {
    const r = emptyHouseRelation("casa-do-ouro", "casa-khazdrun");
    r.amizade = 80;
    r.comercio = 10;
    expect(describeRelation(r)).toBe("amizade boa, comércio ruim, favores médio.");
  });

  it("junta a nota do Mestre, que é o porquê que a IA vai ler", () => {
    const r = emptyHouseRelation("a", "b");
    r.note = "  Devem grão desde o cerco.  ";
    expect(describeRelation(r)).toBe("amizade média, comércio médio, favores médio. Devem grão desde o cerco.");
  });
});

describe("direção", () => {
  // A assimetria é o ponto: quem corteja e quem desconfia são posições
  // diferentes, e é daí que sai a política.
  it("distingue os dois lados do mesmo par", () => {
    expect(relationKey("a", "b")).not.toBe(relationKey("b", "a"));
    const ida = emptyHouseRelation("a", "b");
    ida.amizade = 90;
    const volta = emptyHouseRelation("b", "a");
    volta.amizade = 10;
    expect(levelOf(ida.amizade)).toBe("BOM");
    expect(levelOf(volta.amizade)).toBe("RUIM");
  });
});
