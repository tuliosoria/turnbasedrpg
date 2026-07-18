import { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/ApiProvider";
import { AdminChoiceTable } from "../components/AdminChoiceTable";
import { KingdomStats } from "../components/KingdomStats";
import { LoadingState } from "../components/LoadingState";
import { saveAdminToken, loadAdminToken, clearAdminToken } from "../auth/adminSession";
import { ApiError, type AdminDashboard } from "../types/api";

export function AdminPage() {
  const api = useApi();
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [code, setCode] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      setDashboard(await api.getAdminDashboard(adminToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        clearAdminToken();
        setToken(null);
      } else {
        setError("Falha ao carregar o painel.");
      }
    }
  }, [api]);

  useEffect(() => { if (token) void refresh(token); }, [token, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { adminToken } = await api.adminLogin(code.trim());
      saveAdminToken(adminToken);
      setToken(adminToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock(lock: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      if (lock) await api.lockTurn(token);
      else await api.unlockTurn(token);
      await refresh(token);
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!dashboard) return;
    await navigator.clipboard.writeText(dashboard.summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function logout() {
    clearAdminToken();
    setToken(null);
    setDashboard(null);
  }

  if (!token) {
    return (
      <main className="app-shell">
        <h1>Administração</h1>
        <form onSubmit={login}>
          <input
            aria-label="Código de admin"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ display: "block", width: "100%", minHeight: "44px", marginBottom: "1rem" }}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
        </form>
      </main>
    );
  }

  if (!dashboard) return <div className="app-shell"><LoadingState /></div>;

  return (
    <main className="app-shell">
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Painel do Turno {dashboard.activeTurnId}</h1>
        <button onClick={logout}>Sair</button>
      </header>
      <p>Status: <strong>{dashboard.turnStatus === "OPEN" ? "Aberto" : "Bloqueado"}</strong></p>

      <KingdomStats state={dashboard.kingdomState} />

      <section className="card">
        <h2>Escolhas do turno</h2>
        <AdminChoiceTable rows={dashboard.rows} />
      </section>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => toggleLock(dashboard.turnStatus === "OPEN")}>
          {dashboard.turnStatus === "OPEN" ? "Bloquear turno" : "Desbloquear turno"}
        </button>
        <button disabled={busy} onClick={copySummary}>
          {copied ? "Copiado!" : "Copiar resumo"}
        </button>
      </div>
    </main>
  );
}
