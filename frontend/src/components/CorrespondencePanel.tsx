import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import { LoadingState } from "./LoadingState";
import type { CorrespondenceRecipient, DiplomaticMessageView } from "../api/client";

interface CorrespondencePanelProps {
  playerToken: string;
  houseName: string;
}

/**
 * Correspondência entre as Casas, entre um turno e outro.
 *
 * O orçamento de cartas vem da distância real até a sede da outra Casa, então a
 * tela mostra os dias de viagem junto do que resta: recusar uma carta sem dizer
 * o porquê pareceria arbitrário, e a distância é justamente a regra do jogo.
 */
export function CorrespondencePanel({ playerToken, houseName }: CorrespondencePanelProps) {
  const api = useApi();
  const [recipients, setRecipients] = useState<CorrespondenceRecipient[] | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CorrespondenceRecipient | null>(null);
  const [thread, setThread] = useState<DiplomaticMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.getCorrespondence(playerToken);
      setRecipients(r.entries);
      setOpen(r.open);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a correspondência.");
    }
  }, [api, playerToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(
    async (r: CorrespondenceRecipient) => {
      setSelected(r);
      setNotice(null);
      setThread(await api.getCorrespondenceThread(playerToken, r.houseKey).catch(() => []));
    },
    [api, playerToken],
  );

  const send = useCallback(async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.sendCorrespondence(playerToken, { toHouseKey: selected.houseKey, body: draft.trim() });
      setThread((t) => [...t, res.sent, ...(res.reply ? [res.reply] : [])]);
      setDraft("");
      if (res.replyFailed) {
        // A carta foi entregue; só a resposta falhou. Dizer isso evita que o
        // jogador ache que perdeu o envio.
        setNotice("A carta seguiu, mas a resposta não chegou desta vez.");
      }
      await load();
      setSelected((s) => (s ? { ...s, remaining: res.remaining } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }, [api, playerToken, selected, draft, load]);

  if (error && !recipients) {
    return <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>{error}</Alert>;
  }
  if (!recipients) return <LoadingState />;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Envie cartas às outras Casas. Quantas cabem por turno depende de quão longe fica a sede delas.
      </Typography>

      {!open && <Alert severity="info" sx={{ mb: 2 }}>A correspondência só circula com o turno aberto.</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, gap: 2 }}>
        <Paper variant="outlined">
          <List dense disablePadding>
            {recipients.map((r) => (
              <ListItemButton
                key={r.houseKey}
                selected={selected?.houseKey === r.houseKey}
                disabled={r.playerControlled}
                onClick={() => void openThread(r)}
              >
                <ListItemText
                  primary={r.name}
                  secondary={
                    r.playerControlled
                      ? "conduzida por outro jogador"
                      : `${r.seat} · ~${r.days} dias · ${r.remaining} de ${r.sends}`
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Box>
          {!selected ? (
            <Typography color="text.secondary">Escolha uma Casa para escrever.</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">{selected.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={`${selected.seat} · ~${selected.days} dias`} />
                  <Chip
                    size="small"
                    color={selected.remaining > 0 ? "primary" : "default"}
                    label={`${selected.remaining} de ${selected.sends} cartas`}
                  />
                </Stack>
              </Box>

              <Divider />

              <Stack spacing={1}>
                {thread.map((m) => (
                  <Paper
                    key={m.id}
                    variant="outlined"
                    sx={{ p: 1.5, bgcolor: m.author === "PLAYER" ? "action.hover" : "transparent" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {m.author === "PLAYER" ? houseName : selected.name}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.body}</Typography>
                  </Paper>
                ))}
                {thread.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Nenhuma carta trocada neste turno.</Typography>
                )}
              </Stack>

              {notice && <Alert severity="warning">{notice}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}

              {selected.remaining > 0 && open ? (
                <Stack spacing={1}>
                  <TextField
                    label={`Carta para ${selected.name}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    multiline
                    minRows={4}
                    fullWidth
                  />
                  <Box>
                    <Button variant="contained" disabled={sending || !draft.trim()} onClick={() => void send()}>
                      {sending ? "Enviando…" : "Enviar carta"}
                    </Button>
                  </Box>
                </Stack>
              ) : (
                open && (
                  <Alert severity="info">
                    Sem mensageiros disponíveis para {selected.name} neste turno. {selected.seat} fica a cerca de{" "}
                    {selected.days} dias de viagem.
                  </Alert>
                )
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
