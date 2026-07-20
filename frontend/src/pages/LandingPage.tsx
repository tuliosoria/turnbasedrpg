import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { SectionHeading } from "../components/SectionHeading";
import { FancyDivider } from "../components/FancyDivider";
import type { CampaignSummary } from "../types/api";

const STEPS: { title: string; text: string }[] = [
  {
    title: "1. Funde a sua Casa",
    text: "Crie uma Grande Casa de Valdren e distribua 10 pontos entre Riqueza, Recursos, Soldados e Controle. Escolha o brasão, o lema e a história da sua linhagem.",
  },
  {
    title: "2. Aja a cada turno",
    text: "Leia o evento público do reino e as informações secretas da sua Casa. Depois escreva suas ordens em texto livre, sem menus rígidos: apenas a sua estratégia.",
  },
  {
    title: "3. O mundo responde",
    text: "O mestre resolve o turno: seus atributos mudam, segredos são revelados, alianças se rompem e a narrativa avança de forma diferente para cada Casa.",
  },
  {
    title: "4. Acompanhe a crônica",
    text: "Cada acontecimento marcante vira uma imagem na Galeria e entra na wiki viva de Valdren. Ao final, você percorre toda a história do reino como uma crônica ilustrada.",
  },
];

const PILLARS: { label: string; text: string }[] = [
  { label: "Riqueza", text: "Ouro para sustentar exércitos, subornar nobres e comprar aliados." },
  { label: "Recursos", text: "Comida, madeira e ferro para resistir ao longo inverno." },
  { label: "Soldados", text: "A força militar que defende, ou conquista, o Norte." },
  { label: "Controle", text: "Sua autoridade sobre o povo, os nobres e as suas terras." },
];

export function LandingPage() {
  const api = useApi();
  const navigate = useNavigate();
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

  return (
    <Layout>
      <Stack spacing={{ xs: 5, sm: 7 }}>
        <Box
          sx={{
            textAlign: { xs: "left", sm: "center" },
            py: { xs: 4, sm: 6 },
            px: { xs: 2.5, sm: 4 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            background: (t) =>
              `radial-gradient(120% 140% at 50% 0%, ${t.palette.primary.dark}22, transparent 60%), linear-gradient(180deg, #1f1811 0%, #140f0a 100%)`,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: "secondary.main", letterSpacing: "0.24em" }}
          >
            Ravenloft · Estratégia narrativa
          </Typography>
          <Typography variant="h1" sx={{ mt: 1, mb: 2 }}>
            {campaign.title}
          </Typography>
          {campaign.introduction.split("\n\n").map((p, i) => (
            <Typography
              key={i}
              sx={{ mb: 2, color: "text.secondary", maxWidth: 680, mx: { xs: 0, sm: "auto" } }}
            >
              {p}
            </Typography>
          ))}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mt: 3, justifyContent: { xs: "stretch", sm: "center" } }}
          >
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

        <Box>
          <SectionHeading>O que é este jogo?</SectionHeading>
          <Typography sx={{ color: "text.secondary", mb: 1.5 }}>
            <strong>{campaign.title}</strong> é um jogo de estratégia narrativa por turnos, ambientado em
            Valdren, um reino de Ravenloft isolado pelas Brumas e ameaçado pelos mortos-vivos do Rei
            Pálido. Cada jogador lidera uma das Grandes Casas do reino.
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Não há tabuleiro nem dados: você escreve as suas decisões em texto livre e o mestre as tece na
            história do mundo. A cada turno, o reino muda. Cidades caem, o inverno avança e as Brumas
            engolem o Norte. A sua Casa pode sobreviver, prosperar ou desaparecer na neve.
          </Typography>
        </Box>

        <Box>
          <SectionHeading>Como se joga</SectionHeading>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            }}
          >
            {STEPS.map((step) => (
              <Card key={step.title} component="section" variant="outlined">
                <CardContent>
                  <Typography variant="h3" sx={{ fontSize: "1.05rem", mb: 1 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {step.text}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>

        <Box>
          <SectionHeading>Os quatro pilares da sua Casa</SectionHeading>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Cada Casa é definida por quatro atributos. Você os gasta e os conquista turno após turno.
          </Typography>
          <Stack spacing={1.5}>
            {PILLARS.map((pillar) => (
              <Stack key={pillar.label} direction="row" spacing={2} alignItems="center">
                <Chip label={pillar.label} color="secondary" sx={{ minWidth: 104 }} />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {pillar.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <FancyDivider my={0} />

        <Box sx={{ textAlign: { xs: "left", sm: "center" }, pb: 2 }}>
          <SectionHeading align="center">Pronto para reivindicar o Norte?</SectionHeading>
          <Typography sx={{ color: "text.secondary", mb: 2, maxWidth: 560, mx: { xs: 0, sm: "auto" } }}>
            Funde a sua Casa e escreva o seu lugar na crônica de Valdren antes que o inverno decida por você.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ justifyContent: { xs: "stretch", sm: "center" } }}
          >
            <Button color="secondary" size="large" onClick={() => navigate("/criar")}>
              Criar conta
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate("/valdren")}>
              Explorar Valdren
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Layout>
  );
}
