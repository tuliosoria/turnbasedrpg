import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import type { KingdomState } from "@ravenloft/content";

const LABELS: { key: keyof KingdomState; label: string; danger?: boolean }[] = [
  { key: "provisions", label: "Provisões" },
  { key: "militaryStrength", label: "Força Militar" },
  { key: "unity", label: "Unidade" },
  { key: "publicOrder", label: "Ordem Pública" },
  { key: "enemyKnowledge", label: "Conhecimento sobre o Inimigo" },
  { key: "undeadAdvance", label: "Avanço dos Mortos", danger: true },
];

export function KingdomStats({ state }: { state: KingdomState }) {
  return (
    <Card component="section" aria-label="Estado do reino" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h2" gutterBottom>
          Estado do Reino
        </Typography>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {LABELS.map(({ key, label, danger }) => {
            const value = state[key];
            return (
              <Box key={key}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {value} / 10
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, (value / 10) * 100))}
                  color={danger ? "warning" : "primary"}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
