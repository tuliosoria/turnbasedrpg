import { describe, expect, it, vi } from "vitest";
import { OUTREACH_DEADLINE_MS, sendOutreach, type OutreachDeps } from "./sendOutreach";

function deps(over: Partial<OutreachDeps> = {}): OutreachDeps {
  return {
    chat: vi.fn().mockResolvedValue(JSON.stringify({
      carta: "Patriarca, propomos quarenta barras de ferro de forja por sessenta sacas de grão, em doze carroças. — Chancelaria",
      oferta: "quarenta barras de ferro de forja",
      pedido: "sessenta sacas de grão, em doze carroças",
    })),
    putFavor: vi.fn().mockResolvedValue(undefined),
    houses: [
      { houseId: "khazdrun-wxey", name: "Khazdrun" },
      { houseId: "solarion-k0hc", name: "Solarion" },
      { houseId: "do-ouro-g0gg", name: "Do Ouro" },
    ],
    relations: [],
    publicEvent: "A Marcha do Norte partiu.",
    publicObservations: {},
    alreadyTalking: new Set(),
    turnNumber: 7,
    campaignId: "winter-dead",
    putMessage: vi.fn().mockResolvedValue(undefined),
    newId: (() => { let n = 0; return () => `out-${++n}`; })(),
    ...over,
  };
}

describe("sendOutreach", () => {
  // Três por jogador, e não três no turno inteiro: uma carta por Casa era um
  // conhecido mandando notícia, não um reino em guerra.
  it("manda três cartas a cada jogador quando o turno abre", async () => {
    const d = deps();
    const enviadas = await sendOutreach(d);
    expect(enviadas).toHaveLength(9);
    expect(d.putMessage).toHaveBeenCalledTimes(9);
    for (const houseId of ["khazdrun-wxey", "solarion-k0hc", "do-ouro-g0gg"]) {
      expect(enviadas.filter((m) => m.fromHouseId === houseId)).toHaveLength(3);
    }
  });

  // O fio é indexado por (Casa do jogador, Casa NPC). Guardar ao contrário
  // esconderia a carta do jogador, que é o único ponto do recurso.
  it("grava no fio onde o jogador já procura correspondência", async () => {
    const enviadas = await sendOutreach(deps());
    for (const m of enviadas) {
      expect(["khazdrun-wxey", "solarion-k0hc", "do-ouro-g0gg"]).toContain(m.fromHouseId);
      expect(m.author).toBe("AI");
      expect(m.turnNumber).toBe(7);
    }
  });

  it("não escreve nada sem IA configurada", async () => {
    const d = deps({ chat: undefined });
    expect(await sendOutreach(d)).toEqual([]);
    expect(d.putMessage).not.toHaveBeenCalled();
  });

  // Uma carta que falha não pode levar as outras junto, e nenhuma delas pode
  // derrubar a abertura do turno.
  it("segue em frente quando o modelo falha numa carta", async () => {
    let n = 0;
    const chat = vi.fn().mockImplementation(async () => {
      if (++n === 1) throw new Error("timeout");
      return JSON.stringify({ carta: "Proposta concreta de trezentas toneladas, entregues até o degelo. — Chancelaria", oferta: "madeira", pedido: "ferro" });
    });
    const enviadas = await sendOutreach(deps({ chat }));
    expect(enviadas).toHaveLength(8);
  });

  it("descarta resposta curta demais para ser carta", async () => {
    const enviadas = await sendOutreach(deps({ chat: vi.fn().mockResolvedValue(JSON.stringify({ carta: "ok", oferta: "x", pedido: "y" })) }));
    expect(enviadas).toEqual([]);
  });

  it("dá 4000 tokens ao escritor — raciocínio alto sai do mesmo orçamento", async () => {
    const d = deps();
    await sendOutreach(d);
    const caps = (d.chat as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[3]);
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((n) => n === 4000)).toBe(true);
  });

  it("não escreve por cima de conversa já viva no turno", async () => {
    const enviadas = await sendOutreach(deps({
      alreadyTalking: new Set(["khazdrun-wxey~casa-valerius"]),
    }));
    expect(enviadas.every((m) => !(m.fromHouseId === "khazdrun-wxey" && m.toHouseKey === "casa-valerius"))).toBe(true);
  });

  it("passa a queda recente ao redator mesmo com evento corrente vazio", async () => {
    const d = deps({ publicEvent: "", recentPublicResult: "Asterhall caiu e os mortos marcham no escuro." });
    await sendOutreach(d);
    const requests = (d.chat as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1] as string);
    expect(requests.some((request) => request.includes("O resultado público mais recente:\nAsterhall caiu"))).toBe(true);
  });
});

