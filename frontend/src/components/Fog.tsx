import Box from "@mui/material/Box";
import { keyframes } from "@mui/system";

const driftA = keyframes`
  0%   { transform: translate3d(-12%, 0, 0); }
  100% { transform: translate3d(12%, 0, 0); }
`;

const driftB = keyframes`
  0%   { transform: translate3d(10%, 6%, 0); }
  100% { transform: translate3d(-12%, -6%, 0); }
`;

const pulse = keyframes`
  0%   { opacity: 0.35; }
  100% { opacity: 0.7; }
`;

const layer = {
  position: "absolute",
  inset: "-30%",
  backgroundRepeat: "no-repeat",
  filter: "blur(40px)",
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
            "radial-gradient(60% 45% at 25% 35%, rgba(190,200,215,0.28), transparent 70%)," +
            "radial-gradient(55% 40% at 80% 70%, rgba(160,175,195,0.24), transparent 70%)",
          animation: `${driftA} 34s ease-in-out infinite alternate, ${pulse} 17s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.5 },
        }}
      />
      <Box
        sx={{
          ...layer,
          backgroundImage:
            "radial-gradient(55% 45% at 65% 20%, rgba(150,165,190,0.24), transparent 70%)," +
            "radial-gradient(50% 45% at 30% 85%, rgba(120,140,170,0.22), transparent 70%)",
          animation: `${driftB} 48s ease-in-out infinite alternate, ${pulse} 23s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.5 },
        }}
      />
    </Box>
  );
}
