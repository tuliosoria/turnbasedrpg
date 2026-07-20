import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, DEFAULT_IMAGE_DIRECTIVES, EMBLEM_COLORS, EMBLEM_ICONS, type Attributes, type Emblem, type House, type NarrativeCard, type TurnResult } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { clearAdminToken, loadAdminToken, saveAdminToken } from "../auth/adminSession";
import { LoadingState } from "../components/LoadingState";
import { Layout } from "../components/Layout";
import { NarrativeCardEditor } from "../components/NarrativeCardEditor";
import { TurnImagePanel } from "../components/TurnImagePanel";
import { WikiManager } from "../components/WikiManager";
import { GmBibleManager } from "../components/GmBibleManager";
import { HouseForm, type HouseFormValue } from "../components/HouseForm";
import { ApiError, type AdminDashboard } from "../types/api";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };

const blankEmblem: Emblem = { icon: EMBLEM_ICONS[0], color1: EMBLEM_COLORS[0], color2: EMBLEM_COLORS[1] };

function blankHouseForm(): HouseFormValue {
  return {
    name: "",
    motto: "",
    emblem: { ...blankEmblem },
    leaderName: "",
    heirName: "",
    castleName: "",
    townsText: "",
    historyText: "",
    specialty: "",
    weakness: "",
    attributes: { ...emptyAttributes },
  };
}

function houseToForm(house: House): HouseFormValue {
  return {
    name: house.name,
    motto: house.motto,
    emblem: { ...house.emblem },
    leaderName: house.leaderName,
    heirName: house.heirName,
    castleName: house.castleName,
    townsText: house.townsText,
    historyText: house.historyText,
    specialty: house.specialty,
    weakness: house.weakness,
    attributes: { ...house.attributes },
  };
}

function blankResult(houses: AdminDashboard["houses"]): TurnResult {
  return {
    publicResult: "",
    houseResults: Object.fromEntries(houses.map((house) => [house.houseId, ""])),
    attributeDeltas: Object.fromEntries(houses.map((house) => [house.houseId, { ...emptyAttributes }])),
    discoveries: [],
  };
}

