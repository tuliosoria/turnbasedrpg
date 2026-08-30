import { describe, it, expect } from "vitest";
import { buildProjectCardPrompt, parseProjectCardProposal, enforceGmTriggers, buildProjectResolutionPrompt, parseProjectResolution } from "./projectPrompts";
import { HttpError } from "../types/domain";
import type { House } from "@ravenloft/content";
import { TABELA_DE_TROCA } from "@ravenloft/content";
import { readFile } from "node:fs/promises";

const house: House = {
  houseId: "casa-a", name: "Casa A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "Lorde", heirName: "", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
  attributes: { riqueza: 3, recursos: 2, soldados: 3, controle: 3 }, createdAt: "", stability: 3,
};

const validJson = JSON.stringify({
  title: "Muralha da Capital", description: "Constrói uma muralha.", publicDescription: "Obras na capital.",
  category: "INFRASTRUCTURE", durationTurns: 4,
  costs: [{ type: "RESOURCES", amount: 2, timing: "ON_START" }],
  requirements: [], risks: ["Custo elevado"], complications: [],
  completionEffects: { attributeChanges: [], favors: [], assets: ["Muralha"], qualitativeEffects: ["+1 defesa"], unlocks: [] },
  targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
  aiBalanceStatus: "BALANCED", aiBalanceExplanation: "Custo coerente com 4 turnos.",
});

describe("projectPrompts", () => {
  it("builds a prompt with system + user containing the request", () => {
    const { system, user } = buildProjectCardPrompt(house, "Canon público", { request: "Quero uma muralha" });
    expect(system).toContain("Valdren");
    expect(user).toContain("Quero uma muralha");
    expect(user).toContain("Casa A");
  });

  it("parses valid AI JSON", () => {
    const p = parseProjectCardProposal(validJson);
    expect(p.title).toBe("Muralha da Capital");
    expect(p.category).toBe("INFRASTRUCTURE");
    expect(p.durationTurns).toBe(4);
  });

  it("throws AI_PARSE on invalid JSON", () => {
    expect(() => parseProjectCardProposal("not json")).toThrow(HttpError);
  });

  it("throws AI_PARSE on bad category", () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), category: "BANANA" });
    expect(() => parseProjectCardProposal(bad)).toThrow(HttpError);
  });

  it("normalizes Portuguese category names to the English enum", () => {
    const pt = JSON.stringify({ ...JSON.parse(validJson), category: "Infraestrutura" });
    expect(parseProjectCardProposal(pt).category).toBe("INFRASTRUCTURE");
    const upper = JSON.stringify({ ...JSON.parse(validJson), category: "INFRAESTRUTURA" });
    expect(parseProjectCardProposal(upper).category).toBe("INFRASTRUCTURE");
    const esp = JSON.stringify({ ...JSON.parse(validJson), category: "Espionagem" });
    expect(parseProjectCardProposal(esp).category).toBe("INTELLIGENCE");
  });

  it("normalizes Portuguese cost types and attributes", () => {
    const j = JSON.stringify({
      ...JSON.parse(validJson),
      costs: [{ type: "Riqueza", amount: 2, timing: "ON_START" }, { type: "Recursos", amount: 1, timing: "ON_START" }],
      completionEffects: { attributeChanges: [{ attribute: "Controle", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const p = parseProjectCardProposal(j);
    expect(p.costs.map((c) => c.type)).toEqual(["WEALTH", "RESOURCES"]);
    expect(p.completionEffects.attributeChanges[0].attribute).toBe("controle");
  });

  it("drops unknown cost types instead of failing", () => {
    const j = JSON.stringify({ ...JSON.parse(validJson), costs: [{ type: "Ouro", amount: 2, timing: "ON_START" }] });
    expect(parseProjectCardProposal(j).costs).toEqual([]);
  });

  it("enforceGmTriggers só força aprovação acima do que a tabela permite", () => {
    // O Mestre tirou o portão do +2 (decisão 1 da spec): a tabela já permite
    // +2 em 4 turnos, então isso passa direto. Só o +3 desce para a mesa dele.
    const dois = parseProjectCardProposal(JSON.stringify({
      ...JSON.parse(validJson),
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    }));
    expect(enforceGmTriggers(dois).requiresGmApproval).toBe(false);

    const tres = parseProjectCardProposal(JSON.stringify({
      ...JSON.parse(validJson),
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 3, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    }));
    expect(enforceGmTriggers(tres).requiresGmApproval).toBe(true);
  });

  it("enforceGmTriggers forces GM approval for duration > 6", () => {
    const p = parseProjectCardProposal(JSON.stringify({ ...JSON.parse(validJson), durationTurns: 7 }));
    expect(enforceGmTriggers(p).requiresGmApproval).toBe(true);
  });
});

describe("buildEnhanceCardPrompt", () => {
  it("refines the player's title and body and enforces character limits", async () => {
    const { buildEnhanceCardPrompt } = await import("./projectPrompts");
    const { system, user } = buildEnhanceCardPrompt(house, "Canon público", {
      title: "A Rede dos Portos",
      body: "Quero criar uma rede secreta entre os portos do sul.",
    });
    expect(system.toLowerCase()).toContain("refine");
    expect(system.toLowerCase()).toMatch(/intenç|objetivo/);
    expect(system).toContain("80");
    expect(system).toContain("500");
    expect(user).toContain("A Rede dos Portos");
    expect(user).toContain("rede secreta entre os portos do sul");
    expect(user).toContain("Casa A");
  });
});

describe("buildProjectCanon", () => {
  const entries = [
    { section: "visao-geral", title: "Valdren", body: "Valdren é um reino-ilha cercado pelas Brumas." },
    { section: "crise-atual", title: "O Inverno dos Mortos", body: "Um inverno sobrenatural ameaça as Casas." },
    { section: "censo", title: "Censo 1", body: "X".repeat(40000) },
    { section: "casas", title: "Casa Ulgar", body: "Os Ulgar são guerreiros errantes." },
  ];

  it("includes the mechanics summary and essential world sections", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon(entries);
    expect(canon.toLowerCase()).toContain("projeto");
    expect(canon).toContain("Valdren é um reino-ilha");
    expect(canon).toContain("O Inverno dos Mortos");
  });

  it("caps total size and drops bulky non-essential sections", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon(entries);
    expect(canon.length).toBeLessThan(9000);
    expect(canon).not.toContain("X".repeat(1000));
  });

  it("works with no wiki entries by still providing the mechanics canon", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon([]);
    expect(canon.toLowerCase()).toContain("projeto");
  });
});

