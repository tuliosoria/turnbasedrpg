import { keyframes } from "@emotion/react";
import { brand } from "../../theme";

/**
 * Movimento neste painel é o jogo; fora dele, o tema manda que seja só acento.
 * Toda decisão de animar passa por aqui, para que `prefers-reduced-motion`
 * desligue tudo num lugar só.
 */
export function querMovimentoReduzido(): boolean {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const pulsoEnergia = keyframes`
  0%, 100% { box-shadow: 0 0 0 1px ${brand.energia}, 0 0 6px 0 ${brand.energia}55; }
  50% { box-shadow: 0 0 0 1px ${brand.energia}, 0 0 14px 2px ${brand.energia}88; }
`;

export const brilhoSucesso = keyframes`
  0% { box-shadow: 0 0 0 0 ${brand.accent}00; }
  40% { box-shadow: 0 0 32px 6px ${brand.accent}aa; }
  100% { box-shadow: 0 0 12px 2px ${brand.accent}55; }
`;

export const virarCarta = keyframes`
  0% { transform: perspective(800px) rotateY(90deg); opacity: 0; }
  100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
`;

export const rachadura = keyframes`
  0% { transform: translateX(0); filter: grayscale(0); }
  20% { transform: translateX(-4px) rotate(-1deg); }
  40% { transform: translateX(4px) rotate(1deg); }
  60% { transform: translateX(-2px); }
  100% { transform: translateX(0); filter: grayscale(0.7); }
`;

export const aparecer = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

type Keyframes = ReturnType<typeof keyframes>;

/** Valor da prop `animation` do `sx`, ou "none" com movimento reduzido. */
export function animacao(nome: Keyframes, duracao: string, extra = ""): string {
  if (querMovimentoReduzido()) return "none";
  return `${nome} ${duracao} ease-out ${extra}`.trim();
}

function centro(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Um orbe de Energia sai de `de` e pousa em `para`, num arco. Resolve quando
 * termina; com movimento reduzido, sem Web Animations ou sem os dois pontos,
 * resolve na hora sem criar nada.
 */
export async function voarOrbe(de: Element | null, para: Element | null): Promise<void> {
  if (!de || !para || querMovimentoReduzido()) return;
  const orbe = document.createElement("div");
  orbe.setAttribute("data-orbe-voando", "");
  if (typeof orbe.animate !== "function") return;
  const a = centro(de);
  const b = centro(para);
  const topo = Math.min(a.y, b.y) - 60;
  Object.assign(orbe.style, {
    position: "fixed", left: "0", top: "0", width: "18px", height: "18px", borderRadius: "50%",
    background: brand.energia, boxShadow: `0 0 12px 4px ${brand.energia}99`, pointerEvents: "none", zIndex: "2000",
  });
  document.body.appendChild(orbe);
  const ponto = (x: number, y: number) => `translate(${x - 9}px, ${y - 9}px)`;
  try {
    await orbe.animate(
      [
        { transform: ponto(a.x, a.y), opacity: 1 },
        { transform: ponto((a.x + b.x) / 2, topo), opacity: 1, offset: 0.5 },
        { transform: ponto(b.x, b.y), opacity: 0.2 },
      ],
      { duration: 450, easing: "cubic-bezier(.3,.7,.4,1)" },
    ).finished;
  } catch {
    // Animação cancelada (aba escondida, navegação): o estado já mudou.
  } finally {
    orbe.remove();
  }
}
