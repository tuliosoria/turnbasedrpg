import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from "@ravenloft/content";

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  riqueza: "Riqueza",
  recursos: "Recursos",
  soldados: "Soldados",
  controle: "Controle",
};

export function AttributeBars({ attributes }: { attributes: Attributes }) {
  return (
    <Stack spacing={1.5}>
      {ATTRIBUTE_KEYS.map((key) => (
        <Box key={key}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography sx={{ width: 96 }} variant="body2">
              {ATTRIBUTE_LABELS[key]}
            </Typography>
            <LinearProgress
              aria-label={ATTRIBUTE_LABELS[key]}
              variant="determinate"
              value={(attributes[key] / 5) * 100}
              sx={{ flexGrow: 1, height: 8, borderRadius: 999 }}
            />
            <Typography sx={{ width: 24, textAlign: "right" }} variant="body2">
              {attributes[key]}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