describe("buildProjectResolutionPrompt", () => {
  const project = {
    id: "p1", title: "Fortificar a Fronteira", description: "Erguer defesas na fronteira norte.",
    risks: ["Invasores podem atacar antes das obras terminarem", "Falta de mão de obra"],
    durationTurns: 4,
  } as any;

  it("includes risks, house attributes and the campaign event", () => {
    
    const { system, user } = buildProjectResolutionPrompt(house, project, "Um exército morto-vivo cercou a capital.", "CÂNONE");
    expect(system.toLowerCase()).toMatch(/deu certo|sucesso|falh/);
    expect(user).toContain("Invasores podem atacar");
    expect(user).toContain("Controle");
    expect(user).toContain("morto-vivo cercou a capital");
    expect(user.toLowerCase()).toContain("success");
  });
});

describe("parseProjectResolution", () => {
  it("parses a valid success verdict", () => {
    
    const res = parseProjectResolution(JSON.stringify({ success: true, narrative: "As muralhas resistiram ao cerco." }));
    expect(res.success).toBe(true);
    expect(res.narrative).toContain("muralhas");
  });

  // O formato antigo não nomeava risco nenhum, e é justamente por isso que ele
  // não pode mais reprovar sozinho: era assim que o juiz fracassava tudo.
  it("rebaixa o fracasso antigo, que não aponta risco, para entrega com custo", () => {
    const res = parseProjectResolution(JSON.stringify({ success: false, narrative: "O cerco interrompeu as obras." }));
    expect(res.success).toBe(true);
    expect(res.custo).toBe(true);
    expect(res.narrative).toContain("cerco");
  });

  it("throws AI_PARSE on invalid shape", () => {
    
    expect(() => parseProjectResolution(JSON.stringify({ narrative: "sem success" }))).toThrow(HttpError);
  });

  it("clamps an overly long narrative", () => {
    
    const res = parseProjectResolution(JSON.stringify({ success: true, narrative: "x".repeat(2000) }));
    expect(res.narrative.length).toBeLessThanOrEqual(600);
  });
});

