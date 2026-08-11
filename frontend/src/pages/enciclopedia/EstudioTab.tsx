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

const NEW_CONCEPT = "";

interface EstudioTabProps {
  isAdmin: boolean;
}

export function EstudioTab({ isAdmin }: EstudioTabProps) {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [entityId, setEntityId] = useState<string>(NEW_CONCEPT);
  const [requestText, setRequestText] = useState("");
  const [preview, setPreview] = useState<VisualContextPreview | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultAsset, setResultAsset] = useState<VisualAsset | null>(null);
  const [resolvingAsset, setResolvingAsset] = useState(false);
  const [noAsset, setNoAsset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canonizing, setCanonizing] = useState(false);
  const [canonized, setCanonized] = useState(false);
  const [canonizeError, setCanonizeError] = useState<string | null>(null);

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
    if (generation?.status !== "COMPLETED" && generation?.status !== "NEEDS_REVIEW") return;
    const assetId = generation.outputAssetIds[0];
    if (!assetId) {
      setNoAsset(true);
      return;
    }
    let active = true;
    setResolvingAsset(true);
    setNoAsset(false);
    void api
      .getVisualAsset(assetId)
      .then((asset) => {
        if (!active) return;
        setResultAsset(asset);
      })
      .catch(() => {
        if (active) setNoAsset(true);
      })
      .finally(() => {
        if (active) setResolvingAsset(false);
      });
    return () => {
      active = false;
    };
  }, [api, generation]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setResultAsset(null);
    setNoAsset(false);
    setResolvingAsset(false);
    setCanonized(false);
    setCanonizeError(null);
    setSubmitting(true);
    try {
      const { generationId } = await api.createVisualGeneration({ requestText, entityId: entityId || null });
      setGenId(generationId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
    } finally {
      setSubmitting(false);
    }
  }, [api, requestText, entityId]);

  const canonize = useCallback(async () => {
    if (!resultAsset) return;
    setCanonizeError(null);
    setCanonizing(true);
    try {
      await api.canonizeAsset(resultAsset.id);
      setCanonized(true);
    } catch (e) {
      setCanonizeError(e instanceof Error ? e.message : "Falha ao canonizar.");
    } finally {
      setCanonizing(false);
    }
  }, [api, resultAsset]);

  const canSubmit = requestText.trim().length > 0 && !loading && !submitting;
  const needsReview = generation?.status === "NEEDS_REVIEW";
  const isNewConcept = !generation?.entityId;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="body2" color="text.secondary">
        Gere uma nova imagem. Escolha uma entidade para manter o cânone dela (rosto, cores,
        arquitetura) — ou gere um conceito novo sem entidade.
      </Typography>
      <TextField select label="Entidade" value={entityId} onChange={(e) => setEntityId(e.target.value)} fullWidth>
        <MenuItem value={NEW_CONCEPT}>Conceito novo (sem entidade)</MenuItem>
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
          {preview.warnings.map((w, i) => (
            <div key={`${i}-${w}`}>{w}</div>
          ))}
        </Alert>
      )}
      <Box>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {loading || submitting ? "Gerando…" : "Gerar"}
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
      {resolvingAsset && <Typography color="text.secondary">Carregando a imagem gerada…</Typography>}
      {noAsset && !resolvingAsset && (
        <Alert severity="info">A geração foi concluída, mas a imagem não pôde ser exibida. Recarregue a página para verificar.</Alert>
      )}
      {resultAsset && (
        <Box>
          <Box
            component="img"
            src={resultAsset.storageUrl}
            alt={resultAsset.description}
            sx={{ maxWidth: "100%", display: "block" }}
          />
          {needsReview ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Divergência do cânone detectada — revise antes de canonizar.
              {resultAsset.consistencyScore != null ? ` (score ${resultAsset.consistencyScore})` : ""}
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mt: 1 }}>
              Passou na verificação de consistência
              {resultAsset.consistencyScore != null ? ` (score ${resultAsset.consistencyScore})` : ""}.
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Button variant="outlined" href={resultAsset.storageUrl} target="_blank" rel="noopener">
              Baixar
            </Button>
            {isAdmin && !canonized && (
              <Button variant="contained" disabled={canonizing} onClick={() => void canonize()}>
                {canonizing ? "Adicionando…" : isNewConcept ? "Adicionar ao cânone?" : "Adicionar ao cânone"}
              </Button>
            )}
          </Stack>
          {canonized && <Alert severity="success" sx={{ mt: 1 }}>Adicionada ao cânone.</Alert>}
          {canonizeError && <Alert severity="error" sx={{ mt: 1 }}>{canonizeError}</Alert>}
        </Box>
      )}
    </Stack>
  );
}
