import Box from "@mui/material/Box";
import { brand } from "../../theme";
import type { Previa } from "./previa";

type Passo = "andada" | "gratis" | "energia" | "vazia";

const ESTILO: Record<Passo, object> = {
  andada: { bgcolor: brand.text, borderColor: brand.text },
  gratis: { bgcolor: "transparent", borderColor: brand.text, borderStyle: "dashed" },
  energia: { bgcolor: brand.energia, borderColor: brand.energia, boxShadow: `0 0 8px ${brand.energia}88` },
  vazia: { bgcolor: "transparent", borderColor: brand.line },
};

/** Uma casinha por turno da carta: o progresso lido de relance. */
export function TrilhaDePassos({ previa }: { previa: Previa }) {
  const passos: Passo[] = Array.from({ length: previa.total }, (_, i) => {
    if (i < previa.andadas) return "andada";
    if (i < previa.andadas + previa.gratis) return "gratis";
    if (i < previa.depois) return "energia";
    return "vazia";
  });
  return (
    <Box
      role="img"
      aria-label={`${previa.andadas} de ${previa.total} turnos; no fim do turno: ${previa.depois} de ${previa.total}`}
      sx={{ display: "flex", gap: 0.75, my: 1 }}
    >
      {passos.map((p, i) => (
        <Box
          key={i}
          data-passo={p}
          sx={{ flex: 1, maxWidth: 40, height: 14, borderRadius: 1, border: "2px solid", transition: "background-color 200ms ease-out", ...ESTILO[p] }}
        />
      ))}
    </Box>
  );
}