describe("a regra de balanceamento vem da tabela", () => {
  it("o prompt cita cada faixa da tabela", () => {
    const { system } = buildProjectCardPrompt(house, "cânone", { request: "quero um exército" } as never);
    for (const f of TABELA_DE_TROCA) {
      expect(system).toContain(`${f.turnos} turno`);
      expect(system).toContain(f.resumo);
    }
  });

  it("não sobrou nenhuma cópia da regra escrita à mão", async () => {
    // Havia três cópias em prosa neste arquivo, e a terceira discordava das
    // outras duas sobre quantos turnos um ganho de atributo exige.
    const fonte = await readFile(new URL("./projectPrompts.ts", import.meta.url), "utf8");
    expect(fonte).not.toContain("ativo permanente ou +1 atributo");
    expect(fonte).not.toContain("- 4 turnos: ");
  });

  it("o teto que o prompt anuncia bate com o da tabela", () => {
    const { system } = buildProjectCardPrompt(house, "cânone", { request: "quero um exército" } as never);
    const maior = Math.max(...TABELA_DE_TROCA.map((f) => f.atributoPermanenteMax));
    expect(system).toContain(`Nenhuma carta concede mais de +${maior} permanente num atributo`);
  });

  it("exige que toda carta conceda alguma coisa", () => {
    const { system } = buildProjectCardPrompt(house, "cânone", { request: "quero um exército" } as never);
    expect(system).toContain("TODA carta precisa conceder alguma coisa");
  });
});

describe("enforceGmTriggers depois de o Mestre tirar o portão do +2", () => {
  const base = {
    completionEffects: { attributeChanges: [] as { attribute: string; amount: number; permanent: boolean }[], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    costs: [{ type: "WEALTH", amount: 2, timing: "ON_START" }], durationTurns: 4, requiresGmApproval: false,
  };

  it("deixa passar o +2, que a tabela permite em 4 turnos", () => {
    const p = { ...base, completionEffects: { ...base.completionEffects, attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }] } };
    expect(enforceGmTriggers(p as never).requiresGmApproval).toBe(false);
  });

  it("ainda manda para o Mestre o que estoura a tabela", () => {
    const p = { ...base, completionEffects: { ...base.completionEffects, attributeChanges: [{ attribute: "soldados", amount: 3, permanent: true }] } };
    expect(enforceGmTriggers(p as never).requiresGmApproval).toBe(true);
  });
});

describe("o fracasso precisa provar que pode existir", () => {
  const RISCOS = ["retirada de trabalhadores da produção afeta a economia local"];
  const j = (o: Record<string, unknown>) => JSON.stringify(o);

  // Cinco cartas fracassaram seguidas e nenhuma narrativa citou um risco da
  // própria carta: todas citaram o resultado público do turno. Como o resultado
  // público desta campanha é sempre catastrófico, o juiz reprovava tudo.
  it("rebaixa a fracasso sem risco apontado para 'entregou com custo'", () => {
    const r = parseProjectResolution(j({ desfecho: "fracasso", riscoAtivado: null, narrative: "O porto queimou." }), RISCOS);
    expect(r.success).toBe(true);
    expect(r.custo).toBe(true);
  });

  it("rebaixa também quando o risco apontado não é da carta", () => {
    const r = parseProjectResolution(j({ desfecho: "fracasso", riscoAtivado: "o eclipse se aproxima", narrative: "x" }), RISCOS);
    expect(r.success).toBe(true);
  });

  it("aceita o fracasso que aponta um risco declarado", () => {
    const r = parseProjectResolution(j({ desfecho: "fracasso", riscoAtivado: "retirada de trabalhadores da produção", narrative: "x" }), RISCOS);
    expect(r.success).toBe(false);
    expect(r.riscoAtivado).toContain("retirada de trabalhadores");
  });

  // O modelo reescreve pontuação e maiúsculas ao copiar; reprovar por isso
  // transformaria um fracasso legítimo em custo.
  it("perdoa acento e pontuação ao comparar o risco", () => {
    const r = parseProjectResolution(j({ desfecho: "fracasso", riscoAtivado: "RETIRADA DE TRABALHADORES DA PRODUCAO!", narrative: "x" }), RISCOS);
    expect(r.success).toBe(false);
  });

  // Duas narrativas reais usaram a AUSÊNCIA de riscos como motivo de fracasso,
  // que é o contrário do que uma lista vazia significa.
  it("uma carta sem riscos declarados nunca pode fracassar", () => {
    const r = parseProjectResolution(j({ desfecho: "fracasso", riscoAtivado: "qualquer coisa", narrative: "x" }), []);
    expect(r.success).toBe(true);
    expect(r.custo).toBe(true);
  });

  it("sucesso e custo passam direto", () => {
    expect(parseProjectResolution(j({ desfecho: "sucesso", narrative: "x" }), RISCOS)).toMatchObject({ success: true, custo: false });
    expect(parseProjectResolution(j({ desfecho: "custo", narrative: "x" }), RISCOS)).toMatchObject({ success: true, custo: true });
  });

  // O formato antigo continua entrando: há chamada gravada com ele.
  it("entende o formato antigo de success booleano", () => {
    expect(parseProjectResolution(j({ success: true, narrative: "x" }), RISCOS).success).toBe(true);
    expect(parseProjectResolution(j({ success: false, narrative: "x" }), RISCOS).success).toBe(true);
  });
});
