import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WORLD_FACT_KINDS, WORLD_FACT_KIND_LABELS, SEATS, type WorldFact } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";

const nomeDaSede = (k: string) => SEATS.find((s) => s.key === k)?.name ?? k;

/**
 * O registro da campanha: o que já aconteceu e não se discute.
 *
 * Existe porque o que aconteceu só vivia como prosa, e a afirmação errada de
 * que Khazdrun não enviou tropa nenhuma atravessou três turnos, o evento
 * público, o resultado da Casa e três cartas entregues antes de alguém notar.
 *
 * Como a extração grava sem passar por aprovação, esta tela é a única
 * supervisão que existe — e por isso a CITAÇÃO aparece junto de cada fato. Sem
 * ela, revogar seria palpite: o Mestre precisa ver de qual frase do turno o
 * fato saiu antes de decidir se ele fica.
 */
export function AdminRegistroTab({ adminToken }: { adminToken: string }) {
  const api = useApi();
  const [fatos, setFatos] = useState<WorldFact[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tipo, setTipo] = useState("");
  const [turno, setTurno] = useState("");

  const carregar = useCallback(async () => {
    try {
      setFatos(await api.listWorldFacts(adminToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o registro.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const revogar = async (id: string) => {
    setOcupado(id);
    try {
      await api.revokeWorldFact(adminToken, id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao revogar.");
    } finally {
      setOcupado(null);
    }
  };

  const turnos = useMemo(
    () => [...new Set((fatos ?? []).map((f) => f.turnNumber))].sort((a, b) => b - a),
    [fatos],
  );

  const visiveis = (fatos ?? []).filter(
    (f) => (!tipo || f.kind === tipo) && (!turno || String(f.turnNumber) === turno),
  );

  if (!fatos) return null;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "80ch" }}>
        Extraído do texto de cada turno e lido pela IA em toda carta e em todo resultado. A citação
        é o trecho do seu texto que sustenta o fato — se ela não corresponder ao que você escreveu,
        revogue. O que saiu do resultado privado de uma Casa fica marcado e nunca entra numa carta. Revogar não apaga: o fato sai dos prompts e continua no histórico.
      </Typography>

      {erro && <Alert severity="error" onClose={() => setErro(null)}>{erro}</Alert>}

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">Todos</MenuItem>
          {WORLD_FACT_KINDS.map((k) => (
            <MenuItem key={k} value={k}>{WORLD_FACT_KIND_LABELS[k]}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Turno" value={turno} onChange={(e) => setTurno(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">Todos</MenuItem>
          {turnos.map((t) => <MenuItem key={t} value={String(t)}>Turno {t}</MenuItem>)}
        </TextField>
      </Stack>

      {visiveis.length === 0 && (
        <Typography color="text.secondary">
          Nenhum fato registrado ainda. Eles nascem quando você aplica a resolução de um turno.
        </Typography>
      )}

      {visiveis.map((f) => (
        <Paper key={f.id} variant="outlined" sx={{ p: 1.5, opacity: f.status === "REVOGADO" ? 0.55 : 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={WORLD_FACT_KIND_LABELS[f.kind] ?? f.kind} />
            <Chip size="small" variant="outlined" label={`turno ${f.turnNumber}`} />
            <Chip
              size="small"
              variant="outlined"
              label={f.parties.length ? f.parties.map(nomeDaSede).join(", ") : "o reino"}
            />
            {/* Quem pode saber. O Mestre precisa enxergar isto de relance: um
                fato marcado como segredo de uma Casa nunca entra em carta, e um
                que devia ser segredo e está público é vazamento esperando. */}
            {f.visibility !== "PUBLICO" && (
              <Chip size="small" color="info" variant="outlined" label={`só ${nomeDaSede(f.visibility)} sabe`} />
            )}
            {f.status === "REVOGADO" && <Chip size="small" color="warning" label="revogado" />}
          </Stack>

          <Typography variant="body1" sx={{ mt: 1, maxWidth: "80ch" }}>{f.summary}</Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: "80ch", borderLeft: 3, borderColor: "divider", pl: 1.5, fontStyle: "italic" }}
          >
            {f.quote}
          </Typography>

          {f.status === "ATIVO" && (
            <Button size="small" color="inherit" sx={{ mt: 1 }} disabled={ocupado === f.id} onClick={() => void revogar(f.id)}>
              Revogar
            </Button>
          )}
        </Paper>
      ))}
    </Stack>
  );
}
