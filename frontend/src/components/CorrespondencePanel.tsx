import { useCallback, useEffect, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { TextoComPessoas } from "./TextoComPessoas";
import { mensagemDeErro } from "../api/mensagemDeErro";
import { useApi } from "../api/ApiProvider";
import { LoadingState } from "./LoadingState";
import { MESSAGE_MAX } from "@ravenloft/content";
import { portraitEntityId } from "../pages/personagens/portraitEntityId";
import type { CorrespondenceRecipient, DiplomaticMessageView, PactProposal } from "../api/client";

/** Iniciais para o avatar quando o personagem ainda não tem retrato. */
function initials(name: string): string {
  return name.replace(/^(Lorde|Lady|Ser|Mestra?|Príncipe|Princesa|Dama|Irmão|Irmã|Capitão)\s+/i, "")
    .split(/[\s,]+/).slice(0, 2).map((w) => w[0] ?? "").join("");
}

/** Um destinatário selecionável: avatar + nome + papel, com quem escrever. */
function PersonOption({ selected, onClick, name, role, avatar }: {
  selected: boolean; onClick: () => void; name: string; role: string; avatar?: string;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        justifyContent: "flex-start", textAlign: "left", width: "100%", gap: 1.25, p: 1, borderRadius: 1.5,
        border: 1, borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: "action.hover", borderColor: selected ? "primary.main" : "text.disabled" },
      }}
    >
      <Avatar src={avatar} alt={name} sx={{ width: 40, height: 40, flexShrink: 0 }}>{initials(name)}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">{role}</Typography>
      </Box>
    </ButtonBase>
  );
}

interface CorrespondencePanelProps {
  playerToken: string;
  houseName: string;
  /**
   * Casa a abrir assim que a lista chegar.
   *
   * O sino traz o jogador para cá apontando uma conversa específica. Sem isto
   * ele chegava na aba certa e ainda tinha de procurar quem lhe escreveu — que
   * é metade do problema que o aviso deveria resolver.
   */
  abrirCasa?: string | null;
}

/**
 * Correspondência entre as Casas, entre um turno e outro.
 *
 * O orçamento de cartas vem da distância real até a sede da outra Casa, então a
 * tela mostra os dias de viagem junto do que resta: recusar uma carta sem dizer
 * o porquê pareceria arbitrário, e a distância é justamente a regra do jogo.
 */
