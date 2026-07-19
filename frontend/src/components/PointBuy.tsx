import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, POINT_BUDGET, type AttributeKey, type Attributes } from "@ravenloft/content";

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  riqueza: "Riqueza",
  recursos: "Recursos",
  soldados: "Soldados",
  controle: "Controle",
};

export function PointBuy({ value, onChange, freeMode = false }: { value: Attributes; onChange: (attributes: Attributes) => void; freeMode?: boolean }) {
  const spent = ATTRIBUTE_KEYS.reduce((total, key) => total + value[key], 0);
  const remaining = POINT_BUDGET - spent;

  function change(key: AttributeKey, delta: number) {
    onChange({ ...value, [key]: value[key] + delta });
  }

  return (
    <Stack spacing={2}>
      {!freeMode && <Typography variant="subtitle1">Pontos restantes: {remaining}</Typography>}
      {ATTRIBUTE_KEYS.map((key) => {
        const label = ATTRIBUTE_LABELS[key];
        return (
          <Stack key={key} direction="row" alignItems="center" spacing={1.5}>
            <Typography sx={{ flexGrow: 1 }}>{label}</Typography>
            <IconButton
              aria-label={`Diminuir ${label}`}
              disabled={value[key] <= 0}
              onClick={() => change(key, -1)}
              size="small"
            >
              −
            </IconButton>
            <Box sx={{ minWidth: 24, textAlign: "center" }}>{value[key]}</Box>
            <IconButton
              aria-label={`Aumentar ${label}`}
              disabled={(!freeMode && remaining <= 0) || value[key] >= 5}
              onClick={() => change(key, 1)}
              size="small"
            >
              +
            </IconButton>
          </Stack>
        );
      })}
    </Stack>
  );
}
