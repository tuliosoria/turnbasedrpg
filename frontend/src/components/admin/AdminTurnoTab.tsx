import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TurnResult } from "@ravenloft/content";
import type { TurnImageKind } from "../../api/client";
import type { AdminDashboard } from "../../types/api";
import { AdminCorrespondenceTab } from "./AdminCorrespondenceTab";
import { AdminProjectsTab } from "./AdminProjectsTab";
import { CardCatalog } from "./CardCatalog";
import { useState } from "react";
import { useApi } from "../../api/ApiProvider";
import { AdminTurnsTab } from "./AdminTurnsTab";
import { TurnDraftBanner } from "./TurnDraftBanner";
import type { RunAction } from "./types";

/**
 * Uma seção que o Mestre abre quando vai usar.
 *
 * A correspondência de uma campanha inteira e a lista de cartas não cabem
 * abertas em cima do formulário do turno — mas escondê-las noutra aba obrigava
 * a sair do meio do trabalho para consultá-las. O meio-termo é ficarem aqui,
 * recolhidas, com o número na barra para o Mestre saber se vale abrir.
 */
function Secao({ titulo, resumo, children }: { titulo: string; resumo?: string; children: React.ReactNode }) {
  return (
    <Accordion disableGutters>
      {/* Sem a seta, uma barra recolhida não se anuncia como clicável. */}
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">{titulo}</Typography>
          {resumo && <Chip size="small" variant="outlined" label={resumo} />}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

/**
 * Tudo que se faz para rodar um turno, na ordem em que se faz.
 *
 * O Mestre lê o que as Casas escreveram, despacha as cartas que estão paradas
 * esperando ele, e só então escreve o resultado. Antes isso eram três abas
 * separadas — Correspondência, Projetos e Turnos — e ele se perdia entre elas
 * no meio de uma única sessão de trabalho.
 */
export function AdminTurnoTab(props: {
  dashboard: AdminDashboard;
  adminToken: string;
  busy: boolean;
  runAction: RunAction;
  publicEvent: string;
  setPublicEvent: (value: string) => void;
  privateInfo: Record<string, string>;
  setPrivateInfo: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  resolution: TurnResult | null;
  setResolution: React.Dispatch<React.SetStateAction<TurnResult | null>>;
  updateResolution: (patch: Partial<TurnResult>) => void;
  discoveriesText: string;
  setDiscoveriesText: (value: string) => void;
  setTurnImageUrl: (kind: TurnImageKind, imageUrl: string) => void;
  onDraftPublished?: () => void;
  onError: (message: string) => void;
  pendingProjects: number;
}) {
  const { adminToken, dashboard, onError, pendingProjects, onDraftPublished, setTurnImageUrl, ...turnos } = props;

  return (
    <Stack spacing={2}>
      <TurnDraftBanner
        adminToken={adminToken}
        houses={dashboard.houses.map((h) => ({ houseId: h.houseId, name: h.name }))}
        turnStatus={dashboard.turnStatus}
        onLoad={(nextPublicEvent, nextPrivateInfo) => {
          props.setPublicEvent(nextPublicEvent);
          props.setPrivateInfo(() => nextPrivateInfo);
        }}
        onImageSet={(url) => setTurnImageUrl("event", url)}
        onLoadResolution={(publicResult, houseResults, discoveries) => {
          props.updateResolution({ publicResult, houseResults });
          props.setDiscoveriesText(discoveries.join("\n"));
        }}
        onPublished={onDraftPublished}
      />

      <Secao titulo="Correspondência" resumo="o que as Casas escreveram">
        <CartasDoMundo adminToken={adminToken} />
        <AdminCorrespondenceTab adminToken={adminToken} />
      </Secao>

      <Secao
        titulo="Projetos das Casas"
        resumo={pendingProjects > 0 ? `${pendingProjects} esperando você` : "nada parado"}
      >
        <AdminProjectsTab adminToken={adminToken} busy={props.busy} onError={onError} />
      </Secao>

      <Secao titulo="Catálogo de projetos" resumo="o que existe para oferecer aos jogadores">
        <CardCatalog />
      </Secao>

      <AdminTurnsTab dashboard={dashboard} setTurnImageUrl={setTurnImageUrl} {...turnos} />
    </Stack>
  );
}

/**
 * O botão que faz o mundo escrever agora.
 *
 * O gatilho automático é a abertura do turno, o que obriga a esperar o turno
 * corrente ser resolvido. Aqui o Mestre dispara quando quiser — e dispara de
 * novo se as primeiras cartas não prestarem.
 */
function CartasDoMundo({ adminToken }: { adminToken: string }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = async () => {
    setBusy(true);
    setAviso(null);
    try {
      const { enviadas } = await api.adminSendWorldLetters(adminToken);
      setAviso(
        enviadas === 0
          ? "Nenhuma carta saiu. Ou todos os pares já estão conversando neste turno, ou a IA não respondeu a tempo."
          : `${enviadas} ${enviadas === 1 ? "Casa escreveu" : "Casas escreveram"} aos jogadores. Elas já aparecem abaixo.`,
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha ao enviar as cartas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" disabled={busy} onClick={() => void enviar()}>
          {busy ? "As Casas estão escrevendo…" : "Mandar o mundo escrever"}
        </Button>
        <Typography variant="caption" color="text.secondary">
          Três Casas NPC procuram os jogadores. Isto também acontece sozinho ao abrir um turno.
        </Typography>
      </Stack>
      {aviso && <Alert severity="info" onClose={() => setAviso(null)}>{aviso}</Alert>}
    </Stack>
  );
}
