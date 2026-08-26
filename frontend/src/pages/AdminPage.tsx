import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Badge from "@mui/material/Badge";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DEFAULT_IMAGE_DIRECTIVES, type Attributes, type TurnResult } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { clearAdminToken, loadAdminToken, saveAdminToken } from "../auth/adminSession";
import { LoadingState } from "../components/LoadingState";
import { Layout } from "../components/Layout";
import { AdminTurnoTab } from "../components/admin/AdminTurnoTab";
import { AdminHousesTab } from "../components/admin/AdminHousesTab";
import { AdminLoreTab } from "../components/admin/AdminLoreTab";
import { AdminPromptsTab } from "../components/admin/AdminPromptsTab";
import { AdminSystemTab } from "../components/admin/AdminSystemTab";
import { AdminCanonTab } from "../components/admin/AdminCanonTab";
import { AdminLivingTab } from "../components/admin/AdminLivingTab";
import { AdminRelationsTab } from "../components/admin/AdminRelationsTab";
import type { TurnImageKind } from "../api/client";
import { AcervoTab } from "./enciclopedia/AcervoTab";
import { EntidadesTab } from "./enciclopedia/EntidadesTab";
import { EstudioTab } from "./enciclopedia/EstudioTab";
import { ADMIN_GROUPS, groupOf, sectionOf } from "../components/admin/adminNav";
import { ApiError, type AdminDashboard } from "../types/api";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };


function blankResult(houses: AdminDashboard["houses"]): TurnResult {
  return {
    publicResult: "",
    houseResults: Object.fromEntries(houses.map((house) => [house.houseId, ""])),
    attributeDeltas: Object.fromEntries(houses.map((house) => [house.houseId, { ...emptyAttributes }])),
    discoveries: [],
  };
}

