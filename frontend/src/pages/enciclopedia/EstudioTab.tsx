import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { useGenerationPolling } from "./useGenerationPolling";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";
import type { VisualContextPreview } from "../../api/client";

export function EstudioTab() {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [entityId, setEntityId] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [preview, setPreview] = useState<VisualContextPreview | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultAsset, setResultAsset] = useState<VisualAsset | null>(null);

  const { generation, loading, error: pollError } = useGenerationPolling(genId);

  useEffect(() => {
    void api
      .listVisualEntities()
      .then(setEntities)
      .catch(() => setEntities([]));
  }, [api]);

  useEffect(() => {
    if (!entityId) {
      setPreview(null);
      return;
    }

    let active = true;
    void api
      .previewVisualContext({ entityId })
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [api, entityId]);

  useEffect(() => {
    if (generation?.status === "COMPLETED" || generation?.status === "NEEDS_REVIEW") {
      const assetId = generation.outputAssetIds[0];
      if (assetId && generation.entityId) {
        void api
          .getVisualEntityAssets(generation.entityId)
          .then((assets) => {
            setResultAsset(assets.find((a) => a.id === assetId) ?? null);
          })
          .catch(() => {});
      }
    }
  }, [api, generation]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setResultAsset(null);
    try {
      const { generationId } = await api.createVisualGeneration({ requestText, entityId });
      setGenId(generationId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
    }
  }, [api, requestText, entityId]);

  const canSubmit = requestText.trim().length > 0 && entityId !== "" && !loading;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="body2" color="text.secondary">
        Gere uma nova imagem para uma entidade canônica. A seleção de entidade é obrigatória.
      </Typography>
      <TextField select label="Entidade" value={entityId} onChange={(e) => setEntityId(e.target.value)} fullWidth>
        {entities.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {e.canonicalName}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Pedido (prompt)"
        value={requestText}
        onChange={(e) => setRequestText(e.target.value)}
        multiline
        minRows={3}
        fullWidth
      />
      {preview && (
        <Alert severity="info">
          Operação: {preview.operation} · Referências: {preview.referenceCount}
          {preview.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </Alert>
      )}
      <Box>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {loading ? "Gerando…" : "Gerar"}
        </Button>
      </Box>
      {submitError && <Alert severity="error">{submitError}</Alert>}
      {pollError && <Alert severity="warning">{pollError}</Alert>}
      {loading && (
        <Typography color="text.secondary">
          Status: {generation?.status ?? "iniciando"}… isso pode levar 1–2 minutos.
        </Typography>
      )}
      {generation?.status === "FAILED" && (
        <Alert severity="error">{generation.error ?? "Falha ao gerar a imagem."}</Alert>
      )}
      {resultAsset && (
        <Box>
          <Box
            component="img"
            src={resultAsset.storageUrl}
            alt={resultAsset.description}
            sx={{ maxWidth: "100%", display: "block" }}
          />
          <Typography sx={{ mt: 1 }}>
            {generation?.status === "NEEDS_REVIEW" ? "Precisa de revisão · " : ""}
            Score de consistência: {resultAsset.consistencyScore ?? "—"}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
