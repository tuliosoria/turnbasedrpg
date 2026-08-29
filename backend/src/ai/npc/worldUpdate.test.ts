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

describe("teto de NPCs por turno", () => {
  // Um evento público sem alvo é o pior caso: todo o Codex fica sabendo.
  const turnoQueTodosSabem = () =>
    turn({ publicEvent: "A Marcha do Norte partiu de Asterhall e o reino inteiro comenta." });

  // As defesas que já existiam não limitavam o pior caso: um evento que toca
  // todo mundo virava noventa chamadas de IA numa aplicação de turno.
  it("processa no máximo o teto, mesmo com o Codex inteiro sabendo", async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify({ mood: "m", memory: [] }));
    const deps = makeDeps({ chat, maxNpcs: 3 } as never);
    await updateNpcWorld(deps as never, turnoQueTodosSabem());
    expect(chat.mock.calls.length).toBeLessThanOrEqual(3);
  });

  // Quem soube de mais coisas tem mais o que atualizar; quem soube de uma
  // espera o turno em que for relevante, e nada se perde.
  it("prefere quem soube de mais eventos", async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify({ mood: "m", memory: [] }));
    const deps = makeDeps({ chat, maxNpcs: 1 } as never);
    const r = await updateNpcWorld(deps as never, turnoQueTodosSabem());
    expect(r.candidates).toBeLessThanOrEqual(1);
  });
});

describe("quem entra na fila do estado vivo", () => {
  /** Quem o modelo foi chamado a avaliar, na ordem. */
  const avaliados = (deps: ReturnType<typeof makeDeps>) =>
    (deps.chat as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[1]).slice(0, 200));

  // O bug que motivou a mudança: os eventos de um turno são quase todos
  // PUBLICO, então os 90 do Codex conhecem exatamente os mesmos fatos. O sort
  // por "quantos eventos conhece" comparava iguais com iguais e não decidia
  // nada, e o slice pegava sempre os 20 primeiros na ordem fixa do Codex.
  it("põe quem recebeu carta na frente, mesmo com todos sabendo do mesmo", async () => {
    const deps = makeDeps({
      maxNpcs: 3,
      recentlyContacted: async () => new Set(["casa-rimerberg:capitao-orven-geada"]),
    });
    await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));

    expect(avaliados(deps)[0]).toContain("Orven Geada");
  });

  it("desce quem já foi tocado há pouco", async () => {
    // Os dois primeiros do Codex abriam a fila todo turno. Marcados como
    // processados no turno 9, precisam ceder o lugar a quem está em zero.
    const deps = makeDeps({
      maxNpcs: 2,
      lastTouched: async () =>
        new Map([
          ["casa-auremont:lorde-marcien-auremont", 9],
          ["casa-do-ouro:principe-setimo", 9],
        ]),
    });
    await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));

    const abertura = avaliados(deps).join("\n");
    expect(abertura).not.toContain("Marcien");
    expect(abertura).not.toContain("Sétimo");
  });

  // Sem as deps novas o comportamento tem de continuar válido: o motor roda em
  // qualquer chamador que ainda não as passe.
  it("funciona sem as deps de prioridade", async () => {
    const deps = makeDeps({ maxNpcs: 2 });
    const res = await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));
    expect(res.candidates).toBe(2);
  });

  it("mantém o teto mesmo com o Codex inteiro empatado", async () => {
    const deps = makeDeps({ maxNpcs: 5, recentlyContacted: async () => new Set() });
    const res = await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));
    expect(res.candidates).toBe(5);
  });
});

describe("silêncio do modelo não é decisão do modelo", () => {
  // parseImpact("") devolve { affected: false }, então um estouro de orçamento
  // era indistinguível de "este NPC não mudou". Foi assim que a maioria do
  // Codex ficou sem estado vivo sem ninguém perceber.
  it("conta a resposta vazia em vez de tratá-la como 'não foi afetado'", async () => {
    const deps = makeDeps({ maxNpcs: 3, chat: vi.fn().mockResolvedValue("") });
    const res = await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));

    expect(res.candidates).toBe(3);
    expect(res.vazias).toBe(3);
    expect(res.changed).toBe(0);
    expect(deps.store.size).toBe(0);
  });

  it("um 'não fui afetado' de verdade não conta como vazio", async () => {
    const deps = makeDeps({ maxNpcs: 2, chat: vi.fn().mockResolvedValue(JSON.stringify({ affected: false })) });
    const res = await updateNpcWorld(deps, turn({ publicEvent: "A Coroa declarou lei marcial." }));

    expect(res.vazias).toBe(0);
    expect(res.changed).toBe(0);
  });
});
