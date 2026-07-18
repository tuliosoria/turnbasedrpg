import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { CardView } from "../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  military: "Militar",
  logistics: "Logística",
  politics: "Política",
  administration: "Administração",
  investigation: "Investigação",
  religion: "Religião",
  engineering: "Engenharia",
  "popular-support": "Apoio Popular",
  sacrifice: "Sacrifício",
};

export function CardChoice({
  card,
  selected,
  disabled,
  onChoose,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  onChoose: (cardId: string) => void;
}) {
  return (
    <Card
      component="article"
      aria-current={selected}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: selected ? "secondary.main" : "divider",
        borderWidth: selected ? 2 : 1,
        boxShadow: selected ? "0 0 0 1px rgba(161,61,61,0.4)" : "none",
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h3" gutterBottom>
          {card.title}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {card.categories.map((c) => (
            <Chip key={c} size="small" variant="outlined" label={CATEGORY_LABELS[c] ?? c} />
          ))}
        </Stack>
        <Typography sx={{ mb: 1.5 }}>{card.description}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>Contribuição:</strong> {card.contribution}
        </Typography>
        {card.risk && (
          <Typography variant="body2" sx={{ mb: 0.5, color: "warning.main" }}>
            <strong>Risco:</strong> {card.risk}
          </Typography>
        )}
        {card.cost && (
          <Typography variant="body2">
            <strong>Custo:</strong> {card.cost}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0, flexDirection: "column", alignItems: "stretch", gap: 1 }}>
        <Button
          fullWidth
          color={selected ? "secondary" : "primary"}
          variant={selected ? "outlined" : "contained"}
          disabled={disabled}
          onClick={() => onChoose(card.id)}
        >
          Escolher esta carta
        </Button>
        {selected && (
          <Box
            aria-live="polite"
            sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "secondary.main" }}
          >
            <CheckCircleIcon fontSize="small" />
            <Typography variant="body2">Carta escolhida</Typography>
          </Box>
        )}
      </CardActions>
    </Card>
  );
}
