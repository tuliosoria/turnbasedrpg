import { createTheme } from "@mui/material/styles";

const serif = 'Georgia, "Times New Roman", serif';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0c0d10", paper: "#16181d" },
    primary: { main: "#5a7aa6", dark: "#38506e" },
    secondary: { main: "#a13d3d", dark: "#7c2b2b" },
    error: { main: "#c05a5a", dark: "#7c2b2b" },
    warning: { main: "#c76a2f", dark: "#b3541e" },
    text: { primary: "#e8e4d8", secondary: "#9aa0ab" },
    divider: "#3a3f4b",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: sans,
    h1: { fontFamily: serif, fontWeight: 600, fontSize: "2.2rem", letterSpacing: "0.02em" },
    h2: { fontFamily: serif, fontWeight: 600, fontSize: "1.5rem" },
    h3: { fontFamily: serif, fontWeight: 600, fontSize: "1.2rem" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { variant: "contained" },
      styleOverrides: { root: { minHeight: 44, borderRadius: 8 } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: { backgroundColor: "#16181d", borderColor: "#3a3f4b", backgroundImage: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#111318",
          backgroundImage: "none",
          borderBottom: "1px solid #3a3f4b",
        },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true, variant: "outlined" } },
  },
});
