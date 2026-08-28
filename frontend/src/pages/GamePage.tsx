import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ORDER_TEXT_MAX, seatKeyForHouseId } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { clearPlayerSession, loadPlayerSession } from "../auth/playerSession";
import { AttributeBars } from "../components/AttributeBars";
import { AttributeChangeChips } from "../components/AttributeChangeChips";
import { Crest } from "../components/Crest";
import Badge from "@mui/material/Badge";
import { PactsPanel } from "../components/PactsPanel";
import { SpyPanel } from "../components/SpyPanel";
import { GAME_TABS, gameTabOf } from "./game/gameTabs";
import { CorrespondencePanel } from "../components/CorrespondencePanel";
import { HouseProjectsPanel } from "../components/HouseProjectsPanel";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { WikiMarkdown } from "../components/WikiMarkdown";
import { ApiError, type PlayerGameView } from "../types/api";

/**
 * Junta ativos repetidos num item só, preservando a ordem de chegada — que é a
 * ordem em que a Casa os conquistou. Repetidos são um caso real: nada impede o
 * jogador de rodar a mesma carta duas vezes.
 */
function agruparAtivos(assets: string[] | undefined): { nome: string; quantidade: number }[] {
  const porNome = new Map<string, number>();
  for (const nome of assets ?? []) porNome.set(nome, (porNome.get(nome) ?? 0) + 1);
  return [...porNome].map(([nome, quantidade]) => ({ nome, quantidade }));
}

