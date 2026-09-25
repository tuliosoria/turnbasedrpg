import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { CATEGORY_LABELS, resumoDoGanho, type ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";
import { CORES_DE_CATEGORIA } from "./cores";
import { animacao, pulsoEnergia } from "./animacoes";
import { previaDoFechamento } from "./previa";
import { TrilhaDePassos } from "./TrilhaDePassos";

const rotulo = { fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em" };

export function CartaAtiva({ carta, energia, teto, livre, busy, alvoRef, onMudar, onCancelar, onReescrever }: {
  carta: ProjectCard;
  energia: number;
  teto: number;
  livre: number;
  busy: boolean;
  alvoRef?: (el: HTMLDivElement | null) => void;
  onMudar: (delta: 1 | -1) => void;
  onCancelar: () => void;
  onReescrever: (pedido: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [reescrever, setReescrever] = useState(false);
  const [pedido, setPedido] = useState("");
  const previa = previaDoFechamento(carta, energia);
  const ativa = carta.status === "ACTIVE";
  const energizada = energia > 0;
  const podeMais = energia < teto && livre > 0;
  const motivoSemMais = energia >= teto ? "Esta carta já recebe o máximo" : "Sem Energia livre";

  return (
    <Box
      ref={alvoRef}
      sx={{
        position: "relative", bgcolor: brand.raised, border: `1px solid ${energizada ? brand.energia : brand.line}`,
        borderRadius: 3, p: 2, pl: 2.5, overflow: "hidden",
        animation: energizada ? animacao(pulsoEnergia, "2.4s", "infinite") : "none",
        "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: CORES_DE_CATEGORIA[carta.category] },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography sx={rotulo}>{carta.title}</Typography>
          <Typography variant="caption" color="text.secondary">{CATEGORY_LABELS[carta.category]}</Typography>
        </Box>
        <IconButton aria-label="Mais ações" onClick={(e) => setMenu(e.currentTarget)} sx={{ width: 48, height: 48 }}>⋯</IconButton>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
        {!ativa && <Chip size="small" color="warning" label="Pausada" />}
        {carta.refeita && <Chip size="small" color="success" label="Sucesso garantido" />}
        {previa.conclui && <Chip size="small" sx={{ bgcolor: brand.energia, color: brand.base }} label="Conclui neste turno" />}
      </Stack>

      <TrilhaDePassos previa={previa} />
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Fim do turno: → {previa.depois} de {previa.total}</Typography>
      <Typography variant="caption" display="block" color="success.main">
        Ao concluir: {resumoDoGanho(carta.completionEffects, carta.pagamentoNarrativo)}
      </Typography>

      {ativa && teto <= 0 && energia <= 0 && (
        <Typography sx={{ mt: 1.5, color: brand.energia }}>
          {previa.conclui ? "✓ Conclui sozinha no fim do turno. Não precisa de Energia." : "Não aceita Energia agora."}
        </Typography>
      )}

      {ativa && (teto > 0 || energia > 0) && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={2}>
            <Button variant="outlined" aria-label={`Tirar Energia de ${carta.title}`} disabled={busy || energia <= 0}
              onClick={() => onMudar(-1)} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.4rem" }}>−</Button>
            <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: brand.energia, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>
              ◆ {energia}
            </Typography>
            <Button variant="outlined" aria-label={`Pôr Energia em ${carta.title}`} disabled={busy || !podeMais}
              onClick={() => onMudar(1)} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.4rem", borderColor: brand.energia, color: brand.energia }}>+</Button>
          </Stack>
          {!podeMais && <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 0.5 }}>{motivoSemMais}</Typography>}
        </Box>
      )}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {carta.refeita && (
          <MenuItem onClick={() => { setMenu(null); setPedido(""); setReescrever(true); }}>Reescrever</MenuItem>
        )}
        <MenuItem onClick={() => { setMenu(null); onCancelar(); }}>Cancelar carta</MenuItem>
      </Menu>

      <Dialog open={reescrever} onClose={() => setReescrever(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reescrever {carta.title}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline minRows={3} autoFocus sx={{ mt: 1 }} label="O que esta carta deveria ser agora?"
            value={pedido} onChange={(e) => setPedido(e.target.value)} />
          <Typography variant="caption" color="text.secondary">Continua com 1 turno e sucesso garantido. Um prêmio maior que o atual não é aceito.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReescrever(false)}>Voltar</Button>
          <Button variant="contained" disabled={busy || !pedido.trim()} onClick={() => { setReescrever(false); onReescrever(pedido.trim()); }}>Reescrever</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
