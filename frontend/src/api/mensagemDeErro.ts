import { ApiError, type ApiErrorCode } from "../types/api";

/**
 * O que dizer ao jogador quando algo dá errado.
 *
 * As mensagens que vinham do servidor foram escritas para quem lê log: "AI_ERROR",
 * "BAD_STATUS", "Erro 502". O jogador que viu uma delas na carta dos anões para
 * Ferrumor concluiu que tinha perdido a carta, e reenviou — e o fio ficou com a
 * mesma carta duas vezes.
 *
 * Cada texto aqui responde três coisas na ordem em que a pessoa pergunta: o que
 * aconteceu, se o trabalho dela sobreviveu, e o que fazer agora. A segunda é a
 * que mais importa; sem ela, todo erro parece perda.
 */
const TEXTOS: Partial<Record<ApiErrorCode, string>> = {
  SESSION_EXPIRED:
    "Sua sessão expirou por tempo parado. Entre de novo com o código da sua Casa — o que você digitou continua salvo aqui.",
  TURN_LOCKED:
    "O turno foi trancado pelo Mestre e não aceita mais envios. Seu texto fica guardado e você pode mandá-lo quando o próximo turno abrir.",
  NO_HOUSE: "Sua conta não está ligada a nenhuma Casa. Fale com o Mestre.",
  RATE_LIMITED: "Você mandou várias coisas seguidas. Espere alguns segundos e tente de novo.",
  NETWORK:
    "Não consegui falar com o servidor. Verifique sua conexão e tente de novo — nada foi perdido.",
  SERVER_TIMEOUT:
    "O servidor demorou mais do que o permitido para responder. O que você mandou pode ter sido registrado — recarregue a página antes de tentar de novo.",
  AI_QUOTA:
    "A cota de escrita do dia acabou. Sua carta está guardada; tente de novo mais tarde ou avise o Mestre.",
  AI_DISABLED: "A escrita automática está desligada nesta campanha. Avise o Mestre.",
  AI_PARSE: "Quem ia responder não conseguiu escrever desta vez. Sua carta está a salvo — tente de novo.",
  AI_ERROR: "Quem ia responder não conseguiu escrever desta vez. Sua carta está a salvo — tente de novo.",
  AI_AUTH: "A escrita automática está sem credencial válida. Isso é coisa para o Mestre resolver.",
  INVALID_BODY: "Faltou alguma coisa no que foi enviado, ou passou do tamanho permitido. Revise e tente de novo.",
  INVALID_CODE: "Esse código não confere. Confira maiúsculas e espaços.",
  NOT_FOUND: "Não achei isso. Talvez tenha sido removido — recarregue a página.",
  INTERNAL: "Algo quebrou do nosso lado. Nada do que você escreveu foi apagado; tente de novo em instantes.",
};

/** O texto para mostrar na tela. Nunca devolve vazio. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ApiError) {
    const texto = TEXTOS[e.code];
    if (texto) return texto;
    // Sem tradução, a mensagem do servidor ainda é melhor que o código cru:
    // várias delas são escritas para o jogador (as regras de envio, por exemplo).
    return e.message || "Algo deu errado. Tente de novo.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "Algo deu errado. Tente de novo.";
}
