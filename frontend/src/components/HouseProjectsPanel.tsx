import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resumoDoGanho } from "@ravenloft/content";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { CATEGORY_LABELS, SEATS, seatKeyForHouseId } from "@ravenloft/content";
import { ApiError, type ProjectsView, type ProjectTemplate, type CustomCardDraft } from "../types/api";
import { CARD_TITLE_MAX, CARD_DESCRIPTION_MAX } from "@ravenloft/content";
import { CofreDeEnergia } from "./projetos/CofreDeEnergia";
import { CartaAtiva } from "./projetos/CartaAtiva";
import { CartaFracassada } from "./projetos/CartaFracassada";
import { RevelacaoDoTurno } from "./projetos/RevelacaoDoTurno";
import { useEnergiaAutoSave, aguardarGravacaoDeEnergia } from "./projetos/useEnergiaAutoSave";
import { voarOrbe } from "./projetos/animacoes";
import { cartasParaRevelar, gravarVistoEm, lerVistoEm, type RecorteDaRevelacao } from "./projetos/previa";

const COST_NAMES: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };


function costLabel(costs: ProjectTemplate["costs"]): string {
  if (!costs.length) return "Sem custo";
  const names: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };
  return costs.map((c) => `${c.amount} ${names[c.type] ?? c.type}`).join(", ");
}

