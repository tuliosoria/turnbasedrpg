import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { sendMessage, houseKeyForName, withdrawLetter } from "./diplomacyRoutes";
import * as messagesDb from "../db/diplomacy/messages";
import * as adminAuth from "../auth/adminAuth";
import type { Deps } from "./publicRoutes";
import type { Config } from "../types/domain";
import { signToken } from "../auth/tokens";

const config = { tableName: "t", campaignId: "winter-dead", tokenSigningSecret: "s3cret" } as unknown as Config;

function playerReq(body: unknown) {
  const token = signToken({ type: "player", campaignId: "winter-dead", houseId: "h-solarion", displayName: "Solarion", exp: Date.now() + 60000 } as never, "s3cret");
  return { method: "POST", path: "/api/player/correspondencia", headers: { authorization: `Bearer ${token}` }, body, pathParams: {}, sourceIp: "1.2.3.4" } as never;
}

/**
 * Um fake do DynamoDB que responde por prefixo de SK, guardando as mensagens
 * gravadas para que o orçamento seja exercido de verdade entre chamadas.
 */
function makeDeps(over: { houses?: any[]; turnStatus?: string; sent?: any[]; chat?: any; invokeReply?: any } = {}) {
  const stored: any[] = [...(over.sent ?? [])];
  const houses = over.houses ?? [{ houseId: "h-solarion", name: "Solarion" }];
  const doc = {
    send: vi.fn(async (cmd: any) => {
      const sk = cmd?.input?.ExpressionAttributeValues?.[":sk"];
      const key = cmd?.input?.Key?.SK;
      if (cmd?.input?.Item) { stored.push(cmd.input.Item); return {}; }
      if (key?.startsWith?.("HOUSE#")) return { Item: houses[0] };
      if (sk === "HOUSE#") return { Items: houses };
      if (sk === "TURN#") return { Items: [{ SK: "TURN#0002", turnId: 2, status: over.turnStatus ?? "OPEN", publicEvent: "Asterhall foi atacada." }] };
      if (sk === "WIKI#") return { Items: [] };
      if (typeof sk === "string" && sk.startsWith("DIPLMSG#")) {
        return { Items: stored.filter((m) => typeof m.SK === "string" && m.SK.startsWith(sk)) };
      }
      return { Items: [] };
    }),
  } as unknown as DynamoDBDocumentClient;
  const invokeReply = over.invokeReply ?? vi.fn(async () => {});
  return { deps: { doc, config, chat: over.chat, invokeReply } as unknown as Deps, stored, invokeReply };
}

describe("houseKeyForName", () => {
  it("liga a Casa viva à chave canônica", () => {
    // As Casas vivas guardam nomes curtos; as chaves seguem os títulos do wiki.
    expect(houseKeyForName("Solarion")).toBe("casa-solarion");
    expect(houseKeyForName("Do Ouro")).toBe("casa-do-ouro");
    expect(houseKeyForName("Khazdrun")).toBe("casa-khazdrun");
  });

  it("devolve null para nome desconhecido", () => {
    expect(houseKeyForName("Casa Inventada")).toBeNull();
  });
});

/**
 * Uma carta que a Casa mandou ao jogador, já no fio.
 *
 * É ela que abre o direito de resposta: quem foi procurado pode responder uma
 * vez além do orçamento. Antes, a resposta da própria chamada anterior fazia
 * esse papel nos testes — agora a resposta chega fora da requisição, e o que o
 * orçamento enxerga precisa estar semeado.
 */
function cartaRecebida(houseKey: string) {
  return {
    PK: "CAMPAIGN#WINTER_DEAD",
    SK: `DIPLMSG#0002#h-solarion~${houseKey}#seed`,
    id: "seed", campaignId: "winter-dead", turnNumber: 2, author: "AI",
    fromHouseId: "h-solarion", toHouseKey: houseKey, toCharacterId: null,
    body: "A Casa escreve primeiro.", createdAt: new Date().toISOString(),
  };
}

