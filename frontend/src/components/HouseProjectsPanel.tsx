import { useCallback, useEffect, useMemo, useState } from "react";
import { resumoDoGanho } from "@ravenloft/content";
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
import Slider from "@mui/material/Slider";
import { useApi } from "../api/ApiProvider";
import { CATEGORY_LABELS, SEATS, seatKeyForHouseId } from "@ravenloft/content";
import { ApiError, type ProjectsView, type ProjectTemplate, type CustomCardDraft } from "../types/api";
import { CARD_TITLE_MAX, CARD_DESCRIPTION_MAX } from "@ravenloft/content";

const COST_NAMES: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };


function costLabel(costs: ProjectTemplate["costs"]): string {
  if (!costs.length) return "Sem custo";
  const names: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };
  return costs.map((c) => `${c.amount} ${names[c.type] ?? c.type}`).join(", ");
}

/** Quais atributos desta carta a Casa já não consegue absorver. */
function atributosNoTeto(
  efeitos: ProjectTemplate["completionEffects"],
  attrs: { riqueza: number; recursos: number; soldados: number; controle: number } | undefined,
): string[] {
  if (!attrs) return [];
  const nomes: Record<string, string> = { riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados", controle: "Controle" };
  return efeitos.attributeChanges
    .filter((c) => c.permanent && c.amount > 0 && c.attribute !== "stability" && (attrs as Record<string, number>)[c.attribute] >= 5)
    .map((c) => nomes[c.attribute] ?? c.attribute);
}

/** O que N pontos de Energia fazem com esta carta, em palavras. */
function efeitoDaEnergia(pontos: number, turnsCompleted: number, durationTurns: number, distribuiu: boolean): string {
  if (pontos <= 0) {
    return distribuiu
      ? "Sem Energia neste turno: o projeto fica parado."
      : "Sem distribuição, o projeto anda um turno, como sempre andou.";
  }
  const depois = Math.min(turnsCompleted + pontos, durationTurns);
  if (depois >= durationTurns) return `Com ${pontos} de Energia, conclui neste turno.`;
  return `Com ${pontos} de Energia, chega a ${depois} de ${durationTurns}; faltam ${durationTurns - depois} turnos.`;
}

/**
 * O painel serve a duas abas de /game.
 *
 * Em "Projetos" ele mostra tudo menos espionagem; em "Espiões", só espionagem.
 * Comprar um rumor no Porto e erguer um aqueduto são atividades diferentes, e
 * misturá-las fazia a compra de informação sumir no meio de setenta cartas —
 * mas a lógica de custo, Energia e início é a mesma, então o componente é um só
 * com um recorte.
 */
export function HouseProjectsPanel({ playerToken, houseName, categoria, excluirCategoria, titulo, onChanged }: {
  playerToken: string;
  houseName?: string;
  /** Mostra só esta categoria, e esconde os chips: a aba já é o filtro. */
  categoria?: string;
  /** Tira esta categoria da lista, porque ela mora em outra aba. */
  excluirCategoria?: string;
  titulo?: string;
  onChanged: () => void;
}) {
  const api = useApi();
  const [data, setData] = useState<ProjectsView | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Catorze modelos de diplomacia pedem uma Casa alvo. Sem perguntar qual, a
  // carta era gravada esperando a resposta de ninguém e nunca saía do lugar.
  const [alvoDe, setAlvoDe] = useState<ProjectTemplate | null>(null);
  const [alvo, setAlvo] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardBody, setCardBody] = useState("");
  const [draft, setDraft] = useState<CustomCardDraft | null>(null);
  const [rulesEdited, setRulesEdited] = useState(false);
  const [energia, definirEnergia] = useState<Record<string, number>>({});

  const resetCreate = useCallback(() => {
    setCreateOpen(false); setDraft(null); setRulesEdited(false); setCardTitle(""); setCardBody("");
  }, []);

  const patchDraft = useCallback((patch: Partial<CustomCardDraft>, isRule: boolean) => {
    setDraft((d) => (d ? { ...d, ...patch, playerEditedRules: d.playerEditedRules || isRule } : d));
    if (isRule) setRulesEdited(true);
  }, []);

  const load = useCallback(async () => {
    try { setData(await api.getProjects(playerToken)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, playerToken]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { if (data?.energia) definirEnergia(data.energia.porProjeto); }, [data]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setBusy(false); }
  }, [load, onChanged]);

  // O recorte vale para tudo que a aba mostra: projeto ativo de espionagem
  // aparece em Espiões, e não em Projetos.
  const noRecorte = useCallback(
    (c: string) => (categoria ? c === categoria : excluirCategoria ? c !== excluirCategoria : true),
    [categoria, excluirCategoria],
  );
  const active = useMemo(
    () => (data?.projects ?? []).filter((p) => (p.status === "ACTIVE" || p.status === "PAUSED") && noRecorte(p.category)),
    [data, noRecorte],
  );
  const pending = useMemo(() => (data?.projects ?? []).filter((p) => ["PENDING_PLAYER", "PENDING_GM", "PENDING_TARGET"].includes(p.status) && noRecorte(p.category)), [data, noRecorte]);
  const finished = useMemo(() => (data?.projects ?? []).filter((p) => (p.status === "COMPLETED" || p.status === "FAILED") && noRecorte(p.category)), [data, noRecorte]);
  const recommended = useMemo(() => {
    const rec = data?.recommended ?? [];
    const byId = new Map((data?.templates ?? []).map((t) => [t.id, t]));
    return rec.map((id) => byId.get(id)).filter((t): t is ProjectTemplate => !!t).filter((t) => noRecorte(t.category));
  }, [data, noRecorte]);
  const templates = useMemo(() => {
    let list = (data?.templates ?? []).filter((t) => noRecorte(t.category));
    if (filter !== "ALL") list = list.filter((t) => t.category === filter);
    // Buscar só no título obriga o jogador a já saber o nome do que procura.
    // A descrição é onde estão as palavras que ele tem na cabeça.
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(q));
    return list;
  }, [data, filter, search, noRecorte]);

  if (!data) return null;
  const slotFull = active.length >= data.slotLimit;
  const energiaGasta = Object.values(energia).reduce((n, v) => n + v, 0);
  // Um frontend novo pode falar com um backend antigo durante o deploy. Sem o
  // campo, a Energia some da tela inteira em vez de aparecer como "0/0" com um
  // botão que só daria erro.
  const temEnergia = Boolean(data.energia);
  const energiaTotal = data.energia?.total ?? 0;
  const energiaLivre = energiaTotal - energiaGasta;

  const templateCard = (t: ProjectTemplate, highlight = false) => (
    <Card key={t.id} variant="outlined" sx={highlight ? { borderColor: "secondary.main" } : undefined}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight="bold">{t.title}</Typography>
          <Chip size="small" label={CATEGORY_LABELS[t.category]} />
        </Stack>
        <Typography variant="body2" sx={{ my: 0.5 }}>{t.description}</Typography>
        <Typography variant="caption" display="block">Duração: {t.durationTurns} turnos · Custo: {costLabel(t.costs)}</Typography>
        <Typography variant="caption" display="block" color="success.main">Ganho: {resumoDoGanho(t.completionEffects, t.pagamentoNarrativo)}</Typography>
        {t.completionEffects.qualitativeEffects.length > 0 && (
          <Typography variant="caption" display="block" color="text.secondary">
            O Mestre honra na narrativa: {t.completionEffects.qualitativeEffects.join(" ")}
          </Typography>
        )}
        {atributosNoTeto(t.completionEffects, data?.attributes).map((nome) => (
          <Typography key={nome} variant="caption" display="block" color="warning.main">
            Sua {nome} já está no teto; este ganho virá como Estabilidade ou como um ativo.
          </Typography>
        ))}
        <Button size="small" sx={{ mt: 1 }} disabled={busy || slotFull}
          onClick={() => {
            if (t.requiresTargetApproval || t.requiresSecretTarget) { setAlvo(""); setAlvoDe(t); return; }
            if (confirm(`Iniciar "${t.title}"?\n\nCusto: ${costLabel(t.costs)}\nGanho ao concluir: ${resumoDoGanho(t.completionEffects, t.pagamentoNarrativo)}`)) {
              void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id }));
            }
          }}>
          Iniciar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{titulo ?? "Projetos da Casa"}</Typography>
          <Chip label={`Estabilidade: ${data.stability}`} color="secondary" size="small" />
          {temEnergia && <Chip label={`Energia: ${energiaLivre}/${energiaTotal}`} color={energiaLivre === 0 ? "default" : "primary"} size="small" />}
        </Stack>
        {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Projetos Ativos (${active.length}/${data.slotLimit})`} />
          <Tab label="Biblioteca" />
          {/* Uma aba que vive dizendo (0) ensina o jogador a ignorá-la. */}
          {data.favors.length > 0 && <Tab label={`Favores (${data.favors.length})`} />}
        </Tabs>

        <Button variant="contained" fullWidth sx={{ mb: 2 }} onClick={() => setCreateOpen(true)}>
          ✍️ Propor um projeto próprio
        </Button>

        {tab === 0 && (
          <Stack spacing={2}>
            {active.length === 0 && recommended.length > 0 && (
              <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Sua Casa ainda não tem projetos ativos. Comece por um dos projetos recomendados para sua especialidade.
                </Alert>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Projetos recomendados para sua Casa</Typography>
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
                  <Typography variant="caption" display="block" color="success.main">
                    Ao concluir: {resumoDoGanho(p.completionEffects, p.pagamentoNarrativo)}
                  </Typography>
                  {p.status === "ACTIVE" && (data.energia?.tetoPorProjeto[p.id] ?? 0) > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">Energia neste projeto: {energia[p.id] ?? 0}</Typography>
                      <Slider
                        size="small"
                        value={energia[p.id] ?? 0}
                        min={0}
                        max={data.energia?.tetoPorProjeto[p.id] ?? 0}
                        step={1}
                        marks
                        disabled={busy}
                        aria-label={`Energia em ${p.title}`}
                        onChange={(_e, v) => definirEnergia((atual) => ({ ...atual, [p.id]: Array.isArray(v) ? v[0] : v }))}
                      />
                      <Typography variant="caption" display="block" color="text.secondary">
                        {efeitoDaEnergia(energia[p.id] ?? 0, p.turnsCompleted, p.durationTurns, Boolean(data.energia?.distribuiu) || energiaGasta > 0)}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Button size="small" color="error" disabled={busy}
                      onClick={() => { if (confirm("Cancelar o projeto? O cancelamento não gera reembolso.")) void run(() => api.cancelProject(playerToken, { projectId: p.id })); }}>
                      Cancelar
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {temEnergia && active.some((p) => p.status === "ACTIVE") && (
              <Box>
                {energiaLivre < 0 && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Sua Casa tem {energiaTotal} de Energia por turno, e você distribuiu {energiaGasta}.
                  </Alert>
                )}
                <Button variant="contained" disabled={busy || energiaLivre < 0 || energiaGasta === 0}
                  onClick={() => void run(() => api.setEnergia(playerToken, { porProjeto: energia }))}>
                  Distribuir Energia
                </Button>
                {energiaGasta === 0 && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                    Mova a Energia de alguma carta para distribuir. Sem distribuir, cada carta anda um turno.
                  </Typography>
                )}
              </Box>
            )}
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
            {finished.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>Projetos concluídos</Typography>
                <Stack spacing={2}>
                  {finished.map((p) => {
                    const ok = p.status === "COMPLETED";
                    return (
                      <Card key={p.id} variant="outlined" sx={{ borderColor: ok ? "success.main" : "error.main" }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography fontWeight="bold">{p.title}</Typography>
                            <Chip size="small" color={ok ? "success" : "error"} label={ok ? "Concluído com êxito" : "Fracassou"} />
                          </Stack>
                          {ok && (
                            <Typography variant="caption" display="block" color="success.main" sx={{ mt: 1 }}>
                              Recebido: {resumoDoGanho(p.completionEffects, p.pagamentoNarrativo)}
                            </Typography>
                          )}
                          {p.outcomeNarrative && (
                            <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>{p.outcomeNarrative}</Typography>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            {/* Com 65 cartas, procurar vem antes de navegar. O filtro estava
                embaixo do bloco de recomendadas e quase ninguém rolava até ele. */}
            {/* Categoria num select escondia setenta cartas atrás de dois
                cliques e da suposição de que "Espionagem" é onde se compra
                informação. Em chips, a lista se anuncia. */}
            {/* Com a aba já recortando a categoria, os chips só repetiriam o
                que o jogador acabou de escolher. */}
            {!categoria && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip
                label="Todas"
                size="small"
                color={filter === "ALL" ? "primary" : "default"}
                variant={filter === "ALL" ? "filled" : "outlined"}
                onClick={() => setFilter("ALL")}
              />
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <Chip
                  key={k}
                  label={v}
                  size="small"
                  color={filter === k ? "primary" : "default"}
                  variant={filter === k ? "filled" : "outlined"}
                  onClick={() => setFilter(k)}
                />
              ))}
            </Stack>
            )}
            <TextField size="small" label="Buscar por nome ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
            {slotFull && <Alert severity="warning">Limite de projetos ativos atingido.</Alert>}
            {!search.trim() && filter === "ALL" && recommended.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Projetos recomendados para sua Casa</Typography>
                <Stack spacing={2}>
                  {recommended.map((t) => templateCard(t, true))}
                </Stack>
              </Box>
            )}
            {/* O total é o do recorte, não o do baralho: numa aba que só mostra
                espionagem, "16 de 70" faz o jogador achar que 54 sumiram. */}
            <Typography variant="caption" color="text.secondary">
              {templates.length} de {(data.templates ?? []).filter((t) => noRecorte(t.category)).length}
              {categoria ? " cartas de espionagem" : " projetos"}
            </Typography>
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

      {/* Uma carta de diplomacia é feita COM alguém. Perguntar antes de gravar
          é o que impede que ela fique esperando a resposta de ninguém. */}
      <Dialog open={!!alvoDe} onClose={() => setAlvoDe(null)} fullWidth maxWidth="xs">
        <DialogTitle>{alvoDe?.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {alvoDe?.requiresSecretTarget
              ? "Contra qual Casa? Ela não será consultada nem avisada."
              : "Com qual Casa? A carta fica aguardando a resposta dela antes de começar."}
          </Typography>
          <TextField
            select
            fullWidth
            label="Casa"
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
          >
            {SEATS.filter((seat) => seat.key !== (houseName ? seatKeyForHouseId(houseName) : null)).map((seat) => (
              <MenuItem key={seat.key} value={seat.key}>{seat.name}</MenuItem>
            ))}
          </TextField>
          {alvoDe && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Custo: {costLabel(alvoDe.costs)} · Ganho ao concluir: {resumoDoGanho(alvoDe.completionEffects, alvoDe.pagamentoNarrativo)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlvoDe(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!alvo || busy}
            onClick={() => {
              const t = alvoDe;
              setAlvoDe(null);
              if (t) void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id, targetHouseKey: alvo }));
            }}
          >
            {alvoDe?.requiresSecretTarget ? "Começar" : "Enviar proposta"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={resetCreate} fullWidth maxWidth="sm">
        <DialogTitle>Propor um projeto próprio</DialogTitle>
        <DialogContent>
          {!draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Escreva sua carta livremente. A IA vai preservar seu texto (corrigindo apenas gramática e clareza) e adicionar as regras.
              </Typography>
              <TextField label="Título do projeto" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} fullWidth />
              <TextField label="O que sua Casa deseja realizar?" value={cardBody} onChange={(e) => setCardBody(e.target.value)} multiline minRows={4} fullWidth />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Texto (edições aqui não exigem aprovação do mestre):</Typography>
              <TextField label="Título" value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value.slice(0, CARD_TITLE_MAX) }, false)}
                inputProps={{ maxLength: CARD_TITLE_MAX }}
                helperText={`${draft.title.length}/${CARD_TITLE_MAX}`} fullWidth />
              <TextField label="Descrição" value={draft.description}
                onChange={(e) => { const v = e.target.value.slice(0, CARD_DESCRIPTION_MAX); patchDraft({ description: v, publicDescription: v }, false); }}
                inputProps={{ maxLength: CARD_DESCRIPTION_MAX }}
                helperText={`${draft.description.length}/${CARD_DESCRIPTION_MAX}`}
                multiline minRows={3} fullWidth />

              <Typography variant="caption" color="text.secondary">Regras (editar exige aprovação do mestre):</Typography>
              <TextField label="Duração (turnos)" type="number" value={draft.durationTurns}
                onChange={(e) => patchDraft({ durationTurns: Math.max(1, Number(e.target.value) || 1) }, true)}
                inputProps={{ min: 1, max: 12 }} sx={{ maxWidth: 200 }} />
              {draft.costs.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField label={`Custo: ${COST_NAMES[c.type] ?? c.type}`} type="number" value={c.amount}
                    onChange={(e) => {
                      const amount = Math.max(0, Number(e.target.value) || 0);
                      const costs = draft.costs.map((x, j) => (j === i ? { ...x, amount } : x));
                      patchDraft({ costs }, true);
                    }}
                    inputProps={{ min: 0 }} sx={{ maxWidth: 220 }} />
                </Stack>
              ))}
              {draft.costs.length === 0 && <Typography variant="body2" color="text.secondary">Sem custo.</Typography>}
              <TextField label="Requisitos (um por linha)" value={draft.requirements.join("\n")}
                onChange={(e) => patchDraft({ requirements: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }, true)}
                multiline minRows={2} fullWidth />
              <TextField label="Riscos (um por linha)" value={draft.risks.join("\n")}
                onChange={(e) => patchDraft({ risks: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }, true)}
                multiline minRows={2} fullWidth />

              {draft.aiBalanceExplanation && <Alert severity="info">{draft.aiBalanceExplanation}</Alert>}
              {rulesEdited && <Alert severity="warning">Você alterou as regras — este projeto será enviado ao mestre para aprovação.</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!draft ? (
            <Button disabled={busy || !cardBody.trim()} onClick={async () => {
              setBusy(true); setError(null);
              try { setDraft(await api.enhanceCustomProject(playerToken, { title: cardTitle, body: cardBody })); }
              catch (e) { setError(e instanceof ApiError ? e.message : "Falha ao aprimorar."); }
              finally { setBusy(false); }
            }}>Aprimorar com IA</Button>
          ) : (
            <>
              <Button onClick={() => { setDraft(null); setRulesEdited(false); }}>Voltar</Button>
              <Button variant="contained" disabled={busy} onClick={() => void run(async () => {
                await api.startCustomProject(playerToken, draft);
                resetCreate();
              })}>Iniciar projeto</Button>
            </>
          )}
          <Button onClick={resetCreate}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
