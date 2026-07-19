import { createTheme, responsiveFontSizes } from "@mui/material/styles";

/**
 * Ravenloft design system — a dark-fantasy look & feel inspired by D&D Beyond.
 *
 * Tokens live here so the entire site shares one visual language: a warm
 * near-black parchment-on-charcoal base, a blood-crimson primary for actions
 * and section rules, and an aged-gold secondary for highlights and crests.
 * Display type uses the Marcellus serif (with small-caps for section titles),
 * paired with Roboto for readable body copy.
 */

const display = '"Marcellus", Georgia, "Times New Roman", serif';
const displaySc = '"Marcellus SC", "Marcellus", Georgia, serif';
const body = '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif';

export const brand = {
  ink: "#0b0906",
  panel: "#17120d",
  panelRaised: "#1f1811",
  crimson: "#b21e1e",
  crimsonDark: "#7a1414",
  crimsonLight: "#d24a3a",
  gold: "#c8a24b",
  goldDark: "#8f6f2c",
  parchment: "#ede4d0",
  parchmentDim: "#a89e8b",
  border: "#3a2f24",
} as const;

export const theme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: "dark",
      background: { default: brand.ink, paper: brand.panel },
      primary: { main: brand.crimson, dark: brand.crimsonDark, light: brand.crimsonLight, contrastText: "#f7efe0" },
      secondary: { main: brand.gold, dark: brand.goldDark, contrastText: "#1a1206" },
      error: { main: "#c05a5a", dark: "#7c2b2b" },
      warning: { main: "#c76a2f", dark: "#b3541e" },
      text: { primary: brand.parchment, secondary: brand.parchmentDim },
      divider: brand.border,
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: body,
      h1: { fontFamily: display, fontWeight: 400, fontSize: "2.6rem", letterSpacing: "0.01em", lineHeight: 1.1 },
      h2: { fontFamily: displaySc, fontWeight: 400, fontSize: "1.7rem", letterSpacing: "0.04em" },
      h3: { fontFamily: display, fontWeight: 400, fontSize: "1.25rem", letterSpacing: "0.02em" },
      subtitle1: { fontFamily: display, fontWeight: 400 },
      overline: { fontFamily: displaySc, letterSpacing: "0.22em", fontWeight: 400 },
      button: { textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: brand.ink,
            backgroundImage:
              "radial-gradient(1200px 600px at 50% -10%, rgba(178,30,30,0.10), transparent 60%)," +
              "radial-gradient(900px 500px at 100% 110%, rgba(200,162,75,0.06), transparent 60%)",
            backgroundAttachment: "fixed",
          },
        },
      },
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
        styleOverrides: {
          root: { minHeight: 44, borderRadius: 4 },
          containedPrimary: {
            backgroundImage: `linear-gradient(180deg, ${brand.crimsonLight} 0%, ${brand.crimson} 45%, ${brand.crimsonDark} 100%)`,
            border: "1px solid rgba(0,0,0,0.4)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            "&:hover": {
              backgroundImage: `linear-gradient(180deg, ${brand.crimson} 0%, ${brand.crimsonDark} 100%)`,
            },
          },
          containedSecondary: {
            backgroundImage: `linear-gradient(180deg, ${brand.gold} 0%, ${brand.goldDark} 100%)`,
            color: "#1a1206",
            border: "1px solid rgba(0,0,0,0.35)",
          },
          outlined: {
            borderColor: brand.gold,
            color: brand.gold,
            "&:hover": { borderColor: brand.gold, backgroundColor: "rgba(200,162,75,0.08)" },
          },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: {
            backgroundColor: brand.panel,
            backgroundImage: `linear-gradient(180deg, ${brand.panelRaised} 0%, ${brand.panel} 100%)`,
            borderColor: brand.border,
            boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "#120d09",
            backgroundImage: "linear-gradient(180deg, #1c140d 0%, #120d09 100%)",
            borderBottom: `2px solid ${brand.crimsonDark}`,
            boxShadow: "0 3px 12px rgba(0,0,0,0.55)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: brand.panel,
            backgroundImage: "none",
            borderRight: `2px solid ${brand.crimsonDark}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          colorSecondary: {
            backgroundColor: "rgba(200,162,75,0.15)",
            color: brand.gold,
            border: `1px solid ${brand.goldDark}`,
            fontWeight: 700,
            letterSpacing: "0.04em",
          },
        },
      },
      MuiTextField: { defaultProps: { fullWidth: true, variant: "outlined" } },
      MuiListSubheader: {
        styleOverrides: {
          root: {
            fontFamily: displaySc,
            letterSpacing: "0.14em",
            color: brand.gold,
            textTransform: "uppercase",
          },
        },
      },
    },
  }),
);