/** Quais atributos desta carta a Casa já não consegue absorver. */
function atributosNoTeto(
  efeitos: ProjectTemplate["completionEffects"],
  attrs: { riqueza: number; recursos: number; soldados: number; controle: number } | undefined,
): string[] {
  if (!attrs) return [];
  const nomes: Record<string, string> = { riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados", controle: "Controle" };
  return efeitos.attributeChanges
    .filter((c) => c.permanent && c.amount > 0 && c.attribute !== "stability" && (attrs as Record<string, number>)[c.attribute] >= 5)
    .map((c) => nomes[c.attribute] ?? c.attribute);
}

/**
 * O painel serve a duas abas de /game.
 *
 * Em "Projetos" ele mostra tudo menos espionagem; em "Espiões", só espionagem.
 * Comprar um rumor no Porto e erguer um aqueduto são atividades diferentes, e
 * misturá-las fazia a compra de informação sumir no meio de setenta cartas —
 * mas a lógica de custo, Energia e início é a mesma, então o componente é um só
 * com um recorte.
 */
export function HouseProjectsPanel({ playerToken, houseId, houseName, categoria, excluirCategoria, titulo, onChanged }: {
  playerToken: string;
  /** Sem ela, a revelação do fechamento não aparece. */
  houseId?: string;
  houseName?: string;
  /** Mostra só esta categoria, e esconde os chips: a aba já é o filtro. */
  categoria?: string;
  /** Tira esta categoria da lista, porque ela mora em outra aba. */
  excluirCategoria?: string;
  titulo?: string;
  onChanged: () => void;
}) {
  const api = useApi();
  const [data, setData] = useState<ProjectsView | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Qual carta fracassada está voltando ao jogo.
  const [refazendo, setRefazendo] = useState<string | null>(null);
  // Catorze modelos de diplomacia pedem uma Casa alvo. Sem perguntar qual, a
  // carta era gravada esperando a resposta de ninguém e nunca saía do lugar.
  const [alvoDe, setAlvoDe] = useState<ProjectTemplate | null>(null);
  const [alvo, setAlvo] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardBody, setCardBody] = useState("");
  const [draft, setDraft] = useState<CustomCardDraft | null>(null);

  const resetCreate = useCallback(() => {
    setCreateOpen(false); setDraft(null); setCardTitle(""); setCardBody("");
  }, []);

  const patchDraft = useCallback((patch: Partial<CustomCardDraft>, isRule: boolean) => {
    setDraft((d) => (d ? { ...d, ...patch, playerEditedRules: d.playerEditedRules || isRule } : d));
  }, []);

  const load = useCallback(async () => {
    // Nunca ler antes de a Energia gravada chegar: o mapa velho apagaria o toque.
    try { await aguardarGravacaoDeEnergia(); setData(await api.getProjects(playerToken)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, playerToken]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setBusy(false); }
  }, [load, onChanged]);

  /**
   * Devolve ao jogo a carta que o juiz de desfecho reprovou.
   *
   * O servidor é que decide o que isso significa — prazo de um turno, sem
   * cobrar custo outra vez, e sem novo sorteio. Aqui só pedimos e recarregamos,
   * para que a carta reapareça entre as ativas já com a explicação dela.
   */
  const refazer = useCallback(async (projectId: string): Promise<boolean> => {
    setRefazendo(projectId);
    // `run` engole o erro (vai para a faixa do painel); a revelação precisa
    // saber se deu certo para não confirmar uma recusa.
    let ok = false;
    try { await run(async () => { await api.refazerProjeto(playerToken, { projectId }); ok = true; }); }
    finally { setRefazendo(null); }
    return ok;
  }, [api, playerToken, run]);

  const gravado = useMemo(() => data?.energia?.porProjeto ?? {}, [data]);
  const { energia, mudar, erro: erroEnergia } = useEnergiaAutoSave({
    gravado,
    gravar: (porProjeto) => api.setEnergia(playerToken, { porProjeto }),
  });
  const origemRef = useRef<HTMLDivElement>(null);
  const alvos = useRef(new Map<string, HTMLDivElement>());
  const [revelando, setRevelando] = useState(false);
  const [versaoVisto, setVersaoVisto] = useState(0);
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);

  const porEnergia = useCallback((id: string, delta: 1 | -1) => {
    mudar(id, delta);
    const carta = alvos.current.get(id) ?? null;
    void (delta === 1 ? voarOrbe(origemRef.current, carta) : voarOrbe(carta, origemRef.current));
  }, [mudar]);

  // A aba Espiões lembra o próprio "visto"; qualquer outra, o de Projetos.
  const recorteRevelacao: RecorteDaRevelacao = categoria === "INTELLIGENCE" ? "espioes" : "projetos";

  // O recorte vale para tudo que a aba mostra: projeto ativo de espionagem
  // aparece em Espiões, e não em Projetos.
  const noRecorte = useCallback(
    (c: string) => (categoria ? c === categoria : excluirCategoria ? c !== excluirCategoria : true),
    [categoria, excluirCategoria],
  );
  const active = useMemo(
    () => (data?.projects ?? []).filter((p) => (p.status === "ACTIVE" || p.status === "PAUSED") && noRecorte(p.category)),
    [data, noRecorte],
  );
  // O teto de vagas é da Casa inteira: projetos e espionagem disputam as
  // mesmas. Contar só o recorte fazia Espiões dizer "0/3" para uma Casa que já
  // tinha as três vagas ocupadas por obras.
  const ativasDaCasa = useMemo(
    () => (data?.projects ?? []).filter((p) => p.status === "ACTIVE" || p.status === "PAUSED").length,
    [data],
  );
  // Só o que o jogador ainda decide. PENDING_GM e PENDING_TARGET eram a mesa
  // de aprovação, que saiu: a carta aceita começa na hora.
  const pending = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "PENDING_PLAYER" && noRecorte(p.category)), [data, noRecorte]);
  const fracassadas = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "FAILED" && noRecorte(p.category)), [data, noRecorte]);
  const concluidas = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "COMPLETED" && noRecorte(p.category)), [data, noRecorte]);
  const paraRevelar = useMemo(() => {
    if (!houseId) return [];
    const doRecorte = (data?.projects ?? []).filter((p) => noRecorte(p.category));
    return cartasParaRevelar(doRecorte, lerVistoEm(houseId, recorteRevelacao));
    // versaoVisto força reler o storage depois de fechar a revelação.
  }, [data, noRecorte, houseId, versaoVisto, recorteRevelacao]);

  const fecharRevelacao = useCallback(() => {
    const ultimo = paraRevelar[paraRevelar.length - 1]?.resolvedAt;
    if (houseId && ultimo) gravarVistoEm(houseId, recorteRevelacao, ultimo);
    setRevelando(false);
    setVersaoVisto((v) => v + 1);
  }, [paraRevelar, houseId, recorteRevelacao]);
  const recommended = useMemo(() => {
    const rec = data?.recommended ?? [];
    const byId = new Map((data?.templates ?? []).map((t) => [t.id, t]));
    return rec.map((id) => byId.get(id)).filter((t): t is ProjectTemplate => !!t).filter((t) => noRecorte(t.category));
  }, [data, noRecorte]);
  const templates = useMemo(() => {
    let list = (data?.templates ?? []).filter((t) => noRecorte(t.category));
    if (filter !== "ALL") list = list.filter((t) => t.category === filter);
    // Buscar só no título obriga o jogador a já saber o nome do que procura.
    // A descrição é onde estão as palavras que ele tem na cabeça.
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(q));
    return list;
  }, [data, filter, search, noRecorte]);

  if (!data) return null;
  // O teto é da Casa, não da aba. `active` só conta o recorte: em Espiões,
  // obras cheias deixavam Iniciar ligado e o servidor respondia 409.
  const semVaga = ativasDaCasa >= data.slotLimit;
  const ativasIds = new Set((data.projects ?? []).filter((p) => p.status === "ACTIVE").map((p) => p.id));
  const energiaGasta = Object.entries(energia).reduce((n, [id, v]) => n + (ativasIds.has(id) ? v : 0), 0);
  // Um frontend novo pode falar com um backend antigo durante o deploy. Sem o
  // campo, a Energia some da tela inteira em vez de aparecer como "0/0" com um
  // botão que só daria erro.
  const temEnergia = Boolean(data.energia);
  const energiaTotal = data.energia?.total ?? 0;
  const energiaLivre = energiaTotal - energiaGasta;

  const templateCard = (t: ProjectTemplate, highlight = false) => (
    <Card key={t.id} variant="outlined" sx={highlight ? { borderColor: "secondary.main" } : undefined}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight="bold">{t.title}</Typography>
          <Chip size="small" label={CATEGORY_LABELS[t.category]} />
        </Stack>
        <Typography variant="body2" sx={{ my: 0.5 }}>{t.description}</Typography>
        <Typography variant="caption" display="block">Duração: {t.durationTurns} turnos · Custo: {costLabel(t.costs)}</Typography>
        <Typography variant="caption" display="block" color="success.main">Ganho: {resumoDoGanho(t.completionEffects, t.pagamentoNarrativo)}</Typography>
        {t.completionEffects.qualitativeEffects.length > 0 && (
          <Typography variant="caption" display="block" color="text.secondary">
            O Mestre honra na narrativa: {t.completionEffects.qualitativeEffects.join(" ")}
          </Typography>
        )}
        {atributosNoTeto(t.completionEffects, data?.attributes).map((nome) => (
          <Typography key={nome} variant="caption" display="block" color="warning.main">
            Sua {nome} já está no teto; este ganho virá como Estabilidade ou como um ativo.
          </Typography>
        ))}
        <Button size="small" sx={{ mt: 1 }} disabled={busy || semVaga}
          onClick={() => {
            if (t.requiresTargetApproval || t.requiresSecretTarget) { setAlvo(""); setAlvoDe(t); return; }
            if (confirm(`Iniciar "${t.title}"?\n\nCusto: ${costLabel(t.costs)}\nGanho ao concluir: ${resumoDoGanho(t.completionEffects, t.pagamentoNarrativo)}`)) {
              void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id }));
            }
          }}>
          Iniciar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    // overflow visible: o Card do MUI corta o overflow, e um ancestral assim
    // vira a caixa de rolagem do sticky — o cofre rolava junto e sumia.
    <Card variant="outlined" sx={{ overflow: "visible" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{titulo ?? "Projetos da Casa"}</Typography>
          <Chip label={`Estabilidade: ${data.stability}`} color="secondary" size="small" />
        </Stack>
        {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={categoria ? `Operações em curso (${active.length})` : `Em andamento (${active.length})`} />
          <Tab label={categoria ? "Catálogo de operações" : "Biblioteca"} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            {erroEnergia && <Alert severity="error">{erroEnergia}</Alert>}
            {temEnergia && active.some((p) => p.status === "ACTIVE") && (
              <CofreDeEnergia total={energiaTotal} livre={Math.max(0, energiaLivre)} origemRef={origemRef} />
            )}

            {paraRevelar.length > 0 && (
              <Button variant="outlined" fullWidth onClick={() => setRevelando(true)} sx={{ minHeight: 48, borderColor: "primary.main" }}>
                ✦ {paraRevelar.length === 1 ? "1 novidade" : `${paraRevelar.length} novidades`} do fechamento
              </Button>
            )}

            {fracassadas.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Pode tentar de novo</Typography>
                <Stack spacing={1.5}>
                  {fracassadas.map((p) => (
                    <CartaFracassada key={p.id} carta={p} semVaga={semVaga} busy={busy || refazendo === p.id} onTentarDeNovo={() => void refazer(p.id)} />
                  ))}
                </Stack>
              </Box>
            )}

            {temEnergia && data.energia?.ajustes && data.energia.ajustes.length > 0 && (
              <Alert severity="info">
                Uma carta mudou desde que você distribuiu Energia, e parte dela não valia mais o que valia:{" "}
                {data.energia.ajustes.map((a, i) => (
                  <span key={a.id}>{i > 0 && "; "}<strong>{a.title}</strong> tinha {a.de} e agora aceita {a.para}</span>
                ))}
                . A diferença está livre.
              </Alert>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Em andamento</Typography>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} title="Projetos e espionagem ocupam as mesmas vagas">
                Vagas {ativasDaCasa}/{data.slotLimit}
              </Typography>
            </Stack>
            {ativasDaCasa > data.slotLimit && (
              <Alert severity="warning">Sua Casa está com {ativasDaCasa} cartas ativas, acima do teto de {data.slotLimit}. Nenhuma carta nova começa até alguma terminar.</Alert>
            )}
            {active.length === 0 && recommended.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Projetos recomendados para sua Casa</Typography>
                <Stack spacing={2}>{recommended.map((t) => templateCard(t, true))}</Stack>
              </Box>
            )}
            {active.length === 0 && recommended.length === 0 && <Typography color="text.secondary">Nenhuma carta em andamento.</Typography>}
            {active.map((p) => (
              <CartaAtiva
                key={p.id}
                carta={p}
                energia={energia[p.id] ?? 0}
                teto={data.energia?.tetoPorProjeto[p.id] ?? 0}
                livre={energiaLivre}
                busy={busy}
                alvoRef={(el) => { if (el) alvos.current.set(p.id, el); else alvos.current.delete(p.id); }}
                onMudar={(d) => porEnergia(p.id, d)}
                onCancelar={() => { if (confirm("Cancelar a carta? O cancelamento não devolve o custo.")) void run(() => api.cancelProject(playerToken, { projectId: p.id })); }}
                onReescrever={(nota) => void run(() => api.requestProjectRevision(playerToken, { projectId: p.id, note: nota }))}
              />
            ))}

            {pending.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.14em" }}>Esperando sua decisão</Typography>
                <Stack spacing={1}>
                  {pending.map((p) => (
                    <Alert key={p.id} severity="info" action={
                      <Button size="small" disabled={busy || semVaga} onClick={() => void run(() => api.acceptProject(playerToken, { projectId: p.id }))}>Aceitar</Button>
                    }>
                      {p.title}{semVaga ? " — sem vaga: libere uma" : ""}
                    </Alert>
                  ))}
                </Stack>
              </Box>
            )}

            <Button variant="contained" fullWidth onClick={() => setTab(1)} sx={{ minHeight: 48 }}>+ Nova carta</Button>

            {concluidas.length > 0 && (
              <Box>
                <Button onClick={() => setConcluidasAbertas((v) => !v)} sx={{ minHeight: 48 }}>
                  Concluídas ({concluidas.length}) {concluidasAbertas ? "▾" : "▸"}
                </Button>
                {concluidasAbertas && (
                  <Stack spacing={1.5}>
                    {concluidas.map((p) => (
                      <Card key={p.id} variant="outlined" sx={{ borderColor: "success.main" }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography fontWeight="bold">{p.title}</Typography>
                            <Chip size="small" color="success" label="Concluído com êxito" />
                          </Stack>
                          <Typography variant="caption" display="block" color="success.main" sx={{ mt: 1 }}>
                            Recebido: {resumoDoGanho(p.completionEffects, p.pagamentoNarrativo)}
                          </Typography>
                          {p.outcomeNarrative && <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>{p.outcomeNarrative}</Typography>}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            <RevelacaoDoTurno
              cartas={paraRevelar}
              aberta={revelando}
              semVaga={semVaga}
              busy={busy}
              onFechar={fecharRevelacao}
              erro={error}
              onTentarDeNovo={(id) => refazer(id)}
            />
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Button variant="contained" fullWidth onClick={() => setCreateOpen(true)} sx={{ minHeight: 48 }}>
              ✍️ Propor um projeto próprio
            </Button>
            {/* Com 65 cartas, procurar vem antes de navegar. O filtro estava
                embaixo do bloco de recomendadas e quase ninguém rolava até ele. */}
            {/* Categoria num select escondia setenta cartas atrás de dois
                cliques e da suposição de que "Espionagem" é onde se compra
                informação. Em chips, a lista se anuncia. */}
            {/* Com a aba já recortando a categoria, os chips só repetiriam o
                que o jogador acabou de escolher. Com excluirCategoria, o chip
                da categoria que mora noutra aba filtrava a lista para vazio. */}
            {!categoria && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip
                label="Todas"
                size="small"
                color={filter === "ALL" ? "primary" : "default"}
                variant={filter === "ALL" ? "filled" : "outlined"}
                onClick={() => setFilter("ALL")}
              />
              {Object.entries(CATEGORY_LABELS)
                .filter(([k]) => k !== excluirCategoria)
                .map(([k, v]) => (
                  <Chip
                    key={k}
                    label={v}
                    size="small"
                    color={filter === k ? "primary" : "default"}
                    variant={filter === k ? "filled" : "outlined"}
                    onClick={() => setFilter(k)}
                  />
                ))}
            </Stack>
            )}
            <TextField size="small" label="Buscar por nome ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
            {semVaga && <Alert severity="warning">Limite de projetos ativos atingido.</Alert>}
            {!search.trim() && filter === "ALL" && recommended.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Projetos recomendados para sua Casa</Typography>
                <Stack spacing={2}>
                  {recommended.map((t) => templateCard(t, true))}
                </Stack>
              </Box>
            )}
            {/* O total é o do recorte, não o do baralho: numa aba que só mostra
                espionagem, "16 de 70" faz o jogador achar que 54 sumiram. */}
            <Typography variant="caption" color="text.secondary">
              {templates.length} de {(data.templates ?? []).filter((t) => noRecorte(t.category)).length}
              {categoria ? " cartas de espionagem" : " projetos"}
            </Typography>
            {templates.map((t) => templateCard(t))}
          </Stack>
        )}

      </CardContent>

      {/* Uma carta de diplomacia é feita COM alguém. Perguntar antes de gravar
          é o que impede que ela fique esperando a resposta de ninguém. */}
      <Dialog open={!!alvoDe} onClose={() => setAlvoDe(null)} fullWidth maxWidth="xs">
        <DialogTitle>{alvoDe?.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {alvoDe?.requiresSecretTarget
              ? "Contra qual Casa? Ela não será consultada nem avisada."
              : "Com qual Casa?"}
          </Typography>
          <TextField
            select
            fullWidth
            label="Casa"
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
          >
            {SEATS.filter((seat) => seat.key !== (houseName ? seatKeyForHouseId(houseName) : null)).map((seat) => (
              <MenuItem key={seat.key} value={seat.key}>{seat.name}</MenuItem>
            ))}
          </TextField>
          {alvoDe && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Custo: {costLabel(alvoDe.costs)} · Ganho ao concluir: {resumoDoGanho(alvoDe.completionEffects, alvoDe.pagamentoNarrativo)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlvoDe(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!alvo || busy}
            onClick={() => {
              const t = alvoDe;
              setAlvoDe(null);
              if (t) void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id, targetHouseKey: alvo }));
            }}
          >
            {alvoDe?.requiresSecretTarget ? "Começar" : "Iniciar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={resetCreate} fullWidth maxWidth="sm">
        <DialogTitle>Propor um projeto próprio</DialogTitle>
        <DialogContent>
          {!draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Escreva sua carta livremente. A IA vai preservar seu texto (corrigindo apenas gramática e clareza) e adicionar as regras.
              </Typography>
              <TextField label="Título do projeto" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} fullWidth />
              <TextField label="O que sua Casa deseja realizar?" value={cardBody} onChange={(e) => setCardBody(e.target.value)} multiline minRows={4} fullWidth />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Texto:</Typography>
              <TextField label="Título" value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value.slice(0, CARD_TITLE_MAX) }, false)}
                inputProps={{ maxLength: CARD_TITLE_MAX }}
                helperText={`${draft.title.length}/${CARD_TITLE_MAX}`} fullWidth />
              <TextField label="Descrição" value={draft.description}
                onChange={(e) => { const v = e.target.value.slice(0, CARD_DESCRIPTION_MAX); patchDraft({ description: v, publicDescription: v }, false); }}
                inputProps={{ maxLength: CARD_DESCRIPTION_MAX }}
                helperText={`${draft.description.length}/${CARD_DESCRIPTION_MAX}`}
                multiline minRows={3} fullWidth />

              <Typography variant="caption" color="text.secondary">Regras:</Typography>
              <TextField label="Duração (turnos)" type="number" value={draft.durationTurns}
                onChange={(e) => patchDraft({ durationTurns: Math.max(1, Number(e.target.value) || 1) }, true)}
                inputProps={{ min: 1, max: 12 }} sx={{ maxWidth: 200 }} />
              {draft.costs.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField label={`Custo: ${COST_NAMES[c.type] ?? c.type}`} type="number" value={c.amount}
                    onChange={(e) => {
                      const amount = Math.max(0, Number(e.target.value) || 0);
                      const costs = draft.costs.map((x, j) => (j === i ? { ...x, amount } : x));
                      patchDraft({ costs }, true);
                    }}
                    inputProps={{ min: 0 }} sx={{ maxWidth: 220 }} />
                </Stack>
              ))}
              {draft.costs.length === 0 && <Typography variant="body2" color="text.secondary">Sem custo.</Typography>}
              <TextField label="Requisitos (um por linha)" value={draft.requirements.join("\n")}
                onChange={(e) => patchDraft({ requirements: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }, true)}
                multiline minRows={2} fullWidth />
              <TextField label="Riscos (um por linha)" value={draft.risks.join("\n")}
                onChange={(e) => patchDraft({ risks: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }, true)}
                multiline minRows={2} fullWidth />

              {draft.aiBalanceExplanation && <Alert severity="info">{draft.aiBalanceExplanation}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!draft ? (
            <Button disabled={busy || !cardBody.trim()} onClick={async () => {
              setBusy(true); setError(null);
              try { setDraft(await api.enhanceCustomProject(playerToken, { title: cardTitle, body: cardBody })); }
              catch (e) { setError(e instanceof ApiError ? e.message : "Falha ao aprimorar."); }
              finally { setBusy(false); }
            }}>Aprimorar com IA</Button>
          ) : (
            <>
              <Button onClick={() => setDraft(null)}>Voltar</Button>
              <Button variant="contained" disabled={busy} onClick={() => void run(async () => {
                await api.startCustomProject(playerToken, draft);
                resetCreate();
              })}>Iniciar projeto</Button>
            </>
          )}
          <Button onClick={resetCreate}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
