import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { savePlayerSession } from "../auth/playerSession";
import { ApiError } from "../types/api";

export function LoginPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(code.trim());
      savePlayerSession({
        playerToken: result.playerToken,
        houseId: result.houseId,
        displayName: result.displayName,
      });
      navigate("/game");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <h1>Entrar com seu código</h1>
      <form onSubmit={submit}>
        <input
          aria-label="Código do jogador"
          placeholder="ex.: vargen-4K7P"
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
