import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { PedidoDeResposta } from "./gerarResposta";

let cached: LambdaClient | null = null;
function client(region?: string): LambdaClient {
  if (!cached) cached = new LambdaClient(region ? { region } : {});
  return cached;
}

/**
 * Dispara a escrita da resposta e não espera por ela.
 *
 * `Event` é o que faz a diferença: a requisição do jogador termina assim que a
 * Lambda aceita o pedido, e não quando o modelo acaba de escrever.
 */
export async function invokeReplyWorker(
  functionName: string,
  region: string | undefined,
  pedido: PedidoDeResposta,
): Promise<void> {
  await client(region).send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(pedido)),
  }));
}
