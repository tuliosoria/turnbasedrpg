import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TurnDraft } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";

interface House {
  houseId: string;
  name: string;
}

/**
 * Mostra o rascunho de turno que o Claude enviou, para o Mestre revisar,
 * carregar nos campos do turno (e então editar/salvar como sempre) ou descartar.
 * As chaves de info privada do rascunho podem vir por nome de Casa ou por id;
 * aqui casamos com as Casas vivas e reescrevemos por houseId.
 */
export function TurnDraftBanner({ adminToken, houses, onLoad, onImageSet, onLoadResolution }: {
  adminToken: string;
  houses: House[];
  onLoad: (publicEvent: string, privateInfo: Record<string, string>) => void;
  onImageSet?: (url: string) => void;
  onLoadResolution?: (publicResult: string, houseResults: Record<string, string>, discoveries: string[]) => void;
}) {
  const api = useApi();
  const [draft, setDraft] = useState<TurnDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resLoaded, setResLoaded] = useState(false);
  const [imageSet, setImageSet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.adminGetTurnDraft(adminToken);
      setDraft(res.draft);
    } catch {
      // Sem rascunho o painel some; não é erro que precise assustar o Mestre.
    }
  }, [api, adminToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!draft) return null;

  const norm = (s: string) => s.trim().toLowerCase();
  const byName = new Map(houses.map((h) => [norm(h.name), h.houseId]));
  const byId = new Set(houses.map((h) => h.houseId));
  const mapped: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const [key, text] of Object.entries(draft.privateInfo)) {
    const houseId = byId.has(key) ? key : byName.get(norm(key));
    if (houseId) mapped[houseId] = text;
    else unmatched.push(key);
  }

  const mapByHouse = (rec: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, text] of Object.entries(rec)) {
      const houseId = byId.has(key) ? key : byName.get(norm(key));
      if (houseId) out[houseId] = text;
    }
    return out;
  };

  const load = () => {
    onLoad(draft.publicEvent, mapped);
    setLoaded(true);
  };

  const loadResolution = () => {
    if (!draft.resolution) return;
    onLoadResolution?.(draft.resolution.publicResult, mapByHouse(draft.resolution.houseResults), draft.resolution.discoveries);
    setResLoaded(true);
  };

  const useImage = async () => {
    if (!draft?.eventImageUrl) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminSetTurnImageUrl(adminToken, "event", draft.eventImageUrl);
      onImageSet?.(draft.eventImageUrl);
      setImageSet(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao definir a imagem do turno.");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.adminDiscardTurnDraft(adminToken);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao descartar.");
    } finally {
      setBusy(false);
    }
  };

  const houseName = (houseId: string) => houses.find((h) => h.houseId === houseId)?.name ?? houseId;

  return (
    <Card component="section" variant="outlined" sx={{ borderColor: "primary.main" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6">📝 Rascunho de turno pendente</Typography>
            {draft.createdAt && (
              <Typography variant="caption" color="text.secondary">
                Recebido em {new Date(draft.createdAt).toLocaleString("pt-BR")}
              </Typography>
            )}
          </Box>

          {draft.note && <Alert severity="info" sx={{ whiteSpace: "pre-wrap" }}>{draft.note}</Alert>}

          <Box>
            <Typography variant="overline" color="text.secondary">Evento público</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {draft.publicEvent || <em>(vazio)</em>}
            </Typography>
          </Box>

          {Object.keys(mapped).length > 0 && (
            <Box>
              <Typography variant="overline" color="text.secondary">Info privada para</Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                {Object.keys(mapped).map((houseId) => (
                  <Chip key={houseId} size="small" label={houseName(houseId)} />
                ))}
              </Stack>
            </Box>
          )}

          {unmatched.length > 0 && (
            <Alert severity="warning">
              Info privada para Casas não reconhecidas (serão ignoradas ao carregar): {unmatched.join(", ")}
            </Alert>
          )}

          {draft.eventImageUrl && (
            <Box>
              <Typography variant="overline" color="text.secondary">Imagem sugerida para o turno</Typography>
              <Box sx={{ mt: 0.5, display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
                <Box
                  component="img"
                  src={draft.eventImageUrl}
                  alt="Imagem sugerida do turno"
                  sx={{ width: 120, height: 180, objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
                />
                <Button variant="outlined" onClick={() => void useImage()} disabled={busy || imageSet}>
                  {imageSet ? "Imagem definida ✓" : "Usar como imagem do turno"}
                </Button>
              </Box>
            </Box>
          )}

          {draft.resolution && (draft.resolution.publicResult || Object.keys(draft.resolution.houseResults).length > 0) && (
            <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
              <Typography variant="overline" color="text.secondary">Resultado proposto do turno atual</Typography>
              {draft.resolution.publicResult && (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{draft.resolution.publicResult}</Typography>
              )}
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                {Object.keys(mapByHouse(draft.resolution.houseResults)).map((houseId) => (
                  <Chip key={houseId} size="small" label={`resultado: ${houseName(houseId)}`} />
                ))}
                {draft.resolution.discoveries.length > 0 && (
                  <Chip size="small" color="secondary" label={`${draft.resolution.discoveries.length} descoberta(s)`} />
                )}
              </Stack>
              <Button size="small" variant="contained" onClick={loadResolution} disabled={busy}>
                Carregar resultado nos campos
              </Button>
              {resLoaded && <Alert severity="success" sx={{ mt: 1 }}>Resultado carregado. Revise os deltas e aplique o turno.</Alert>}
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {loaded && <Alert severity="success">Carregado nos campos abaixo. Revise, ajuste e salve o turno.</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" onClick={load} disabled={busy}>Carregar nos campos</Button>
            <Button variant="outlined" color="inherit" onClick={() => void discard()} disabled={busy}>
              Descartar rascunho
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
