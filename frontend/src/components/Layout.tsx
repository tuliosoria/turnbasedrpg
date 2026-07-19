import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Divider from "@mui/material/Divider";
import { WIKI_SECTIONS } from "@ravenloft/content";
import { Fog } from "./Fog";

export function Layout({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const close = () => setNavOpen(false);

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative" }}>
      <Fog />
      <AppBar position="sticky" elevation={0} sx={{ zIndex: (t) => t.zIndex.appBar }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Abrir navegação"
            onClick={() => setNavOpen(true)}
            sx={{ mr: 0.5, fontSize: "1.4rem", lineHeight: 1 }}
          >
            ☰
          </IconButton>
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
          <Button component={RouterLink} to="/galeria" color="inherit" size="small">
            Galeria
          </Button>
          {action}
        </Toolbar>
      </AppBar>
      <Drawer anchor="left" open={navOpen} onClose={close}>
        <Box sx={{ width: 280 }} role="navigation">
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="h3" sx={{ fontSize: "1.1rem" }}>
              Valdren
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Crônica do Inverno dos Mortos
            </Typography>
          </Box>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/" onClick={close}>
                <ListItemText primary="Início" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/galeria" onClick={close}>
                <ListItemText primary="Galeria" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider />
          <List
            subheader={
              <ListSubheader component="div" disableSticky sx={{ bgcolor: "transparent" }}>
                Valdren História
              </ListSubheader>
            }
          >
            {WIKI_SECTIONS.map((section) => (
              <ListItem key={section.id} disablePadding>
                <ListItemButton component={RouterLink} to={`/valdren/${section.id}`} onClick={close}>
                  <ListItemText primary={section.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
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
