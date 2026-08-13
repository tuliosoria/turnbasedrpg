import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  CAMPAIGN_GUIDE_SECTION,
  SRD_ATTRIBUTION,
  WIKI_SECTIONS,
  WIKI_SECTION_IDS,
  wikiSectionLabel,
} from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { WikiMarkdown } from "../components/WikiMarkdown";
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
  const visibleSections = useMemo(() => {
    if (!entries) return [];
    const populatedSections = new Set(entries.map((entry) => entry.section));
    return WIKI_SECTIONS.filter((wikiSection) => populatedSections.has(wikiSection.id));
  }, [entries]);

  if (!section || !WIKI_SECTION_IDS.includes(section)) {
    return <Navigate to={`/valdren/${visibleSections[0]?.id ?? WIKI_SECTIONS[0].id}`} replace />;
  }

  if (entries && sectionEntries.length === 0 && visibleSections.length > 0) {
    return <Navigate to={`/valdren/${visibleSections[0].id}`} replace />;
  }

  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1" gutterBottom>
            {wikiSectionLabel(section)}
          </Typography>
          <Typography color="text.secondary">
            {section === CAMPAIGN_GUIDE_SECTION
              ? "Como levar Valdren para a mesa: magia rara, não magia fraca."
              : "A crônica viva de Valdren, atualizada conforme os turnos avançam."}
          </Typography>
        </Box>

        {visibleSections.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {visibleSections.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                component={RouterLink}
                to={`/valdren/${s.id}`}
                clickable
                color={s.id === section ? "primary" : "default"}
                variant={s.id === section ? "filled" : "outlined"}
              />
            ))}
          </Stack>
        )}

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
    </Layout>
  );
}
