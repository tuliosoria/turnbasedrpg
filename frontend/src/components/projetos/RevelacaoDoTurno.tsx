import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { resumoDoGanho, type ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";
import { animacao, aparecer, brilhoSucesso, rachadura, virarCarta } from "./animacoes";

/**
 * O fechamento acontece com o jogador longe da tela. Esta é a hora em que ele
 * vê as cartas resolvidas: uma por vez, como quem vira cartas na mesa.
 */
export function RevelacaoDoTurno({ cartas, aberta, semVaga, busy, onFechar, onTentarDeNovo }: {
  cartas: ProjectCard[]; aberta: boolean; semVaga: boolean; busy: boolean;
  onFechar: () => void; onTentarDeNovo: (id: string) => void;
}) {
  const [i, setI] = useState(0);
  const celular = useMediaQuery("(max-width:600px)");
  useEffect(() => { if (aberta) setI(0); }, [aberta]);
  if (cartas.length === 0) return null;
  const carta = cartas[Math.min(i, cartas.length - 1)];
  const sucesso = carta.status === "COMPLETED";
  const ultima = i >= cartas.length - 1;

  return (
    <Dialog open={aberta} onClose={onFechar} fullScreen={celular} fullWidth maxWidth="xs"
      PaperProps={{ sx: { bgcolor: brand.base, backgroundImage: "none" } }}>
      <DialogContent>
        <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
          <Typography variant="overline" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>Fechamento do turno</Typography>
          <Typography color="text.secondary">{i + 1} de {cartas.length}</Typography>
          <Box
            key={carta.id}
            sx={{
              width: "100%", maxWidth: 340, bgcolor: brand.raised, borderRadius: 3, p: 3, textAlign: "center",
              border: `1px solid ${sucesso ? brand.accent : "#c05a5a"}`,
              animation: [
                animacao(virarCarta, "500ms"),
                sucesso ? animacao(brilhoSucesso, "1.2s", "500ms forwards") : animacao(rachadura, "900ms", "500ms forwards"),
              ].filter((a) => a !== "none").join(", ") || `${aparecer} 120ms ease-out`,
            }}
          >
            <Typography sx={{ color: sucesso ? brand.accent : "#c05a5a", fontWeight: 700, letterSpacing: "0.14em" }}>
              {sucesso ? "Concluída" : "Fracassou"}
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{carta.title}</Typography>
            {carta.outcomeNarrative && <Typography variant="body2" sx={{ mt: 1.5, fontStyle: "italic" }}>{carta.outcomeNarrative}</Typography>}
            {sucesso && (
              <Typography sx={{ mt: 1.5, color: brand.accent, animation: animacao(aparecer, "400ms", "900ms both") }}>
                Recebido: {resumoDoGanho(carta.completionEffects, carta.pagamentoNarrativo)}
              </Typography>
            )}
          </Box>
          {!sucesso && (
            <Box sx={{ width: "100%", maxWidth: 340 }}>
              <Button variant="contained" fullWidth disabled={busy || semVaga} onClick={() => onTentarDeNovo(carta.id)} sx={{ minHeight: 48 }}>
                Tentar de novo — grátis, sucesso garantido
              </Button>
              {semVaga && <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 0.5 }}>Libere uma vaga primeiro</Typography>}
            </Box>
          )}
          <Button variant={ultima ? "outlined" : "contained"} onClick={() => (ultima ? onFechar() : setI(i + 1))} sx={{ minHeight: 48, minWidth: 160 }}>
            {ultima ? "Fechar" : "Próxima"}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
