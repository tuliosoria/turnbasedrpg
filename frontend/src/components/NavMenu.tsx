import { useState, type MouseEvent } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
export function NavMenu({ label, links }: { label: string; links: NavLink[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  const open = Boolean(anchor);
  const active = links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));

  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ transition: "transform 160ms ease-out", transform: open ? "rotate(180deg)" : "none" }} />}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{
          color: active ? "primary.main" : "text.primary",
          "&:hover": { color: active ? "primary.main" : "text.primary" },
        }}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 260, borderRadius: 0, mt: 1 } } }}
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