export function GamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [game, setGame] = useState<PlayerGameView | null>(null);
  const [historyTab, setHistoryTab] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const aba = gameTabOf(searchParams.get("aba"));
  const trocarAba = (proxima: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("aba", proxima);
    setSearchParams(params, { replace: true });
  };
  // Quantas Casas procuraram o jogador neste turno: o selo na aba é o que faz
  // a carta que chegou ser vista, em vez de esperar que ele abra por acaso.
  const [cartasNovas, setCartasNovas] = useState(0);
  const [orderText, setOrderText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [energia, setEnergia] = useState<{ livre: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    const session = loadPlayerSession();
    if (!session) {
      navigate("/login");
      return;
    }
    try {
      const view = await api.getGame(session.playerToken);
      setGame(view);
      setOrderText(view.submission?.orderText ?? "");
      try {
        const vista = await api.getProjects(session.playerToken);
        const gasta = Object.values(vista.energia.porProjeto).reduce((n, v) => n + v, 0);
        setEnergia({ livre: vista.energia.total - gasta, total: vista.energia.total });
      } catch {
        // A Energia é informação de apoio: se ela falhar, ou se o backend ainda
        // não a conhecer, a página do jogo segue sem mostrá-la.
        setEnergia(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "SESSION_EXPIRED") {
        clearPlayerSession();
        navigate("/login");
        return;
      }
      setError("Não foi possível carregar o jogo.");
    }
  }, [api, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sessao = loadPlayerSession();
    if (!sessao?.playerToken) return;
    // Conveniência: se o contador falhar, a aba fica sem selo e nada mais.
    void api.countIncomingLetters(sessao.playerToken)
      .then((r) => setCartasNovas(r.cartas))
      .catch(() => setCartasNovas(0));
  }, [api]);

  useEffect(() => {
    if (game && game.turnHistory.length > 0) {
      setHistoryTab(game.turnHistory.length - 1);
    }
  }, [game?.turnHistory.length]);

  async function submitOrder() {
    const session = loadPlayerSession();
    if (!session || !game) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.submitOrder(session.playerToken, {
        orderText: orderText.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar a ordem.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearPlayerSession();
    navigate("/");
  }

  const logoutButton = (
    <Button variant="outlined" size="small" color="inherit" onClick={logout}>
      Sair
    </Button>
  );

  if (error && !game)
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  if (!game)
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );

  const hasVisibleTurn = game.turnStatus === "OPEN" || game.turnStatus === "LOCKED" || game.turnStatus === "RESOLVED";
  const inputsDisabled = saving || game.turnStatus !== "OPEN";
  const playerSession = loadPlayerSession();
  const ativos = agruparAtivos(game.house.assets);

  return (
    <Layout action={logoutButton}>
      <Stack spacing={3}>
        {/* O jogador entra aqui para ler o turno e responder a ele. Isso vinha
            depois da ficha da Casa, das cartas e da correspondência — ele
            rolava três blocos para chegar no que veio fazer. Agora o turno
            abre a página, e o que é consulta desce. */}
        {/* Quem sou eu e em que turno estou: some das abas internas, então
            fica aqui em cima, sempre. Sem isto o jogador abre "O Turno" e não
            vê mais o nome da própria Casa. */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <Crest emblem={game.house.emblem} name={game.house.name} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h2">{game.house.name}</Typography>
            <Typography variant="caption" color="text.secondary">{game.house.motto}</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {game.turnId != null && <Chip size="small" label={`Turno ${game.turnId}`} />}
            {game.turnStatus === "OPEN" && <Chip size="small" color="secondary" label="aberto para ordens" />}
            {game.turnStatus === "LOCKED" && <Chip size="small" variant="outlined" label="turno trancado" />}
          </Stack>
        </Stack>

        {/* A página era uma rolagem só com seis blocos grandes: tudo estava lá e
            nada era achável. As abas põem cada coisa a um clique, na ordem do
            uso — primeiro o que se veio fazer, depois o que se consulta. */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", position: "sticky", top: 0, zIndex: 2, bgcolor: "background.default" }}>
          <Tabs value={aba} onChange={(_e, v) => trocarAba(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            {GAME_TABS.map((t) => (
              <Tab
                key={t.value}
                value={t.value}
                label={
                  t.value === "cartas" && cartasNovas > 0 ? (
                    <Badge badgeContent={cartasNovas} color="secondary" sx={{ pr: 1.5 }}>{t.label}</Badge>
                  ) : (
                    t.label
                  )
                }
              />
            ))}
          </Tabs>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          {GAME_TABS.find((t) => t.value === aba)?.hint}
        </Typography>

        {aba === "turno" && (
          <>
        {(game.turnStatus === "DRAFT" || game.turnId === null) && (
          <Alert severity="info">Aguardando o próximo turno.</Alert>
        )}

        {game.turnStatus === "LOCKED" && <Alert severity="info">O Conselho está resolvendo o turno.</Alert>}

        {hasVisibleTurn && (
          <>
            {/* Empilhados numa página larga, os dois viravam cards do tamanho
                da tela com o texto colado à esquerda e um vazio enorme à
                direita. Lado a lado, a largura é usada e a linha continua na
                medida de leitura — que é o motivo de o texto ter teto. */}
            <Box
              sx={{
                display: "grid",
                gap: 3,
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
                alignItems: "start",
              }}
            >
              <Card component="section">
                <CardContent>
                  <Typography variant="h2" gutterBottom>
                    Evento público
                  </Typography>
                  {game.eventImageUrl && (
                    <Box
                      component="img"
                      src={game.eventImageUrl}
                      alt="Ilustração do evento"
                      sx={{ width: "100%", borderRadius: 1, mb: 2, display: "block" }}
                    />
                  )}
                  <Box sx={{ maxWidth: "75ch" }}><WikiMarkdown body={game.publicEvent} /></Box>
                </CardContent>
              </Card>

              <Card component="section">
                <CardContent>
                  <Typography variant="h2" gutterBottom>
                    Informação privada
                  </Typography>
                  <Box sx={{ maxWidth: "75ch" }}><WikiMarkdown body={game.privateInformation} /></Box>
                </CardContent>
              </Card>
            </Box>

            {/* O limite existia só no backend: o jogador escrevia à vontade e
                só descobria o teto quando a ordem era recusada. Agora o contador
                mostra o quanto resta antes de ele gastar a escrita. */}
            <TextField
              label="Sua ordem"
              value={orderText}
              onChange={(event) => setOrderText(event.target.value.slice(0, ORDER_TEXT_MAX))}
              disabled={inputsDisabled}
              required
              multiline
              minRows={5}
              inputProps={{ maxLength: ORDER_TEXT_MAX }}
              helperText={
                `Escreva livremente as decisões e ordens da sua Casa para este turno. ` +
                `${orderText.length.toLocaleString("pt-BR")} de ${ORDER_TEXT_MAX.toLocaleString("pt-BR")} caracteres.`
              }
              FormHelperTextProps={{
                sx: orderText.length >= ORDER_TEXT_MAX ? { color: "warning.main" } : undefined,
              }}
            />

            {error && <Alert severity="error">{error}</Alert>}
            {saved && <Alert severity="success">Ordem registrada. Você pode editar enquanto o turno estiver aberto.</Alert>}

            <Button
              color="secondary"
              size="large"
              disabled={inputsDisabled || !orderText.trim()}
              onClick={submitOrder}
            >
              {saving ? "Enviando..." : "Enviar ordem"}
            </Button>
          </>
        )}
          </>
        )}

        {aba === "casa" && (
          <>
        <Card component="section">
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
              <Crest emblem={game.house.emblem} name={game.house.name} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h1">Sua Casa</Typography>
                <Typography variant="h2">{game.house.name}</Typography>
                <Typography sx={{ color: "text.secondary", mb: 2 }}>{game.house.motto}</Typography>
                <AttributeBars attributes={game.house.attributes} seatKey={seatKeyForHouseId(game.house.name)} />
                {energia && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                    Energia deste turno: {energia.livre} de {energia.total} — cada ponto move um projeto um turno.
                  </Typography>
                )}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">Ativos da Casa</Typography>
                  {ativos.length === 0 ? (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Sua Casa ainda não tem ativos. Cartas concluídas deixam construções e instituições permanentes.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {ativos.map((ativo) => (
                        <Chip
                          key={ativo.nome}
                          size="small"
                          variant="outlined"
                          label={ativo.quantidade > 1 ? `${ativo.nome} ×${ativo.quantidade}` : ativo.nome}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Stack>
            {game.house.imageUrls && game.house.imageUrls.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                {game.house.imageUrls.map((src, index) => (
                  <Box
                    key={index}
                    component="img"
                    src={src}
                    alt={`Imagem ${index + 1} da Casa`}
                    sx={{ width: 140, height: 94, objectFit: "cover", borderRadius: 1, display: "block" }}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

          </>
        )}

        {aba === "projetos" && (
          <>
        {playerSession && (
          <HouseProjectsPanel
            playerToken={playerSession.playerToken}
            houseName={game.house.name}
            excluirCategoria="INTELLIGENCE"
            onChanged={() => void refresh()}
          />
        )}

          </>
        )}

        {aba === "espioes" && playerSession && (
          <Stack spacing={3}>
            <SpyPanel playerToken={playerSession.playerToken} onChanged={() => void refresh()} />
            {/* As cartas de espionagem continuam existindo: montar uma rede de
                informantes é obra, não pergunta. Ficam abaixo do formulário,
                que é o que o jogador vem fazer aqui. */}
            <HouseProjectsPanel
              playerToken={playerSession.playerToken}
              houseName={game.house.name}
              categoria="INTELLIGENCE"
              titulo="Obras de espionagem"
              onChanged={() => void refresh()}
            />
          </Stack>
        )}

        {aba === "pactos" && (
          <>
        {playerSession && <PactsPanel playerToken={playerSession.playerToken} onChanged={() => void refresh()} />}

          </>
        )}

        {aba === "cartas" && (
          <>
        {playerSession && (
          <Card component="section">
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Correspondência
              </Typography>
              <CorrespondencePanel playerToken={playerSession.playerToken} houseName={game.house.name} />
            </CardContent>
          </Card>
        )}

          </>
        )}

        {aba === "historico" && (
          <>
        {game.turnHistory.length > 0 && (
          <Card component="section">
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Histórico de turnos
              </Typography>
              <Tabs
                value={Math.min(historyTab, game.turnHistory.length - 1)}
                onChange={(_event, value) => setHistoryTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2 }}
              >
                {game.turnHistory.map((entry) => (
                  <Tab key={entry.turnId} label={`Turno ${entry.turnId}`} />
                ))}
              </Tabs>
              {(() => {
                const entry = game.turnHistory[Math.min(historyTab, game.turnHistory.length - 1)];
                return (
                  <Box>
                    {entry.attributeChanges && entry.attributeChanges.length > 0 && (
                      <AttributeChangeChips changes={entry.attributeChanges} />
                    )}
                    {entry.publicResult && (
                      <Box sx={{ mb: 1, maxWidth: "75ch" }}>
                        <WikiMarkdown body={entry.publicResult} />
                      </Box>
                    )}
                    {entry.privateResult && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="h3" gutterBottom>
                          Informação Privada
                        </Typography>
                        <Box sx={{ color: "text.secondary", maxWidth: "75ch" }}>
                          <WikiMarkdown body={entry.privateResult} />
                        </Box>
                      </Box>
                    )}
                    {entry.resultImageUrl && (
                      <Box
                        component="img"
                        src={entry.resultImageUrl}
                        alt={`Ilustração do resultado do turno ${entry.turnId}`}
                        sx={{ width: "100%", borderRadius: 1, my: 1, display: "block" }}
                      />
                    )}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        )}

          </>
        )}

      </Stack>
    </Layout>
  );
}