export function AdminPage() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [code, setCode] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [publicEvent, setPublicEvent] = useState("");
  const [privateInfo, setPrivateInfo] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<TurnResult | null>(null);
  const [discoveriesText, setDiscoveriesText] = useState("");
  const [worldLore, setWorldLore] = useState("");
  const [worldVisualDirectives, setWorldVisualDirectives] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // O Mestre não deve descobrir que há trabalho parado abrindo aba por aba.
  const [pendingProjects, setPendingProjects] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);

  // A aba vive na URL (?tab=&sec=) para o Mestre poder guardar o link de onde
  // trabalha. Os doze valores antigos continuam entrando, remapeados.
  const group = groupOf(searchParams.get("tab"));
  const section = sectionOf(searchParams.get("tab"), searchParams.get("sec"));

  function selectGroup(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    params.delete("sec");
    setSearchParams(params, { replace: true });
  }

  function selectSection(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", group.value);
    params.set("sec", next);
    setSearchParams(params, { replace: true });
  }

  const syncDashboard = useCallback((next: AdminDashboard) => {
    setDashboard(next);
    setPublicEvent(next.publicEvent);
    setPrivateInfo({ ...next.privateInfo });
    const nextResult = next.result ?? blankResult(next.houses);
    setResolution(nextResult);
    setDiscoveriesText(nextResult.discoveries.join("\n"));
  }, []);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      syncDashboard(await api.getAdminDashboard(adminToken));
      const wb = await api.adminGetWorldBible(adminToken);
      setWorldLore(wb.lore);
      setWorldVisualDirectives(wb.visualDirectives.trim() ? wb.visualDirectives : DEFAULT_IMAGE_DIRECTIVES);
      // O badge é conveniência: se falhar, o painel continua inteiro.
      try {
        const [projects, draft] = await Promise.all([
          api.adminListProjects(adminToken),
          api.adminGetTurnDraft(adminToken),
        ]);
        setPendingProjects(projects.filter((p) => p.status === "PENDING_GM").length);
        setHasDraft(!!draft.draft);
      } catch {
        setPendingProjects(0);
        setHasDraft(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "SESSION_EXPIRED") {
        clearAdminToken();
        setToken(null);
        setDashboard(null);
        return;
      }
      setError("Falha ao carregar o painel.");
    }
  }, [api, syncDashboard]);

  useEffect(() => {
    if (token) void refresh(token);
  }, [token, refresh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { adminToken } = await api.adminLogin(code.trim());
      saveAdminToken(adminToken);
      setToken(adminToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAdminToken();
    setToken(null);
    setDashboard(null);
  }

  const runAction = useCallback(
    async (action: (adminToken: string) => Promise<unknown>, success?: string, refreshAfter = true) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await action(token);
        if (success) setNotice(success);
        if (refreshAfter) await refresh(token);
      } catch (err) {
        const aiCodes = ["AI_DISABLED", "AI_QUOTA", "AI_AUTH", "AI_ERROR", "AI_PARSE", "AI_LEAKED_PRIVATE_CONTEXT"];
        if (err instanceof ApiError && err.code === "AI_DISABLED") {
          setNotice("IA não configurada. Escreva manualmente.");
        } else if (err instanceof ApiError && aiCodes.includes(err.code)) {
          setNotice(`${err.message} Você pode escrever manualmente.`);
        } else {
          setError(err instanceof ApiError ? err.message : "Ação não concluída.");
        }
      } finally {
        setBusy(false);
      }
    },
    [token, refresh],
  );

  function updateResolution(patch: Partial<TurnResult>) {
    setResolution((current) => ({ ...(current ?? blankResult(dashboard?.houses ?? [])), ...patch }));
  }

  const setTurnImageUrl = useCallback((kind: TurnImageKind, imageUrl: string) => {
    setDashboard((current) => {
      if (!current) return current;
      return kind === "event" ? { ...current, eventImageUrl: imageUrl } : { ...current, resultImageUrl: imageUrl };
    });
  }, []);

  if (!token) {
    return (
      <Layout>
        <Typography variant="h1" gutterBottom>
          Administração
        </Typography>
        <Box component="form" onSubmit={login} sx={{ maxWidth: 420, mt: 2 }}>
          <TextField
            label="Código de admin"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            sx={{ mb: 2 }}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" color="secondary" size="large" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </Box>
      </Layout>
    );
  }

  // Rascunho esperando revisão e cartas paradas são as duas coisas que travam
  // um turno. Somadas num número só, elas cabem no rótulo da aba.
  const trabalhoPendente = pendingProjects + (hasDraft ? 1 : 0);

  const logoutButton = (
    <Button variant="outlined" size="small" color="inherit" onClick={logout}>
      Sair
    </Button>
  );

  if (!dashboard)
    return (
      <Layout action={logoutButton}>
        <LoadingState />
      </Layout>
    );

  return (
    <Layout action={logoutButton}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Typography variant="h1">Painel do Turno {dashboard.turnId ?? "-"}</Typography>
          <Chip label={`Status: ${dashboard.turnStatus ?? "sem turno"}`} variant="outlined" />
        </Stack>

        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={group.value} onChange={(_e, next) => selectGroup(next)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            {ADMIN_GROUPS.map((g) => (
              <Tab
                key={g.value}
                value={g.value}
                label={
                  g.value === "turno" && trabalhoPendente > 0 ? (
                    <Badge badgeContent={trabalhoPendente} color="secondary" sx={{ pr: 1.5 }}>
                      {g.label}
                    </Badge>
                  ) : (
                    g.label
                  )
                }
              />
            ))}
          </Tabs>
        </Box>

        {/* A segunda fileira só aparece depois que o Mestre já decidiu onde
            está. Grupos empilhados (Turno, Sistema) não têm nenhuma. */}
        {group.sections.length > 0 && (
          <Tabs value={section} onChange={(_e, next) => selectSection(next)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            {group.sections.map((s) => (
              <Tab key={s.value} value={s.value} label={s.label} />
            ))}
          </Tabs>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="info">{notice}</Alert>}

        {group.value === "turno" && (
          <AdminTurnoTab
            dashboard={dashboard}
            adminToken={token ?? ""}
            busy={busy}
            runAction={runAction}
            publicEvent={publicEvent}
            setPublicEvent={setPublicEvent}
            privateInfo={privateInfo}
            setPrivateInfo={setPrivateInfo}
            resolution={resolution}
            setResolution={setResolution}
            updateResolution={updateResolution}
            discoveriesText={discoveriesText}
            setDiscoveriesText={setDiscoveriesText}
            setTurnImageUrl={setTurnImageUrl}
            onDraftPublished={() => { if (token) void refresh(token); }}
            onError={setError}
            pendingProjects={pendingProjects}
          />
        )}

        {group.value === "casas" && section === "casas" && (
          <AdminHousesTab dashboard={dashboard} busy={busy} runAction={runAction} />
        )}
        {group.value === "casas" && section === "relacoes" && token && <AdminRelationsTab adminToken={token} />}
        {group.value === "casas" && section === "vivos" && token && <AdminLivingTab adminToken={token} busy={busy} />}

        {group.value === "mundo" && section === "biblia" && (
          <AdminLoreTab
            token={token}
            busy={busy}
            runAction={runAction}
            worldLore={worldLore}
            setWorldLore={setWorldLore}
            worldVisualDirectives={worldVisualDirectives}
          />
        )}
        {group.value === "mundo" && section === "canonico" && token && (
          <AdminCanonTab adminToken={token} busy={busy} onError={setError} />
        )}
        {group.value === "mundo" && section === "prompts" && (
          <AdminPromptsTab
            busy={busy}
            runAction={runAction}
            worldLore={worldLore}
            worldVisualDirectives={worldVisualDirectives}
            setWorldVisualDirectives={setWorldVisualDirectives}
          />
        )}
        {/* As ferramentas visuais saíram da Enciclopédia pública: são trabalho
            de Mestre, e conviviam com conteúdo de jogador separadas só por um
            isAdmin invisível. */}
        {group.value === "mundo" && section === "acervo" && <AcervoTab isAdmin />}
        {group.value === "mundo" && section === "entidades" && <EntidadesTab />}
        {group.value === "mundo" && section === "estudio" && <EstudioTab isAdmin />}

        {group.value === "sistema" && <AdminSystemTab busy={busy} runAction={runAction} adminToken={token ?? ""} />}
      </Stack>
    </Layout>
  );
}
