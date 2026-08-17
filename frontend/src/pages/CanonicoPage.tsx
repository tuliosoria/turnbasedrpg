import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  CANON_SUBMISSION_STATUS_LABELS,
  type CanonSubmission,
  type CanonSubmissionStatus,
} from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import type { CanonSubmitInput } from "../api/client";
import { loadPlayerSession } from "../auth/playerSession";
import { CanonSubmitForm } from "../components/CanonSubmitForm";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ApiError } from "../types/api";

const STATUS_COLOR: Record<CanonSubmissionStatus, "warning" | "success" | "default"> = {
  PENDING_GM: "warning",
  APPROVED: "success",
  REJECTED: "default",
};

export function CanonicoPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<CanonSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = loadPlayerSession()?.playerToken ?? null;

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setSubmissions(await api.playerCanonList(token));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar suas propostas.");
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    void refresh();
  }, [token, navigate, refresh]);

  if (!token) return null;

  const preview = (rawText: string) => api.playerCanonPreview(token, rawText);
  const upload = (file: File) => api.playerCanonUploadImage(token, file);
  const submit = async (input: CanonSubmitInput) => {
    await api.playerCanonSubmit(token, input);
    await refresh();
  };

  return (
    <Layout>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Adicionar Canônico</Typography>
          <Typography color="text.secondary">
            Escreva o que você quer acrescentar ao mundo. A IA organiza em verbete, o Mestre revisa e, se aprovar,
            o texto entra na Enciclopédia e passa a valer para todo o jogo.
          </Typography>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <CanonSubmitForm onPreview={preview} onSubmit={submit} onUploadImage={upload} />

        <Stack spacing={2}>
          <Typography variant="h6">Suas propostas</Typography>
          {loading ? <LoadingState /> : null}
          {!loading && submissions.length === 0 ? (
            <Typography color="text.secondary">Você ainda não propôs nada.</Typography>
          ) : null}
          {submissions.map((s) => (
            <Card key={s.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight="bold">{s.proposal.title}</Typography>
                  <Chip
                    size="small"
                    color={STATUS_COLOR[s.status]}
                    label={CANON_SUBMISSION_STATUS_LABELS[s.status]}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {s.proposal.summary}
                </Typography>
                {s.gmNote ? (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {s.gmNote}
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Layout>
  );
}
