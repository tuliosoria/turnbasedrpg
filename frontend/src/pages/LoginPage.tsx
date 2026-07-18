import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { savePlayerSession } from "../auth/playerSession";
import { ApiError } from "../types/api";

export function LoginPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(code.trim());
      savePlayerSession({
        playerToken: result.playerToken,
        houseId: result.houseId,
        displayName: result.displayName,
      });
      navigate("/game");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <Typography variant="h1" gutterBottom>
        Entrar com seu código
      </Typography>
      <Box component="form" onSubmit={submit} sx={{ maxWidth: 420, mt: 2 }}>
        <TextField
          label="Código do jogador"
          placeholder="ex.: vargen-4K7P"
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
