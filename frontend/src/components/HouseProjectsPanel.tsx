import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { ApiError, type ProjectCard, type ProjectsView, type ProjectTemplate } from "../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  MILITARY: "Militar", INFRASTRUCTURE: "Infraestrutura", ECONOMY: "Economia", DIPLOMACY: "Diplomacia",
  INTELLIGENCE: "Espionagem", SOCIETY: "Sociedade", MAGIC: "Magia", EXPLORATION: "Exploração",
};

function costLabel(costs: ProjectTemplate["costs"]): string {
  if (!costs.length) return "Sem custo";
  const names: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };
  return costs.map((c) => `${c.amount} ${names[c.type] ?? c.type}`).join(", ");
}

export function HouseProjectsPanel({ playerToken, onChanged }: { playerToken: string; onChanged: () => void }) {
  const api = useApi();
  const [data, setData] = useState<ProjectsView | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [proposal, setProposal] = useState<ProjectCard | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.getProjects(playerToken)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, playerToken]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setBusy(false); }
  }, [load, onChanged]);

  const active = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "ACTIVE" || p.status === "PAUSED"), [data]);
  const pending = useMemo(() => (data?.projects ?? []).filter((p) => ["PENDING_PLAYER", "PENDING_GM", "PENDING_TARGET"].includes(p.status)), [data]);
  const recommended = useMemo(() => {
    const rec = data?.recommended ?? [];
    const byId = new Map((data?.templates ?? []).map((t) => [t.id, t]));
    return rec.map((id) => byId.get(id)).filter((t): t is ProjectTemplate => !!t);
  }, [data]);
  const templates = useMemo(() => {
    let list = data?.templates ?? [];
    if (filter !== "ALL") list = list.filter((t) => t.category === filter);
    if (search.trim()) list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [data, filter, search]);

  if (!data) return null;
  const slotFull = active.length >= data.slotLimit;

  const templateCard = (t: ProjectTemplate, highlight = false) => (
    <Card key={t.id} variant="outlined" sx={highlight ? { borderColor: "secondary.main" } : undefined}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight="bold">{t.title}</Typography>
          <Chip size="small" label={CATEGORY_LABELS[t.category]} />
        </Stack>
        <Typography variant="body2" sx={{ my: 0.5 }}>{t.description}</Typography>
        <Typography variant="caption" display="block">Duração: {t.durationTurns} turnos · Custo: {costLabel(t.costs)}</Typography>
        <Button size="small" sx={{ mt: 1 }} disabled={busy || slotFull}
          onClick={() => { if (confirm(`Iniciar "${t.title}"? Custo: ${costLabel(t.costs)}.`)) void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id })); }}>
          Iniciar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Projetos da Casa</Typography>
          <Chip label={`Estabilidade: ${data.stability}`} color="secondary" size="small" />
        </Stack>
        {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Projetos Ativos (${active.length}/${data.slotLimit})`} />
          <Tab label="Biblioteca" />
          <Tab label={`Favores (${data.favors.length})`} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            {active.length === 0 && recommended.length > 0 && (
              <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Sua Casa ainda não tem projetos ativos. Comece por uma das cartas recomendadas para sua especialidade.
                </Alert>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Cartas recomendadas para sua Casa</Typography>
                <Stack spacing={2}>
                  {recommended.map((t) => templateCard(t, true))}
                </Stack>
              </Box>
            )}
            {active.length === 0 && recommended.length === 0 && <Typography color="text.secondary">Nenhum projeto ativo.</Typography>}
            {active.map((p) => (
              <Card key={p.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight="bold">{p.title}</Typography>
                    <Chip size="small" label={CATEGORY_LABELS[p.category]} />
                  </Stack>
                  {p.status === "PAUSED" && <Chip size="small" color="warning" label="Pausado" sx={{ my: 0.5 }} />}
                  <Typography variant="body2" sx={{ my: 1 }}>{p.description}</Typography>
                  <LinearProgress variant="determinate" value={(p.turnsCompleted / p.durationTurns) * 100} sx={{ my: 1 }} />
                  <Typography variant="caption">{p.turnsCompleted} de {p.durationTurns} turnos</Typography>
                  <Box>
                    <Button size="small" color="error" disabled={busy}
                      onClick={() => { if (confirm("Cancelar o projeto? O cancelamento não gera reembolso.")) void run(() => api.cancelProject(playerToken, { projectId: p.id })); }}>
                      Cancelar
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {pending.map((p) => (
              <Alert key={p.id} severity="info">
                {p.title} — {p.status === "PENDING_GM" ? "aguardando o mestre" : p.status === "PENDING_TARGET" ? "aguardando outra Casa" : "aguardando sua decisão"}
                {p.status === "PENDING_PLAYER" && (
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" disabled={busy} onClick={() => void run(() => api.acceptProject(playerToken, { projectId: p.id }))}>Aceitar</Button>
                    <Button size="small" disabled={busy} onClick={() => void run(() => api.submitProjectToGm(playerToken, { projectId: p.id }))}>Enviar ao mestre</Button>
                  </Box>
                )}
              </Alert>
            ))}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            {recommended.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Cartas recomendadas para sua Casa</Typography>
                <Stack spacing={2}>
                  {recommended.map((t) => templateCard(t, true))}
                </Stack>
              </Box>
            )}
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Categoria" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="ALL">Todas</MenuItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
              <Button variant="outlined" onClick={() => setCreateOpen(true)}>Criar minha carta</Button>
            </Stack>
            {slotFull && <Alert severity="warning">Limite de projetos ativos atingido.</Alert>}
            {templates.map((t) => templateCard(t))}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1}>
            {data.favors.length === 0 && <Typography color="text.secondary">Nenhum favor pendente.</Typography>}
            {data.favors.map((f) => (
              <Alert key={f.id} severity="info"
                action={<>
                  <Button size="small" disabled={busy} onClick={() => void run(() => api.respondToFavor(playerToken, { favorId: f.id, accept: true }))}>Aceitar</Button>
                  <Button size="small" color="error" disabled={busy} onClick={() => void run(() => api.respondToFavor(playerToken, { favorId: f.id, accept: false }))}>Recusar</Button>
                </>}>
                {f.reason} (de {f.fromHouseId})
              </Alert>
            ))}
          </Stack>
        )}
      </CardContent>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Criar minha carta</DialogTitle>
        <DialogContent>
          {!proposal ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="O que sua Casa deseja realizar?" value={request} onChange={(e) => setRequest(e.target.value)} multiline minRows={3} fullWidth />
              <TextField select label="Nível de risco" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as "low" | "medium" | "high")}>
                <MenuItem value="low">Baixo</MenuItem>
                <MenuItem value="medium">Médio</MenuItem>
                <MenuItem value="high">Alto</MenuItem>
              </TextField>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography fontWeight="bold">{proposal.title}</Typography>
              <Typography variant="body2">{proposal.description}</Typography>
              <Typography variant="caption">Duração: {proposal.durationTurns} turnos · Custo: {costLabel(proposal.costs)}</Typography>
              {proposal.aiBalanceExplanation && <Alert severity="info">{proposal.aiBalanceExplanation}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!proposal ? (
            <Button disabled={busy || !request.trim()} onClick={async () => {
              setBusy(true); setError(null);
              try { setProposal(await api.analyzeCustomProject(playerToken, { request, riskLevel })); }
              catch (e) { setError(e instanceof ApiError ? e.message : "Falha ao analisar."); }
              finally { setBusy(false); }
            }}>Analisar</Button>
          ) : (
            <>
              <Button onClick={() => setProposal(null)}>Pedir ajuste</Button>
              <Button variant="contained" disabled={busy} onClick={() => void run(async () => {
                await api.acceptProject(playerToken, { projectId: proposal.id });
                setProposal(null); setRequest(""); setCreateOpen(false);
              })}>Aceitar</Button>
            </>
          )}
          <Button onClick={() => { setCreateOpen(false); setProposal(null); }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
