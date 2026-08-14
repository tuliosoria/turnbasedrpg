import { describe, expect, it } from "vitest";
import { emptyDynamic, type NpcDynamic } from "@ravenloft/content";
import { buildRoleplayBlock } from "./roleplay";

function dynamicWith(over: Partial<NpcDynamic>): NpcDynamic {
  return { ...emptyDynamic("ordem-dos-tres", "arquimago-azul"), ...over };
}

describe("buildRoleplayBlock", () => {
  it("reconstrói humor, objetivo e memórias — não só a última mensagem", () => {
    const d = dynamicWith({
      mood: "preocupado",
      objective: "descobrir se a mobilização de Alic ameaça a Ordem",
      memory: [
        { turnNumber: 3, description: "Solarion ajudou a Ordem.", impact: "+confiança" },
        { turnNumber: 11, description: "Solarion alertou sobre uma conspiração.", impact: "+confiança" },
      ],
    });
    const block = buildRoleplayBlock({ dynamic: d, fromHouseKey: "casa-solarion", fromHouseName: "Casa Solarion" });
    expect(block).toMatch(/humor agora: preocupado/);
    expect(block).toMatch(/objetivo imediato/);
    expect(block).toMatch(/Solarion alertou sobre uma conspiração/);
  });

  // A relação injetada é só a de quem escreve, com dimensões e resumo.
  it("descreve a relação com quem escreve, não com outros", () => {
    const d = dynamicWith({
      relations: {
        "casa-solarion": { trust: 72, respect: 81, fear: 12, resentment: 8, obligation: 20, summary: "Casa intelectualmente sofisticada." },
        "casa-do-ouro": { trust: 20, respect: 30, fear: 40, resentment: 70, obligation: 5, summary: "Só pensa em crédito." },
      },
    });
    const block = buildRoleplayBlock({ dynamic: d, fromHouseKey: "casa-solarion", fromHouseName: "Casa Solarion" });
    expect(block).toMatch(/intelectualmente sofisticada/);
    expect(block).toMatch(/confia|respeita/);
    // Não vaza a leitura da Casa do Ouro.
    expect(block).not.toMatch(/crédito/);
  });

  it("fica vazio quando não há nada vivo ainda", () => {
    expect(buildRoleplayBlock({ dynamic: emptyDynamic("a", "b"), fromHouseKey: "casa-solarion", fromHouseName: "Casa Solarion" })).toBe("");
  });
});