describe("sendMessage", () => {
  const chat = vi.fn(async () => "Karasoy responde com cautela.");

  // A resposta é escrita fora da requisição: quem responde leva de dez a
  // quarenta segundos e o gateway corta em trinta. A rota grava a carta,
  // dispara o escritor e volta — o que o jogador vê é a carta entregue e um
  // aviso de que a resposta vem a seguir.
  it("grava a carta, dispara a resposta e não espera por ela", async () => {
    const { deps, stored, invokeReply } = makeDeps({ chat });
    const res = await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "Propomos uma aliança." }));
    expect(res.status).toBe(201);
    expect((res.body as any).sent.author).toBe("PLAYER");
    expect((res.body as any).reply).toBeNull();
    expect((res.body as any).replyPending).toBe(true);
    expect(stored.filter((s) => s.SK?.startsWith("DIPLMSG#"))).toHaveLength(1);
    expect(invokeReply).toHaveBeenCalledWith(expect.objectContaining({ toHouseKey: "casa-karasoy", sentId: (res.body as any).sent.id }));
  });

  // Falhar ao chamar o escritor não desfaz nada: a carta está gravada e o envio,
  // cobrado. O jogador precisa saber que a resposta não vem — não que a carta
  // sumiu, que foi o que ele concluiu quando isto dava erro vermelho.
  it("a carta segue mesmo quando o escritor não pode ser chamado", async () => {
    const invokeReply = vi.fn(async () => { throw new Error("Lambda fora do ar"); });
    const { deps, stored } = makeDeps({ chat, invokeReply });
    const res = await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "Propomos uma aliança." }));
    expect(res.status).toBe(201);
    expect((res.body as any).replyPending).toBe(false);
    expect((res.body as any).replyFailed).toBe(true);
    expect(stored.filter((s) => s.SK?.startsWith("DIPLMSG#"))).toHaveLength(1);
  });

  // O orçamento conta as cartas que o jogador COMEÇA. Responder à última carta
  // que lhe mandaram é de graça, uma vez por turno e por par — senão levar uma
  // carta e não poder responder vira mordaça, e não distância.
  it("recusa o quinto envio para uma Casa próxima: três do orçamento e um de resposta", async () => {
    const { deps } = makeDeps({ chat, sent: [cartaRecebida("casa-karasoy")] });
    const send = () => sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "carta" }));
    for (let i = 0; i < 4; i++) await send();
    await expect(send()).rejects.toThrow(/Sem mensageiros/);
  });

  // Nem a faixa mais cara do mapa deixa alguém com uma carta só: dois do
  // orçamento e a resposta. Distância encarece a conversa, não a proíbe.
  it("Rimewatch, a vinte e cinco dias, ainda dá dois envios mais a resposta", async () => {
    const { deps } = makeDeps({ chat, sent: [cartaRecebida("casa-rimerberg")] });
    const send = () => sendMessage(deps, playerReq({ toHouseKey: "casa-rimerberg", body: "carta" }));
    for (let i = 0; i < 3; i++) await send();
    await expect(send()).rejects.toThrow(/dias de viagem/);
  });

  it("mantém orçamentos separados por par", async () => {
    // Gastar com Karasoy não pode consumir o de Vargen.
    const { deps } = makeDeps({ chat });
    await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "a" }));
    await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "b" }));
    const res = await sendMessage(deps, playerReq({ toHouseKey: "casa-vargen", body: "c" }));
    expect(res.status).toBe(201);
  });

  it("recusa quando o turno não está aberto", async () => {
    const { deps } = makeDeps({ chat, turnStatus: "LOCKED" });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "x" })))
      .rejects.toThrow(/turno aberto/);
  });

  it("recusa Casa conduzida por outro jogador, explicando o motivo", async () => {
    // Fase A não cobre jogador-a-jogador; a recusa precisa dizer isso, não
    // devolver um erro genérico.
    const { deps } = makeDeps({ chat, houses: [{ houseId: "h-solarion", name: "Solarion" }, { houseId: "h2", name: "Khazdrun" }] });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-khazdrun", body: "x" })))
      .rejects.toThrow(/outro jogador/);
  });

  it("recusa escrever para a própria Casa", async () => {
    const { deps } = makeDeps({ chat });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-solarion", body: "x" })))
      .rejects.toThrow(/para si mesmo/);
  });

  it("recusa destinatário inexistente", async () => {
    const { deps } = makeDeps({ chat });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-inventada", body: "x" })))
      .rejects.toThrow(/desconhecida/);
  });

  it("recusa corpo vazio antes de gastar qualquer chamada", async () => {
    const { deps } = makeDeps({ chat });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "   " })))
      .rejects.toThrow(/Escreva a mensagem/);
  });
});

describe("retirar carta do mundo", () => {
  const adminDeps = () => ({ doc: {} as never, config } as unknown as Deps);
  const adminReq = (id: string) =>
    ({ method: "DELETE", path: "/", headers: {}, body: undefined, pathParams: { id } }) as never;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(adminAuth, "requireAdmin").mockReturnValue(undefined as never);
  });

  // O Mestre escolheu que as cartas de NPC chegam sem fila de aprovação, com a
  // condição de poder tirar do ar a que sair errada.
  it("apaga uma carta escrita pela IA", async () => {
    const carta = { id: "out-1", author: "AI", turnNumber: 7, fromHouseId: "casa-a", toHouseKey: "casa-valerius" };
    vi.spyOn(messagesDb, "listAllMessages").mockResolvedValue([carta] as never);
    const del = vi.spyOn(messagesDb, "deleteMessage").mockResolvedValue();
    const res = await withdrawLetter(adminDeps(), adminReq("out-1"));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
  });

  // Apagar o que um jogador escreveu reescreveria a história dele.
  it("recusa apagar carta de jogador", async () => {
    const carta = { id: "p-1", author: "PLAYER", turnNumber: 7, fromHouseId: "casa-a", toHouseKey: "casa-valerius" };
    vi.spyOn(messagesDb, "listAllMessages").mockResolvedValue([carta] as never);
    const del = vi.spyOn(messagesDb, "deleteMessage").mockResolvedValue();
    await expect(withdrawLetter(adminDeps(), adminReq("p-1"))).rejects.toMatchObject({ status: 409 });
    expect(del).not.toHaveBeenCalled();
  });

  it("devolve 404 para carta que não existe", async () => {
    vi.spyOn(messagesDb, "listAllMessages").mockResolvedValue([]);
    const res = await withdrawLetter(adminDeps(), adminReq("nada"));
    expect(res.status).toBe(404);
  });
});
