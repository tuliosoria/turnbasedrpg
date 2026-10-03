import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ApiProvider } from "./api/ApiProvider";
import { criarApiClient } from "./api";
import { AppRoutes } from "./App";
import { theme } from "./theme";

criarApiClient()
  .then((apiClient) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ApiProvider client={apiClient}>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ApiProvider>
        </ThemeProvider>
      </StrictMode>,
    );
  })
  .catch((erro: unknown) => {
    const el = document.getElementById("root");
    if (!el) return;
    el.textContent = erro instanceof Error ? erro.message : "Não foi possível iniciar o jogo.";
  });
