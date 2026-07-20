import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, type TurnResult } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import type { AdminDashboard } from "../../types/api";
import { TurnImagePanel } from "../TurnImagePanel";
import type { RunAction } from "./types";

interface AdminTurnsTabProps {
  dashboard: AdminDashboard;
  busy: boolean;
  runAction: RunAction;
  publicEvent: string;
  setPublicEvent: (value: string) => void;
  privateInfo: Record<string, string>;
  setPrivateInfo: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  resolution: TurnResult | null;
  setResolution: React.Dispatch<React.SetStateAction<TurnResult | null>>;
  updateResolution: (patch: Partial<TurnResult>) => void;
  discoveriesText: string;
  setDiscoveriesText: (value: string) => void;
}

export function AdminTurnsTab({
  dashboard,
  busy,
  runAction,
  publicEvent,
  setPublicEvent,
  privateInfo,
  setPrivateInfo,
  resolution,
  setResolution,
  updateResolution,
  discoveriesText,
  setDiscoveriesText,
}: AdminTurnsTabProps) {
  const api = useApi();

  return (
    <Stack spacing={3}>
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
                  onClick={() => runAction((adminToken) => api.adminComposeTurn(adminToken, { publicEvent, privateInfo }), "Rascunho salvo.")}
                >
                  Salvar rascunho
                </Button>
                <Button color="secondary" disabled={busy} onClick={() => runAction(async (adminToken) => {
                  await api.adminComposeTurn(adminToken, { publicEvent, privateInfo });
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
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>{submission.orderText}</Typography>
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
                            <Typography sx={{ whiteSpace: "pre-wrap" }}>{submission.orderText || "(sem texto de ordem)"}</Typography>
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

      {dashboard.turnStatus == null && (
        <Card component="section">
          <CardContent>
            <Typography sx={{ color: "text.secondary" }}>Nenhum turno ativo.</Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
