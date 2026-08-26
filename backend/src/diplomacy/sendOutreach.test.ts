import { describe, expect, it, vi } from "vitest";
import { sendOutreach, type OutreachDeps } from "./sendOutreach";

function deps(over: Partial<OutreachDeps> = {}): OutreachDeps {
  return {
    chat: vi.fn().mockResolvedValue("Patriarca, propomos duzentas toneladas de ferro por trezentas de grão, entregues até a lua cheia. — Chancelaria"),
    houses: [
      { houseId: "khazdrun-wxey", name: "Khazdrun" },
      { houseId: "solarion-k0hc", name: "Solarion" },
      { houseId: "do-ouro-g0gg", name: "Do Ouro" },
    ],
    relations: [],
    publicEvent: "A Marcha do Norte partiu.",
    lastOrders: {},
    alreadyTalking: new Set(),
    turnNumber: 7,
    campaignId: "winter-dead",
    putMessage: vi.fn().mockResolvedValue(undefined),
    newId: (() => { let n = 0; return () => `out-${++n}`; })(),
    ...over,
  };
}

describe("sendOutreach", () => {
  it("manda três cartas quando o turno abre", async () => {
    const d = deps();
    const enviadas = await sendOutreach(d);
    expect(enviadas).toHaveLength(3);
    expect(d.putMessage).toHaveBeenCalledTimes(3);
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
      return "Proposta concreta de trezentas toneladas, entregues até o degelo. — Chancelaria";
    });
    const enviadas = await sendOutreach(deps({ chat }));
    expect(enviadas).toHaveLength(2);
  });

  it("descarta resposta curta demais para ser carta", async () => {
    const enviadas = await sendOutreach(deps({ chat: vi.fn().mockResolvedValue("ok") }));
    expect(enviadas).toEqual([]);
  });

  it("não escreve por cima de conversa já viva no turno", async () => {
    const enviadas = await sendOutreach(deps({
      alreadyTalking: new Set(["khazdrun-wxey~casa-valerius"]),
    }));
    expect(enviadas.every((m) => !(m.fromHouseId === "khazdrun-wxey" && m.toHouseKey === "casa-valerius"))).toBe(true);
  });
});
