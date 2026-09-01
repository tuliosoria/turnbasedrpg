import type { ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { Layout } from "./Layout";
import { useEffect, useState } from "react";
import { WORLD_LINKS } from "./navigation";
import { WikiNav } from "../pages/wiki/WikiNav";
import { useApi } from "../api/ApiProvider";

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
  const api = useApi();

  /**
   * A crônica agora vive na lateral de TODA página do Mundo, e não só dentro
   * de /valdren.
   *
   * Antes, a lateral tinha cinco itens em /casas e vinte e oito em
   * /valdren/geografia: a mesma navegação mudava de tamanho conforme onde você
   * estava, e de /casas não havia como pular para o Censo sem passar pelo
   * índice. O reino é parte do Mundo, e o menu passa a dizer isso.
   */
  const [povoadas, setPovoadas] = useState<Set<string> | null>(null);
  useEffect(() => {
    // Best-effort: uma falha aqui esconde a crônica, nunca derruba a página.
    void api.getWiki().then((e) => setPovoadas(new Set(e.map((x) => x.section)))).catch(() => setPovoadas(new Set()));
  }, [api]);

  const secaoAtual = pathname.startsWith("/valdren/") ? pathname.slice("/valdren/".length) : "";
  // O índice da crônica JÁ é essa lista, com descrição de cada seção. Repeti-la
  // na lateral da mesma tela é a poluição que a mudança veio resolver.
  const ehIndice = pathname === "/valdren";

  return (
    <Layout action={action}>
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
                // O destino é o atual quando a rota é ele, desce a partir dele
                // — /personagens/x continua sendo Personagens — ou é uma das
                // rotas que ele declara suas.
                const donoDe = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
                const atual = donoDe(link.to) || (link.tambem ?? []).some(donoDe);
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

          {povoadas && povoadas.size > 0 && !ehIndice && (
            <Box sx={{ mt: 3 }}>
              <WikiNav current={secaoAtual} populated={povoadas} />
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>
    </Layout>
  );
}
