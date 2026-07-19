import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import type { CampaignSummary } from "../types/api";

export function LandingPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCampaign().then(setCampaign).catch(() => setError("Não foi possível carregar a campanha."));
  }, [api]);

  return (
    <Layout>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : !campaign ? (
        <LoadingState />
      ) : (
        <Box>
          <Typography variant="h1" gutterBottom>
            {campaign.title}
          </Typography>
          {campaign.introduction.split("\n\n").map((p, i) => (
            <Typography key={i} sx={{ mb: 2, color: "text.secondary" }}>
              {p}
            </Typography>
          ))}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 3 }}>
            <Button color="secondary" size="large" onClick={() => navigate("/criar")}>
              Criar conta
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button variant="text" size="large" onClick={() => navigate("/admin")}>
              Entrar como Admin
            </Button>
          </Stack>
        </Box>
      )}
    </Layout>
  );
}
