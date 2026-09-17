import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ApiProvider } from "./api/ApiProvider";
import { criarApiClient } from "./api";
import { AppRoutes } from "./App";
import { theme } from "./theme";

criarApiClient().then((apiClient) => {
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
});
