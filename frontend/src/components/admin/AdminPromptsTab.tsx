import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import type { RunAction } from "./types";

interface AdminPromptsTabProps {
  busy: boolean;
  runAction: RunAction;
  worldLore: string;
  worldVisualDirectives: string;
  setWorldVisualDirectives: (value: string) => void;
}

export function AdminPromptsTab({ busy, runAction, worldLore, worldVisualDirectives, setWorldVisualDirectives }: AdminPromptsTabProps) {
  const api = useApi();

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">Prompts de imagem</Typography>
          <Typography variant="body2" color="text.secondary">
            Prompt de estilo e continuidade aplicado automaticamente a toda imagem gerada nos turnos. Não aparece na zona de turno.
          </Typography>
          <TextField
            label="Diretrizes de Imagem (prompt de estilo)"
            value={worldVisualDirectives}
            onChange={(e) => setWorldVisualDirectives(e.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
          <Box>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() =>
                runAction(
                  (adminToken) => api.adminPutWorldBible(adminToken, { lore: worldLore, visualDirectives: worldVisualDirectives }),
                  "Prompt salvo.",
                )
              }
            >
              Salvar prompt
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
