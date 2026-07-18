import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
            <Button component={RouterLink} to="/claim" color="secondary" size="large">
              Escolher uma Casa
            </Button>
            <Button component={RouterLink} to="/login" variant="outlined" size="large">
              Já tenho um código
            </Button>
            <Button component={RouterLink} to="/admin" variant="text" size="large">
              Entrar como Admin
            </Button>
          </Stack>
        </Box>
      )}
    </Layout>
  );
}
