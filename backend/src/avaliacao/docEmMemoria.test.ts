import { describe, expect, it } from "vitest";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docEmMemoria } from "./docEmMemoria";

const PK = "CAMPAIGN#X";
const base = [
  { PK, SK: "WIKI#b", t: 2 },
  { PK, SK: "WIKI#a", t: 1 },
  { PK, SK: "TURN#001", t: 3 },
  { PK: "OUTRA", SK: "WIKI#c", t: 4 },
];

const query = (sk: string, pk = PK) => new QueryCommand({
  TableName: "t",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: { ":pk": pk, ":sk": sk },
});

describe("docEmMemoria", () => {
  it("responde Query por prefixo, na ordem de SK e só da partição pedida", async () => {
    const { doc } = docEmMemoria(base);
    const res = await doc.send(query("WIKI#"));
    expect(res.Items?.map((i) => i.SK)).toEqual(["WIKI#a", "WIKI#b"]);
    expect(res.LastEvaluatedKey).toBeUndefined();
  });

  it("responde Get pela chave, e Item ausente quando não há", async () => {
    const { doc } = docEmMemoria(base);
    const hit = await doc.send(new GetCommand({ TableName: "t", Key: { PK, SK: "TURN#001" } }));
    expect(hit.Item?.t).toBe(3);
    const miss = await doc.send(new GetCommand({ TableName: "t", Key: { PK, SK: "NADA" } }));
    expect(miss.Item).toBeUndefined();
  });

  it("captura Put sem tocar no snapshot, e o item gravado passa a ser lido", async () => {
    const { doc, gravados } = docEmMemoria(base);
    await doc.send(new PutCommand({ TableName: "t", Item: { PK, SK: "WIKI#z", t: 9 } }));
    expect(gravados).toEqual([{ PK, SK: "WIKI#z", t: 9 }]);
    expect(base).toHaveLength(4);
    const res = await doc.send(query("WIKI#"));
    expect(res.Items?.map((i) => i.SK)).toEqual(["WIKI#a", "WIKI#b", "WIKI#z"]);
  });

  it("devolve cópias: quem lê não altera o snapshot", async () => {
    const { doc } = docEmMemoria(base);
    const res = await doc.send(query("WIKI#"));
    (res.Items![0] as Record<string, unknown>).t = 99;
    const again = await doc.send(query("WIKI#"));
    expect(again.Items![0].t).toBe(1);
  });

  it("lança em comando que não conhece", async () => {
    const { doc } = docEmMemoria(base);
    await expect(doc.send(new UpdateCommand({ TableName: "t", Key: { PK, SK: "WIKI#a" }, UpdateExpression: "SET t = :t", ExpressionAttributeValues: { ":t": 1 } })))
      .rejects.toThrow(/UpdateCommand/);
  });

  it("lança em Query com condição que não conhece", async () => {
    const { doc } = docEmMemoria(base);
    await expect(doc.send(new QueryCommand({ TableName: "t", KeyConditionExpression: "PK = :pk", ExpressionAttributeValues: { ":pk": PK } })))
      .rejects.toThrow(/KeyConditionExpression/);
  });
});
