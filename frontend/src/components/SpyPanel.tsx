import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { SEATS, SPY_QUESTION_MAX } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import type { SpyView, SpyTierView } from "../api/client";

/**
 * Contratar quem vai perguntar por você.
 *
 * Isto era uma carta de projeto, com o mesmo formulário de um aqueduto. Mas uma
 * operação de espionagem não constrói nada: ela devolve informação uma vez e
 * pode ser descoberta, que é um tipo de fracasso que obra nenhuma tem.
 *
 * A tela existe para uma decisão só — quanto pagar — e por isso mostra o que
 * acontece se der certo E se der errado antes de confirmar. Risco escondido
 * não é risco, é armadilha.
 */
export function SpyPanel({ playerToken, onChanged }: { playerToken: string; onChanged?: () => void }) {
  const api = useApi();
  const [data, setData] = useState<SpyView | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [nivel, setNivel] = useState<string>("BOCA");
  const [alvo, setAlvo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setData(await api.listSpyOps(playerToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as operações.");
    }
  }, [api, playerToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tier: SpyTierView | undefined = useMemo(
    () => data?.tiers.find((t) => t.level === nivel),
    [data, nivel],
  );

  const contratar = async () => {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      await api.startSpyOp(playerToken, { question: pergunta.trim(), level: nivel, targetKey: alvo });
      setAviso("O agente partiu. O que ele trouxer aparece aqui quando o Mestre resolver o turno.");
      setPergunta("");
      await carregar();
      onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao contratar a operação.");
    } finally {
      setEnviando(false);
    }
  };

  if (!data) return null;

  const emCurso = data.operations.filter((o) => o.status === "EM_CURSO");
  const resolvidas = data.operations.filter((o) => o.status === "RESOLVIDA");
  const nomeDoAlvo = (k: string) => SEATS.find((s) => s.key === k)?.name ?? k;

  return (
    <Stack spacing={3}>
      <Card component="section">
        <CardContent>
          <Typography variant="h2" gutterBottom>Mandar alguém perguntar</Typography>
          {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>{erro}</Alert>}
          {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

          <Stack spacing={2} sx={{ maxWidth: "80ch" }}>
            <TextField
              label="O que você quer saber?"
              placeholder="Quem determinou a evacuação da Asteria, e por que a família real saiu por outra rota."
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value.slice(0, SPY_QUESTION_MAX))}
              multiline
              minRows={2}
              inputProps={{ maxLength: SPY_QUESTION_MAX }}
              helperText={`${pergunta.length} de ${SPY_QUESTION_MAX} caracteres. Quanto mais específica a pergunta, mais útil a resposta.`}
            />

            <TextField
              select
              label="Sobre quem (opcional)"
              value={alvo}
              onChange={(e) => setAlvo(e.target.value)}
              helperText="Deixe em branco para perguntar sobre o mundo, e não sobre uma Casa."
            >
              <MenuItem value="">Ninguém em especial</MenuItem>
              {SEATS.map((s) => <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>)}
            </TextField>

            <TextField select label="Quanto quer pagar?" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              {data.tiers.map((t) => (
                <MenuItem key={t.level} value={t.level}>
                  {t.label} — {t.custoRecursos} Recurso{t.custoRecursos > 1 ? "s" : ""}
                  {t.custoRiqueza > 0 ? ` e ${t.custoRiqueza} Riqueza` : ""}
                </MenuItem>
              ))}
            </TextField>

            {/* Os dois lados, sempre. Pagar mais sobe o teto da recompensa e a
                gravidade do fracasso junto — é isso que faz da escolha uma
                decisão, e não um upgrade. */}
            {tier && (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <Alert severity="success" icon={false}>
                  <Typography variant="overline" display="block">Se der certo</Typography>
                  <Typography variant="body2">{tier.seDerCerto}</Typography>
                </Alert>
                <Alert severity="warning" icon={false}>
                  <Typography variant="overline" display="block">Se der errado</Typography>
                  <Typography variant="body2">{tier.seDerErrado}</Typography>
                </Alert>
              </Box>
            )}
            {tier && <Typography variant="caption" color="text.secondary">Quem você paga: {tier.quem}</Typography>}

            <Box>
              <Button variant="contained" disabled={enviando || pergunta.trim().length < 10} onClick={() => void contratar()}>
                {enviando ? "O agente está saindo…" : "Contratar"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {emCurso.length > 0 && (
        <Card component="section">
          <CardContent>
            <Typography variant="h2" gutterBottom>Em curso</Typography>
            <Stack spacing={1}>
              {emCurso.map((o) => (
                <Paper key={o.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={data.tiers.find((t) => t.level === o.level)?.label ?? o.level} />
                    {o.targetKey && <Chip size="small" variant="outlined" label={`sobre ${nomeDoAlvo(o.targetKey)}`} />}
                    <Chip size="small" variant="outlined" label={`turno ${o.turnNumber}`} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5, maxWidth: "80ch" }}>{o.question}</Typography>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card component="section">
        <CardContent>
          <Typography variant="h2" gutterBottom>O que voltou</Typography>
          {resolvidas.length === 0 ? (
            <Typography color="text.secondary">Nada voltou ainda.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {resolvidas.map((o) => (
                <Paper key={o.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      color={o.outcome === "SUCESSO" ? "success" : "warning"}
                      label={o.outcome === "SUCESSO" ? "deu certo" : "deu errado"}
                    />
                    {o.targetKey && <Chip size="small" variant="outlined" label={nomeDoAlvo(o.targetKey)} />}
                    <Chip size="small" variant="outlined" label={`turno ${o.turnNumber}`} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    Você perguntou: {o.question}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", maxWidth: "80ch" }}>{o.report}</Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
