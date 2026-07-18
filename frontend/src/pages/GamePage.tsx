import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { KingdomStats } from "../components/KingdomStats";
import { CardChoice } from "../components/CardChoice";
import { PrivatePanel } from "../components/PrivatePanel";
import { LoadingState } from "../components/LoadingState";
import { loadPlayerSession, clearPlayerSession } from "../auth/playerSession";
import { ApiError, type PlayerGameView } from "../types/api";

export function GamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [game, setGame] = useState<PlayerGameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const session = loadPlayerSession();
    if (!session) {
      navigate("/login");
      return;
    }
    try {
      setGame(await api.getGame(session.playerToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        clearPlayerSession();
        navigate("/login");
        return;
      }
      setError("Não foi possível carregar o jogo.");
    }
  }, [api, navigate]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function choose(cardId: string) {
    const session = loadPlayerSession();
    if (!session || !game) return;
    setSaving(true);
    setError(null);
    try {
      await api.submitChoice(session.playerToken, game.turnId, cardId);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao salvar a escolha.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearPlayerSession();
    navigate("/");
  }

  if (error && !game) return <div className="app-shell error">{error}</div>;
  if (!game) return <div className="app-shell"><LoadingState /></div>;

  const locked = game.turnStatus === "LOCKED";

  return (
    <main className="app-shell">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>{game.houseName}</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {game.houseSubtitle} · {game.displayName}
          </p>
        </div>
        <button onClick={logout}>Sair</button>
      </header>

      <KingdomStats state={game.kingdomState} />

      {game.previousResult && (
        <section className="card">
          <h2>Resultado anterior</h2>
          {game.previousResult.publicResult.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
        </section>
      )}

      <section className="card">
        <h2>Turno {game.turnId}: {game.turnTitle}</h2>
        {game.publicEvent.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
      </section>

      <PrivatePanel title="Informação privada" text={game.privateInformation} />

      <h2>Sua escolha</h2>
      {locked && <p className="card">O Conselho está resolvendo o turno.</p>}
      {error && <p className="error">{error}</p>}
      <div style={{ display: "grid", gap: "1rem" }}>
        {game.cards.map((card) => (
          <CardChoice
            key={card.id}
            card={card}
            selected={game.currentChoice?.cardId === card.id}
            disabled={saving || locked}
            onChoose={choose}
          />
        ))}
      </div>

      {game.currentChoice && !locked && (
        <p aria-live="polite">
          Escolha registrada às{" "}
          {new Date(game.currentChoice.chosenAt).toLocaleTimeString("pt-BR")}. Você pode trocar
          enquanto o turno estiver aberto.
        </p>
      )}
    </main>
  );
}
