import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import { clearPlayerSession, loadPlayerSession } from "../auth/playerSession";
import { AttributeBars } from "../components/AttributeBars";
import { Crest } from "../components/Crest";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { NarrativeCardInput } from "../components/NarrativeCardInput";
import { ApiError, type CardResponse, type PlayerGameView } from "../types/api";

type ResponseMap = Record<string, CardResponse>;

function defaultResponses(game: PlayerGameView): ResponseMap {
  const submitted = new Map(game.submission?.cardResponses.map((response) => [response.cardId, response]) ?? []);
  return Object.fromEntries(
    game.cards.map((card) => [card.id, submitted.get(card.id) ?? { cardId: card.id, text: "" }]),
  );
}

export function GamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [game, setGame] = useState<PlayerGameView | null>(null);
  const [orderText, setOrderText] = useState("");
  const [responses, setResponses] = useState<ResponseMap>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const session = loadPlayerSession();
    if (!session) {
      navigate("/login");
      return;
    }
    try {
      const view = await api.getGame(session.playerToken);
      setGame(view);
      setOrderText(view.submission?.orderText ?? "");
      setResponses(defaultResponses(view));
    } catch (err) {
      if (err instanceof ApiError && err.code === "SESSION_EXPIRED") {
        clearPlayerSession();
        navigate("/login");
        return;
      }
      setError("Não foi possível carregar o jogo.");
    }
  }, [api, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const spendValid = useMemo(() => {
    if (!game) return false;
    return game.cards.every((card) => {
      const spend = responses[card.id]?.declaredSpend;
      if (!spend || !card.spend) return true;
      const max = Math.min(card.spend.max, game.house.attributes[card.spend.attribute]);
      return spend.amount <= max;
    });
  }, [game, responses]);

  async function submitOrder() {
    const session = loadPlayerSession();
    if (!session || !game) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.submitOrder(session.playerToken, {
        orderText: orderText.trim(),
        cardResponses: Object.values(responses),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar a ordem.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearPlayerSession();
    navigate("/");
  }

  const logoutButton = (
    <Button variant="outlined" size="small" color="inherit" onClick={logout}>
      Sair
    </Button>
  );

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

  const hasVisibleTurn = game.turnStatus === "OPEN" || game.turnStatus === "LOCKED" || game.turnStatus === "RESOLVED";
  const inputsDisabled = saving || game.turnStatus !== "OPEN";

  return (
    <Layout action={logoutButton}>
      <Stack spacing={3}>
        <Card component="section">
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
              <Crest emblem={game.house.emblem} name={game.house.name} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h1">Sua Casa</Typography>
                <Typography variant="h2">{game.house.name}</Typography>
                <Typography sx={{ color: "text.secondary", mb: 2 }}>{game.house.motto}</Typography>
                <AttributeBars attributes={game.house.attributes} />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {game.previousResult && (
          <Card component="section">
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Resultado anterior
              </Typography>
              {game.previousResult.publicResult && <Typography sx={{ mb: 1 }}>{game.previousResult.publicResult}</Typography>}
              {game.previousResult.resultImageUrl && (
                <Box
                  component="img"
                  src={game.previousResult.resultImageUrl}
                  alt="Ilustração do resultado anterior"
                  sx={{ width: "100%", borderRadius: 1, my: 1, display: "block" }}
                />
              )}
              {game.previousResult.privateResult && <Typography sx={{ color: "text.secondary" }}>{game.previousResult.privateResult}</Typography>}
            </CardContent>
          </Card>
        )}

        {(game.turnStatus === "DRAFT" || game.turnId === null) && (
          <Alert severity="info">Aguardando o próximo turno.</Alert>
        )}

        {game.turnStatus === "LOCKED" && <Alert severity="info">O Conselho está resolvendo o turno.</Alert>}

        {hasVisibleTurn && (
          <>
            <Card component="section">
              <CardContent>
                <Typography variant="h2" gutterBottom>
                  Evento público
                </Typography>
                {game.eventImageUrl && (
                  <Box
                    component="img"
                    src={game.eventImageUrl}
                    alt="Ilustração do evento"
                    sx={{ width: "100%", borderRadius: 1, mb: 2, display: "block" }}
                  />
                )}
                <Typography>{game.publicEvent}</Typography>
              </CardContent>
            </Card>

            <Card component="section">
              <CardContent>
                <Typography variant="h2" gutterBottom>
                  Informação privada
                </Typography>
                <Typography>{game.privateInformation}</Typography>
              </CardContent>
            </Card>

            {game.cards.map((card) => (
              <NarrativeCardInput
                key={card.id}
                card={card}
                houseAttributes={game.house.attributes}
                value={responses[card.id] ?? { cardId: card.id, text: "" }}
                onChange={(response) => setResponses((current) => ({ ...current, [card.id]: response }))}
                disabled={inputsDisabled}
              />
            ))}

            <TextField
              label="Sua ordem"
              value={orderText}
              onChange={(event) => setOrderText(event.target.value)}
              disabled={inputsDisabled}
              required
              multiline
              minRows={5}
            />

            {error && <Alert severity="error">{error}</Alert>}
            {saved && <Alert severity="success">Ordem registrada — você pode editar enquanto o turno estiver aberto.</Alert>}

            <Button
              color="secondary"
              size="large"
              disabled={inputsDisabled || !orderText.trim() || !spendValid}
              onClick={submitOrder}
            >
              {saving ? "Enviando..." : "Enviar ordem"}
            </Button>
          </>
        )}
      </Stack>
    </Layout>
  );
}
