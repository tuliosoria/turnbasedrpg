import { describe, it, expect, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { sendMessage, houseKeyForName } from "./diplomacyRoutes";
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
function makeDeps(over: { houses?: any[]; turnStatus?: string; sent?: any[]; chat?: any } = {}) {
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
  return { deps: { doc, config, chat: over.chat } as unknown as Deps, stored };
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

describe("sendMessage", () => {
  const chat = vi.fn(async () => "Karasoy responde com cautela.");

  it("grava a carta e a resposta da Casa", async () => {
    const { deps, stored } = makeDeps({ chat });
    const res = await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "Propomos uma aliança." }));
    expect(res.status).toBe(201);
    expect((res.body as any).sent.author).toBe("PLAYER");
    expect((res.body as any).reply.author).toBe("AI");
    expect(stored.filter((s) => s.SK?.startsWith("DIPLMSG#"))).toHaveLength(2);
  });

  it("recusa o terceiro envio para uma Casa próxima no mesmo turno", async () => {
    // Solarion↔Karasoy dá dois envios; o terceiro fica sem mensageiro.
    const { deps } = makeDeps({ chat });
    const send = () => sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "carta" }));
    await send();
    await send();
    await expect(send()).rejects.toThrow(/Sem mensageiros/);
  });

  it("recusa o segundo envio para Rimewatch, que fica a um envio só", async () => {
    const { deps } = makeDeps({ chat });
    const send = () => sendMessage(deps, playerReq({ toHouseKey: "casa-rimerberg", body: "carta" }));
    await send();
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

  it("não perde a carta quando a IA falha", async () => {
    // O envio já foi cobrado; apagar a carta puniria o jogador por uma falha
    // que não é dele.
    const failing = vi.fn(async () => { throw new Error("openai fora do ar"); });
    const { deps, stored } = makeDeps({ chat: failing });
    const res = await sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "carta" }));
    expect(res.status).toBe(201);
    expect((res.body as any).reply).toBeNull();
    expect((res.body as any).replyFailed).toBe(true);
    expect(stored.filter((s) => s.SK?.startsWith("DIPLMSG#"))).toHaveLength(1);
  });

  it("recusa corpo vazio antes de gastar qualquer chamada", async () => {
    const { deps } = makeDeps({ chat });
    await expect(sendMessage(deps, playerReq({ toHouseKey: "casa-karasoy", body: "   " })))
      .rejects.toThrow(/Escreva a mensagem/);
  });
});
