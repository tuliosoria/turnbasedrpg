import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function Layout({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" elevation={0}>
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
        sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1, width: "100%" }}
      >
        {children}
      </Container>
    </Box>
  );
}
