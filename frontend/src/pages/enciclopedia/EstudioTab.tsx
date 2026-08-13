import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { ConsistencyReportPanel } from "./ConsistencyReportPanel";
import { useGenerationPolling } from "./useGenerationPolling";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";
import type { VisualContextPreview, OrchestratedPrompt } from "../../api/client";
import { PromptReview } from "./PromptReview";

const NEW_CONCEPT = "";

/**
 * Framing intent. This is what separates "show me this place" from "show me a
 * moment happening here" — a capital asked for as a SCENE comes back as a
 * close-up of whatever the description mentioned first.
 */
const ASSET_TYPES: { value: string; label: string }[] = [
  { value: "SCENE", label: "Cena — um momento acontecendo" },
  { value: "ESTABLISHING", label: "Plano geral — mostrar um lugar inteiro" },
  { value: "PORTRAIT", label: "Retrato — busto e ombros" },
  { value: "FULL_BODY", label: "Figura inteira" },
  { value: "ARCHITECTURE", label: "Arquitetura — uma construção" },
  { value: "OBJECT", label: "Objeto isolado" },
  { value: "EMBLEM", label: "Brasão" },
  { value: "MAP", label: "Mapa" },
];

interface EstudioTabProps {
  isAdmin: boolean;
}

export function EstudioTab({ isAdmin }: EstudioTabProps) {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [entityId, setEntityId] = useState<string>(NEW_CONCEPT);
  const [requestText, setRequestText] = useState("");
  const [preview, setPreview] = useState<VisualContextPreview | null>(null);
  const [orchestrated, setOrchestrated] = useState<OrchestratedPrompt | null>(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [assetType, setAssetType] = useState("SCENE");
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

  const enhance = useCallback(async () => {
    setSubmitError(null);
    setResultAsset(null);
    setGenId(null);
    setEnhancing(true);
    try {
      const r = await api.enhanceVisualPrompt({ requestText, entityId: entityId || null, assetType });
      setOrchestrated(r);
      setFinalPrompt(r.compiledPrompt);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao preparar o prompt.");
    } finally {
      setEnhancing(false);
    }
  }, [api, requestText, entityId, assetType]);

  const submit = useCallback(async () => {
    setGenId(null);
    setSubmitError(null);
    setResultAsset(null);
    setNoAsset(false);
    setResolvingAsset(false);
    setCanonized(false);
    setCanonizeError(null);
    setSubmitting(true);
    try {
      const { generationId } = await api.createVisualGeneration({ requestText, entityId: entityId || null, compiledPrompt: finalPrompt, assetType });
      setGenId(generationId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
    } finally {
      setSubmitting(false);
    }
  }, [api, requestText, entityId, finalPrompt, assetType]);

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

  const canEnhance = requestText.trim().length > 0 && !enhancing && !loading && !submitting;
  const canSubmit = finalPrompt.trim().length > 0 && !loading && !submitting && !canonizing;
  const needsReview = generation?.status === "NEEDS_REVIEW";
  const isNewConcept = !generation?.entityId;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="body2" color="text.secondary">
        Gere uma nova imagem. Escolha uma entidade existente para manter o cânone dela (rosto,
        cores, arquitetura) — ou adicione um novo canônico ao acervo.
      </Typography>
      <TextField select label="Entidade" value={entityId} onChange={(e) => setEntityId(e.target.value)} fullWidth>
        <MenuItem value={NEW_CONCEPT}>Adicionar Novo Canônico</MenuItem>
        {entities.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {e.canonicalName}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Tipo de imagem"
        value={assetType}
        onChange={(e) => {
          setAssetType(e.target.value);
          setOrchestrated(null);
          setFinalPrompt("");
        }}
        fullWidth
      >
        {ASSET_TYPES.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Pedido (prompt)"
        value={requestText}
        onChange={(e) => {
          setRequestText(e.target.value);
          setOrchestrated(null);
          setFinalPrompt("");
        }}
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
        <Button variant="contained" disabled={!canEnhance} onClick={() => void enhance()}>
          {enhancing ? "Preparando…" : "Preparar prompt"}
        </Button>
      </Box>

      {orchestrated && (
        <>
          <PromptReview result={orchestrated} value={finalPrompt} onChange={setFinalPrompt} />
          <Box>
            <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
              {loading || submitting ? "Gerando…" : "Gerar imagem"}
            </Button>
          </Box>
        </>
      )}
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
          {resultAsset.consistencyReport ? (
            <ConsistencyReportPanel
              report={resultAsset.consistencyReport}
              referenceCount={generation?.referenceAssetIds.length ?? 0}
              needsReview={needsReview}
            />
          ) : null}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Button variant="outlined" href={resultAsset.storageUrl} target="_blank" rel="noopener">
              Baixar
            </Button>
            {generation && (
              <Typography variant="caption" color="text.secondary">
                {generation.model} · {generation.size} · qualidade {generation.quality}
              </Typography>
            )}
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
