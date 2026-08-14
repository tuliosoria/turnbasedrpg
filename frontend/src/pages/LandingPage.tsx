import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { HeroVideo } from "../components/HeroVideo";
import { layout } from "../theme";
import type { CampaignSummary } from "../types/api";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Funde a sua Casa",
    text: "Crie uma Grande Casa de Valdren e distribua 10 pontos entre Riqueza, Recursos, Soldados e Controle. Escolha o brasão, o lema e a história da sua linhagem.",
  },
  {
    title: "Aja a cada turno",
    text: "Leia o evento público do reino e as informações secretas da sua Casa. Depois escreva suas ordens em texto livre, sem menus rígidos: apenas a sua estratégia.",
  },
  {
    title: "O mundo responde",
    text: "O mestre resolve o turno: seus atributos mudam, segredos são revelados, alianças se rompem e a narrativa avança de forma diferente para cada Casa.",
  },
  {
    title: "Acompanhe a crônica",
    text: "Cada acontecimento marcante vira uma imagem na Galeria e entra na wiki viva de Valdren. Ao final, você percorre a história do reino como uma crônica ilustrada.",
  },
];

/** Faixa de conteúdo padrão da home. O hero é a única coisa que sangra. */
function Band({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth={false} sx={{ maxWidth: layout.maxWidth, px: { xs: 3, md: 6 } }}>
      {children}
    </Container>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" component="h2" sx={{ display: "block", mb: 2 }}>
      {children}
    </Typography>
  );
}

export function LandingPage() {
  const api = useApi();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCampaign().then(setCampaign).catch(() => setError("Não foi possível carregar a campanha."));
  }, [api]);

  if (error) {
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );
  }

  const lead = campaign.introduction.split("\n\n")[0] ?? "";

  return (
    <Layout bleed>
      <HeroVideo>
        <Box sx={{ maxWidth: layout.maxWidth, mx: "auto", width: "100%" }}>
          <Typography variant="overline" sx={{ display: "block", mb: 2 }}>
            Estratégia narrativa por turnos
          </Typography>
          <Typography variant="h1" sx={{ maxWidth: 900 }}>
            {campaign.title}
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 3, maxWidth: 620 }}>
            {lead}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 5 }}>
            <Button component={RouterLink} to="/criar" size="large">
              Criar sua Casa
            </Button>
            <Button component={RouterLink} to="/valdren" variant="outlined" size="large">
              Explorar Valdren
            </Button>
          </Stack>
        </Box>
      </HeroVideo>

      <Stack spacing={{ xs: 8, md: 12 }} sx={{ py: { xs: 8, md: 12 } }}>
        <Band>
          <SectionLabel>O que é este jogo</SectionLabel>
          <Typography variant="h2" sx={{ maxWidth: 820, mb: 3 }}>
            Um reino isolado pelas Brumas, dezesseis potências, e nenhum dado sobre a mesa.
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
            Cada jogador lidera uma das Grandes Casas de Valdren. Não há tabuleiro: você escreve as suas
            decisões em texto livre e o mestre as tece na história do mundo. A cada turno o reino muda —
            cidades caem, o inverno avança e as Brumas engolem o Norte.
          </Typography>
        </Band>

        <Band>
          <SectionLabel>Como se joga</SectionLabel>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
            }}
          >
            {STEPS.map((step, i) => (
              <Card key={step.title} component="section">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="overline" sx={{ color: "primary.main" }}>
                    {String(i + 1).padStart(2, "0")}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1, mb: 1.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {step.text}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Band>

        <Band>
          <Box
            sx={{
              borderTop: 1,
              borderBottom: 1,
              borderColor: "divider",
              py: { xs: 6, md: 8 },
              textAlign: "center",
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>
              Pronto para reivindicar o Norte?
            </Typography>
            <Typography sx={{ color: "text.secondary", maxWidth: 560, mx: "auto", mb: 4 }}>
              Funde a sua Casa antes que o inverno decida por você.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button component={RouterLink} to="/criar" size="large">
                Criar sua Casa
              </Button>
              <Button component={RouterLink} to={`/valdren/campanha-dnd`} variant="outlined" size="large">
                Jogar em D&amp;D 5.5
              </Button>
            </Stack>
          </Box>
        </Band>
      </Stack>
    </Layout>
  );
}
