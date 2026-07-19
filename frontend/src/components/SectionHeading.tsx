import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/**
 * A D&D Beyond-style section title: an optional gold overline, a small-caps
 * serif heading, and a crimson underline rule that anchors the block. Use it
 * to open any content section so headings share one consistent treatment.
 */
export function SectionHeading({
  children,
  overline,
  align = "left",
}: {
  children: ReactNode;
  overline?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <Box sx={{ mb: 2.5, textAlign: align }}>
      {overline && (
        <Typography variant="overline" component="div" sx={{ color: "secondary.main", mb: 0.5 }}>
          {overline}
        </Typography>
      )}
      <Typography variant="h2" component="h2">
        {children}
      </Typography>
      <Box
        aria-hidden
        sx={{
          mt: 1,
          height: 3,
          width: 72,
          mx: align === "center" ? "auto" : 0,
          borderRadius: 2,
          background: (t) =>
            `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
        }}
      />
    </Box>
  );
}
