import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fullCodex } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../LoadingState";
import type { AdminCorrespondence, AdminCorrespondenceThread } from "../../api/client";

/** Id do NPC → nome legível, para não mostrar "kaelen-drakorys" ao Mestre. */
function nomeDoNpc(id: string): string {
  return fullCodex().find((n) => n.id === id)?.name ?? id;
}

/**
 * A correspondência inteira da campanha, para o Mestre.
 *
 * Sem isto ele arbitra às cegas: as Casas combinam alianças, prometem tropas e
 * fazem ameaças por carta, e nada disso aparecia em lugar nenhum do painel.
 */
export function AdminCorrespondenceTab({ adminToken }: { adminToken: string }) {
  const api = useApi();
  const [data, setData] = useState<AdminCorrespondence | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroCasa, setFiltroCasa] = useState("todas");
  const [retirando, setRetirando] = useState<string | null>(null);

  const retirar = async (id: string) => {
    setRetirando(id);
    setErro(null);
    try {
      await api.adminWithdrawLetter(adminToken, id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao retirar a carta.");
    } finally {
      setRetirando(null);
    }
  };

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setData(await api.adminGetCorrespondence(adminToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a correspondência.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const casas = useMemo(() => {
    const nomes = new Set((data?.threads ?? []).map((t) => t.houseName));
    return [...nomes].sort();
  }, [data]);

  const porTurno = useMemo(() => {
    const fios = (data?.threads ?? []).filter((t) => filtroCasa === "todas" || t.houseName === filtroCasa);
    const mapa = new Map<number, AdminCorrespondenceThread[]>();
    for (const t of fios) mapa.set(t.turnNumber, [...(mapa.get(t.turnNumber) ?? []), t]);
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [data, filtroCasa]);

  if (erro) return <Alert severity="error">{erro}</Alert>;
  if (!data) return <LoadingState />;

  const totalCartas = (data.threads ?? []).reduce(
    (n, t) => n + t.messages.filter((m) => m.author === "PLAYER").length, 0,
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Tudo que as Casas escreveram e o que lhes foi respondido, do turno mais recente para o mais antigo.
          {totalCartas > 0 && ` ${totalCartas} carta${totalCartas > 1 ? "s" : ""} enviada${totalCartas > 1 ? "s" : ""} até agora.`}
        </Typography>
      </Box>

      {casas.length > 1 && (
        <TextField
          select
          size="small"
          label="Casa remetente"
          value={filtroCasa}
          onChange={(e) => setFiltroCasa(e.target.value)}
          sx={{ maxWidth: 260 }}
        >
          <MenuItem value="todas">Todas as Casas</MenuItem>
          {casas.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
      )}

      {porTurno.length === 0 ? (
        <Typography color="text.secondary">Nenhuma carta foi enviada ainda.</Typography>
      ) : (
        porTurno.map(([turno, fios]) => (
          <Box key={turno}>
            <Typography variant="overline" color="text.secondary">Turno {turno}</Typography>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              {fios.map((fio) => {
                // A quem foi endereçada: a mesma Casa pode receber cartas para
                // pessoas diferentes, e para o Mestre isso muda tudo.
                const destinatario = fio.messages.find((m) => m.toCharacterId)?.toCharacterId ?? null;
                return (
                  <Paper key={`${fio.turnNumber}-${fio.houseId}-${fio.toHouseKey}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">
                        {fio.mundoComecou ? `${fio.toName} → ${fio.houseName}` : `${fio.houseName} → ${fio.toName}`}
                      </Typography>
                      {fio.mundoComecou && <Chip size="small" color="secondary" label="o mundo escreveu primeiro" />}
                      {destinatario && <Chip size="small" variant="outlined" label={`para ${nomeDoNpc(destinatario)}`} />}
                    </Stack>
                    <Stack spacing={1}>
                      {fio.messages.map((m) => (
                        <Box
                          key={m.id}
                          sx={{
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: m.author === "PLAYER" ? "action.hover" : "transparent",
                            borderLeft: 3,
                            borderColor: m.author === "PLAYER" ? "primary.main" : "divider",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" display="block">
                            {m.author === "PLAYER"
                              ? `${fio.houseName} ${fio.mundoComecou ? "respondeu" : "escreveu"}`
                              : `${fio.toName} ${fio.mundoComecou && m.id === fio.messages[0]?.id ? "escreveu primeiro" : "respondeu"}`}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.body}</Typography>
                          {/* As cartas de NPC chegam sem fila de aprovação, com
                              a condição de o Mestre poder tirar do ar a que sair
                              errada. O que um jogador enviou não se apaga: é
                              registro da partida. */}
                          {m.author === "AI" && (
                            <Button
                              size="small"
                              color="error"
                              disabled={retirando === m.id}
                              onClick={() => void retirar(m.id)}
                              sx={{ mt: 0.5 }}
                            >
                              {retirando === m.id ? "Retirando…" : "Retirar esta carta"}
                            </Button>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ))
      )}

      {data.facts.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">Registro da partida</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {data.facts.map((f) => (
              <Typography key={f.id} variant="body2">
                <strong>Turno {f.turnNumber}:</strong> {f.text}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
