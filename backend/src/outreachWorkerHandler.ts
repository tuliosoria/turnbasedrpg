import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { enviarCartasDoMundo } from "./diplomacy/cartasDoMundo";

/**
 * Escreve as cartas que o mundo manda quando o turno abre.
 *
 * Saiu da rota do admin porque não cabia mais lá: cada carta agora são duas
 * chamadas ao modelo com raciocínio alto, e o API Gateway corta em trinta
 * segundos. O prazo interno do disparo era de vinte, o que já abandonava carta
 * antes mesmo da segunda passada existir.
 *
 * Aqui há quinze minutos, e o Mestre recebe a resposta na hora: as cartas
 * aparecem sozinhas na correspondência conforme ficam prontas.
 */
const config = loadConfig(process.env);
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const chatDiplomacia = config.openAiApiKey
  ? makeChatFn(config.openAiApiKey, config.openAiDiplomacyModel, "high")
  : undefined;

export async function handler(event: { turnId: number; publicEvent: string }): Promise<void> {
  try {
    const n = await enviarCartasDoMundo(
      { doc, config, chatDiplomacia },
      event.turnId,
      event.publicEvent ?? "",
    );
    console.info(`Cartas do mundo escritas: ${n}`);
  } catch (e) {
    // Não relança: uma falha aqui não pode virar repetição automática do
    // Lambda, que escreveria as mesmas cartas de novo.
    console.error("Falha ao escrever as cartas do mundo:", (e as Error)?.message);
  }
}
