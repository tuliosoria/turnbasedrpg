import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { SEATS } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import type { SpyView } from "../../api/client";

/**
 * A fila de espionagem do Mestre.
 *
 * Sem isto o jogador contrata um agente, paga o Recurso e nunca recebe nada —
 * o pior fim possível para uma mecânica de informação. O desfecho é escolha do
 * Mestre e não de um dado: só ele sabe se o que foi perguntado tem resposta,
 * e a carta de risco que o jogador leu antes de pagar é o contrato a cumprir.
 */
export function AdminSpyTab({ adminToken, onChanged }: {
  adminToken: string;
  /** Avisa a página que uma operação saiu da fila. */
  onChanged?: () => void;
}) {
  const api = useApi();
  const [data, setData] = useState<SpyView | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [relatos, setRelatos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setData(await api.adminListSpyOps(adminToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as operações.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resolver = async (id: string, outcome: "SUCESSO" | "FRACASSO") => {
    const report = (relatos[id] ?? "").trim();
    if (!report) {
      setErro("Escreva o que a Casa descobriu, ou o que deu errado.");
      return;
    }
    setOcupado(id);
    setErro(null);
    try {
      await api.adminResolveSpyOp(adminToken, { id, outcome, report });
      await carregar();
      onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(null);
    }
  };

  if (!data) return null;

  const emCurso = data.operations.filter((o) => o.status === "EM_CURSO");
  const nomeDoAlvo = (k: string) => SEATS.find((s) => s.key === k)?.name ?? k;
  const tier = (l: string) => data.tiers.find((t) => t.level === l);

  return (
    <Stack spacing={2}>
      {erro && <Alert severity="error" onClose={() => setErro(null)}>{erro}</Alert>}
      {emCurso.length === 0 && <Typography color="text.secondary">Nenhuma operação esperando você.</Typography>}

      {emCurso.map((o) => {
        const t = tier(o.level);
        return (
          <Paper key={o.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" label={o.houseId} />
              <Chip size="small" color="secondary" label={t?.label ?? o.level} />
              {o.targetKey && <Chip size="small" variant="outlined" label={`sobre ${nomeDoAlvo(o.targetKey)}`} />}
              <Chip size="small" variant="outlined" label={`turno ${o.turnNumber}`} />
            </Stack>

            <Typography variant="body2" sx={{ mb: 1 }}><strong>Perguntaram:</strong> {o.question}</Typography>

            {/* O que o jogador leu antes de pagar. É o contrato: o relato tem
                de caber num dos dois lados que ele aceitou. */}
            {t && (
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="success.main">Se der certo: {t.seDerCerto}</Typography>
                <Typography variant="caption" color="warning.main">Se der errado: {t.seDerErrado}</Typography>
              </Stack>
            )}

            <TextField
              label="O que voltou"
              placeholder="O que a Casa descobriu, ou o que deu errado e quem ficou sabendo."
              value={relatos[o.id] ?? ""}
              onChange={(e) => setRelatos((r) => ({ ...r, [o.id]: e.target.value }))}
              multiline
              minRows={3}
              fullWidth
              size="small"
            />

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button variant="contained" size="small" disabled={ocupado === o.id} onClick={() => void resolver(o.id, "SUCESSO")}>
                Deu certo
              </Button>
              <Button variant="outlined" color="warning" size="small" disabled={ocupado === o.id} onClick={() => void resolver(o.id, "FRACASSO")}>
                Deu errado
              </Button>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
