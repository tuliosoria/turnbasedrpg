import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface TurnImagePanelProps {
  title: string;
  imageUrl?: string;
  busy: boolean;
  onGenerate: (sceneDescription: string) => void;
  onDelete: () => void;
}

export function TurnImagePanel({ title, imageUrl, busy, onGenerate, onDelete }: TurnImagePanelProps) {
  const [scene, setScene] = useState("");

  return (
    <Stack spacing={1.5} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
      <Typography variant="h3">{title}</Typography>
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={title}
          sx={{ width: "100%", maxWidth: 640, borderRadius: 1, display: "block" }}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Nenhuma imagem gerada ainda.
        </Typography>
      )}
      <TextField
        label="Descrição da cena (opcional)"
        value={scene}
        onChange={(event) => setScene(event.target.value)}
        multiline
        minRows={2}
        helperText="Deixe em branco para ilustrar o texto do turno. O estilo visual vem das Diretrizes de Imagem do Admin."
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" disabled={busy} onClick={() => onGenerate(scene)}>
          {imageUrl ? "Regerar imagem" : "Gerar imagem"}
        </Button>
        {imageUrl && (
          <Button variant="text" color="error" disabled={busy} onClick={onDelete}>
            Remover imagem
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
