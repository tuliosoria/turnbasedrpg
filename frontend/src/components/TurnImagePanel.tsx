import { useId, useState } from "react";
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
  onUpload: (file: File) => void;
  onDelete: () => void;
}

export function TurnImagePanel({ title, imageUrl, busy, onGenerate, onUpload, onDelete }: TurnImagePanelProps) {
  const [scene, setScene] = useState("");
  const uploadInputId = useId();

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
        <Button component="label" htmlFor={uploadInputId} variant="outlined" disabled={busy}>
          Enviar imagem
          <Box
            id={uploadInputId}
            component="input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Enviar imagem para ${title}`}
            sx={{ display: "none" }}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
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
