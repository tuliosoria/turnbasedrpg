const KEY = "ravenloft.admin";

/**
 * O login do GM vive em localStorage, não em sessionStorage.
 *
 * O servidor já assina o token com validade própria (TOKEN_TTL_SECONDS, sete
 * dias por padrão) e recusa o que passou do prazo. Guardá-lo por aba jogava
 * fora um token que o servidor ainda aceitaria: fechar a aba, ou abrir o
 * Estúdio numa aba nova, derrubava o login sem avisar — e a interface
 * simplesmente some com os botões de GM, então parece que o botão não existe
 * em vez de parecer que falta permissão.
 *
 * Quem decide quanto tempo a sessão dura é o servidor. O cliente agora só
 * para de descartar essa decisão.
 */

/** O `exp` que o servidor assinou, ou null se o token não disser. */
function expiresAt(token: string): number | null {
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    const exp = (payload as { exp?: unknown })?.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    // Token opaco ou de teste: sem prazo legível, quem decide é o servidor.
    return null;
  }
}

export function saveAdminToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function loadAdminToken(): string | null {
  // sessionStorage continua sendo lido, sem ser reescrito: quem já estava
  // logado quando esta mudança subiu segue logado até fechar a aba, e o
  // próximo login grava no lugar novo. Ler nunca grava — um getter com efeito
  // colateral escondido faz a limpeza dos testes (e da interface) mentir.
  const token = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  if (!token) return null;

  // Descartar o token vencido aqui evita a pior versão do problema: a
  // interface mostrar os controles de GM que o servidor vai recusar depois.
  const exp = expiresAt(token);
  if (exp !== null && exp <= Date.now()) {
    clearAdminToken();
    return null;
  }

  return token;
}

export function clearAdminToken(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
