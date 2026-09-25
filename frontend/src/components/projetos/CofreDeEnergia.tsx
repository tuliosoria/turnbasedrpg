import { useState, type Ref } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ENERGIA_POR_TURNO, PASSO_POR_TURNO } from "@ravenloft/content";
import { brand } from "../../theme";

/**
 * O saldo do turno, no topo e grudado ao rolar. `origemRef` é de onde o orbe
 * sai quando o jogador põe Energia numa carta.
 */
export function CofreDeEnergia({ total, livre, origemRef }: { total: number; livre: number; origemRef: Ref<HTMLDivElement> }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Box sx={{ position: "sticky", top: 64, zIndex: 2, bgcolor: brand.surface, border: `1px solid ${brand.line}`, borderRadius: 3, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>Energia do turno</Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{livre} de {total} livres</Typography>
        </Box>
        <Stack ref={origemRef} direction="row" spacing={1} aria-hidden>
          {Array.from({ length: total }, (_, i) => {
            const aceso = i < livre;
            return (
              <Box
                key={i}
                data-orbe={aceso ? "aceso" : "apagado"}
                sx={{
                  width: 24, height: 24, borderRadius: "50%",
                  bgcolor: aceso ? brand.energia : "transparent",
                  border: `2px solid ${aceso ? brand.energia : brand.line}`,
                  boxShadow: aceso ? `0 0 10px ${brand.energia}88` : "none",
                  transition: "all 200ms ease-out",
                }}
              />
            );
          })}
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{total} de Energia por turno · o que sobrar se perde no fechamento.</Typography>
        <Button size="small" onClick={() => setAberto(true)} sx={{ minHeight: 48 }}>Como funciona?</Button>
      </Stack>
      <Dialog open={aberto} onClose={() => setAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle>Como funciona</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pb: 1 }}>
            <Typography>◇ Toda carta ativa anda {PASSO_POR_TURNO} passo por turno, de graça. Não precisa de Energia para andar.</Typography>
            <Typography>◆ Cada ponto de Energia é 1 passo a mais. Você recebe {ENERGIA_POR_TURNO} por turno, e o que sobrar se perde no fechamento.</Typography>
            <Typography>↻ Carta que fracassa pode tentar de novo: volta com 1 turno, de graça, e com sucesso garantido.</Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
