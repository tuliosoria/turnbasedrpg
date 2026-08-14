import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SEATS, VALDREN_PEOPLES } from "@ravenloft/content";
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

/**
 * As três Casas que a home apresenta.
 *
 * Escolha editorial, não derivada: são as de cânone mais denso, e servem de
 * amostra das dezesseis. Trocar aqui troca a home.
 */
const FEATURED = ["casa-valerius", "casa-khazdrun", "casa-solarion"] as const;

/**
 * Faixa de conteúdo padrão da home. O hero é a única coisa que sangra.
 *
 * O `id` existe para dar link direto a uma seção — e é o que torna a página
 * verificável por captura, já que o hero ocupa a altura da janela inteira e
 * nenhum tamanho de viewport revelaria o que vem abaixo dele.
 */
function Band({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <Container
      id={id}
      component="section"
      maxWidth={false}
      // `mx: auto` é obrigatório aqui: com maxWidth={false} o Container do MUI
      // não aplica as margens automáticas que centralizam, então a faixa
      // encostava à esquerda enquanto o hero, que já tinha mx auto, ficava
      // centrado — os dois desalinhados entre si.
      sx={{ maxWidth: layout.maxWidth, mx: "auto", px: { xs: 3, md: 6 }, scrollMarginTop: 80 }}
    >
      {children}
    </Container>
  );
}

/**
 * O título de uma seção.
 *
 * Era um `overline` em caixa alta acima de um `h2` — o rótulo que não diz nada
 * que o título já não diga. O título carrega o próprio peso; a etiqueta acima
 * dele só ocupava espaço e roubava a primeira linha da leitura.
 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="h2" component="h2" sx={{ mb: 3, maxWidth: "26ch" }}>
      {children}
    </Typography>
  );
}

export function LandingPage() {
  const api = useApi();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [emblems, setEmblems] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getCampaign().then(setCampaign).catch(() => setError("Não foi possível carregar a campanha."));
  }, [api]);

  // Verbetes e brasões enriquecem a home mas não a definem: se o acervo não
  // responder, os blocos caem para o cânone compilado em vez de sumirem.
  useEffect(() => {
    api.getWiki().then((entries) => setEntryCount(entries.length)).catch(() => undefined);
  }, [api]);

  useEffect(() => {
    api
      .getVisualGallery()
      .then((assets) => {
        const found: Record<string, string> = {};
        for (const asset of assets) {
          const key = asset.entityId?.startsWith("emblem-") ? asset.entityId.slice(7) : null;
          if (key) found[key] = asset.thumbnailUrl ?? asset.storageUrl;
        }
        setEmblems(found);
      })
      .catch(() => undefined);
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
          <SectionTitle>Um reino isolado pelas Brumas, dezesseis potências, e nenhum dado sobre a mesa.</SectionTitle>
          <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
            Cada jogador lidera uma das Grandes Casas de Valdren. Não há tabuleiro: você escreve as suas
            decisões em texto livre e o mestre as tece na história do mundo. A cada turno o reino muda —
            cidades caem, o inverno avança e as Brumas engolem o Norte.
          </Typography>
        </Band>

        <Band id="estado">
          <SectionTitle>O estado da campanha</SectionTitle>
          <Box
            sx={{
              display: "grid",
              gap: 0,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            {[
              { value: String(SEATS.length), label: "Potências no reino" },
              { value: entryCount === null ? "—" : String(entryCount), label: "Verbetes na crônica" },
              { value: String(VALDREN_PEOPLES.length), label: "Povos jogáveis" },
            ].map((stat) => (
              <Box
                key={stat.label}
                sx={{
                  py: 4,
                  borderBottom: 1,
                  borderColor: "divider",
                  borderRight: { sm: 1 },
                  "&:last-of-type": { borderRight: 0 },
                  pr: { sm: 3 },
                }}
              >
                <Typography sx={{ fontSize: "3rem", fontWeight: 800, lineHeight: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="overline" sx={{ display: "block", mt: 1 }}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Band>

        <Band id="casas">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ mb: 2, flexWrap: "wrap", gap: 2 }}
          >
            <SectionTitle>As Casas</SectionTitle>
            <Link component={RouterLink} to="/casas" variant="body2">
              Ver as dezesseis
            </Link>
          </Stack>
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            {FEATURED.map((key) => {
              const seat = SEATS.find((s) => s.key === key);
              if (!seat) return null;
              return (
                <Card key={key}>
                  <CardActionArea component={RouterLink} to={`/casa/${key}`} sx={{ p: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {emblems[key] && (
                        <Box
                          component="img"
                          src={emblems[key]}
                          alt={`Brasão da ${seat.name}`}
                          sx={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }}
                        />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h4">{seat.name}</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {seat.seat}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </Band>

        <Band id="como-se-joga">
          <SectionTitle>Como se joga</SectionTitle>
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
