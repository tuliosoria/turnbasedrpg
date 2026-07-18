import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Emblem, EmblemIcon } from "@ravenloft/content";

const ICON_GLYPHS: Record<EmblemIcon, string> = {
  lobo: "🐺",
  veado: "🦌",
  corvo: "🐦‍⬛",
  torre: "🏰",
  chama: "🔥",
  coroa: "👑",
};

export function Crest({ emblem, name, size = 96 }: { emblem: Emblem; name?: string; size?: number }) {
  return (
    <Box
      aria-label={name ? `Brasão de ${name}` : "Brasão da casa"}
      role="img"
      sx={{
        width: size,
        height: size * 1.15,
        borderRadius: "24% 24% 42% 42%",
        border: "2px solid rgba(255,255,255,0.45)",
        background: `linear-gradient(90deg, ${emblem.color1} 0 50%, ${emblem.color2} 50% 100%)`,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 10px 28px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      <Typography component="span" sx={{ fontSize: size * 0.42, lineHeight: 1 }}>
        {ICON_GLYPHS[emblem.icon]}
      </Typography>
    </Box>
  );
}
