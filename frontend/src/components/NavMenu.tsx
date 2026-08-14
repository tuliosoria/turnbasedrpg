import { useState, type MouseEvent } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SxProps, Theme } from "@mui/material/styles";

/** Estático de propósito: ver o comentário no `sx` do botão. */
const NAV_BUTTON_SX = {
  color: "text.primary",
  "&.is-active": { color: "primary.main" },
  "& .MuiButton-endIcon": { transition: "transform 160ms ease-out" },
  '&[data-open="true"] .MuiButton-endIcon': { transform: "rotate(180deg)" },
} as const;

const MENU_PAPER_SX = { minWidth: 260, borderRadius: 0, mt: 1 } as const;

export interface NavLink {
  label: string;
  to: string;
  /** Uma linha sobre o destino, para quem não conhece o vocabulário do site. */
  hint?: string;
}

/**
 * Um destino da barra que abre um menu.
 *
 * A barra antes listava sete irmãos — mundo, ferramenta e jogo competindo na
 * mesma fileira. Aqui cada destino agrupa o que pertence a ele, e o botão
 * marca-se como atual quando a rota aberta está dentro do grupo: sem isso o
 * usuário perde de vista onde está assim que navega para dentro.
 */
export function NavMenu({
  label,
  links,
  variant = "text",
  sx,
}: {
  label: string;
  links: NavLink[];
  variant?: "text" | "outlined";
  sx?: SxProps<Theme>;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  const open = Boolean(anchor);
  const active = links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));

  return (
    <>
      <Button
        variant={variant}
        size="small"
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        aria-haspopup="menu"
        aria-expanded={open}
        // Um objeto sx só, e a rotação descrita por seletor em vez de por
        // valor: sx que muda de identidade a cada render força o emotion a
        // reserializar o estilo, e a barra rerenderiza junto com cada tecla
        // digitada nas páginas de formulário.
        sx={[NAV_BUTTON_SX, ...(Array.isArray(sx) ? sx : [sx])]}
        className={active ? "is-active" : undefined}
        data-open={open ? "true" : undefined}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
      >
        {links.map((link) => (
          <MenuItem
            key={link.to}
            component={RouterLink}
            to={link.to}
            onClick={() => setAnchor(null)}
            selected={pathname === link.to}
            sx={{ py: 1.25 }}
          >
            <ListItemText
              primary={link.label}
              secondary={link.hint}
              slotProps={{
                primary: { sx: { fontWeight: 600 } },
                secondary: { sx: { fontSize: "0.8125rem" } },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
