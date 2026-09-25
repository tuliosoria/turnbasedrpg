import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { ProjectCard } from "@ravenloft/content";
import { brand } from "../../theme";

/** A carta que o juiz reprovou, no topo da aba, com a saída à vista. */
export function CartaFracassada({ carta, semVaga, busy, onTentarDeNovo }: {
  carta: ProjectCard; semVaga: boolean; busy: boolean; onTentarDeNovo: () => void;
}) {
  return (
    <Box sx={{ bgcolor: brand.raised, border: "1px solid #c05a5a", borderRadius: 3, p: 2 }}>
      <Typography sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{carta.title}</Typography>
      {carta.outcomeNarrative && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>{carta.outcomeNarrative}</Typography>
      )}
      <Button variant="contained" fullWidth disabled={busy || semVaga} onClick={onTentarDeNovo} sx={{ mt: 1.5, minHeight: 48 }}>
        Tentar de novo — grátis
      </Button>
      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
        {semVaga ? "Libere uma vaga primeiro" : "Volta com 1 turno e sucesso garantido."}
      </Typography>
    </Box>
  );
}
