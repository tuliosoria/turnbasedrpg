import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { OrchestratedPrompt } from "../../api/client";

interface PromptReviewProps {
  result: OrchestratedPrompt;
  value: string;
  onChange: (next: string) => void;
}

/**
 * Shows the exact text that will be sent to the image model, and lets the
 * author edit it before spending anything. This replaces the old
 * post-generation consistency check, which judged the result without ever
 * seeing the image and paid for retries on faults it had invented.
 */
export function PromptReview({ result, value, onChange }: PromptReviewProps) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2">Cânone aplicado</Typography>
        {result.canonSources.length ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
            {result.canonSources.map((s) => (
              <Chip key={s} size="small" label={s} />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nenhum verbete reconhecido.
          </Typography>
        )}
      </Box>

      {result.warnings.map((w) => (
        <Alert key={w} severity="info">
          {w}
        </Alert>
      ))}

      <Box>
        <Typography variant="subtitle2">Prompt que será enviado</Typography>
        <Typography variant="caption" color="text.secondary">
          Revise e edite se quiser. As regras de paleta e iluminação são reaplicadas mesmo se você as remover.
        </Typography>
        <TextField
          label="Prompt final"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          multiline
          minRows={12}
          fullWidth
          sx={{ mt: 1, "& textarea": { fontFamily: "monospace", fontSize: 13 } }}
        />
      </Box>
    </Stack>
  );
}
