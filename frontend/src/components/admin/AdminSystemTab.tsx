import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import type { AiStatus } from "../../types/api";
import type { RunAction } from "./types";

interface AdminSystemTabProps {
  busy: boolean;
  runAction: RunAction;
  adminToken: string;
}

const AI_CODE_LABELS: Record<string, string> = {
  AI_AUTH: "Chave inválida ou sem permissão",
  AI_QUOTA: "Cota da OpenAI excedida (verifique o faturamento)",
  AI_ERROR: "OpenAI fora do ar ou tempo esgotado",
  AI_PARSE: "Resposta inesperada da OpenAI",
};

export function AdminSystemTab({ busy, runAction, adminToken }: AdminSystemTabProps) {
  const api = useApi();
  const [resetOpen, setResetOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const checkAi = useCallback(async () => {
    setAiChecking(true);
    setAiError(null);
    try {
      setAiStatus(await api.adminAiStatus(adminToken));
    } catch {
      setAiError("Não foi possível consultar o status da IA.");
      setAiStatus(null);
    } finally {
      setAiChecking(false);
    }
  }, [api, adminToken]);

  useEffect(() => { void checkAi(); }, [checkAi]);

  const statusChip = () => {
    if (aiChecking) return <Chip size="small" icon={<CircularProgress size={14} />} label="Verificando…" />;
    if (!aiStatus) return <Chip size="small" color="default" label="Desconhecido" />;
    if (aiStatus.status === "OK") return <Chip size="small" color="success" label="Operacional" />;
    if (aiStatus.status === "NOT_CONFIGURED") return <Chip size="small" color="default" label="Não configurada" />;
    return <Chip size="small" color="error" label="Fora do ar" />;
  };

  return (
    <>
      <Card component="section" sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h2">Status da IA (OpenAI)</Typography>
              {statusChip()}
            </Stack>
            {aiStatus && (
              <Typography variant="body2" color="text.secondary">
                Modelo: <strong>{aiStatus.model}</strong>
              </Typography>
            )}
            {aiStatus?.status === "DOWN" && (
              <Typography variant="body2" color="error.main">
                {AI_CODE_LABELS[aiStatus.code ?? "AI_ERROR"] ?? "Falha ao contatar a OpenAI"}
                {aiStatus.message ? ` — ${aiStatus.message}` : ""}
              </Typography>
            )}
            {aiStatus?.status === "NOT_CONFIGURED" && (
              <Typography variant="body2" color="text.secondary">
                Nenhuma chave da OpenAI configurada no servidor. As funções de IA ficam indisponíveis.
              </Typography>
            )}
            {aiError && <Typography variant="body2" color="error.main">{aiError}</Typography>}
            <Box>
              <Button variant="outlined" disabled={aiChecking} onClick={() => void checkAi()}>
                Testar conexão
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

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
