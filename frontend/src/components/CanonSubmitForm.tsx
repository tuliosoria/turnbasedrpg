import { useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { WIKI_SECTIONS, isCanonWikiSection, VISUAL_ENTITY_TYPES, VISUAL_ENTITY_TYPE_LABELS, CANON_BODY_MAX, CANON_TITLE_MAX, CANON_VERDICT_LABELS, type CanonProposal, type CanonReview } from "@ravenloft/content";
import type { CanonSubmitInput } from "../api/client";

export interface CanonSubmitFormProps {
  onAdvice: (input: { title: string; body: string }) => Promise<{ proposal: CanonProposal; review: CanonReview }>;
  onSubmit: (input: CanonSubmitInput) => Promise<void>;
  onUploadImage: (file: File) => Promise<{ imageUrl: string; imageKey: string }>;
}

const SECTIONS = WIKI_SECTIONS.filter((s) => isCanonWikiSection(s.id));

// Nenhuma flag é fatal no formulário do jogador: um conflito com o cânone é
// aviso, não bloqueio. O BLOCK segue no parecer para o Mestre; aqui só muda a
// cor, nunca vira o vermelho que sugere "não dá para enviar".
const SEVERITY_COLOR = { BLOCK: "warning", WARN: "warning", INFO: "info" } as const;

/**
 * O jogador escreve o verbete, e a IA opina ao lado.
 *
 * Antes era o contrário: ele descrevia o pedido, a IA TRANSFORMAVA aquilo num
 * verbete, e era a versão dela que ele enviava. Os jogadores reclamaram com
 * razão — perdiam a própria voz e o texto costumava sair pior. Agora a prosa é
 * dele do começo ao fim; a revisão classifica, aponta contradição com o cânone
 * e sugere, sem nunca reescrever nada.
 */
export function CanonSubmitForm({ onAdvice, onSubmit, onUploadImage }: CanonSubmitFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [section, setSection] = useState("");
  const [entityType, setEntityType] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<CanonProposal | null>(null);
  const [review, setReview] = useState<CanonReview | null>(null);
  const [image, setImage] = useState<{ imageUrl: string; imageKey: string } | null>(null);

  const revisar = async () => {
    if (!title.trim() || body.trim().length < 20 || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await onAdvice({ title: title.trim(), body: body.trim() });
      setProposal(r.proposal);
      setReview(r.review);
      // Só a classificação entra: o texto continua sendo o que ele digitou.
      if (!section && r.proposal.section) setSection(r.proposal.section);
      if (!entityType && r.proposal.entityType) setEntityType(r.proposal.entityType);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível revisar.");
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
    if (!title.trim() || body.trim().length < 20 || !section || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        rawText: body.trim(),
        rawImageUrl: image?.imageUrl ?? null,
        rawImageKey: image?.imageKey ?? null,
        // O que vai ao Mestre é o texto do jogador, não uma versão da IA.
        proposal: {
          ...(proposal ?? ({} as CanonProposal)),
          title: title.trim(),
          body: body.trim(),
          section,
          entityType: (entityType || null) as CanonProposal["entityType"],
          canonicalName: proposal?.canonicalName || title.trim(),
          immutableTraits: proposal?.immutableTraits ?? [],
          summary: proposal?.summary ?? "",
          houseId: proposal?.houseId ?? null,
        },
        review,
      });
      setTitle("");
      setBody("");
      setSection("");
      setEntityType("");
      setProposal(null);
      setReview(null);
      setImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a proposta.");
    } finally {
      setBusy(false);
    }
  };

  const podeEnviar = !!title.trim() && body.trim().length >= 20 && !!section && !busy;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Escreva o verbete com as suas palavras. A revisão da IA não altera o seu texto — ela aponta o
        que contradiz o cânone e sugere o que talvez esteja faltando. Quem decide é você, e quem
        publica é o Mestre.
      </Typography>

      <TextField
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, CANON_TITLE_MAX))}
        fullWidth
      />

      <TextField
        label="O verbete"
        helperText={`${body.length} de ${CANON_BODY_MAX} caracteres. O texto vai ao Mestre exatamente como você escrever.`}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, CANON_BODY_MAX))}
        multiline
        minRows={10}
        fullWidth
      />

      <TextField label="Seção" select value={section} onChange={(e) => setSection(e.target.value)} fullWidth>
        {SECTIONS.map((s) => (
          <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
        ))}
      </TextField>

      <TextField
        label="Tipo de entidade"
        select
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        helperText="Uma pessoa é sempre Personagem. Deixe em branco para algo sem forma visual, como um tratado."
        fullWidth
      >
        <MenuItem value="">Nenhum (só verbete)</MenuItem>
        {VISUAL_ENTITY_TYPES.map((t) => (
          <MenuItem key={t} value={t}>{VISUAL_ENTITY_TYPE_LABELS[t]}</MenuItem>
        ))}
      </TextField>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={revisar} disabled={busy || !title.trim() || body.trim().length < 20}>
          Revisar com a IA (opcional)
        </Button>
        <Button component="label" variant="outlined" disabled={busy}>
          {image ? "Trocar imagem" : "Anexar imagem (opcional)"}
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickImage(e.target.files?.[0])} />
        </Button>
        {image ? <Typography variant="body2">Imagem anexada.</Typography> : null}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {review ? (
        <Box>
          <Stack spacing={1}>
            <Chip label={`Parecer da IA: ${CANON_VERDICT_LABELS[review.verdict]}`} size="small" sx={{ alignSelf: "flex-start" }} />

            {review.flags.map((flag, i) => (
              <Alert key={`f${i}`} severity={SEVERITY_COLOR[flag.severity]}>{flag.message}</Alert>
            ))}

            {(review.suggestions ?? []).map((s, i) => (
              <Alert key={`s${i}`} severity="info" icon={false}>
                <Typography variant="overline" display="block">Sugestão</Typography>
                {s}
              </Alert>
            ))}

            {review.flags.length === 0 && (review.suggestions ?? []).length === 0 ? (
              <Alert severity="success">Nada a apontar. O verbete não contradiz o cânone.</Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nada disso muda o seu texto, e nada impede o envio. Aplique o que fizer sentido e ignore o resto.
              </Typography>
            )}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <Button variant="contained" onClick={send} disabled={!podeEnviar}>
          Enviar ao Mestre
        </Button>
        {!section && title.trim() && body.trim().length >= 20 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Escolha a seção antes de enviar.
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
