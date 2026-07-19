import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WIKI_SECTIONS, WIKI_SECTION_IDS, wikiSectionLabel } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
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

  if (!section || !WIKI_SECTION_IDS.includes(section)) {
    return <Navigate to={`/valdren/${WIKI_SECTIONS[0].id}`} replace />;
  }

  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1" gutterBottom>
            {wikiSectionLabel(section)}
          </Typography>
          <Typography color="text.secondary">
            A crônica viva de Valdren, atualizada conforme os turnos avançam.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {WIKI_SECTIONS.map((s) => (
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

        {error && <Alert severity="error">{error}</Alert>}

        {!entries && !error && <LoadingState />}

        {entries && !error && sectionEntries.length === 0 && (
          <Alert severity="info">Nada foi registrado nesta seção ainda.</Alert>
        )}

        {sectionEntries.map((entry) => (
          <Card key={entry.entryId} component="article">
            <CardContent>
              <Typography variant="h2" gutterBottom sx={{ fontSize: "1.3rem" }}>
                {entry.title}
              </Typography>
              <Typography component="div" sx={{ whiteSpace: "pre-wrap" }}>
                {entry.body}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Layout>
  );
}
