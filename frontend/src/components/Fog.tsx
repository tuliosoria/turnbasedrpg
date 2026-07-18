import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
  twinkle: number;
  color: number[];
}

const COLORS = [
  [200, 210, 225],
  [170, 185, 205],
  [150, 165, 190],
  [130, 150, 180],
];

/**
 * Atmospheric fog rendered as slow-drifting translucent particles on a canvas
 * behind all content. Soft radial specks that wander and gently twinkle,
 * evoking drifting mist. Honors prefers-reduced-motion.
 */
export function Fog() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext("2d");
    if (!context) return;
    const cv = el;
    const ctx = context;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;

    function spawn(): Particle {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 24 + Math.random() * 64,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.05 - Math.random() * 0.18,
        alpha: 0.05 + Math.random() * 0.13,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.4 + Math.random() * 0.9,
        color,
      };
    }

    function makeParticles() {
      const count = Math.max(28, Math.min(90, Math.round((width * height) / 22000)));
      particles = Array.from({ length: count }, spawn);
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      cv.style.width = `${width}px`;
      cv.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeParticles();
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const flicker = 0.6 + 0.4 * Math.sin(t * 0.0006 * p.twinkle + p.phase);
        const a = p.alpha * flicker;
        const [cr, cg, cb] = p.color;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function step(t: number) {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        const m = p.r;
        if (p.x < -m) p.x = width + m;
        if (p.x > width + m) p.x = -m;
        if (p.y < -m) p.y = height + m;
        if (p.y > height + m) p.y = -m;
      }
      draw(t);
      raf = requestAnimationFrame(step);
    }

    resize();
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(step);
    }
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

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
        component="canvas"
        data-testid="fog"
        ref={canvasRef}
        sx={{ width: "100%", height: "100%", display: "block" }}
      />
    </Box>
  );
}
