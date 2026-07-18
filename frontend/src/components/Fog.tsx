import Box from "@mui/material/Box";
import { keyframes } from "@mui/system";

const driftA = keyframes`
  0%   { transform: translate3d(-14%, 0, 0); }
  100% { transform: translate3d(14%, 2%, 0); }
`;

const driftB = keyframes`
  0%   { transform: translate3d(12%, 6%, 0); }
  100% { transform: translate3d(-14%, -6%, 0); }
`;

const pulse = keyframes`
  0%   { opacity: 0.55; }
  100% { opacity: 0.95; }
`;

const layer = {
  position: "absolute",
  inset: "-35%",
  backgroundRepeat: "no-repeat",
  filter: "blur(60px)",
  willChange: "transform, opacity",
} as const;

/**
 * Atmospheric drifting fog rendered behind all content.
 * Pure CSS radial gradients — no images, GPU-friendly transforms only.
 */
export function Fog() {
  return (
    <Box
      aria-hidden
      data-testid="fog"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          ...layer,
          backgroundImage:
            "radial-gradient(50% 40% at 20% 30%, rgba(200,210,225,0.55), transparent 70%)," +
            "radial-gradient(45% 35% at 78% 62%, rgba(170,185,205,0.50), transparent 70%)," +
            "radial-gradient(40% 35% at 50% 90%, rgba(150,165,190,0.45), transparent 72%)",
          animation: `${driftA} 30s ease-in-out infinite alternate, ${pulse} 14s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.75 },
        }}
      />
      <Box
        sx={{
          ...layer,
          backgroundImage:
            "radial-gradient(48% 40% at 65% 18%, rgba(180,195,215,0.50), transparent 70%)," +
            "radial-gradient(45% 40% at 28% 75%, rgba(140,160,190,0.48), transparent 72%)," +
            "radial-gradient(40% 38% at 92% 40%, rgba(160,175,200,0.42), transparent 72%)",
          animation: `${driftB} 44s ease-in-out infinite alternate, ${pulse} 20s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.75 },
        }}
      />
    </Box>
  );
}