export function CorrespondencePanel({ playerToken, houseName, abrirCasa }: CorrespondencePanelProps) {
  const api = useApi();
  const [recipients, setRecipients] = useState<CorrespondenceRecipient[] | null>(null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CorrespondenceRecipient | null>(null);
  // Destinatário dentro da Casa: null = a chancelaria; um id = uma pessoa.
  const [addressee, setAddressee] = useState<string | null>(null);
  const [thread, setThread] = useState<DiplomaticMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);
  const [propostas, setPropostas] = useState<PactProposal[]>([]);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [pactoAviso, setPactoAviso] = useState<string | null>(null);
  // Enquanto a resposta está sendo escrita do outro lado, fora da requisição.
  const [esperandoResposta, setEsperandoResposta] = useState(false);

  /**
   * O rascunho vive no navegador até a carta sair.
   *
   * O jogador escreve dez linhas, o envio falha, e as dez linhas somem com a
   * tela de erro. Foi o que aconteceu com a carta dos anões para Ferrumor. Um
   * campo de texto que só existe em memória é um campo que perde trabalho em
   * toda falha, e nenhuma mensagem de erro amigável compensa isso.
   *
   * Guardado por destinatário: quem escreve a Khazdrun e depois muda para a
   * Karasoy encontra cada rascunho onde deixou.
   */
  const chaveDoRascunho = selected ? `valdren:rascunho:${selected.houseKey}:${addressee ?? ""}` : null;

  useEffect(() => {
    if (!chaveDoRascunho) return;
    setDraft(localStorage.getItem(chaveDoRascunho) ?? "");
  }, [chaveDoRascunho]);

  const escrever = (texto: string) => {
    setDraft(texto);
    if (!chaveDoRascunho) return;
    if (texto.trim()) localStorage.setItem(chaveDoRascunho, texto);
    else localStorage.removeItem(chaveDoRascunho);
  };

  const limparRascunho = () => {
    setDraft("");
    if (chaveDoRascunho) localStorage.removeItem(chaveDoRascunho);
  };

  const responder = async (factId: string, aceitar: boolean) => {
    setRespondendo(factId);
    setPactoAviso(null);
    try {
      const r = await api.respondToPact(playerToken, { factId, aceitar });
      setPactoAviso(
        r.aceito
          ? `Pacto firmado.${r.ativo ? ` Sua Casa ganhou: ${r.ativo}.` : ""}` +
            (r.custoPolitico?.length
              ? ` Custou com ${r.custoPolitico.map((c) => c.casa).join(", ")}.`
              : " As relações entre as duas Casas mudaram.")
          : "Proposta recusada. Fica registrado.",
      );
      await load();
    } catch (e) {
      setPactoAviso(mensagemDeErro(e));
    } finally {
      setRespondendo(null);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.getCorrespondence(playerToken);
      setRecipients(r.entries);
      setOpen(r.open);
      setTurnNumber(r.turnNumber);
      setPropostas(r.propostas ?? []);
    } catch (e) {
      setError(mensagemDeErro(e));
    }
  }, [api, playerToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Os retratos canônicos viram avatares dos NPCs. Ornamento: sem eles o
  // seletor ainda funciona com iniciais.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const assets = await api.getVisualGallery();
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const a of assets) if (a.assetType === "PORTRAIT" && a.entityId) map[a.entityId] = a.thumbnailUrl ?? a.storageUrl;
        setPortraits(map);
      } catch {
        /* segue sem avatares */
      }
    })();
    return () => { alive = false; };
  }, [api]);

  const openThread = useCallback(
    async (r: CorrespondenceRecipient) => {
      setSelected(r);
      setAddressee(null);
      setNotice(null);
      setThread(await api.getCorrespondenceThread(playerToken, r.houseKey).catch(() => []));
    },
    [api, playerToken],
  );


  // Só a primeira vez que a Casa pedida aparecer: reabrir a cada render
  // atropelaria o jogador que já navegou para outra conversa.
  const [jaAbriu, setJaAbriu] = useState<string | null>(null);
  useEffect(() => {
    if (!abrirCasa || jaAbriu === abrirCasa) return;
    const alvo = (recipients ?? []).find((r) => r.houseKey === abrirCasa);
    if (!alvo) return;
    setJaAbriu(abrirCasa);
    void openThread(alvo);
  }, [abrirCasa, recipients, jaAbriu, openThread]);

  const addresseeName = selected
    ? (addressee ? selected.people.find((p) => p.id === addressee)?.name ?? selected.name : selected.name)
    : "";
  // O fio é por Casa; aqui filtramos para a conversa com este destinatário.
  const visible = thread.filter((m) => (m.toCharacterId ?? null) === addressee);

  // Do turno mais antigo para o mais novo: uma correspondência se lê na ordem
  // em que aconteceu, ao contrário da visão do Mestre, que quer o recente.
  const porTurno = (() => {
    const mapa = new Map<number, typeof visible>();
    for (const m of visible) mapa.set(m.turnNumber, [...(mapa.get(m.turnNumber) ?? []), m]);
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  })();

  /** A carta que acabamos de tentar mandar já está no fio do servidor? */
  const chegou = async (corpo: string): Promise<boolean> => {
    if (!selected) return false;
    try {
      const fio = await api.getCorrespondenceThread(playerToken, selected.houseKey);
      return fio.some((m) => m.author === "PLAYER" && m.body.trim() === corpo);
    } catch {
      // Se nem isso responde, não dá para afirmar nada: o erro original vale.
      return false;
    }
  };

  const send = useCallback(async () => {
    if (!selected || !draft.trim()) return;
    const corpo = draft.trim();
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.sendCorrespondence(playerToken, { toHouseKey: selected.houseKey, toCharacterId: addressee, body: corpo });
      setThread((t) => [...t, res.sent, ...(res.reply ? [res.reply] : [])]);
      limparRascunho();
      if (res.replyPending) {
        // A carta saiu; quem recebeu ainda está escrevendo. O painel busca o
        // fio de tempos em tempos até a resposta aparecer, e o jogador não
        // precisa recarregar nem adivinhar se deu certo.
        setEsperandoResposta(true);
      } else if (res.replyFailed) {
        setNotice("A carta seguiu e está entregue. A resposta não saiu desta vez — ela pode chegar quando o Mestre resolver o turno.");
      }
      await load();
      setSelected((s) => (s ? { ...s, remaining: res.remaining } : s));
    } catch (e) {
      // Mesmo agora que a IA saiu da requisição, a carta é gravada antes de
      // qualquer outra coisa: um erro na tela não prova que ela não foi.
      // Perguntar ao servidor é mais barato que um reenvio duplicado.
      const enviada = await chegou(corpo);
      if (enviada) {
        limparRascunho();
        setNotice("A carta foi entregue — ela já está no fio. Não reenvie. Se houver resposta, ela aparece aqui.");
      } else {
        setError(mensagemDeErro(e));
      }
    } finally {
      setSending(false);
    }
  }, [api, playerToken, selected, addressee, draft, load]);

  /**
   * Busca o fio até a resposta chegar.
   *
   * Para sozinho depois de dois minutos. Quem escreve leva de dez a quarenta
   * segundos; passar disso é falha, e ficar batendo no servidor para sempre não
   * conserta falha nenhuma — só esconde que ela existe.
   */
  useEffect(() => {
    if (!esperandoResposta || !selected) return;
    const casa = selected.houseKey;
    let vivo = true;
    let tentativas = 0;
    const id = setInterval(() => {
      void (async () => {
        tentativas += 1;
        try {
          const fio = await api.getCorrespondenceThread(playerToken, casa);
          if (!vivo) return;
          const temResposta = fio.some((m) => m.author === "AI" && !thread.some((t) => t.id === m.id));
          if (temResposta) {
            setThread(fio);
            setEsperandoResposta(false);
            return;
          }
        } catch {
          // Uma busca que falha não é a resposta falhando. Tenta de novo.
        }
        if (vivo && tentativas >= 24) {
          setEsperandoResposta(false);
          setNotice("Sua carta está entregue, mas a resposta demorou mais que o normal. Ela pode chegar sozinha — recarregue a página daqui a pouco.");
        }
      })();
    }, 5000);
    return () => { vivo = false; clearInterval(id); };
  }, [esperandoResposta, selected, api, playerToken, thread]);

  if (error && !recipients) {
    return <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>{error}</Alert>;
  }
  if (!recipients) return <LoadingState />;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Escreva às Casas e Ordens de Valdren. Escolha um destino à esquerda e depois <strong>a quem falar</strong> —
        a chancelaria ou uma pessoa específica. A distância até a sede define quantas cartas cabem por turno.
      </Typography>

      {!open && <Alert severity="info" sx={{ mb: 2 }}>A correspondência só circula com o turno aberto.</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, gap: 2 }}>
        {/* Uma proposta em aberto vem antes de tudo: o jogador lê a carta que
            propõe a rota e precisa de onde dizer sim. Sem isto o acordo morre
            de silêncio. */}
        {propostas.length > 0 && (
          <Stack spacing={1} sx={{ gridColumn: { md: "1 / -1" }, mb: 1 }}>
            {propostas.map((p) => (
              <Alert key={p.id} severity="info" icon={false}>
                <Typography variant="subtitle2">
                  Proposta de {recipients.find((r) => r.houseKey === p.comHouseKey)?.name ?? p.comHouseKey}
                  {" "}(turno {p.turnNumber})
                </Typography>
                <Typography variant="body2" sx={{ my: 1 }}>{p.resumo}</Typography>
                {/* O preço vem antes do sim. Custo político descoberto depois
                    de aceitar é armadilha, não escolha. */}
                {p.custoPolitico && p.custoPolitico.length > 0 && (
                  <Alert severity="warning" sx={{ my: 1 }}>
                    <Typography variant="body2">
                      Isto vai custar politicamente:{" "}
                      {p.custoPolitico.map((c) => `${c.casa} (${c.amizade})`).join(", ")}.
                      {" "}Quem detesta essa Casa vai detestar a sua companhia.
                    </Typography>
                  </Alert>
                )}
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={respondendo === p.id}
                    onClick={() => void responder(p.id, true)}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={respondendo === p.id}
                    onClick={() => void responder(p.id, false)}
                  >
                    Recusar
                  </Button>
                </Stack>
              </Alert>
            ))}
            {pactoAviso && <Alert severity="success" onClose={() => setPactoAviso(null)}>{pactoAviso}</Alert>}
          </Stack>
        )}
        {propostas.length === 0 && pactoAviso && (
          <Alert severity="success" sx={{ gridColumn: { md: "1 / -1" }, mb: 1 }} onClose={() => setPactoAviso(null)}>
            {pactoAviso}
          </Alert>
        )}

        <Paper variant="outlined">
          <List dense disablePadding>
            {recipients.map((r) => (
              <ListItemButton
                key={r.houseKey}
                selected={selected?.houseKey === r.houseKey}
                disabled={r.playerControlled}
                onClick={() => void openThread(r)}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" component="span">
                      <span>{r.name}</span>
                      {/* Sem este selo a carta que o NPC mandou chega e some:
                          nada na lista distingue quem procurou o jogador. */}
                      {r.escreveuPrimeiro && <Chip size="small" color="secondary" label="escreveu para você" />}
                    </Stack>
                  }
                  secondary={
                    r.playerControlled
                      ? "conduzida por outro jogador"
                      : `${r.remaining}/${r.sends} cartas · ${r.people.length} ${r.people.length === 1 ? "pessoa" : "pessoas"}${r.days != null ? ` · ~${Math.round(r.days)}d` : ""}`
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Box>
          {!selected ? (
            <Typography color="text.secondary">Escolha uma Casa para escrever.</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">{selected.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={`${selected.seat} · ~${selected.days} dias`} />
                  <Chip
                    size="small"
                    color={selected.remaining > 0 ? "primary" : "default"}
                    label={`${selected.remaining} de ${selected.sends} cartas`}
                  />
                </Stack>
              </Box>

              {/* A quem escrever dentro do destino. Os mensageiros são os mesmos —
                  a viagem até a sede não muda —, então o orçamento acima vale
                  para qualquer destinatário aqui. Cada pessoa é um NPC que a IA
                  interpreta; a chancelaria é a resposta oficial da Casa. */}
              <Box>
                <Typography variant="overline" color="text.secondary">Para quem escrever?</Typography>
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, mt: 0.5 }}>
                  <PersonOption
                    selected={addressee === null}
                    onClick={() => setAddressee(null)}
                    name="A chancelaria"
                    role="Resposta oficial da Casa"
                  />
                  {selected.people.map((p) => (
                    <PersonOption
                      key={p.id}
                      selected={addressee === p.id}
                      onClick={() => setAddressee(p.id)}
                      name={p.name}
                      role={p.role}
                      avatar={portraits[portraitEntityId(p.id)]}
                    />
                  ))}
                </Box>
              </Box>

              <Divider />

              {/* A conversa inteira, agrupada por turno. Mostrar só o turno
                  corrente fazia o jogador abrir uma Casa com quem negociou dois
                  turnos seguidos e ver vazio, como se nunca tivesse escrito. */}
              <Stack spacing={1}>
                {porTurno.map(([turno, cartas]) => (
                  <Box key={turno}>
                    <Divider textAlign="left" sx={{ my: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Turno {turno}{turno === turnNumber ? " · agora" : ""}
                      </Typography>
                    </Divider>
                    <Stack spacing={1}>
                      {cartas.map((m) => (
                        <Paper
                          key={m.id}
                          variant="outlined"
                          sx={{ p: 1.5, bgcolor: m.author === "PLAYER" ? "action.hover" : "transparent" }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {m.author === "PLAYER" ? houseName : addresseeName}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}><TextoComPessoas texto={m.body} /></Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                ))}
                {visible.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Vocês nunca se escreveram. A primeira carta é sua.
                  </Typography>
                )}
              </Stack>

              {esperandoResposta && (
                <Alert severity="info" icon={<CircularProgress size={16} />}>
                  Sua carta seguiu. {addresseeName} está escrevendo a resposta — ela aparece aqui em alguns
                  segundos, sem precisar recarregar.
                </Alert>
              )}
              {notice && <Alert severity="warning" onClose={() => setNotice(null)}>{notice}</Alert>}
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                  {/* O medo real é ter perdido o que escreveu. Dizer onde o
                      texto está vale mais que explicar a causa da falha. */}
                  {draft.trim() && " O que você escreveu continua no campo abaixo, guardado neste navegador."}
                </Alert>
              )}

              {selected.remaining > 0 && open ? (
                <Stack spacing={1}>
                  {/* A carta é cortada em MESSAGE_MAX no servidor. Sem o
                      contador, o jogador escrevia demais e o texto sumia calado. */}
                  <TextField
                    label={`Carta para ${addresseeName}`}
                    value={draft}
                    onChange={(e) => escrever(e.target.value.slice(0, MESSAGE_MAX))}
                    multiline
                    minRows={4}
                    fullWidth
                    inputProps={{ maxLength: MESSAGE_MAX }}
                    helperText={`${draft.length.toLocaleString("pt-BR")} de ${MESSAGE_MAX.toLocaleString("pt-BR")} caracteres.`}
                    FormHelperTextProps={{
                      sx: draft.length >= MESSAGE_MAX ? { color: "warning.main" } : undefined,
                    }}
                  />
                  <Box>
                    <Button variant="contained" disabled={sending || !draft.trim()} onClick={() => void send()}>
                      {sending ? "Enviando…" : "Enviar carta"}
                    </Button>
                  </Box>
                </Stack>
              ) : (
                open && (
                  <Alert severity="info">
                    Sem mensageiros disponíveis para {selected.name} neste turno. {selected.seat} fica a cerca de{" "}
                    {selected.days} dias de viagem.
                  </Alert>
                )
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
