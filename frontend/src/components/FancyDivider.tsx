import Box from "@mui/material/Box";

/**
 * A decorative horizontal rule with a centered diamond, echoing the ornamental
 * dividers used across D&D Beyond stat blocks and chapter breaks. Purely
 * visual, so it is hidden from assistive technology.
 */
export function FancyDivider({ my = 3 }: { my?: number }) {
  const rule = {
    flex: 1,
    height: "1px",
    background: (t: { palette: { divider: string } }) =>
      `linear-gradient(90deg, transparent, ${t.palette.divider})`,
  } as const;

  return (
    <Box
      aria-hidden
      data-testid="fancy-divider"
      sx={{ display: "flex", alignItems: "center", gap: 1.5, my }}
    >
      <Box sx={rule} />
      <Box
        sx={{
          width: 9,
          height: 9,
          transform: "rotate(45deg)",
          bgcolor: "secondary.main",
          boxShadow: (t) => `0 0 0 3px ${t.palette.background.default}`,
        }}
      />
      <Box sx={{ ...rule, background: (t) => `linear-gradient(90deg, ${t.palette.divider}, transparent)` }} />
    </Box>
  );
}
