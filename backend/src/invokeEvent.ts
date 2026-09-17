import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

let cached: LambdaClient | null = null;
function client(region?: string): LambdaClient {
  if (!cached) cached = new LambdaClient(region ? { region } : {});
  return cached;
}

/**
 * Dispara outra Lambda e não espera o resultado.
 *
 * `Event` é o que faz a diferença: a requisição (ou o passo que dispara)
 * termina quando a Lambda aceita o pedido, não quando o trabalho acaba.
 * Resposta de carta, cartas do mundo e geração visual usam o mesmo contrato.
 */
export async function invokeEvent(
  functionName: string,
  payload: unknown,
  region?: string,
): Promise<void> {
  await client(region).send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}
