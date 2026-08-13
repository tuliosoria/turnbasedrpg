import { describe, it, expect } from "vitest";
import type { Turn } from "@ravenloft/content";
import { buildPublicChronicle } from "./chronicle";

function turn(id: number, over: Partial<Turn> = {}): Turn {
  return {
    turnId: id, status: "RESOLVED", publicEvent: `Evento do turno ${id}.`,
    privateInfo: { "casa-solarion": "SEGREDO: a Asteria foi sabotada." },
    createdAt: "", result: { publicResult: `Resultado do turno ${id}.` } as never,
    ...over,
  } as Turn;
}

describe("buildPublicChronicle", () => {
  it("junta evento e resultado de cada turno resolvido", () => {
    const c = buildPublicChronicle([turn(1), turn(2)]);
    expect(c).toMatch(/Turno 1/);
    expect(c).toMatch(/Evento do turno 1/);
    expect(c).toMatch(/Resultado do turno 2/);
  });

  it("NUNCA inclui informação privada de nenhuma Casa", () => {
    // privateInfo é o que cada Casa recebeu em segredo. Uma Casa NPC não pode
    // conhecer o correio privado de outra — isso destruiria arcos inteiros.
    const c = buildPublicChronicle([turn(1), turn(2)]);
    expect(c).not.toMatch(/SEGREDO/);
    expect(c).not.toMatch(/sabotada/);
  });

  it("ignora turnos que ainda não foram resolvidos", () => {
    // O turno corrente entra no prompt separadamente, como "o que está
    // acontecendo agora"; repeti-lo aqui o contaria duas vezes.
    const c = buildPublicChronicle([turn(1), turn(2, { status: "OPEN" })]);
    expect(c).toMatch(/Turno 1/);
    expect(c).not.toMatch(/Turno 2/);
  });

  it("mantém a ordem cronológica", () => {
    const c = buildPublicChronicle([turn(3), turn(1), turn(2)]);
    expect(c.indexOf("Turno 1")).toBeLessThan(c.indexOf("Turno 3"));
  });

  it("corta o passado distante primeiro quando estoura o limite", () => {
    // O turno recente importa mais; truncar o fim deixaria a história parando
    // no meio de uma frase.
    const long = (id: number) => turn(id, { publicEvent: "x".repeat(2000) });
    const c = buildPublicChronicle([long(1), long(2), long(3)], 4500);
    expect(c).toMatch(/Turno 3/);
    expect(c).not.toMatch(/Turno 1/);
  });

  it("devolve vazio quando não há turno resolvido", () => {
    expect(buildPublicChronicle([turn(1, { status: "OPEN" })])).toBe("");
  });

  it("aguenta turno resolvido sem resultado gravado", () => {
    expect(buildPublicChronicle([turn(1, { result: undefined })])).toMatch(/Evento do turno 1/);
  });
});
