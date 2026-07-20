import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DEFAULT_IMAGE_DIRECTIVES, type Attributes, type TurnResult } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { clearAdminToken, loadAdminToken, saveAdminToken } from "../auth/adminSession";
import { LoadingState } from "../components/LoadingState";
import { Layout } from "../components/Layout";
import { AdminTurnsTab } from "../components/admin/AdminTurnsTab";
import { AdminHousesTab } from "../components/admin/AdminHousesTab";
import { AdminLoreTab } from "../components/admin/AdminLoreTab";
import { AdminPromptsTab } from "../components/admin/AdminPromptsTab";
import { AdminSystemTab } from "../components/admin/AdminSystemTab";
import { ApiError, type AdminDashboard } from "../types/api";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };

const TABS = [
  { value: "turnos", label: "Turnos", disabled: false },
  { value: "casas", label: "Casas", disabled: false },
  { value: "historia", label: "História", disabled: false },
  { value: "prompts", label: "Prompts", disabled: false },
  { value: "galeria", label: "Galeria (em breve)", disabled: true },
  { value: "senhas", label: "Senhas (em breve)", disabled: true },
  { value: "sistema", label: "Sistema", disabled: false },
] as const;

const ENABLED_TABS = TABS.filter((tab) => !tab.disabled).map((tab) => tab.value);
type TabValue = (typeof TABS)[number]["value"];
const DEFAULT_TAB: TabValue = "turnos";

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

  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = (ENABLED_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabValue)
    : DEFAULT_TAB;

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
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
        const aiCodes = ["AI_DISABLED", "AI_QUOTA", "AI_AUTH", "AI_ERROR", "AI_PARSE"];
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
          <Tabs
            value={activeTab}
            onChange={(_event, next) => selectTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} disabled={tab.disabled} />
            ))}
          </Tabs>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="info">{notice}</Alert>}

        {activeTab === "turnos" && (
          <AdminTurnsTab
            dashboard={dashboard}
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
          />
        )}

        {activeTab === "casas" && <AdminHousesTab dashboard={dashboard} busy={busy} runAction={runAction} />}

        {activeTab === "historia" && (
          <AdminLoreTab
            token={token}
            busy={busy}
            runAction={runAction}
            worldLore={worldLore}
            setWorldLore={setWorldLore}
            worldVisualDirectives={worldVisualDirectives}
          />
        )}

        {activeTab === "prompts" && (
          <AdminPromptsTab
            busy={busy}
            runAction={runAction}
            worldLore={worldLore}
            worldVisualDirectives={worldVisualDirectives}
            setWorldVisualDirectives={setWorldVisualDirectives}
          />
        )}

        {activeTab === "sistema" && <AdminSystemTab busy={busy} runAction={runAction} />}
      </Stack>
    </Layout>
  );
}
