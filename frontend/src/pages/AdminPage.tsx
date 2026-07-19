import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, type Attributes, type NarrativeCard, type TurnResult } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { clearAdminToken, loadAdminToken, saveAdminToken } from "../auth/adminSession";
import { LoadingState } from "../components/LoadingState";
import { Layout } from "../components/Layout";
import { NarrativeCardEditor } from "../components/NarrativeCardEditor";
import { PointBuy } from "../components/PointBuy";
import { ApiError, type AdminDashboard } from "../types/api";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };

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
  const [houseAttributes, setHouseAttributes] = useState<Record<string, Attributes>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const syncDashboard = useCallback((next: AdminDashboard) => {
    setDashboard(next);
    setPublicEvent(next.publicEvent);
    setPrivateInfo({ ...next.privateInfo });
    setCards(next.cards);
    const nextResult = next.result ?? blankResult(next.houses);
    setResolution(nextResult);
    setDiscoveriesText(nextResult.discoveries.join("\n"));
    setHouseAttributes(Object.fromEntries(next.houses.map((house) => [house.houseId, { ...house.attributes }])));
  }, []);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      syncDashboard(await api.getAdminDashboard(adminToken));
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
      if (err instanceof ApiError && err.code === "AI_DISABLED") {
        setNotice("IA não configurada — escreva manualmente.");
      } else {
        setError(err instanceof ApiError ? err.message : "Ação não concluída.");
      }
    } finally {
      setBusy(false);
    }
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
                  <Button color="secondary" disabled={busy} onClick={() => runAction((adminToken) => api.adminOpenTurn(adminToken))}>
                    Abrir turno
                  </Button>
                </Stack>
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
                {dashboard.houses.map((house) => (
                  <Card key={house.houseId} component="section">
                    <CardContent>
                      <Stack spacing={2}>
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
                ))}
                <TextField
                  label="Descobertas"
                  value={discoveriesText}
                  onChange={(event) => setDiscoveriesText(event.target.value)}
                  multiline
                  minRows={3}
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
              <Typography variant="h2">Editar atributos das Casas</Typography>
              {dashboard.houses.map((house) => (
                <Box key={house.houseId}>
                  <Typography variant="h3" gutterBottom>{house.name}</Typography>
                  <PointBuy
                    value={houseAttributes[house.houseId] ?? house.attributes}
                    onChange={(attributes) => setHouseAttributes((current) => ({ ...current, [house.houseId]: attributes }))}
                  />
                  <Button
                    variant="outlined"
                    sx={{ mt: 1 }}
                    disabled={busy}
                    onClick={() => runAction((adminToken) => api.adminEditHouse(adminToken, house.houseId, houseAttributes[house.houseId] ?? house.attributes))}
                  >
                    Salvar atributos
                  </Button>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Layout>
  );
}