export function AdminPage() {
  const api = useApi();
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [code, setCode] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [publicEvent, setPublicEvent] = useState("");
  const [privateInfo, setPrivateInfo] = useState<Record<string, string>>({});
  const [cards, setCards] = useState<NarrativeCard[]>([]);
  const [resolution, setResolution] = useState<TurnResult | null>(null);
  const [discoveriesText, setDiscoveriesText] = useState("");
  const [worldLore, setWorldLore] = useState("");
  const [worldVisualDirectives, setWorldVisualDirectives] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<HouseFormValue>(() => blankHouseForm());
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<HouseFormValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);
  const [newHouseCode, setNewHouseCode] = useState<{ houseId: string; playerCode: string } | null>(null);

  const syncDashboard = useCallback((next: AdminDashboard) => {
    setDashboard(next);
    setPublicEvent(next.publicEvent);
    setPrivateInfo({ ...next.privateInfo });
    setCards(next.cards);
    const nextResult = next.result ?? blankResult(next.houses);
    setResolution(nextResult);
    setDiscoveriesText(nextResult.discoveries.join("\n"));
  }, []);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      syncDashboard(await api.getAdminDashboard(adminToken));
      const wb = await api.adminGetWorldBible(adminToken);
      setWorldLore(wb.lore);
      setWorldVisualDirectives(wb.visualDirectives.trim() ? wb.visualDirectives : DEFAULT_IMAGE_DIRECTIVES);
    } catch (err) {
      if (err instanceof ApiError && err.code === "SESSION_EXPIRED") {
        clearAdminToken();
        setToken(null);
        setDashboard(null);
        return;
      }
      setError("Falha ao carregar o painel.");
    }
  }, [api, syncDashboard]);

  useEffect(() => {
    if (token) void refresh(token);
  }, [token, refresh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { adminToken } = await api.adminLogin(code.trim());
      saveAdminToken(adminToken);
      setToken(adminToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAdminToken();
    setToken(null);
    setDashboard(null);
  }

  async function runAction(action: (adminToken: string) => Promise<unknown>, success?: string, refreshAfter = true) {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(token);
      if (success) setNotice(success);
      if (refreshAfter) await refresh(token);
    } catch (err) {
      const aiCodes = ["AI_DISABLED", "AI_QUOTA", "AI_AUTH", "AI_ERROR", "AI_PARSE"];
      if (err instanceof ApiError && err.code === "AI_DISABLED") {
        setNotice("IA não configurada — escreva manualmente.");
      } else if (err instanceof ApiError && aiCodes.includes(err.code)) {
        setNotice(`${err.message} Você pode escrever manualmente.`);
      } else {
        setError(err instanceof ApiError ? err.message : "Ação não concluída.");
      }
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setCreateForm(blankHouseForm());
    setCreateDisplayName("");
    setEditingHouseId(null);
    setShowCreate(true);
  }

  function submitCreate() {
    void runAction(async (adminToken) => {
      const res = await api.adminCreateHouse(adminToken, {
        ...createForm,
        displayName: createDisplayName.trim(),
      });
      setNewHouseCode(res);
      setShowCreate(false);
    }, "Casa criada.");
  }

  function toggleEdit(house: House) {
    setShowCreate(false);
    if (editingHouseId === house.houseId) {
      setEditingHouseId(null);
      setEditForm(null);
    } else {
      setEditingHouseId(house.houseId);
      setEditForm(houseToForm(house));
    }
  }

  function submitEdit(houseId: string) {
    if (!editForm) return;
    void runAction(
      (adminToken) => api.adminUpdateHouse(adminToken, { houseId, ...editForm }),
      "Casa atualizada.",
    );
    setEditingHouseId(null);
    setEditForm(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    void runAction((adminToken) => api.adminDeleteHouse(adminToken, target.houseId), "Casa removida.");
  }

  function addCard() {
    setCards((current) => [
      ...current,
      {
        id: `card-${Date.now()}`,
        title: "Nova carta",
        constraintText: "",
        narrativeQuestion: "",
        consequenceText: "",
      },
    ]);
  }

  function updateResolution(patch: Partial<TurnResult>) {
    setResolution((current) => ({ ...(current ?? blankResult(dashboard?.houses ?? [])), ...patch }));
  }

  if (!token) {
    return (
      <Layout>
        <Typography variant="h1" gutterBottom>
          Administração
        </Typography>
        <Box component="form" onSubmit={login} sx={{ maxWidth: 420, mt: 2 }}>
          <TextField
            label="Código de admin"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            sx={{ mb: 2 }}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" color="secondary" size="large" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </Box>
      </Layout>
    );
  }

  const logoutButton = (
    <Button variant="outlined" size="small" color="inherit" onClick={logout}>
      Sair
    </Button>
  );

  if (!dashboard)
    return (
      <Layout action={logoutButton}>
        <LoadingState />
      </Layout>
    );

  return (
    <Layout action={logoutButton}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Typography variant="h1">Painel do Turno {dashboard.turnId ?? "—"}</Typography>
          <Chip label={`Status: ${dashboard.turnStatus ?? "sem turno"}`} variant="outlined" />
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="info">{notice}</Alert>}

        {dashboard.turnStatus === "DRAFT" && (
          <Card component="section">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h2">Compor turno</Typography>
                <TextField
                  label="Evento público"
                  value={publicEvent}
                  onChange={(event) => setPublicEvent(event.target.value)}
                  multiline
                  minRows={4}
                />
                <Box>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        async (adminToken) => setPublicEvent(await api.adminDraftPublicEvent(adminToken)),
                        undefined,
                        false,
                      )
                    }
                  >
                    Rascunhar evento (IA)
                  </Button>
                </Box>
                {dashboard.houses.map((house) => (
                  <TextField
                    key={house.houseId}
                    label={`Informação privada para ${house.name}`}
                    value={privateInfo[house.houseId] ?? ""}
                    onChange={(event) => setPrivateInfo((current) => ({ ...current, [house.houseId]: event.target.value }))}
                    multiline
                    minRows={3}
                  />
                ))}
                {cards.map((card, index) => (
                  <NarrativeCardEditor
                    key={card.id}
                    card={card}
                    onChange={(next) => setCards((current) => current.map((item, i) => (i === index ? next : item)))}
                    onRemove={() => setCards((current) => current.filter((_, i) => i !== index))}
                  />
                ))}
                <Button variant="outlined" onClick={addCard}>Adicionar carta</Button>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        async (adminToken) => setPrivateInfo(await api.adminDraftPrivateInfo(adminToken)),
                        undefined,
                        false,
                      )
                    }
                  >
                    Rascunhar informações (IA)
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => runAction((adminToken) => api.adminComposeTurn(adminToken, { publicEvent, privateInfo, cards }), "Rascunho salvo.")}
                  >
                    Salvar rascunho
                  </Button>
                  <Button color="secondary" disabled={busy} onClick={() => runAction(async (adminToken) => {
                    await api.adminComposeTurn(adminToken, { publicEvent, privateInfo, cards });
                    await api.adminOpenTurn(adminToken);
                  }, "Turno aberto.")}>
                    Abrir turno
                  </Button>
                </Stack>
                <TurnImagePanel
                  title="Imagem do evento"
                  imageUrl={dashboard.eventImageUrl}
                  busy={busy}
                  onGenerate={(scene) =>
                    runAction((adminToken) => api.adminGenerateTurnImage(adminToken, "event", scene), "Imagem gerada.")
                  }
                  onDelete={() =>
                    runAction((adminToken) => api.adminDeleteTurnImage(adminToken, "event"), "Imagem removida.")
                  }
                />
              </Stack>
            </CardContent>
          </Card>
        )}

        {dashboard.turnStatus === "OPEN" && (
          <Card component="section">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h2">Monitorar ordens</Typography>
                {dashboard.houses.map((house) => {
                  const submission = dashboard.submissions.find((item) => item.houseId === house.houseId);
                  return (
                    <Box key={house.houseId} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 2 }}>
                      <Typography variant="h3">{submission ? "✓" : "✗"} {house.name}</Typography>
                      {submission ? (
                        <>
                          <Typography sx={{ whiteSpace: "pre-wrap" }}>{submission.orderText}</Typography>
                          {submission.cardResponses.map((response) => (
                            <Typography key={response.cardId} sx={{ color: "text.secondary" }}>
                              {response.cardId}: {response.text}
                            </Typography>
                          ))}
                        </>
                      ) : (
                        <Typography sx={{ color: "text.secondary" }}>Sem ordem enviada.</Typography>
                      )}
                    </Box>
                  );
                })}
                <Button color="secondary" disabled={busy} onClick={() => runAction((adminToken) => api.adminLockTurn(adminToken))}>
                  Trancar turno
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {dashboard.turnStatus === "LOCKED" && resolution && (
          <Card component="section">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h2">Rodar turno</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() =>
                      runAction(async (adminToken) => {
                        const draft = await api.adminDraftResolution(adminToken);
                        setResolution(draft);
                        setDiscoveriesText(draft.discoveries.join("\n"));
                      }, undefined, false)
                    }
                  >
                    Rascunhar resolução (IA)
                  </Button>
                  <Button variant="outlined" disabled={busy} onClick={() => runAction((adminToken) => api.adminUnlockTurn(adminToken))}>
                    Destrancar
                  </Button>
                </Stack>
                <TextField
                  label="Resultado público"
                  value={resolution.publicResult}
                  onChange={(event) => updateResolution({ publicResult: event.target.value })}
                  multiline
                  minRows={4}
                />
                {dashboard.houses.map((house) => {
                  const submission = dashboard.submissions.find((item) => item.houseId === house.houseId);
                  return (
                  <Card key={house.houseId} component="section">
                    <CardContent>
                      <Stack spacing={2}>
                        <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
                          <Typography variant="h3" gutterBottom>
                            {submission ? "✓" : "✗"} Ordem de {house.name}
                          </Typography>
                          {submission ? (
                            <>
                              <Typography sx={{ whiteSpace: "pre-wrap" }}>{submission.orderText || "(sem texto de ordem)"}</Typography>
                              {submission.cardResponses.map((response) => (
                                <Typography key={response.cardId} variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                  {response.cardId}: {response.text}
                                </Typography>
                              ))}
                            </>
                          ) : (
                            <Typography sx={{ color: "text.secondary" }}>Nenhuma ordem enviada.</Typography>
                          )}
                        </Box>
                        <TextField
                          label={`Resultado privado para ${house.name}`}
                          value={resolution.houseResults[house.houseId] ?? ""}
                          onChange={(event) =>
                            updateResolution({
                              houseResults: { ...resolution.houseResults, [house.houseId]: event.target.value },
                            })
                          }
                          multiline
                          minRows={3}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          {ATTRIBUTE_KEYS.map((attribute) => (
                            <TextField
                              key={attribute}
                              label={`Delta ${attribute} de ${house.name}`}
                              type="number"
                              value={resolution.attributeDeltas[house.houseId]?.[attribute] ?? 0}
                              onChange={(event) =>
                                updateResolution({
                                  attributeDeltas: {
                                    ...resolution.attributeDeltas,
                                    [house.houseId]: {
                                      ...resolution.attributeDeltas[house.houseId],
                                      [attribute]: Number(event.target.value),
                                    },
                                  },
                                })
                              }
                            />
                          ))}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                  );
                })}
                <TextField
                  label="Descobertas"
                  value={discoveriesText}
                  onChange={(event) => setDiscoveriesText(event.target.value)}
                  multiline
                  minRows={3}
                />
                <TurnImagePanel
                  title="Imagem do resultado"
                  imageUrl={dashboard.resultImageUrl}
                  busy={busy}
                  onGenerate={(scene) =>
                    runAction((adminToken) => api.adminGenerateTurnImage(adminToken, "result", scene), "Imagem gerada.")
                  }
                  onDelete={() =>
                    runAction((adminToken) => api.adminDeleteTurnImage(adminToken, "result"), "Imagem removida.")
                  }
                />
                <Button
                  color="secondary"
                  disabled={busy}
                  onClick={() =>
                    runAction((adminToken) =>
                      api.adminApplyResolution(adminToken, {
                        ...resolution,
                        discoveries: discoveriesText.split("\n").map((line) => line.trim()).filter(Boolean),
                      }),
                    )
                  }
                >
                  Aplicar e publicar
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card component="section">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="h2">Gerenciar Casas</Typography>
                <Button variant="outlined" disabled={busy} onClick={openCreate}>
                  Adicionar Casa
                </Button>
              </Stack>

              {showCreate && (
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
                  <Typography variant="h3" gutterBottom>Nova Casa</Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Nome de exibição do jogador"
                      value={createDisplayName}
                      onChange={(e) => setCreateDisplayName(e.target.value.slice(0, 40))}
                      required
                      helperText="Um código de acesso será gerado para este jogador."
                    />
                    <HouseForm value={createForm} onChange={setCreateForm} attributeMode="free" />
                    <Stack direction="row" spacing={2}>
                      <Button
                        color="secondary"
                        disabled={busy || createDisplayName.trim().length === 0 || createForm.name.trim().length === 0}
                        onClick={submitCreate}
                      >
                        Criar Casa
                      </Button>
                      <Button variant="outlined" disabled={busy} onClick={() => setShowCreate(false)}>
                        Cancelar
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}

              {dashboard.houses.map((house) => (
                <Box key={house.houseId} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                    <Box>
                      <Typography variant="h3">{house.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Riqueza {house.attributes.riqueza} · Recursos {house.attributes.recursos} · Soldados {house.attributes.soldados} · Controle {house.attributes.controle}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" disabled={busy} onClick={() => toggleEdit(house)}>
                        {editingHouseId === house.houseId ? "Fechar" : "Editar"}
                      </Button>
                      <Button color="error" variant="outlined" disabled={busy} onClick={() => setDeleteTarget(house)}>
                        Deletar
                      </Button>
                    </Stack>
                  </Stack>
                  {editingHouseId === house.houseId && editForm && (
                    <Box sx={{ mt: 2 }}>
                      <HouseForm value={editForm} onChange={setEditForm} attributeMode="free" />
                      <Button color="secondary" sx={{ mt: 2 }} disabled={busy} onClick={() => submitEdit(house.houseId)}>
                        Salvar alterações
                      </Button>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card component="section">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h2">Bíblia do Mundo</Typography>
              <Typography variant="body2" color="text.secondary">
                Contexto do mundo usado pela IA. Não é mostrado aos jogadores. A crônica dos turnos resolvidos é adicionada automaticamente.
              </Typography>
              <TextField
                label="Lore do Mundo"
                value={worldLore}
                onChange={(e) => setWorldLore(e.target.value)}
                multiline
                minRows={6}
                fullWidth
              />
              <TextField
                label="Diretrizes de Imagem (prompt de estilo)"
                value={worldVisualDirectives}
                onChange={(e) => setWorldVisualDirectives(e.target.value)}
                multiline
                minRows={6}
                fullWidth
                helperText="Prompt de estilo/continuidade aplicado automaticamente a toda imagem gerada nos turnos. Gerencie aqui — não aparece na zona de turno."
              />
              <Box>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      (adminToken) => api.adminPutWorldBible(adminToken, { lore: worldLore, visualDirectives: worldVisualDirectives }),
                      "Bíblia salva.",
                    )
                  }
                >
                  Salvar Bíblia
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <WikiManager token={token} />

        <GmBibleManager token={token} />

        <Card component="section" sx={{ borderColor: "error.dark" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h2" color="error.main">Zona de perigo</Typography>
              <Typography variant="body2" color="text.secondary">
                Reiniciar a campanha apaga todas as Casas, jogadores, turnos e ordens, e recomeça no Turno 1 (rascunho).
                A Bíblia do Mundo é preservada. Esta ação não pode ser desfeita.
              </Typography>
              <Box>
                <Button color="error" disabled={busy} onClick={() => setResetOpen(true)}>
                  Reiniciar campanha
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reiniciar campanha?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Isso vai apagar permanentemente todas as Casas, jogadores, turnos e ordens.
            A Bíblia do Mundo será mantida. Tem certeza?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setResetOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() => {
              setResetOpen(false);
              void runAction(
                async (adminToken) => {
                  const { deleted } = await api.adminResetCampaign(adminToken);
                  return deleted;
                },
                "Campanha reiniciada.",
              );
            }}
          >
            Sim, apagar tudo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Deletar Casa?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Isso vai apagar permanentemente a Casa <strong>{deleteTarget?.name}</strong>, a conta do jogador
            e todas as ordens enviadas por ela. Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button color="error" disabled={busy} onClick={confirmDelete}>
            Sim, deletar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(newHouseCode)} onClose={() => setNewHouseCode(null)}>
        <DialogTitle>Casa criada</DialogTitle>
        <DialogContent>
          <DialogContentText gutterBottom>
            Entregue este código de acesso ao jogador — é o login da Casa.
          </DialogContentText>
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: "2rem", letterSpacing: "0.08em", wordBreak: "break-word" }}>
            {newHouseCode?.playerCode}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={() => setNewHouseCode(null)}>
            Entendi
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
