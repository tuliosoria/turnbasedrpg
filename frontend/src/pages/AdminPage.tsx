import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { AdminChoiceTable } from "../components/AdminChoiceTable";
import { KingdomStats } from "../components/KingdomStats";
import { LoadingState } from "../components/LoadingState";
import { saveAdminToken, loadAdminToken, clearAdminToken } from "../auth/adminSession";
import { ApiError, type AdminDashboard } from "../types/api";

export function AdminPage() {
  const api = useApi();
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [code, setCode] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (adminToken: string) => {
    try {
      setDashboard(await api.getAdminDashboard(adminToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        clearAdminToken();
        setToken(null);
      } else {
        setError("Falha ao carregar o painel.");
      }
    }
  }, [api]);

  useEffect(() => { if (token) void refresh(token); }, [token, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
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

  async function toggleLock(lock: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      if (lock) await api.lockTurn(token);
      else await api.unlockTurn(token);
      await refresh(token);
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!dashboard) return;
    await navigator.clipboard.writeText(dashboard.summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function logout() {
    clearAdminToken();
    setToken(null);
    setDashboard(null);
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
            onChange={(e) => setCode(e.target.value)}
            sx={{ mb: 2 }}
          />
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
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

  const open = dashboard.turnStatus === "OPEN";

  return (
    <Layout action={logoutButton}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Typography variant="h1">Painel do Turno {dashboard.activeTurnId}</Typography>
        <Chip
          label={`Status: ${open ? "Aberto" : "Bloqueado"}`}
          color={open ? "success" : "warning"}
          variant="outlined"
        />
      </Stack>

      <KingdomStats state={dashboard.kingdomState} />

      <Card component="section" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Escolhas do turno
          </Typography>
          <AdminChoiceTable rows={dashboard.rows} />
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          color={open ? "warning" : "secondary"}
          disabled={busy}
          onClick={() => toggleLock(open)}
        >
          {open ? "Bloquear turno" : "Desbloquear turno"}
        </Button>
        <Button variant="outlined" disabled={busy} onClick={copySummary}>
          {copied ? "Copiado!" : "Copiar resumo"}
        </Button>
      </Stack>

      <Snackbar open={copied} message="Resumo copiado" autoHideDuration={2000} />
    </Layout>
  );
}
