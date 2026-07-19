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
import { WIKI_SECTIONS, wikiSectionLabel, type WikiEntry } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";

interface WikiFormState {
  entryId: string | null;
  section: string;
  title: string;
  body: string;
  order: number;
}

const emptyForm: WikiFormState = {
  entryId: null,
  section: WIKI_SECTIONS[0].id,
  title: "",
  body: "",
  order: 0,
};

export function WikiManager({ token }: { token: string }) {
  const api = useApi();
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [form, setForm] = useState<WikiFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await api.adminListWiki(token));
    } catch {
      setError("Não foi possível carregar a wiki.");
    }
  }, [api, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    return WIKI_SECTIONS.map((section) => ({
      section,
      items: entries.filter((e) => e.section === section.id),
    }));
  }, [entries]);

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
    const input = { section: form.section, title: form.title, body: form.body, order: form.order };
    if (form.entryId) {
      const id = form.entryId;
      void run(() => api.adminUpdateWikiEntry(token, id, input), "Entrada atualizada.").then(() => setForm(emptyForm));
    } else {
      void run(() => api.adminCreateWikiEntry(token, input), "Entrada criada.").then(() => setForm(emptyForm));
    }
  }

  function edit(entry: WikiEntry) {
    setForm({ entryId: entry.entryId, section: entry.section, title: entry.title, body: entry.body, order: entry.order });
  }

  function remove(entry: WikiEntry) {
    void run(() => api.adminDeleteWikiEntry(token, entry.entryId), "Entrada removida.");
  }

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">Valdren História (Wiki)</Typography>
          <Typography variant="body2" color="text.secondary">
            Wiki viva do mundo, visível aos jogadores no menu lateral. Só você (admin) pode editar.
            Atualize conforme os turnos avançam. As entradas são preservadas ao reiniciar a campanha.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          {entries.length === 0 && (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                A wiki está vazia. Carregue a cosmologia inicial de Valdren (Casas, cidades, Rei Pálido,
                Brumas e histórias antigas) para começar. Depois é só editar como quiser.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                disabled={busy}
                onClick={() => void run(() => api.adminSeedWiki(token), "História de Valdren carregada.")}
              >
                Carregar história de Valdren
              </Button>
            </Box>
          )}

          <Divider />
          <Typography variant="h3" sx={{ fontSize: "1.05rem" }}>
            {form.entryId ? "Editar entrada" : "Nova entrada"}
          </Typography>
          <TextField
            select
            label="Seção"
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
            fullWidth
          >
            {WIKI_SECTIONS.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Título"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Ordem"
            type="number"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
            sx={{ maxWidth: 160 }}
          />
          <TextField
            label="Conteúdo"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            multiline
            minRows={5}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button variant="contained" disabled={busy || !form.title.trim()} onClick={save}>
              {form.entryId ? "Salvar alterações" : "Adicionar entrada"}
            </Button>
            {form.entryId && (
              <Button variant="text" disabled={busy} onClick={() => setForm(emptyForm)}>
                Cancelar edição
              </Button>
            )}
          </Stack>

          <Divider />
          {grouped.map(({ section, items }) => (
            <Box key={section.id}>
              <Typography variant="h3" sx={{ fontSize: "1.05rem", mb: 1 }}>
                {wikiSectionLabel(section.id)}
              </Typography>
              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma entrada.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {items.map((entry) => (
                    <Box
                      key={entry.entryId}
                      sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
                    >
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1">{entry.title}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                            {entry.body.length > 160 ? `${entry.body.slice(0, 160)}…` : entry.body}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" disabled={busy} onClick={() => edit(entry)}>
                            Editar
                          </Button>
                          <Button size="small" color="error" disabled={busy} onClick={() => remove(entry)}>
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
