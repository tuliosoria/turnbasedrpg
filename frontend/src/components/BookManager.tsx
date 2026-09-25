import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { BOOK_PARTS, bookPartLabel, type BookChapter } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { resumir } from "../utils/resumir";

interface BookFormState {
  chapterId: string | null;
  part: string;
  title: string;
  body: string;
  order: number;
  status: "rascunho" | "publicado";
}

const emptyForm: BookFormState = {
  chapterId: null,
  part: BOOK_PARTS[0].id,
  title: "",
  body: "",
  order: 0,
  status: "rascunho",
};

export function BookManager({ token }: { token: string }) {
  const api = useApi();
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [form, setForm] = useState<BookFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setChapters(await api.adminListBook(token));
    } catch {
      setError("Não foi possível carregar o livro.");
    }
  }, [api, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    return BOOK_PARTS.map((part) => ({
      part,
      items: chapters
        .filter((c) => c.part === part.id)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }));
  }, [chapters]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch {
      setError("Ação falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const input = {
      part: form.part,
      title: form.title,
      body: form.body,
      order: form.order,
      status: form.status,
    };
    if (form.chapterId) {
      const id = form.chapterId;
      void run(() => api.adminUpdateBookChapter(token, id, input), "Capítulo atualizado.").then(() => setForm(emptyForm));
    } else {
      void run(() => api.adminCreateBookChapter(token, input), "Capítulo criado.").then(() => setForm(emptyForm));
    }
  }

  function edit(chapter: BookChapter) {
    setForm({
      chapterId: chapter.chapterId,
      part: chapter.part,
      title: chapter.title,
      body: chapter.body,
      order: chapter.order,
      status: chapter.status,
    });
  }

  function remove(chapter: BookChapter) {
    void run(() => api.adminDeleteBookChapter(token, chapter.chapterId), "Capítulo removido.");
  }

  function move(part: string, items: BookChapter[], index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((c) => c.chapterId);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved);
    void run(() => api.adminReorderBook(token, part, ids), "Ordem atualizada.");
  }

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">O Livro</Typography>
          <Typography variant="body2" color="text.secondary">
            O romance de Valdren, lido pelos jogadores em /livro. Só você (Mestre) edita. Cada capítulo
            pertence a uma parte e tem uma ordem. Capítulos em rascunho ficam invisíveis ao público.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          {chapters.length === 0 && (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                O livro está vazio. Carregue o manuscrito de Valdren (prólogo e as três partes) para
                começar. Depois é só editar como quiser.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                disabled={busy}
                onClick={() => void run(() => api.adminSeedBook(token), "Manuscrito carregado.")}
              >
                Carregar o livro
              </Button>
            </Box>
          )}

          <Divider />
          <Typography variant="h3" sx={{ fontSize: "1.05rem" }}>
            {form.chapterId ? "Editar capítulo" : "Novo capítulo"}
          </Typography>
          <TextField
            select
            label="Parte"
            value={form.part}
            onChange={(e) => setForm((f) => ({ ...f, part: e.target.value }))}
            fullWidth
          >
            {BOOK_PARTS.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Título"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Ordem"
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
              sx={{ maxWidth: 160 }}
            />
            <TextField
              select
              label="Situação"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "rascunho" | "publicado" }))}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="rascunho">Rascunho</MenuItem>
              <MenuItem value="publicado">Publicado</MenuItem>
            </TextField>
          </Stack>
          <TextField
            label="Conteúdo"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            multiline
            minRows={8}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button variant="contained" disabled={busy || !form.title.trim()} onClick={save}>
              {form.chapterId ? "Salvar alterações" : "Adicionar capítulo"}
            </Button>
            {form.chapterId && (
              <Button variant="text" disabled={busy} onClick={() => setForm(emptyForm)}>
                Cancelar edição
              </Button>
            )}
          </Stack>

          <Divider />
          {grouped.map(({ part, items }) => (
            <Box key={part.id}>
              <Typography variant="h3" sx={{ fontSize: "1.05rem", mb: 1 }}>
                {bookPartLabel(part.id)}
              </Typography>
              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum capítulo.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {items.map((chapter, index) => (
                    <Box
                      key={chapter.chapterId}
                      data-chapter={chapter.chapterId}
                      sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
                    >
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1">
                            {chapter.title}
                            {chapter.status === "rascunho" && (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                (rascunho)
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                            {resumir(chapter.body)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            disabled={busy || index === 0}
                            onClick={() => move(part.id, items, index, -1)}
                            aria-label={`Subir ${chapter.title}`}
                          >
                            ↑
                          </Button>
                          <Button
                            size="small"
                            disabled={busy || index === items.length - 1}
                            onClick={() => move(part.id, items, index, 1)}
                            aria-label={`Descer ${chapter.title}`}
                          >
                            ↓
                          </Button>
                          <Button size="small" disabled={busy} onClick={() => edit(chapter)}>
                            Editar
                          </Button>
                          <Button size="small" color="error" disabled={busy} onClick={() => remove(chapter)}>
                            Remover
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
