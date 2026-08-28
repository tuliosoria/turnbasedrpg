import { useCallback, useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MailIcon from "@mui/icons-material/MailOutline";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { loadPlayerSession } from "../auth/playerSession";
import type { IncomingLetter } from "../api/client";

/**
 * O aviso de que uma Casa procurou o jogador.
 *
 * As Casas NPC escrevem primeiro, e sem isto a carta chegava para ninguém: o
 * jogador teria de abrir a correspondência e conferir Casa por Casa. Fica no
 * cabeçalho porque a carta não pertence a nenhuma página — ela chega enquanto
 * ele lê a wiki.
 *
 * Mostra QUEM escreveu, e não só quantas: um "4" apontava para o palheiro em
 * vez da agulha, e o jogador ainda tinha de caçar as conversas uma a uma. Cada
 * item leva direto ao fio daquela Casa.
 *
 * Só aparece quando há carta. Um sino permanentemente zerado é ruído que ensina
 * o jogador a não olhar para ele.
 */
export function CorrespondenceBell() {
  // A guarda vem antes de qualquer hook de API de propósito: o cabeçalho
  // aparece na landing e na wiki, onde não há sessão de jogador — e onde
  // exigir o contexto de API derrubaria a página inteira por um sino.
  const sessao = loadPlayerSession();
  if (!sessao?.playerToken) return null;
  return <Sino playerToken={sessao.playerToken} />;
}

function Sino({ playerToken }: { playerToken: string }) {
  const api = useApi();
  const navigate = useNavigate();
  const [cartas, setCartas] = useState<IncomingLetter[]>([]);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const conferir = useCallback(async () => {
    try {
      const r = await api.countIncomingLetters(playerToken);
      setCartas(r.remetentes ?? []);
    } catch {
      // Um contador que falha não pode atrapalhar a navegação da página.
      setCartas([]);
    }
  }, [api, playerToken]);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  if (cartas.length === 0) return null;

  const rotulo = cartas.length === 1 ? "Uma Casa escreveu para você" : `${cartas.length} Casas escreveram para você`;

  const abrir = (houseKey: string) => {
    setAnchor(null);
    navigate(`/game?aba=cartas&casa=${encodeURIComponent(houseKey)}`);
  };

  return (
    <>
      <Tooltip title={rotulo}>
        <Button
          color="inherit"
          size="small"
          aria-label={rotulo}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ minWidth: 0, px: 1 }}
        >
          <Badge badgeContent={cartas.length} color="secondary">
            <MailIcon fontSize="small" />
          </Badge>
        </Button>
      </Tooltip>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxWidth: 420 } } }}>
        <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>{rotulo}</Typography>
        <Divider sx={{ mt: 0.5 }} />
        {cartas.map((c) => (
          <MenuItem key={c.houseKey} onClick={() => abrir(c.houseKey)} sx={{ whiteSpace: "normal", alignItems: "flex-start" }}>
            <ListItemText
              primary={c.person ? `${c.person} — ${c.houseName}` : c.houseName}
              secondary={c.preview}
              secondaryTypographyProps={{ sx: { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
