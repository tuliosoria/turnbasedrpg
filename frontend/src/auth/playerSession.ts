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

export function clearPlayerSession(): void {
  sessionStorage.removeItem(KEY);
}
