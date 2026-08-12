import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CanonTrait, VisualEntity } from "@ravenloft/content";
import type { UpdateVisualEntityInput } from "../../api/client";

const SOURCE_LABEL: Record<CanonTrait["source"], string> = {
  AUTHORED: "Escrito",
  DISCOVERED: "Descoberto",
  LORE: "Do verbete",
};

interface CanonSheetProps {
  entity: VisualEntity;
  isAdmin: boolean;
  onSave: (patch: UpdateVisualEntityInput) => void;
  saving?: boolean;
}

export function CanonSheet({ entity, isAdmin, onSave, saving = false }: CanonSheetProps) {
  const [description, setDescription] = useState(entity.publicDescription);
  const [traits, setTraits] = useState<CanonTrait[]>(entity.immutableTraits);
  const [draft, setDraft] = useState("");
  // Monotonic: never reused, so removing a trait cannot make a later id collide
  // with an earlier one (which would break both React keys and remove-by-id).
  const nextTraitId = useRef(0);

  const addTrait = () => {
    const text = draft.trim();
    if (!text) return;
    const id = `new-${nextTraitId.current++}`;
    setTraits([...traits, { id, text, source: "AUTHORED", originAssetId: null, createdAt: "" }]);
    setDraft("");
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2">Descrição</Typography>
        {isAdmin ? (
          <TextField
            label="Descrição pública"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        ) : (
          <Typography variant="body2">{description}</Typography>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2">Traços imutáveis</Typography>
        <Typography variant="caption" color="text.secondary">
          Fatos que nenhuma imagem futura pode contradizer.
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {traits.map((t) => (
            <Box key={t.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Chip size="small" label={SOURCE_LABEL[t.source]} />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {t.text}
              </Typography>
              {isAdmin && (
                <IconButton
                  size="small"
                  aria-label={`Remover traço: ${t.text}`}
                  onClick={() => setTraits(traits.filter((x) => x.id !== t.id))}
                >
                  ×
                </IconButton>
              )}
            </Box>
          ))}
          {traits.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nenhum traço imutável ainda.
            </Typography>
          )}
        </Stack>
      </Box>

      {isAdmin && (
        <>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Novo traço imutável"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              fullWidth
              size="small"
            />
            <Button onClick={addTrait}>Adicionar traço</Button>
          </Stack>
          <Box>
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => onSave({ publicDescription: description, immutableTraits: traits })}
            >
              {saving ? "Salvando…" : "Salvar cânone"}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
}
