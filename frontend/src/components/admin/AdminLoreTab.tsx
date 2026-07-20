import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { WikiManager } from "../WikiManager";
import { GmBibleManager } from "../GmBibleManager";
import type { RunAction } from "./types";

interface AdminLoreTabProps {
  token: string;
  busy: boolean;
  runAction: RunAction;
  worldLore: string;
  setWorldLore: (value: string) => void;
  worldVisualDirectives: string;
}

export function AdminLoreTab({ token, busy, runAction, worldLore, setWorldLore, worldVisualDirectives }: AdminLoreTabProps) {
  const api = useApi();

  return (
    <Stack spacing={3}>
      <Card component="section">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h2">Bíblia do Mundo</Typography>
            <Typography variant="body2" color="text.secondary">
              Contexto do mundo usado pela IA. Não é mostrado aos jogadores. A crônica dos turnos resolvidos é adicionada automaticamente.
            </Typography>
            <TextField
              label="Lore do Mundo"
              value={worldLore}
              onChange={(e) => setWorldLore(e.target.value)}
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
                    "Bíblia salva.",
                  )
                }
              >
                Salvar Lore
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <WikiManager token={token} />

      <GmBibleManager token={token} />
    </Stack>
  );
}
