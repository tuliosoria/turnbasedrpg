export interface PlayerSession {
  playerToken: string;
  houseId: string;
  displayName: string;
}

const KEY = "ravenloft.player";

export function savePlayerSession(session: PlayerSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadPlayerSession(): PlayerSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

/**
 * Só "há sessão?", sem desserializar: o Layout pergunta isto a cada render, e
 * ele rerenderiza a cada tecla nas páginas de formulário.
 */
export function hasPlayerSession(): boolean {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearPlayerSession(): void {
  sessionStorage.removeItem(KEY);
}
