import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
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

  if (error && !houses)
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  if (!houses)
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );

  if (claim) {
    return (
      <Layout>
        <Typography variant="h1" gutterBottom>
          Casa reivindicada
        </Typography>
        <Typography sx={{ color: "text.secondary", mb: 2 }}>
          Seu código (guarde-o, ele é mostrado apenas uma vez):
        </Typography>
        <Card sx={{ mb: 3, textAlign: "center" }}>
          <CardContent>
            <Typography
              sx={{ fontFamily: "Georgia, serif", fontSize: "2rem", letterSpacing: "0.08em" }}
            >
              {claim.playerCode}
            </Typography>
          </CardContent>
        </Card>
        <Button color="secondary" size="large" onClick={() => navigate("/game")}>
          Entrar no jogo
        </Button>
      </Layout>
    );
  }

  if (pending) {
    const house = houses.find((h) => h.id === pending)!;
    return (
      <Layout>
        <Typography variant="h1" gutterBottom>
          Confirmar escolha
        </Typography>
        <Typography sx={{ mb: 2 }}>
          Você escolheu <strong>{house.name}</strong>. Esta ação não pode ser desfeita.
        </Typography>
        <Box sx={{ maxWidth: 420 }}>
          <TextField
            label="Seu nome de exibição"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            sx={{ mb: 2 }}
          />
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack direction="row" spacing={2}>
            <Button color="secondary" disabled={saving} onClick={confirmClaim}>
              {saving ? "Confirmando..." : "Confirmar"}
            </Button>
            <Button variant="outlined" disabled={saving} onClick={() => setPending(null)}>
              Voltar
            </Button>
          </Stack>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Typography variant="h1" gutterBottom>
        Escolha sua Casa
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          mt: 2,
        }}
      >
        {houses.map((h) => (
          <HouseCard key={h.id} house={h} onSelect={setPending} />
        ))}
      </Box>
    </Layout>
  );
}
