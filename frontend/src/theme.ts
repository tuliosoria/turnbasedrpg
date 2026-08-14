import { createTheme, responsiveFontSizes } from "@mui/material/styles";

/**
 * Design system de Valdren.
 *
 * A direção é fria e de alto contraste: base grafite, texto osso, e um único
 * acento dourado que aparece em três lugares e só neles — botão primário,
 * item ativo de navegação e link inline. Todo o resto é grafite e osso, para
 * que a imagem carregue a página em vez da cor.
 *
 * O acento começou carmesim, para manter um fio de continuidade com a
 * identidade anterior enquanto a tipografia mudava inteira. Não sobreviveu à
 * medição: `#c2323c` sobre `#0e1013` dá 3,46:1, abaixo do piso de 4,5:1 que
 * texto e link exigem — vermelho escuro sobre preto é justamente o par que a
 * intuição erra. O ouro, que já era a secundária do tema antigo, dá 7,92:1 e
 * mantém a ligação com a heráldica das Casas.
 */

const sans = '"Inter Tight", system-ui, -apple-system, "Segoe UI", sans-serif';

export const brand = {
  base: "#0e1013",
  surface: "#15181c",
  raised: "#1c2026",
  text: "#e8e6e1",
  muted: "#9aa0a6",
  line: "#262b31",
  accent: "#c8a24b",
  accentDim: "#a8853a",
} as const;

/**
 * Escala de 4px. Os nomes existem para que "espaço entre seções" seja uma
 * decisão tomada uma vez, e não um número digitado de novo em cada arquivo.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  section: 96,
} as const;

export const layout = {
  maxWidth: 1200,
  /** Duração única de transição; movimento aqui é acento, não espetáculo. */
  motion: "160ms ease-out",
} as const;

/** O gesto que dá a frieza: caixa alta, peso, e muito espacejamento. */
const label = {
  fontFamily: sans,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.14em",
};

export const theme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: "dark",
      background: { default: brand.base, paper: brand.surface },
      // Tinta, não branco: texto branco sobre o ouro dá 2,41:1 e some. Sobre
      // a base escura o ouro dá 7,92:1, contra os 3,46:1 do carmesim que ele
      // substituiu — que reprovava no piso de 4,5:1 para texto e link.
      primary: { main: brand.accent, dark: brand.accentDim, contrastText: brand.base },
      secondary: { main: brand.text, contrastText: brand.base },
      error: { main: "#c05a5a", dark: "#7c2b2b" },
      warning: { main: "#c7913f" },
      text: { primary: brand.text, secondary: brand.muted },
      divider: brand.line,
    },
    shape: { borderRadius: 2 },
    typography: {
      fontFamily: sans,
      // Escala de razão 1.25. O h1 usa clamp porque o título do hero precisa
      // encher a tela grande sem estourar a estreita.
      h1: { fontFamily: sans, fontWeight: 800, fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1.02, letterSpacing: "-0.01em", textTransform: "uppercase" },
      h2: { fontFamily: sans, fontWeight: 800, fontSize: "2.25rem", lineHeight: 1.12, letterSpacing: "-0.005em" },
      h3: { fontFamily: sans, fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.2 },
      h4: { fontFamily: sans, fontWeight: 700, fontSize: "1.125rem", lineHeight: 1.3 },
      subtitle1: { fontFamily: sans, fontWeight: 400, fontSize: "1.125rem", color: brand.muted },
      body1: { fontSize: "1rem", lineHeight: 1.7 },
      body2: { fontSize: "0.9375rem", lineHeight: 1.65 },
      overline: { ...label, fontSize: "0.75rem", color: brand.muted },
      button: { ...label, fontSize: "0.8125rem" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: brand.base,
            // Sem gradientes decorativos: a base é chapada de propósito, para
            // que o contraste venha da imagem e da tipografia.
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
        styleOverrides: {
          root: { minHeight: 48, borderRadius: 2, paddingInline: 24, transition: `background-color ${layout.motion}, border-color ${layout.motion}` },
          containedPrimary: {
            backgroundColor: brand.accent,
            "&:hover": { backgroundColor: brand.accentDim },
          },
          outlined: {
            borderColor: brand.line,
            color: brand.text,
            "&:hover": { borderColor: brand.text, backgroundColor: "rgba(232,230,225,0.06)" },
          },
          text: { color: brand.text, "&:hover": { backgroundColor: "rgba(232,230,225,0.06)" } },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: {
            backgroundColor: brand.surface,
            backgroundImage: "none",
            borderColor: brand.line,
            boxShadow: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: brand.base,
            backgroundImage: "none",
            borderBottom: `1px solid ${brand.line}`,
            boxShadow: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: brand.surface,
            backgroundImage: "none",
            borderRight: `1px solid ${brand.line}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 2, letterSpacing: "0.06em" },
          colorSecondary: {
            backgroundColor: "transparent",
            color: brand.text,
            border: `1px solid ${brand.line}`,
            fontWeight: 700,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: { color: brand.accent, textDecorationColor: "rgba(200,162,75,0.45)" },
        },
      },
      MuiTextField: { defaultProps: { fullWidth: true, variant: "outlined" } },
      MuiListSubheader: {
        styleOverrides: { root: { ...label, backgroundColor: "transparent", color: brand.muted } },
      },
    },
  }),
);
