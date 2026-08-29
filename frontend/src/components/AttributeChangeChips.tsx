import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_LABELS } from "../attributeLabels";
import type { TurnHistoryAttributeChange } from "../types/api";

function formatSigned(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

function changeLabel(change: TurnHistoryAttributeChange): string {
  const name = ATTRIBUTE_LABELS[change.key];
  const signed = formatSigned(change.delta);
  const base =
    typeof change.before === "number" && typeof change.after === "number"
      ? `${name} ${change.before} → ${change.after} (${signed})`
      : `${name} ${signed}`;
  // O motivo entra no rótulo, e não num tooltip: um ganho automático que só se
  // explica ao passar o mouse não se explica no celular.
  return change.motivo ? `${base} — ${change.motivo}` : base;
}

export function AttributeChangeChips({ changes }: { changes: TurnHistoryAttributeChange[] }) {
  if (changes.length === 0) return null;
  return (
    <Stack spacing={1} sx={{ mb: 1 }}>
      <Typography variant="h3">Mudanças na sua Casa</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {changes.map((change) => (
          <Chip
            key={change.key}
            label={changeLabel(change)}
            color={change.delta > 0 ? "success" : "error"}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
    </Stack>
  );
}
