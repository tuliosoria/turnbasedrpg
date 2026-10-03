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
import { AdminSpyTab } from "./AdminSpyTab";
import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api/ApiProvider";
import { AdminTurnsTab } from "./AdminTurnsTab";
import { TurnDraftBanner } from "./TurnDraftBanner";
import type { RunAction } from "./types";

/** Para onde o atalho da faixa dourada mandou o Mestre. `vez` muda a cada clique. */
export type Foco = { alvo: string; vez: number } | null;

/**
 * Rola até a âncora quando o atalho aponta para ela, a cada clique.
 * `scrollIntoView` não existe no jsdom; lá só não rola.
 */
function useRolarAte(ancora: string | undefined, foco: Foco) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ancora && foco?.alvo === ancora) ref.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [ancora, foco]);
  return ref;
}

/** Um trecho do Turno que não é seção recolhida, mas pode ser destino do atalho. */
function Ancora({ ancora, foco, children }: { ancora: string; foco: Foco; children: React.ReactNode }) {
  const ref = useRolarAte(ancora, foco);
  return <div ref={ref} style={{ scrollMarginTop: 72 }}>{children}</div>;
}

/**
 * Uma seção que o Mestre abre quando vai usar.
 *
 * A correspondência de uma campanha inteira e a lista de cartas não cabem
 * abertas em cima do formulário do turno — mas escondê-las noutra aba obrigava
 * a sair do meio do trabalho para consultá-las. O meio-termo é ficarem aqui,
 * recolhidas, com o número na barra para o Mestre saber se vale abrir.
 *
 * Quando o atalho da faixa dourada aponta para ela, abre e rola até lá. Antes
 * ficava recolhida, e o Mestre clicava em "2 projetos esperando despacho" sem
 * ver nada mudar.
 */
export function Secao({ titulo, resumo, ancora, foco = null, children }: {
  titulo: string;
  resumo?: string;
  ancora?: string;
  foco?: Foco;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(() => !!ancora && foco?.alvo === ancora);
  useEffect(() => {
    if (ancora && foco?.alvo === ancora) setAberta(true);
  }, [ancora, foco]);
  const ref = useRolarAte(ancora, foco);
  return (
    <Accordion ref={ref} disableGutters expanded={aberta} onChange={(_e, v) => setAberta(v)} sx={{ scrollMarginTop: 72 }}>
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
  /** Para onde o atalho da faixa dourada mandou o Mestre. */
  foco?: Foco;
}) {
  const { adminToken, dashboard, onError, pendingProjects, onDraftPublished, setTurnImageUrl, foco = null, ...turnos } = props;

  return (
    <Stack spacing={2}>
      <Ancora ancora="rascunho" foco={foco}>
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
      </Ancora>

      <Secao titulo="Correspondência" resumo="o que as Casas escreveram">
        <CartasDoMundo adminToken={adminToken} />
        <AdminCorrespondenceTab adminToken={adminToken} />
      </Secao>

      <Secao
        titulo="Projetos das Casas"
        ancora="projetos"
        foco={foco}
        resumo={pendingProjects > 0 ? `${pendingProjects} esperando você` : "nada parado"}
      >
        <AdminProjectsTab
          adminToken={adminToken}
          busy={props.busy}
          onError={onError}
          onChanged={() => void props.runAction(async () => {})}
        />
      </Secao>

      {/* Antes de escrever o turno: o que as Casas mandaram perguntar. O que
          voltar daqui costuma virar informação privada de alguém. */}
      <Secao titulo="Espiões esperando resposta" resumo="o que as Casas mandaram perguntar" ancora="espioes" foco={foco}>
        {/* `runAction` sem ação recarrega o painel: é o caminho já existente
            para o aviso dourado recontar depois de uma operação sair da fila. */}
        <AdminSpyTab adminToken={adminToken} onChanged={() => void props.runAction(async () => {})} />
      </Secao>

      <Secao titulo="Catálogo de projetos" resumo="o que existe para oferecer aos jogadores">
        <CardCatalog />
      </Secao>

      <Ancora ancora="resultado" foco={foco}>
        <AdminTurnsTab dashboard={dashboard} setTurnImageUrl={setTurnImageUrl} {...turnos} />
      </Ancora>
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
      // Escrever saiu da requisição: são duas chamadas ao modelo por carta
      // agora, e isso leva minutos. A rota confirma que começou, e as cartas
      // aparecem sozinhas conforme ficam prontas.
      await api.adminSendWorldLetters(adminToken);
      setAviso("As Casas começaram a escrever. Leva alguns minutos; recarregue esta aba daqui a pouco para ver as cartas.");
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
