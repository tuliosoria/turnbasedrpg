import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { BOOK_PART_IDS, bookPartLabel, type BookChapter } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { adminTokenSnapshot, subscribeAdminToken } from "../../auth/adminSession";
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

/**
 * O capítulo, lido como se lê um livro.
 *
 * O Mestre lê o próprio rascunho aqui. A rota pública filtra por `publicado`, e
 * enquanto o romance não é do reino ele está inteiro em rascunho — sem esta
 * porta, a página feita para ler o livro responderia "ainda não foi publicado"
 * justamente a quem o escreveu, e ler cento e vinte mil palavras viraria ler
 * dentro de um campo de edição do painel.
 *
 * A nota e a edição moram junto do texto de propósito: a correção nasce da
 * leitura, e obrigar a trocar de tela entre notar e anotar é o que faz a nota
 * não ser escrita.
 */
export function LivroCapituloPage() {
  const api = useApi();
  const { chapterId } = useParams<{ chapterId: string }>();
  const adminToken = useSyncExternalStore(subscribeAdminToken, adminTokenSnapshot, () => null);
  const [chapters, setChapters] = useState<BookChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nota, setNota] = useState("");
  const [editando, setEditando] = useState(false);
  const [corpo, setCorpo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setChapters(adminToken ? await api.adminListBook(adminToken) : await api.getBook());
    } catch {
      setError("Não foi possível carregar O mundo de Valdren.");
    }
  }, [api, adminToken]);

  useEffect(() => { void carregar(); }, [carregar]);

  const ordered = useMemo(() => (chapters ? readingOrder(chapters) : []), [chapters]);
  const index = useMemo(
    () => ordered.findIndex((c) => c.chapterId === chapterId),
    [ordered, chapterId],
  );
  const chapter = index === -1 ? null : ordered[index];

  // O capítulo pode trocar sem desmontar a página, pelos links de anterior e
  // seguinte: a nota e o texto acompanham.
  useEffect(() => {
    setNota(chapter?.notas ?? "");
    setCorpo(chapter?.body ?? "");
    setEditando(false);
  }, [chapter?.chapterId, chapter?.notas, chapter?.body]);

  const salvar = useCallback(
    async (campos: { body?: string; notas?: string }) => {
      if (!chapter || !adminToken) return;
      setSalvando(true);
      setAviso(null);
      try {
        await api.adminUpdateBookChapter(adminToken, chapter.chapterId, {
          part: chapter.part,
          order: chapter.order,
          title: chapter.title,
          status: chapter.status,
          body: campos.body ?? chapter.body,
          ...(campos.notas === undefined ? {} : { notas: campos.notas }),
        });
        setAviso("Salvo.");
        await carregar();
      } catch {
        setAviso("Não deu para salvar. O que você escreveu continua aqui.");
      } finally {
        setSalvando(false);
      }
    },
    [api, adminToken, chapter, carregar],
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

  // Para o jogador, um capítulo em rascunho simplesmente não existe.
  if (!chapter) {
    return <Navigate to="/livro" replace />;
  }

  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;

  return (
    <MundoLayout>
      <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "72ch" }}>
        <Box>
          <Link component={RouterLink} to="/livro" variant="body2" underline="hover">
            O Livro
          </Link>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {bookPartLabel(chapter.part)}
            </Typography>
            {chapter.status === "rascunho" && (
              <Chip size="small" color="warning" variant="outlined" label="rascunho" />
            )}
          </Stack>
          <Typography variant="h2" sx={{ mt: 0.5 }} gutterBottom>
            {chapter.title}
          </Typography>
        </Box>

        {editando ? (
          <Stack spacing={1}>
            <TextField
              label="Texto do capítulo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              multiline
              minRows={20}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={salvando} onClick={() => void salvar({ body: corpo })}>
                Salvar capítulo
              </Button>
              <Button disabled={salvando} onClick={() => { setCorpo(chapter.body); setEditando(false); }}>
                Descartar
              </Button>
            </Stack>
          </Stack>
        ) : (
          <WikiMarkdown body={chapter.body} />
        )}

        {adminToken && (
          <>
            {!editando && (
              <Box>
                <Button size="small" variant="outlined" onClick={() => setEditando(true)}>
                  Editar este capítulo
                </Button>
              </Box>
            )}

            {/* A nota é do autor para o autor, e nunca sai pela rota pública:
                o servidor a remove antes de responder, inclusive em capítulo
                já publicado. */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary" display="block">
                Só você lê isto
              </Typography>
              <TextField
                label="Nota sobre este capítulo"
                placeholder="O que mudar, o que não funcionou, o que falta. Cite o parágrafo."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                sx={{ mt: 1 }}
              />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Button variant="contained" size="small" disabled={salvando} onClick={() => void salvar({ notas: nota })}>
                  Salvar nota
                </Button>
                {aviso && <Typography variant="caption" color="text.secondary">{aviso}</Typography>}
              </Stack>
            </Paper>
          </>
        )}

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
