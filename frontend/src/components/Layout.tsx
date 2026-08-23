import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
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
import MenuIcon from "@mui/icons-material/Menu";
import { WIKI_GROUPS, wikiSectionLabel } from "@ravenloft/content";
import { adminTokenSnapshot, subscribeAdminToken } from "../auth/adminSession";
import { Fog } from "./Fog";
import { NavMenu } from "./NavMenu";
import { ENTER_LINKS, PLAY_LINKS, STUDIO_LINKS, WORLD_LINKS } from "./navigation";

export function Layout({
  children,
  action,
  bleed = false,
  largo = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  /**
   * Renderiza o conteúdo sem a faixa central, para páginas que precisam
   * encostar nas bordas da janela — hoje só a home, por causa do hero em
   * vídeo. Quem usa isto passa a ser responsável pela própria largura.
   */
  bleed?: boolean;
  /**
   * Solta a faixa central até a largura grande.
   *
   * Fica opcional de propósito: formulário e ficha não melhoram esticando, e a
   * medida estreita é o que mantém a prosa legível. Quem pede o modo largo são
   * as páginas do mundo, que têm barra lateral e grade para preencher o espaço
   * — e a coluna de texto dentro delas continua com teto próprio.
   */
  largo?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const close = () => setNavOpen(false);
  // As ferramentas de autoria não são um item escondido dentro de conteúdo de
  // jogador: são um destino próprio, que só existe para quem é mestre.
  //
  // Precisa ser reativo. A versão anterior lia o token uma vez na montagem,
  // apostando que entrar como mestre mudaria de rota e remontaria o Layout —
  // e não muda: a página de admin troca estado interno e fica onde está. O
  // resultado era o Estúdio, e portanto a Enciclopédia, invisíveis mesmo
  // depois do login. O snapshot é cacheado, então o custo de decodificar o
  // token não volta para o caminho de render.
  const isAdmin = !!useSyncExternalStore(subscribeAdminToken, adminTokenSnapshot, () => null);

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
            sx={{ mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>
          <Box
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
          >
            {/* Uma palavra só. O cenário é Valdren; a campanha não tem mais
                nome próprio competindo com ele no canto da tela. */}
            <Typography
              variant="h3"
              component="div"
              noWrap
              sx={{ fontSize: "1.15rem", lineHeight: 1.2, letterSpacing: "0.02em" }}
            >
              Valdren
            </Typography>
          </Box>
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
            <NavMenu label="O Mundo" links={WORLD_LINKS} />
            <NavMenu label="Jogar" links={PLAY_LINKS} />
            {isAdmin && <NavMenu label="Estúdio" links={STUDIO_LINKS} />}
          </Box>
          {/* Entrar existia só na home. Quem estava lendo a wiki e quisesse
              jogar tinha de voltar para a raiz para achar a porta. */}
          <NavMenu label="Entrar" links={ENTER_LINKS} variant="outlined" sx={{ ml: 1 }} />
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
              Um reino cercado pelas Brumas
            </Typography>
          </Box>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/" onClick={close}>
                <ListItemText primary="Início" />
              </ListItemButton>
            </ListItem>
            {[...WORLD_LINKS, ...PLAY_LINKS, ...(isAdmin ? STUDIO_LINKS : []), ...ENTER_LINKS].map((link) => (
              <ListItem key={link.to} disablePadding>
                <ListItemButton component={RouterLink} to={link.to} onClick={close}>
                  <ListItemText primary={link.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          {/* A crônica por grupo. A lista plana das vinte e três seções era
              uma parede: quem chegava não sabia por onde começar. */}
          {WIKI_GROUPS.map((group) => (
            <List
              key={group.id}
              dense
              subheader={
                <ListSubheader component="div" disableSticky>
                  {group.label}
                </ListSubheader>
              }
            >
              {group.sections.map((id) => (
                <ListItem key={id} disablePadding>
                  <ListItemButton component={RouterLink} to={`/valdren/${id}`} onClick={close}>
                    <ListItemText primary={wikiSectionLabel(id)} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ))}
        </Box>
      </Drawer>
      {bleed ? (
        <Box component="main" sx={{ flexGrow: 1, width: "100%", position: "relative", zIndex: 1 }}>
          {children}
        </Box>
      ) : (
        <Container
          component="main"
          maxWidth={largo ? "xl" : "md"}
          sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1, width: "100%", position: "relative", zIndex: 1 }}
        >
          {children}
        </Container>
      )}
    </Box>
  );
}