describe("a torneira do Favor", () => {
  it("não cria favor de termos retirados pelo revisor", async () => {
    const draft = "Ofereço quarenta barras de ferro por sessenta sacas de grão. — Chancelaria";
    const reviewed = "Depois de ouvir sua situação, proponho que conversemos sobre suprimentos. — Chancelaria";
    const chat = vi.fn().mockImplementation(async (system: string) => system.includes("editor de uma chancelaria")
      ? JSON.stringify({ veredito: "corrigida", carta: reviewed, motivos: ["retirei a troca"] })
      : JSON.stringify({ carta: draft, troca: { oferta: "quarenta barras de ferro", pedido: "sessenta sacas de grão" } }));
    const d = deps({ chat });
    await sendOutreach(d);
    expect(d.putMessage).toHaveBeenCalled();
    expect(d.putFavor).not.toHaveBeenCalled();
  });
  // O razão de favores tinha zero registros desde sempre: a única coisa que o
  // enchia era um projeto concluído com efeito de favor, e nenhum concluiu.
  it("grava a proposta como favor pendente para o jogador decidir", async () => {
    const d = deps();
    await sendOutreach(d);
    expect(d.putFavor).toHaveBeenCalledTimes(9);
    const favor = (d.putFavor as any).mock.calls[0][0];
    expect(favor.status).toBe("PENDING");
    expect(favor.reason).toMatch(/oferece .* e pede /);
    // Indexado pelo jogador: é ele quem aceita ou recusa.
    expect(["khazdrun-wxey", "solarion-k0hc", "do-ouro-g0gg"]).toContain(favor.toHouseId);
  });

  // A troca não passa pelo revisor: ela vai num campo separado do JSON e chega
  // ao jogador com botão de aceitar. "8.000 sacas por 300 toneladas de ferro"
  // ficou três semanas assim na tela de Khazdrun.
  it("não põe botão de aceitar em troca fora de escala", async () => {
    const d = deps({
      chat: vi.fn().mockResolvedValue(JSON.stringify({
        carta: "Patriarca, a Coroa oferece o trigo do Vale por ferro de Khar-Durak, em dois comboios iguais. — Chancelaria",
        troca: { oferta: "8.000 sacas de trigo do Vale da Coroa", pedido: "300 toneladas de ferro em lingotes" },
      })),
    });
    await sendOutreach(d);
    expect(d.putFavor).not.toHaveBeenCalled();
  });

  // A carta some só se o modelo falhar. Escala errada é problema da proposta,
  // não do mundo ficar mudo.
  it("manda a carta mesmo quando a troca é recusada pela escala", async () => {
    const d = deps({
      chat: vi.fn().mockResolvedValue(JSON.stringify({
        carta: "Patriarca, a Coroa oferece o trigo do Vale por ferro de Khar-Durak, em dois comboios iguais. — Chancelaria",
        troca: { oferta: "8.000 sacas de trigo", pedido: "300 toneladas de ferro" },
      })),
    });
    expect(await sendOutreach(d)).toHaveLength(9);
    expect(d.putMessage).toHaveBeenCalledTimes(9);
  });

  it("não inventa favor quando a carta não trouxe proposta", async () => {
    const d = deps({
      chat: vi.fn().mockResolvedValue(JSON.stringify({ carta: "Uma carta longa o bastante para passar no corte de tamanho mínimo.", oferta: "", pedido: "" })),
    });
    await sendOutreach(d);
    expect(d.putFavor).not.toHaveBeenCalled();
  });
});

describe("prazo", () => {
  it("a folga padrão é a do worker, não os 20s do gateway", () => {
    expect(OUTREACH_DEADLINE_MS).toBe(840_000);
  });

  // Estourar o prazo abandona o lote: o turno já abriu, e um Lambda que
  // morre no hard timeout reexecuta e duplica carta.
  it("desiste das cartas se o prazo combinado estourar", async () => {
    const d = deps({
      deadlineMs: 30,
      chat: vi.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r("{}"), 500))),
    });
    expect(await sendOutreach(d)).toEqual([]);
    expect(d.putMessage).not.toHaveBeenCalled();
  });
});
