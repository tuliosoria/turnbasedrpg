import { useCallback, useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import MailIcon from "@mui/icons-material/MailOutline";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/ApiProvider";
import { loadPlayerSession } from "../auth/playerSession";

/**
 * O aviso de que uma Casa procurou o jogador.
 *
 * As Casas NPC passaram a escrever primeiro, e sem isto as cartas chegavam para
 * ninguém: o jogador teria de abrir a correspondência e conferir Casa por Casa
 * para descobrir que alguém falou com ele. Fica no cabeçalho porque a carta não
 * pertence a nenhuma página — ela chega enquanto ele está lendo a wiki.
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
  const [cartas, setCartas] = useState(0);

  const conferir = useCallback(async () => {
    try {
      const { cartas: n } = await api.countIncomingLetters(playerToken);
      setCartas(n);
    } catch {
      // Um contador que falha não pode atrapalhar a navegação da página.
      setCartas(0);
    }
  }, [api, playerToken]);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  if (cartas === 0) return null;

  const rotulo = cartas === 1 ? "Uma Casa escreveu para você" : `${cartas} Casas escreveram para você`;

  return (
    <Tooltip title={rotulo}>
      <Button
        component={RouterLink}
        to="/game"
        color="inherit"
        size="small"
        aria-label={rotulo}
        sx={{ minWidth: 0, px: 1 }}
      >
        <Badge badgeContent={cartas} color="secondary">
          <MailIcon fontSize="small" />
        </Badge>
      </Button>
    </Tooltip>
  );
}
