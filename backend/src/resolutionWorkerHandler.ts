import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeDocClient } from "./db/dynamo";
import { runResolutionAftermath, type PedidoDeResolucao } from "./resolution/aftermath";

/**
 * Continua a resolução depois que o turno já está gravado.
 *
 * Juiz de carta, extração de fatos e Relationship Engine levam mais que os
 * 30s do API Gateway. A rota aplica o resultado, abre o próximo rascunho e
 * dispara isto em Event — o mesmo contrato das cartas e da geração visual.
 *
 * Aqui há novecentos segundos. Uma falha não desfaz o turno: o persist já
 * aconteceu, e cada bloco do aftermath já trata erro sem relançar.
 */
const config = loadConfig();
const doc = makeDocClient(process.env.AWS_REGION);
const chat = config.openAiApiKey ? makeChatFn(config.openAiApiKey, config.openAiModel) : undefined;

export async function handler(pedido: PedidoDeResolucao): Promise<void> {
  try {
    await runResolutionAftermath({ doc, config, chat }, pedido);
  } catch (e) {
    // Não relança: o turno já está RESOLVED. Uma repetição automática da
    // Lambda reprocessaria o mesmo aftermath — os blocos são idempotentes,
    // mas relançar um erro de modelo só queima cota.
    console.error("Falha no aftermath da resolução:", (e as Error)?.message);
  }
}
