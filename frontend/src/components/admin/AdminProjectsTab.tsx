import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { ApiError, type ProjectCard } from "../../types/api";

export function AdminProjectsTab({ adminToken, busy, onError }: { adminToken: string; busy: boolean; onError: (m: string) => void }) {
  const api = useApi();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setProjects(await api.adminListProjects(adminToken)); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, adminToken, onError]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); await load(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setWorking(false); }
  }, [load, onError]);

  const pending = useMemo(() => projects.filter((p) => p.status === "PENDING_GM"), [projects]);
  const activeOrPaused = useMemo(() => projects.filter((p) => p.status === "ACTIVE" || p.status === "PAUSED"), [projects]);
  const disabled = busy || working;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Aprovações pendentes</Typography>
      {pending.length === 0 && <Typography color="text.secondary">Nenhum projeto aguardando aprovação.</Typography>}
      {pending.map((p) => (
        <Card key={p.id} variant="outlined">
          <CardContent>
            <Typography fontWeight="bold">{p.title} <Chip size="small" label={p.houseId} /></Typography>
            {p.playerOriginalRequest && <Typography variant="body2" color="text.secondary">Pedido: {p.playerOriginalRequest}</Typography>}
            <Typography variant="body2" sx={{ my: 1 }}>{p.description}</Typography>
            <Typography variant="caption" display="block">Duração: {p.durationTurns} turnos</Typography>
            {p.aiBalanceExplanation && <Alert severity="info" sx={{ my: 1 }}>{p.aiBalanceExplanation}</Alert>}
            <TextField size="small" fullWidth label="Nota do mestre" value={notes[p.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} sx={{ my: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={disabled} onClick={() => void run(() => api.adminApproveProject(adminToken, { projectId: p.id, note: notes[p.id] }))}>Aprovar</Button>
              <Button color="error" disabled={disabled} onClick={() => void run(() => api.adminRejectProject(adminToken, { projectId: p.id, note: notes[p.id] ?? "Rejeitado." }))}>Rejeitar</Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Typography variant="h6">Projetos ativos</Typography>
      {activeOrPaused.length === 0 && <Typography color="text.secondary">Nenhum projeto ativo.</Typography>}
      {activeOrPaused.map((p) => (
        <Card key={p.id} variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography>{p.title} <Chip size="small" label={p.houseId} /> <Chip size="small" label={p.status} /></Typography>
              {p.status === "ACTIVE"
                ? <Button size="small" disabled={disabled} onClick={() => void run(() => api.adminPauseProject(adminToken, { projectId: p.id }))}>Pausar</Button>
                : <Button size="small" disabled={disabled} onClick={() => void run(() => api.adminResumeProject(adminToken, { projectId: p.id }))}>Retomar</Button>}
            </Stack>
            <Typography variant="caption">{p.turnsCompleted} de {p.durationTurns} turnos</Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
