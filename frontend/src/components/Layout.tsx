import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Fog } from "./Fog";

export function Layout({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative" }}>
      <Fog />
      <AppBar position="sticky" elevation={0} sx={{ zIndex: (t) => t.zIndex.appBar }}>
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h3"
              component="div"
              noWrap
              sx={{ fontSize: "1.05rem", lineHeight: 1.2 }}
            >
              Ravenloft
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              O Inverno dos Mortos
            </Typography>
          </Box>
          {action}
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        maxWidth="md"
        sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1, width: "100%", position: "relative", zIndex: 1 }}
      >
        {children}
      </Container>
    </Box>
  );
}
