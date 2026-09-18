import { useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BOOK_PART_IDS, bookPartLabel, type BookChapter } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { MundoLayout } from "../../components/MundoLayout";
import { LoadingState } from "../../components/LoadingState";
import { WikiMarkdown } from "../../components/WikiMarkdown";

function readingOrder(chapters: BookChapter[]): BookChapter[] {
  const partIndex = (id: string) => {
    const i = BOOK_PART_IDS.indexOf(id);
    return i === -1 ? BOOK_PART_IDS.length : i;
  };
  return [...chapters].sort((a, b) => {
    const pa = partIndex(a.part);
    const pb = partIndex(b.part);
    if (pa !== pb) return pa - pb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

export function LivroCapituloPage() {
  const api = useApi();
  const { chapterId } = useParams<{ chapterId: string }>();
  const [chapters, setChapters] = useState<BookChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBook()
      .then(setChapters)
      .catch(() => setError("Não foi possível carregar O mundo de Valdren."));
  }, [api]);

  const ordered = useMemo(() => (chapters ? readingOrder(chapters) : []), [chapters]);
  const index = useMemo(
    () => ordered.findIndex((c) => c.chapterId === chapterId),
    [ordered, chapterId],
  );

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

  // Capítulo desconhecido ou em rascunho (ausente do público) devolve ao índice.
  if (index === -1) {
    return <Navigate to="/livro" replace />;
  }

  const chapter = ordered[index];
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;

  return (
    <MundoLayout>
      <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "72ch" }}>
        <Box>
          <Link component={RouterLink} to="/livro" variant="body2" underline="hover">
            O Livro
          </Link>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {bookPartLabel(chapter.part)}
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5 }} gutterBottom>
            {chapter.title}
          </Typography>
        </Box>

        <WikiMarkdown body={chapter.body} />

        <Divider />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
          {prev ? (
            <Link component={RouterLink} to={`/livro/${prev.chapterId}`} underline="hover">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link component={RouterLink} to={`/livro/${next.chapterId}`} underline="hover">
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </Stack>
      </Stack>
    </MundoLayout>
  );
}
