import type { ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { Layout } from "./Layout";
import { WORLD_LINKS } from "./navigation";

/**
 * A casca das páginas do mundo.
 *
 * Antes, cada seção era uma ilha: a crônica tinha barra lateral própria e as
 * outras quatro não tinham navegação nenhuma, então de um verbete não havia
 * caminho para Personagens a não ser voltar ao menu do topo. A barra passa a
 * valer nas cinco, sempre dizendo onde você está.
 *
 * No celular ela não aparece: a gaveta do Layout já cobre esse caso, e repetir
 * a navegação em duas formas na mesma tela estreita só rouba espaço do
 * conteúdo.
 */
export function MundoLayout({
  children,
  aninhado,
  action,
}: {
  children: ReactNode;
  /** Navegação de dentro do destino atual — hoje as seções da crônica. */
  aninhado?: ReactNode;
  action?: ReactNode;
}) {
  const { pathname } = useLocation();

  return (
    <Layout largo action={action}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: "1fr", md: "232px minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 88,
            maxHeight: "calc(100dvh - 112px)",
            overflowY: "auto",
          }}
        >
          <Box component="nav" aria-label="O Mundo">
            <Typography variant="overline" component="h2" sx={{ display: "block", px: 2, mb: 0.5 }}>
              O Mundo
            </Typography>
            <List dense disablePadding>
              {WORLD_LINKS.map((link) => {
                // O destino é o atual quando a rota é ele ou desce a partir
                // dele: /personagens/x continua sendo Personagens.
                const atual = pathname === link.to || pathname.startsWith(`${link.to}/`);
                return (
                  <ListItem key={link.to} disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={link.to}
                      selected={atual}
                      sx={{
                        borderLeft: 2,
                        borderColor: atual ? "primary.main" : "transparent",
                        "&.Mui-selected": { backgroundColor: "action.hover" },
                      }}
                    >
                      <ListItemText
                        primary={link.label}
                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight: atual ? 700 : 400,
                              color: atual ? "text.primary" : "text.secondary",
                            },
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
          {aninhado && <Box sx={{ mt: 3 }}>{aninhado}</Box>}
        </Box>

        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>
    </Layout>
  );
}
