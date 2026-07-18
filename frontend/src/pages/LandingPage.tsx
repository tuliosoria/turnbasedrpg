import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { LoadingState } from "../components/LoadingState";
import type { CampaignSummary } from "../types/api";

export function LandingPage() {
  const api = useApi();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCampaign().then(setCampaign).catch(() => setError("Não foi possível carregar a campanha."));
  }, [api]);

  if (error) return <div className="app-shell error">{error}</div>;
  if (!campaign) return <div className="app-shell"><LoadingState /></div>;

  return (
    <main className="app-shell">
      <h1>{campaign.title}</h1>
      {campaign.introduction.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link to="/claim"><button>Escolher uma Casa</button></Link>
        <Link to="/login"><button>Já tenho um código</button></Link>
      </div>
    </main>
  );
}
