import { describe, expect, it, vi } from "vitest";
import { emptyDynamic, type NpcDynamic, type Turn } from "@ravenloft/content";
import { updateNpcWorld } from "./worldUpdate";

function turn(over: Partial<Turn>): Turn {
  return { turnId: 4, status: "RESOLVED", publicEvent: "", privateInfo: {}, ...over } as Turn;
}

function makeDeps(over: Partial<Parameters<typeof updateNpcWorld>[0]> = {}) {
  const store = new Map<string, NpcDynamic>();
  return {
    store,
    chat: vi.fn().mockResolvedValue(JSON.stringify({ affected: true, relationshipChanges: { "casa-valerius": { trust: -30 } }, newMemory: "O rei atacou." })),
    getDynamic: async (aff: string, id: string) => store.get(`${aff}#${id}`) ?? emptyDynamic(aff, id),
    putDynamic: async (d: NpcDynamic) => { store.set(`${d.affiliation}#${d.id}`, d); },
    houseKeyOf: (hid: string) => (hid === "eur-1" ? "casa-euralune" : null),
    now: () => "t",
    ...over,
  };
}

describe("updateNpcWorld", () => {
  it("não faz nada quando o turno não tem eventos", async () => {
    const deps = makeDeps();
    const res = await updateNpcWorld(deps, turn({ publicEvent: "" }));
    expect(res.candidates).toBe(0);
    expect(deps.chat).not.toHaveBeenCalled();
  });

  // Um evento público alcança todo mundo, então todos são candidatos; o modelo
  // decide quem de fato muda.
  it("seleciona candidatos e grava os que o modelo diz terem mudado", async () => {
    const deps = makeDeps();
    const res = await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));
    expect(res.candidates).toBeGreaterThan(0);
    expect(res.changed).toBeGreaterThan(0);
    // Gravou o dynamic com a memória do turno.
    const anyDynamic = [...deps.store.values()][0];
    expect(anyDynamic.memory[0].turnNumber).toBe(4);
  });

  it("não pergunta ao modelo sobre quem não conhece o fato", async () => {
    // Segredo de Euralune: só NPCs de Euralune são candidatos neste turno.
    const deps = makeDeps();
    await updateNpcWorld(deps, turn({ publicEvent: "", privateInfo: { "eur-1": "Preparamos a defesa em segredo." } }));
    // Todos os candidatos consultados são de casa-euralune.
    const chatMock = deps.chat as ReturnType<typeof vi.fn>;
    const consultedPrompts = chatMock.mock.calls.map((c: unknown[]) => c[1] as string);
    expect(consultedPrompts.every((u) => u.includes("casa-euralune"))).toBe(true);
  });

  it("não reprocessa um NPC que já tem memória deste turno", async () => {
    const deps = makeDeps();
    // Pré-carrega um NPC como já processado no turno 4.
    const seeded = { ...emptyDynamic("casa-valerius", "lady-celene-valerius"), memory: [{ turnNumber: 4, description: "já", impact: "" }] };
    deps.store.set("casa-valerius#lady-celene-valerius", seeded);

    await updateNpcWorld(deps, turn({ publicEvent: "Evento público." }));
    // Esse NPC específico não foi reconsultado (o user prompt não o nomeia de novo para gravar).
    const stillOne = deps.store.get("casa-valerius#lady-celene-valerius")!;
    expect(stillOne.memory).toHaveLength(1);
  });

  it("uma falha do modelo num NPC não derruba os outros", async () => {
    const deps = makeDeps({
      chat: vi.fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue(JSON.stringify({ affected: true, relationshipChanges: { "casa-valerius": { trust: -5 } } })),
    });
    const res = await updateNpcWorld(deps, turn({ publicEvent: "Evento público." }));
    expect(res.changed).toBeGreaterThan(0);
  });
});
