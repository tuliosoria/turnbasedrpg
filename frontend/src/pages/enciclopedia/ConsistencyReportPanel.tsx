import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ConsistencyReport, ConsistencyViolation } from "@ravenloft/content";

const SEVERITY_COLOR: Record<ConsistencyViolation["severity"], "error" | "warning" | "default"> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "default",
};

interface ConsistencyReportPanelProps {
  report: ConsistencyReport;
  referenceCount: number;
}

export function ConsistencyReportPanel({ report, referenceCount }: ConsistencyReportPanelProps) {
  const hasViolations = report.violations.length > 0;

  return (
    <Box sx={{ mt: 1 }}>
      <Alert severity={hasViolations ? "warning" : "success"}>
        {hasViolations
          ? `Divergências do cânone (score ${report.overallScore})`
          : `Nenhuma divergência detectada (score ${report.overallScore})`}
      </Alert>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
        <Chip size="small" label={`Estilo ${report.styleScore}`} />
        <Chip size="small" label={`Identidade ${report.characterIdentityScore}`} />
        <Chip size="small" label={`Arquitetura ${report.architectureScore}`} />
        <Chip size="small" label={`Paleta ${report.paletteScore}`} />
      </Stack>

      {hasViolations && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {report.violations.map((v, i) => (
            <Box key={`${v.category}-${i}`} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Chip size="small" color={SEVERITY_COLOR[v.severity]} label={v.severity} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {v.category}
                </Typography>
                <Typography variant="body2">{v.description}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {report.correctionInstructions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Correções sugeridas</Typography>
          {report.correctionInstructions.map((c, i) => (
            <Typography key={`${i}-${c}`} variant="body2">
              {c}
            </Typography>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
        {referenceCount} referências anexadas a esta geração.
      </Typography>
    </Box>
  );
}
