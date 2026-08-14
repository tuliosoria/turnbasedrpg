import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  CAMPAIGN_GUIDE_SECTION,
  SRD_ATTRIBUTION,
  WIKI_SECTION_IDS,
  wikiSectionLabel,
} from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { WikiMarkdown } from "../components/WikiMarkdown";
import { WikiNav } from "./wiki/WikiNav";
import type { WikiEntry } from "../types/api";

export function WikiPage() {
  const api = useApi();
  const { section } = useParams<{ section: string }>();
  const [entries, setEntries] = useState<WikiEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await api.getWiki());
    } catch {
      setError("Não foi possível carregar a história de Valdren.");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sectionEntries = useMemo(
    () => (entries ?? []).filter((e) => e.section === section),
    [entries, section],
  );
  const populated = useMemo(() => new Set((entries ?? []).map((e) => e.section)), [entries]);

  // Uma seção desconhecida ou vazia devolve ao índice, não à primeira seção
  // povoada: cair numa página que não foi pedida é mais confuso do que ver a
  // lista e escolher.
  if (!section || !WIKI_SECTION_IDS.includes(section)) {
    return <Navigate to="/valdren" replace />;
  }

  if (entries && sectionEntries.length === 0) {
    return <Navigate to="/valdren" replace />;
  }

  return (
    <Layout>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: { xs: "1fr", md: "232px minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 88,
            maxHeight: "calc(100dvh - 112px)",
            overflowY: "auto",
          }}
        >
          <WikiNav current={section} populated={populated} />
        </Box>

        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Box>
            <Link component={RouterLink} to="/valdren" variant="body2" underline="hover">
              A crônica
            </Link>
            <Typography variant="h2" sx={{ mt: 0.5 }} gutterBottom>
              {wikiSectionLabel(section)}
            </Typography>
            <Typography color="text.secondary">
              {section === CAMPAIGN_GUIDE_SECTION
                ? "Como levar Valdren para a mesa: magia rara, não magia fraca."
                : "A crônica viva de Valdren, atualizada conforme os turnos avançam."}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {!entries && !error && <LoadingState />}

          {section === CAMPAIGN_GUIDE_SECTION && (
            <Alert severity="info" icon={false}>
            <Typography variant="body2">
              Valdren é compatível com a quinta edição. Nenhuma regra de classe, dano ou progressão é
              alterada — o que este guia descreve é o que as regras significam dentro do mundo.
            </Typography>
          </Alert>
        )}

          {sectionEntries.map((entry) => (
          <Card key={entry.entryId} component="article">
            <CardContent>
              <Typography variant="h2" gutterBottom sx={{ fontSize: "1.3rem" }}>
                {entry.title}
              </Typography>
              {(entry.imageUrls ?? (entry.imageUrl ? [entry.imageUrl] : [])).map((imageUrl, index, images) => (
                <Box
                  key={imageUrl}
                  component="img"
                  src={imageUrl}
                  alt={images.length > 1 ? `Imagem ${index + 1} de ${entry.title}` : `Imagem de ${entry.title}`}
                  sx={{ width: "100%", borderRadius: 1, mb: 2, display: "block" }}
                />
              ))}
              <WikiMarkdown body={entry.body} />
            </CardContent>
          </Card>
        ))}

        {/* Atribuição CC-BY é obrigação de licença: fica no código, e não num
            verbete, para não poder desaparecer numa edição pelo Acervo. */}
          {section === CAMPAIGN_GUIDE_SECTION && (
            <Typography variant="caption" color="text.secondary" component="p" data-testid="srd-attribution">
              {SRD_ATTRIBUTION}
            </Typography>
          )}
        </Stack>
      </Box>
    </Layout>
  );
}
