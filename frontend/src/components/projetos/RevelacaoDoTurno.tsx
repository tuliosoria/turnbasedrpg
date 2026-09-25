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
export function RevelacaoDoTurno({ cartas, aberta, semVaga, busy, erro, onFechar, onTentarDeNovo }: {
  cartas: ProjectCard[]; aberta: boolean; semVaga: boolean; busy: boolean;
  /** O erro do painel; em tela cheia, ele ficaria escondido atrás do diálogo. */
  erro?: string | null;
  onFechar: () => void;
  /** false = o servidor recusou; a carta não é dada como refeita. */
  onTentarDeNovo: (id: string) => Promise<boolean> | boolean | void;
}) {
  const [i, setI] = useState(0);
  // Retrato das cartas no momento em que abre. "Tentar de novo" tira a carta
  // da lista do painel na recarga; sem o retrato, o diálogo sumia sem
  // confirmar nada (uma carta) ou contava "2 de 1" (duas).
  const [retrato, setRetrato] = useState<ProjectCard[]>(cartas);
  const [refeitas, setRefeitas] = useState<ReadonlySet<string>>(new Set());
  const celular = useMediaQuery("(max-width:600px)");
  useEffect(() => {
    if (!aberta) return;
    setI(0);
    setRetrato(cartas);
    setRefeitas(new Set());
    // Só ao abrir: a lista que muda depois (refazer) não entra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);
  if (retrato.length === 0) return null;
  const carta = retrato[Math.min(i, retrato.length - 1)];
  const sucesso = carta.status === "COMPLETED";
  const ultima = i >= retrato.length - 1;
  const refeita = refeitas.has(carta.id);

  return (
    <Dialog open={aberta} onClose={onFechar} fullScreen={celular} fullWidth maxWidth="xs"
      PaperProps={{ sx: { bgcolor: brand.base, backgroundImage: "none" } }}>
      <DialogContent>
        <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
          <Typography variant="overline" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>Fechamento do turno</Typography>
          <Typography color="text.secondary">{i + 1} de {retrato.length}</Typography>
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
          {!sucesso && !refeita && erro && (
            <Typography role="alert" sx={{ color: "#c05a5a", textAlign: "center", maxWidth: 340 }}>{erro}</Typography>
          )}
          {!sucesso && refeita && (
            <Typography sx={{ color: brand.energia, textAlign: "center" }}>↻ Voltou para Em andamento, com sucesso garantido.</Typography>
          )}
          {!sucesso && !refeita && (
            <Box sx={{ width: "100%", maxWidth: 340 }}>
              <Button variant="contained" fullWidth disabled={busy || semVaga} onClick={async () => {
                  // Só confirma o que o servidor aceitou.
                  if ((await onTentarDeNovo(carta.id)) !== false) setRefeitas((r) => new Set(r).add(carta.id));
                }} sx={{ minHeight: 48 }}>
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
