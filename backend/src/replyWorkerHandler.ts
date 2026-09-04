import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeDocClient } from "./db/dynamo";
import { gerarResposta, type PedidoDeResposta } from "./diplomacy/gerarResposta";

/**
 * Escreve a resposta de uma Casa depois que a requisição já terminou.
 *
 * O API Gateway corta em trinta segundos, e uma resposta leva de dez a
 * quarenta: o modelo raciocina antes de escrever. A carta era gravada antes da
 * chamada, então o jogador levava erro vermelho com a carta já entregue — e
 * reenviava, duplicando o fio.
 *
 * Aqui há novecentos segundos e ninguém esperando. A carta sai na hora; a
 * resposta aparece quando ficar pronta.
 */
const config = loadConfig();
const doc = makeDocClient(process.env.AWS_REGION);
const chat = config.openAiApiKey ? makeChatFn(config.openAiApiKey, config.openAiModel) : undefined;
const chatDiplomacia = config.openAiApiKey ? makeChatFn(config.openAiApiKey, config.openAiDiplomacyModel) : undefined;

export async function handler(pedido: PedidoDeResposta): Promise<void> {
  try {
    const reply = await gerarResposta({ doc, config, chat, chatDiplomacia }, pedido);
    if (!reply) {
      console.warn("Resposta não gerada", { toHouseKey: pedido.toHouseKey, sentId: pedido.sentId });
    }
  } catch (e) {
    // A carta do jogador já está gravada e o envio já foi cobrado. Uma falha
    // aqui não pode apagá-la — o Mestre gera a resposta depois se quiser.
    console.error("Falha ao gerar resposta:", (e as Error)?.message);
  }
}
