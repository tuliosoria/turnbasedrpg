import { describe, expect, it } from "vitest";
import { brand, theme } from "./theme";

/** Luminância relativa, como o WCAG a define. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * O acento é a cor que mais erra em tema escuro, porque "vermelho sobre preto"
 * parece dramático e mede mal: o carmesim que esta paleta usou primeiro dava
 * 3,46:1 e passou por revisão visual sem ninguém medir. Estes limites existem
 * para que a próxima troca de acento seja reprovada aqui, e não no olho de
 * quem estiver lendo.
 */
describe("contraste da paleta", () => {
  it("o acento é legível sobre a base e sobre os painéis", () => {
    expect(contrast(brand.accent, brand.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brand.accent, brand.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("o texto e o secundário passam sobre a base", () => {
    expect(contrast(brand.text, brand.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brand.muted, brand.base)).toBeGreaterThanOrEqual(4.5);
  });

  // Branco sobre ouro dá 2,41:1: trocar o acento sem trocar o texto do botão
  // torna o rótulo do botão primário ilegível.
  it("o texto do botão primário é legível sobre o próprio acento", () => {
    const onAccent = theme.palette.primary.contrastText;
    expect(contrast(onAccent, brand.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("o estado pressionado continua legível", () => {
    expect(contrast(theme.palette.primary.contrastText, brand.accentDim)).toBeGreaterThanOrEqual(4.5);
  });
});
