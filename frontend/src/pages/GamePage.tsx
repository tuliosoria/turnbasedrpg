import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
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

  const logoutButton = game ? (
    <Button variant="outlined" size="small" color="inherit" onClick={logout}>
      Sair
    </Button>
  ) : undefined;

  if (error && !game)
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  if (!game)
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );

  const locked = game.turnStatus === "LOCKED";

  return (
    <Layout action={logoutButton}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1">{game.houseName}</Typography>
        <Typography sx={{ color: "text.secondary" }}>
          {game.houseSubtitle} · {game.displayName}
        </Typography>
      </Box>

      <KingdomStats state={game.kingdomState} />

      {game.previousResult && (
        <Card component="section" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Resultado anterior
            </Typography>
            {game.previousResult.publicResult.split("\n\n").map((p, i) => (
              <Typography key={i} sx={{ mb: 1 }}>
                {p}
              </Typography>
            ))}
          </CardContent>
        </Card>
      )}

      <Card component="section" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Turno {game.turnId}: {game.turnTitle}
          </Typography>
          {game.publicEvent.split("\n\n").map((p, i) => (
            <Typography key={i} sx={{ mb: 1 }}>
              {p}
            </Typography>
          ))}
        </CardContent>
      </Card>

      <PrivatePanel title="Informação privada" text={game.privateInformation} />

      <Typography variant="h2" gutterBottom>
        Sua escolha
      </Typography>
      {locked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O Conselho está resolvendo o turno.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        {game.cards.map((card) => (
          <CardChoice
            key={card.id}
            card={card}
            selected={game.currentChoice?.cardId === card.id}
            disabled={saving || locked}
            onChoose={choose}
          />
        ))}
      </Box>

      {game.currentChoice && !locked && (
        <Typography aria-live="polite" sx={{ mt: 2, color: "text.secondary" }}>
          Escolha registrada às{" "}
          {new Date(game.currentChoice.chosenAt).toLocaleTimeString("pt-BR")}. Você pode trocar
          enquanto o turno estiver aberto.
        </Typography>
      )}
    </Layout>
  );
}
