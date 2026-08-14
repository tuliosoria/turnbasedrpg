import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { ReactNode } from "react";
import { brand } from "../theme";

const VIDEO = "/valdren-hero.mp4";
const POSTER = "/valdren-hero-poster.jpg";

/**
 * O fundo de vídeo da home, com o texto por cima.
 *
 * Hero em vídeo falha de três maneiras conhecidas, e as três têm defesa aqui:
 *
 * 1. O primeiro quadro demora. O `poster` cobre o intervalo, então nunca há
 *    um retângulo preto.
 * 2. O navegador nega o autoplay. Como o vídeo é mudo, isso é raro — e se
 *    acontecer, o poster continua no lugar e a página não perde nada.
 * 3. O usuário pediu menos movimento, ou está no celular pagando dados. Aí o
 *    `<video>` não é montado: sem elemento, sem download dos 2,9 MB.
 *
 * O vídeo é diurno e claro — céu azul, floresta verde — e a paleta do site é
 * grafite quase preto. Sem tratamento, ou o texto fica ilegível ou o véu mata
 * a arte. O acordo é rebaixar saturação e brilho no próprio vídeo e escurecer
 * só a base com um gradiente, deixando o topo do quadro legível como imagem.
 */
export function HeroVideo({ children }: { children: ReactNode }) {
  // `noSsr` porque a decisão precisa valer já na primeira pintura: montar o
  // vídeo e removê-lo em seguida desperdiçaria justamente o download que a
  // preferência do usuário pede para evitar.
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  const narrow = useMediaQuery("(max-width: 900px)", { noSsr: true });
  const showVideo = !reducedMotion && !narrow;

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        minHeight: { xs: "72vh", md: "88vh" },
        display: "flex",
        alignItems: "flex-end",
        overflow: "hidden",
        backgroundColor: brand.base,
        backgroundImage: `url(${POSTER})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {showVideo && (
        <Box
          component="video"
          data-testid="hero-video"
          src={VIDEO}
          poster={POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(0.72) brightness(0.62)",
          }}
        />
      )}

      {/* Gradiente da base para o texto ter contraste, mais vinheta para
          fechar as bordas. Decorativos, então fora da árvore de acessibilidade. */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          background:
            `linear-gradient(to top, ${brand.base} 4%, rgba(14,16,19,0.86) 28%, rgba(14,16,19,0.35) 62%, rgba(14,16,19,0.55) 100%),` +
            "radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <Box sx={{ position: "relative", width: "100%", px: { xs: 3, md: 6 }, pb: { xs: 6, md: 10 } }}>
        {children}
      </Box>
    </Box>
  );
}
