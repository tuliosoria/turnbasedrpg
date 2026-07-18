const KEY = "ravenloft.admin";

export function saveAdminToken(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function loadAdminToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(KEY);
}
