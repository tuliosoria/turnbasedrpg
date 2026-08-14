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
import { CAMPAIGN_GUIDE_SECTION, WIKI_SECTIONS } from "@ravenloft/content";
import { Fog } from "./Fog";

export function Layout({
  children,
  action,
  bleed = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  /**
   * Renderiza o conteúdo sem a faixa central, para páginas que precisam
   * encostar nas bordas da janela — hoje só a home, por causa do hero em
   * vídeo. Quem usa isto passa a ser responsável pela própria largura.
   */
  bleed?: boolean;
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
          <Box
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
          >
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
          <Button component={RouterLink} to="/casas" variant="text" size="small">
            Casas
          </Button>
          <Button component={RouterLink} to="/galeria" variant="text" size="small">
            Galeria
          </Button>
          <Button component={RouterLink} to="/enciclopedia" variant="text" size="small">
            Enciclopédia
          </Button>
          <Button component={RouterLink} to={`/valdren/${CAMPAIGN_GUIDE_SECTION}`} variant="text" size="small">
            Campanha D&amp;D
          </Button>
          {/* Entrar existia só na home. Quem estava lendo a wiki e quisesse
              jogar tinha de voltar para a raiz para achar a porta. */}
          <Button component={RouterLink} to="/login" variant="outlined" size="small" sx={{ ml: 1 }}>
            Entrar
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
              <ListItemButton component={RouterLink} to="/casas" onClick={close}>
                <ListItemText primary="As Casas" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/galeria" onClick={close}>
                <ListItemText primary="Galeria" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/enciclopedia" onClick={close}>
                <ListItemText primary="Enciclopédia" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to={`/valdren/${CAMPAIGN_GUIDE_SECTION}`} onClick={close}>
                <ListItemText primary="Campanha D&D" />
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
      {bleed ? (
        <Box component="main" sx={{ flexGrow: 1, width: "100%", position: "relative", zIndex: 1 }}>
          {children}
        </Box>
      ) : (
        <Container
          component="main"
          maxWidth="md"
          sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1, width: "100%", position: "relative", zIndex: 1 }}
        >
          {children}
        </Container>
      )}
    </Box>
  );
}
