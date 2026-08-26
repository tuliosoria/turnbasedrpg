import { useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { WIKI_SECTIONS, isCanonWikiSection, VISUAL_ENTITY_TYPES, VISUAL_ENTITY_TYPE_LABELS, CANON_RAW_TEXT_MAX, CANON_VERDICT_LABELS, type CanonProposal, type CanonReview } from "@ravenloft/content";
import type { CanonSubmitInput } from "../api/client";

export interface CanonSubmitFormProps {
  onPreview: (rawText: string) => Promise<{ proposal: CanonProposal; review: CanonReview | null }>;
  onSubmit: (input: CanonSubmitInput) => Promise<void>;
  onUploadImage: (file: File) => Promise<{ imageUrl: string; imageKey: string }>;
}

const SECTIONS = WIKI_SECTIONS.filter((s) => isCanonWikiSection(s.id));

// No formulário do jogador nenhuma flag é fatal: um conflito com o cânone é
// aviso, não bloqueio. O BLOCK continua guardado no parecer para o Mestre; aqui
// ele só muda a cor, nunca vira o vermelho de erro que sugere "não dá para enviar".
const SEVERITY_COLOR = { BLOCK: "warning", WARN: "warning", INFO: "info" } as const;

export function CanonSubmitForm({ onPreview, onSubmit, onUploadImage }: CanonSubmitFormProps) {
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<CanonProposal | null>(null);
  const [review, setReview] = useState<CanonReview | null>(null);
  const [image, setImage] = useState<{ imageUrl: string; imageKey: string } | null>(null);

  const runPreview = async () => {
    if (!rawText.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await onPreview(rawText.trim());
      setProposal(result.proposal);
      setReview(result.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar a prévia.");
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setImage(await onUploadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        rawText: rawText.trim(),
        rawImageUrl: image?.imageUrl ?? null,
        rawImageKey: image?.imageKey ?? null,
        proposal,
        review,
      });
      setRawText("");
      setProposal(null);
      setReview(null);
      setImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a proposta.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (change: Partial<CanonProposal>) => setProposal((p) => (p ? { ...p, ...change } : p));

  return (
    <Stack spacing={2}>
      <TextField
        label="O que você quer tornar canônico"
        helperText="Descreva o personagem, lugar ou fato. O Mestre lê antes de publicar."
        value={rawText}
        onChange={(e) => setRawText(e.target.value.slice(0, CANON_RAW_TEXT_MAX))}
        multiline
        minRows={4}
        fullWidth
      />

      <Stack direction="row" spacing={2} alignItems="center">
        <Button variant="contained" onClick={runPreview} disabled={busy}>
          Gerar prévia
        </Button>
        <Button component="label" variant="outlined" disabled={busy}>
          {image ? "Trocar imagem" : "Anexar imagem (opcional)"}
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickImage(e.target.files?.[0])} />
        </Button>
        {image ? (
          <Typography variant="body2">Imagem anexada.</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            O texto sozinho já basta.
          </Typography>
        )}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {review && review.flags.length > 0 ? (
        <Stack spacing={1}>
          {review.flags.map((flag, i) => (
            <Alert key={i} severity={SEVERITY_COLOR[flag.severity]}>
              {flag.message}
            </Alert>
          ))}
        </Stack>
      ) : null}

      {review && (review.verdict !== "OK" || review.flags.length > 0) ? (
        <Typography variant="body2" color="text.secondary">
          Um conflito com o cânone não impede o envio: a proposta segue assim mesmo e o Mestre analisa e decide.
        </Typography>
      ) : null}

      {proposal ? (
        <Box>
          <Stack spacing={2}>
            {review ? (
              <Chip label={`Parecer da IA: ${CANON_VERDICT_LABELS[review.verdict]}`} size="small" sx={{ alignSelf: "flex-start" }} />
            ) : (
              <Chip
                label="Crítica da IA indisponível — o Mestre revisa mesmo assim."
                color="warning"
                variant="outlined"
                size="small"
                sx={{ alignSelf: "flex-start" }}
              />
            )}
            <TextField label="Título" value={proposal.title} onChange={(e) => patch({ title: e.target.value })} fullWidth />
            <TextField label="Seção" select value={proposal.section} onChange={(e) => patch({ section: e.target.value })} fullWidth>
              {SECTIONS.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tipo de entidade"
              select
              value={proposal.entityType ?? ""}
              onChange={(e) => patch({ entityType: (e.target.value || null) as CanonProposal["entityType"] })}
              fullWidth
            >
              <MenuItem value="">Nenhum (só verbete)</MenuItem>
              {VISUAL_ENTITY_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{VISUAL_ENTITY_TYPE_LABELS[t]}</MenuItem>
              ))}
            </TextField>
            <TextField label="Verbete" value={proposal.body} onChange={(e) => patch({ body: e.target.value })} multiline minRows={8} fullWidth />
            <Button variant="contained" onClick={send} disabled={busy}>
              Enviar ao Mestre
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
