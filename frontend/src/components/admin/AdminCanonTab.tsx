import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  wikiSectionLabel,
  CANON_VERDICT_LABELS,
  CANON_SUBMISSION_STATUS_LABELS,
  VISUAL_ENTITY_TYPE_LABELS,
  type CanonSubmission,
} from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { ApiError } from "../../types/api";

const SEVERITY_COLOR = { BLOCK: "error", WARN: "warning", INFO: "info" } as const;

export function AdminCanonTab({ adminToken, busy, onError }: { adminToken: string; busy: boolean; onError: (m: string) => void }) {
  const api = useApi();
  const [submissions, setSubmissions] = useState<CanonSubmission[]>([]);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setSubmissions(await api.adminCanonList(adminToken)); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Erro ao carregar propostas."); }
  }, [api, adminToken, onError]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); await load(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setWorking(false); }
  }, [load, onError]);

  const pending = useMemo(() => submissions.filter((s) => s.status === "PENDING_GM"), [submissions]);
  const judged = useMemo(() => submissions.filter((s) => s.status !== "PENDING_GM"), [submissions]);
  const disabled = busy || working;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Propostas de cânone</Typography>
      {pending.length === 0 && <Typography color="text.secondary">Nenhuma proposta aguardando revisão.</Typography>}

      {pending.map((s) => (
        <Card key={s.id} variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                <Typography fontWeight="bold">{s.proposal.title}</Typography>
                <Chip size="small" label={s.authorName} />
                <Chip size="small" label={wikiSectionLabel(s.proposal.section)} />
                {s.proposal.entityType ? <Chip size="small" label={VISUAL_ENTITY_TYPE_LABELS[s.proposal.entityType]} /> : null}
              </Stack>

              {s.review ? (
                <Chip
                  size="small"
                  label={`Parecer da IA: ${CANON_VERDICT_LABELS[s.review.verdict]}`}
                  sx={{ alignSelf: "flex-start" }}
                />
              ) : (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label="Crítica da IA indisponível — revise mesmo assim."
                  sx={{ alignSelf: "flex-start" }}
                />
              )}

              <Typography variant="body2" color="text.secondary">Pedido original: {s.rawText}</Typography>

              {s.review?.flags.map((flag, i) => (
                <Alert key={i} severity={SEVERITY_COLOR[flag.severity]}>
                  {flag.message}
                </Alert>
              ))}

              {s.rawImageUrl ? <img src={s.rawImageUrl} alt="" style={{ maxWidth: 320, borderRadius: 4 }} /> : null}

              <TextField
                label="Verbete (edite antes de publicar)"
                value={bodies[s.id] ?? s.proposal.body}
                onChange={(e) => setBodies((prev) => ({ ...prev, [s.id]: e.target.value }))}
                multiline
                minRows={6}
                fullWidth
              />

              <TextField
                label="Nota para o jogador"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                fullWidth
              />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  disabled={disabled}
                  onClick={() => void run(() => api.adminCanonApprove(adminToken, {
                    submissionId: s.id,
                    proposal: { ...s.proposal, body: bodies[s.id] ?? s.proposal.body },
                  }))}
                >
                  Aprovar e publicar
                </Button>
                <Button
                  color="error"
                  disabled={disabled}
                  onClick={() => void run(() => api.adminCanonReject(adminToken, { submissionId: s.id, note: notes[s.id] ?? "" }))}
                >
                  Recusar
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Typography variant="h6">Já julgadas</Typography>
      {judged.length === 0 && <Typography color="text.secondary">Nada julgado ainda.</Typography>}
      {judged.map((s) => (
        <Card key={s.id} variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography>{s.proposal.title}</Typography>
              <Chip size="small" label={CANON_SUBMISSION_STATUS_LABELS[s.status]} />
            </Stack>
            {s.gmNote ? <Typography variant="body2" color="text.secondary">{s.gmNote}</Typography> : null}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
