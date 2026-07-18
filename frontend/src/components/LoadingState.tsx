import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: "flex", alignItems: "center", gap: 2, py: 6, justifyContent: "center" }}
    >
      <CircularProgress size={28} color="secondary" />
      <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
    </Box>
  );
}
