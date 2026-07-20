import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import type { RunAction } from "./types";

interface AdminSystemTabProps {
  busy: boolean;
  runAction: RunAction;
}

export function AdminSystemTab({ busy, runAction }: AdminSystemTabProps) {
  const api = useApi();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <Card component="section" sx={{ borderColor: "error.dark" }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h2" color="error.main">Zona de perigo</Typography>
            <Typography variant="body2" color="text.secondary">
              Reiniciar a campanha apaga todas as Casas, jogadores, turnos e ordens, e recomeça no Turno 1 (rascunho).
              A Bíblia do Mundo é preservada. Esta ação não pode ser desfeita.
            </Typography>
            <Box>
              <Button color="error" disabled={busy} onClick={() => setResetOpen(true)}>
                Reiniciar campanha
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reiniciar campanha?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Isso vai apagar permanentemente todas as Casas, jogadores, turnos e ordens.
            A Bíblia do Mundo será mantida. Tem certeza?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setResetOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() => {
              setResetOpen(false);
              void runAction(
                async (adminToken) => {
                  const { deleted } = await api.adminResetCampaign(adminToken);
                  return deleted;
                },
                "Campanha reiniciada.",
              );
            }}
          >
            Sim, apagar tudo
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
