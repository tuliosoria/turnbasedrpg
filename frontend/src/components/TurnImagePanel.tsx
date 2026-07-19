import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface TurnImagePanelProps {
  title: string;
  imageUrl?: string;
  defaultPrompt: string;
  busy: boolean;
  onGenerate: (prompt: string) => void;
  onDelete: () => void;
}

export function TurnImagePanel({ title, imageUrl, defaultPrompt, busy, onGenerate, onDelete }: TurnImagePanelProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);

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
        label="Prompt da imagem"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        multiline
        minRows={3}
        helperText="Edite o prompt antes de gerar. Estilo visual do mundo já incluído."
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" disabled={busy || !prompt.trim()} onClick={() => onGenerate(prompt)}>
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
