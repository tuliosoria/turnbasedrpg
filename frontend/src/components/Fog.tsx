import Box from "@mui/material/Box";
import { keyframes } from "@mui/system";

const driftA = keyframes`
  0%   { transform: translate3d(-15%, 0, 0) scale(1.4); }
  100% { transform: translate3d(15%, 0, 0) scale(1.4); }
`;

const driftB = keyframes`
  0%   { transform: translate3d(10%, 5%, 0) scale(1.6); }
  100% { transform: translate3d(-12%, -4%, 0) scale(1.6); }
`;

const layer = {
  position: "absolute",
  inset: "-25%",
  backgroundRepeat: "repeat",
  willChange: "transform",
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
          opacity: 0.5,
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 20% 30%, rgba(150,160,175,0.10), transparent 60%)," +
            "radial-gradient(ellipse 50% 35% at 75% 65%, rgba(120,135,155,0.08), transparent 60%)",
          backgroundSize: "70% 60%, 60% 55%",
          animation: `${driftA} 42s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <Box
        sx={{
          ...layer,
          opacity: 0.4,
          backgroundImage:
            "radial-gradient(ellipse 55% 45% at 60% 20%, rgba(90,105,125,0.10), transparent 65%)," +
            "radial-gradient(ellipse 45% 40% at 30% 80%, rgba(70,80,100,0.10), transparent 65%)",
          backgroundSize: "65% 60%, 55% 50%",
          animation: `${driftB} 60s ease-in-out infinite alternate`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
    </Box>
  );
}
