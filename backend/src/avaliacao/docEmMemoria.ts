import { GetCommand, PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Item } from "./momento";

/**
 * Um DocumentClient que lê de um snapshot e guarda as escritas em memória.
 *
 * Suporta só o que o pipeline de resposta usa. Qualquer outro comando LANÇA:
 * devolver vazio em silêncio faria a carta sair sem contexto, e a avaliação
 * mediria uma regressão que não existe.
 */
export function docEmMemoria(snapshot: readonly Item[]): { doc: DynamoDBDocumentClient; gravados: Item[] } {
  const itens: Item[] = snapshot.map((i) => structuredClone(i));
  const gravados: Item[] = [];
  const copia = <T>(x: T): T => structuredClone(x);

  const send = async (cmd: unknown): Promise<Record<string, unknown>> => {
    if (cmd instanceof QueryCommand) {
      const { KeyConditionExpression: kce, ExpressionAttributeValues: v } = cmd.input;
      if (kce !== "PK = :pk AND begins_with(SK, :sk)" || !v) {
        throw new Error(`docEmMemoria: KeyConditionExpression não suportada: ${kce}`);
      }
      const achados = itens
        .filter((i) => i.PK === v[":pk"] && i.SK.startsWith(String(v[":sk"])))
        .sort((a, b) => (a.SK < b.SK ? -1 : a.SK > b.SK ? 1 : 0));
      return { Items: copia(achados) };
    }
    if (cmd instanceof GetCommand) {
      const k = cmd.input.Key ?? {};
      const achado = itens.find((i) => i.PK === k.PK && i.SK === k.SK);
      return achado ? { Item: copia(achado) } : {};
    }
    if (cmd instanceof PutCommand) {
      const item = copia(cmd.input.Item) as Item;
      const pos = itens.findIndex((i) => i.PK === item.PK && i.SK === item.SK);
      if (pos >= 0) itens[pos] = item; else itens.push(item);
      gravados.push(copia(item));
      return {};
    }
    const nome = (cmd as { constructor?: { name?: string } })?.constructor?.name ?? "desconhecido";
    throw new Error(`docEmMemoria: comando não suportado: ${nome}`);
  };

  return { doc: { send } as unknown as DynamoDBDocumentClient, gravados };
}
