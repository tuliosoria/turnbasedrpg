import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { HouseCard } from "../components/HouseCard";
import { LoadingState } from "../components/LoadingState";
import { savePlayerSession } from "../auth/playerSession";
import type { HouseSummary, ClaimResult } from "../types/api";
import type { HouseId } from "@ravenloft/content";
import { ApiError } from "../types/api";

export function ClaimHousePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [houses, setHouses] = useState<HouseSummary[] | null>(null);
  const [pending, setPending] = useState<HouseId | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getHouses().then(setHouses).catch(() => setError("Falha ao carregar as Casas."));
  }, [api]);

  async function confirmClaim() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.claimHouse(pending, displayName.trim() || "Jogador");
      savePlayerSession({
        playerToken: result.playerToken,
        houseId: result.houseId,
        displayName: result.displayName,
      });
      setClaim(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao reivindicar a Casa.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !houses) return <div className="app-shell error">{error}</div>;
  if (!houses) return <div className="app-shell"><LoadingState /></div>;

  if (claim) {
    return (
      <main className="app-shell">
        <h1>Casa reivindicada</h1>
        <p>Seu código (guarde-o, ele é mostrado apenas uma vez):</p>
        <p style={{ fontSize: "1.6rem", fontFamily: "var(--font-title)" }}>{claim.playerCode}</p>
        <button onClick={() => navigate("/game")}>Entrar no jogo</button>
      </main>
    );
  }

  if (pending) {
    const house = houses.find((h) => h.id === pending)!;
    return (
      <main className="app-shell">
        <h1>Confirmar escolha</h1>
        <p>Você escolheu <strong>{house.name}</strong>. Esta ação não pode ser desfeita.</p>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          Seu nome de exibição:
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: "0.25rem", minHeight: "44px" }}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button disabled={saving} onClick={confirmClaim}>
            {saving ? "Confirmando..." : "Confirmar"}
          </button>
          <button disabled={saving} onClick={() => setPending(null)}>Voltar</button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>Escolha sua Casa</h1>
      <div style={{ display: "grid", gap: "1rem" }}>
        {houses.map((h) => (
          <HouseCard key={h.id} house={h} onSelect={setPending} />
        ))}
      </div>
    </main>
  );
}
