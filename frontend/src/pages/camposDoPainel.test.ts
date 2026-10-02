import { describe, it, expect } from "vitest";
import type { TurnResult } from "@ravenloft/content";
import type { AdminDashboard } from "../types/api";
import { chaveDaResolucao, copiaInicial, preservarBiblia, preservarCampos, type CamposEditaveis } from "./camposDoPainel";

const vazio: CamposEditaveis = {
  publicEvent: "",
  privateInfo: {},
  resolution: null,
  discoveriesText: "",
  worldLore: "",
  worldVisualDirectives: "",
};

function painel(over: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    pendencias: { projetos: 0, canonico: 0, espioes: 0, rascunho: 0, porto: 0, resolucao: 0 },
    turnId: 2,
    turnStatus: "DRAFT",
    publicEvent: "",
    privateInfo: {},
    result: null,
    houses: [],
    submissions: [],
    ...over,
  };
}

const resolucao = (publicResult: string): TurnResult => ({
  publicResult,
  houseResults: {},
  attributeDeltas: {},
  discoveries: [],
});

describe("preservarCampos", () => {
  it("mantém o que diverge da última cópia e atualiza o que não foi editado", () => {
    const carregado = {
      ...copiaInicial(),
      turnId: 2,
      turnStatus: "DRAFT" as const,
      publicEvent: "Evento do servidor.",
      privateInfo: { "house-1": "Sussurro antigo." },
    };
    const atual: CamposEditaveis = {
      ...vazio,
      publicEvent: "Evento que eu digitei.",
      privateInfo: { "house-1": "Sussurro antigo." },
    };
    const applied = preservarCampos(atual, carregado, painel({
      publicEvent: "Evento que o refresh traria.",
      privateInfo: { "house-1": "Sussurro novo." },
      pendencias: { projetos: 0, canonico: 0, espioes: 0, rascunho: 0, porto: 0, resolucao: 0 },
    }));
    expect(applied.campos.publicEvent).toBe("Evento que eu digitei.");
    expect(applied.campos.privateInfo["house-1"]).toBe("Sussurro novo.");
  });

  it("turno novo substitui inclusive o texto digitado", () => {
    const carregado = { ...copiaInicial(), turnId: 2, turnStatus: "LOCKED" as const, publicEvent: "Velho." };
    const atual = { ...vazio, publicEvent: "Ainda estou escrevendo." };
    const applied = preservarCampos(atual, carregado, painel({
      turnId: 3,
      turnStatus: "DRAFT",
      publicEvent: "O turno seguinte.",
    }));
    expect(applied.campos.publicEvent).toBe("O turno seguinte.");
  });

  it("mantém a resolução digitada no mesmo turno", () => {
    const local = resolucao("Resultado local.");
    const carregado = {
      ...copiaInicial(),
      turnId: 2,
      turnStatus: "LOCKED" as const,
      resolutionKey: chaveDaResolucao(resolucao("Fim.")),
    };
    const atual = { ...vazio, resolution: local };
    const applied = preservarCampos(atual, carregado, painel({
      turnStatus: "LOCKED",
      result: resolucao("Resultado do servidor."),
    }));
    expect(applied.campos.resolution?.publicResult).toBe("Resultado local.");
  });
});

describe("preservarBiblia", () => {
  it("a primeira carga entra, e o que foi digitado depois fica", () => {
    const primeira = preservarBiblia(vazio, copiaInicial(), "Cânone antigo.", "estilo");
    expect(primeira.worldLore).toBe("Cânone antigo.");
    const digitado = { worldLore: "Lore que eu escrevi.", worldVisualDirectives: "estilo" };
    const segunda = preservarBiblia(digitado, primeira.carregado, "Cânone novo.", "outro estilo");
    expect(segunda.worldLore).toBe("Lore que eu escrevi.");
    expect(segunda.worldVisualDirectives).toBe("outro estilo");
  });
});
