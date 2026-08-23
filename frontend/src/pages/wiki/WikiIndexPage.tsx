import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WIKI_GROUPS, wikiSectionLabel } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { MundoLayout } from "../../components/MundoLayout";
import { LoadingState } from "../../components/LoadingState";
import type { WikiEntry } from "../../types/api";

/**
 * O índice da crônica.
 *
 * `/valdren` antes redirecionava direto para a primeira seção povoada, então
 * a extensão do material — cento e vinte verbetes em vinte e três seções —
 * era invisível: só se descobria o que existia varrendo os chips. Aqui os
 * grupos aparecem primeiro, com a contagem de verbetes de cada seção, e a
 * escolha vem antes da leitura.
 */
export function WikiIndexPage() {
  const api = useApi();
  const [entries, setEntries] = useState<WikiEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWiki()
      .then(setEntries)
      .catch(() => setError("Não foi possível carregar a crônica de Valdren."));
  }, [api]);

  if (error) {
    return (
      <MundoLayout>
        <Alert severity="error">{error}</Alert>
      </MundoLayout>
    );
  }

  if (!entries) {
    return (
      <MundoLayout>
        <LoadingState />
      </MundoLayout>
    );
  }

  const countBySection = new Map<string, number>();
  for (const entry of entries) {
    countBySection.set(entry.section, (countBySection.get(entry.section) ?? 0) + 1);
  }

  // Campanha recém-criada não tem crônica. Sem isto a página seria um título
  // sobre o vazio, sem dizer se está quebrada ou só começando.
  if (entries.length === 0) {
    return (
      <MundoLayout>
        <Stack spacing={2} sx={{ maxWidth: "60ch" }}>
          <Typography variant="h2">A crônica de Valdren</Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Ainda não há verbetes. A crônica é escrita turno a turno: cada evento resolvido pelo mestre
            vira registro aqui.
          </Typography>
          <Box>
            <Link component={RouterLink} to="/casas">
              Conhecer as dezesseis Casas
            </Link>
          </Box>
        </Stack>
      </MundoLayout>
    );
  }

  return (
    <MundoLayout>
      <Stack spacing={6}>
        <Box>
          <Typography variant="h2" gutterBottom>
            A crônica de Valdren
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: "65ch" }}>
            {entries.length} verbetes, escritos turno a turno. Comece por onde a sua pergunta estiver.
          </Typography>
        </Box>

        {WIKI_GROUPS.map((group) => {
          const sections = group.sections.filter((id) => (countBySection.get(id) ?? 0) > 0);
          if (sections.length === 0) return null;

          return (
            <Box key={group.id} component="section">
              <Typography variant="h3" gutterBottom>
                {group.label}
              </Typography>
              <Typography sx={{ color: "text.secondary", mb: 2.5, maxWidth: "65ch" }}>
                {group.blurb}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 0,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                {sections.map((id) => (
                  <Link
                    key={id}
                    component={RouterLink}
                    to={`/valdren/${id}`}
                    underline="none"
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 2,
                      py: 1.75,
                      pr: 2,
                      borderBottom: 1,
                      borderColor: "divider",
                      color: "text.primary",
                      transition: "color 160ms ease-out",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    <span>{wikiSectionLabel(id)}</span>
                    <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                      {countBySection.get(id)}
                    </Typography>
                  </Link>
                ))}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </MundoLayout>
  );
}
