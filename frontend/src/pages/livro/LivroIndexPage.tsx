import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BOOK_PARTS, type BookChapter } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { MundoLayout } from "../../components/MundoLayout";
import { LoadingState } from "../../components/LoadingState";

/**
 * O índice de O Livro.
 *
 * O romance de Valdren, lido do começo ao fim ou por capítulo avulso. Só os
 * capítulos publicados pelo Mestre aparecem aqui — os rascunhos ficam no
 * editor. As partes ordenam a leitura; dentro de cada uma, a ordem é a que o
 * Mestre definiu.
 */
export function LivroIndexPage() {
  const api = useApi();
  const [chapters, setChapters] = useState<BookChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBook()
      .then(setChapters)
      .catch(() => setError("Não foi possível carregar O Livro de Valdren."));
  }, [api]);

  if (error) {
    return (
      <MundoLayout>
        <Alert severity="error">{error}</Alert>
      </MundoLayout>
    );
  }

  if (!chapters) {
    return (
      <MundoLayout>
        <LoadingState />
      </MundoLayout>
    );
  }

  if (chapters.length === 0) {
    return (
      <MundoLayout>
        <Stack spacing={2} sx={{ maxWidth: "60ch" }}>
          <Typography variant="h2">O Livro de Valdren</Typography>
          <Typography sx={{ color: "text.secondary" }}>
            O romance ainda não foi publicado. Quando o Mestre publicar os capítulos, eles aparecerão
            aqui, parte a parte.
          </Typography>
          <Box>
            <Link component={RouterLink} to="/valdren">
              Enquanto isso, a crônica de Valdren
            </Link>
          </Box>
        </Stack>
      </MundoLayout>
    );
  }

  const grouped = BOOK_PARTS.map((part) => ({
    part,
    items: chapters
      .filter((c) => c.part === part.id)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  })).filter((g) => g.items.length > 0);

  return (
    <MundoLayout>
      <Stack spacing={6} sx={{ maxWidth: "72ch" }}>
        <Box>
          <Typography variant="h2" gutterBottom>
            O Livro de Valdren
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: "65ch" }}>
            A novelização da campanha, narrada em primeira pessoa. Leia do começo ou pelo capítulo que
            quiser.
          </Typography>
        </Box>

        {grouped.map(({ part, items }) => (
          <Box key={part.id} component="section">
            <Typography variant="h3" gutterBottom>
              {part.label}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 0,
                gridTemplateColumns: "1fr",
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              {items.map((chapter) => (
                <Link
                  key={chapter.chapterId}
                  component={RouterLink}
                  to={`/livro/${chapter.chapterId}`}
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
                  <span>{chapter.title}</span>
                </Link>
              ))}
            </Box>
          </Box>
        ))}
      </Stack>
    </MundoLayout>
  );
}
