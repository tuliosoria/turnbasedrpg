import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import type { PactsView } from "../api/client";

const TIPO_ROTULO: Record<string, string> = {
  ALIANCA: "Aliança",
  ACORDO: "Acordo comercial",
  RECUSA: "Recusa",
  AMEACA: "Ameaça",
  PROMESSA: "Promessa",
};

/**
 * O que a Casa firmou, deve e ganhou — num lugar só.
 *
 * Estava tudo espalhado: favores escondidos numa aba do painel de projetos,
 * acordos existindo apenas na visão do Mestre, e os ativos numa lista que não
 * dizia de onde tinham vindo. O jogador não tinha onde olhar para saber com
 * quem tem aliança, quem lhe deve e o que aquela carta do turno passado
 * realmente construiu.
 */
export function PactsPanel({ playerToken, onChanged }: { playerToken: string; onChanged?: () => void }) {
  const api = useApi();
  const [data, setData] = useState<PactsView | null>(null);
  const [aba, setAba] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setData(await api.listPacts(playerToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os pactos.");
    }
  }, [api, playerToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const responderFavor = async (favorId: string, accept: boolean) => {
    setOcupado(favorId);
    try {
      await api.respondToFavor(playerToken, { favorId, accept });
      await carregar();
      onChanged?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao responder ao favor.");
    } finally {
      setOcupado(null);
    }
  };

  if (!data) return null;

  const pendentes = data.favores.filter((f) => f.status === "PENDING");
  const rotas = data.firmados.filter((p) => p.tipo === "ACORDO");
  const aliancas = data.firmados.filter((p) => p.tipo === "ALIANCA");

  const Linha = ({ titulo, com, turno, resumo, chip }: { titulo: string; com: string; turno: number; resumo: string; chip?: string }) => (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2">{titulo}</Typography>
        <Chip size="small" label={`com ${com}`} />
        <Chip size="small" variant="outlined" label={`turno ${turno}`} />
        {chip && <Chip size="small" color="warning" label={chip} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "80ch" }}>{resumo}</Typography>
    </Paper>
  );

  return (
    <Card component="section">
      <CardContent>
        <Typography variant="h2" gutterBottom>O que sua Casa firmou</Typography>
        {erro && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErro(null)}>{erro}</Alert>}

        <Tabs value={aba} onChange={(_e, v) => setAba(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
          <Tab label={`Alianças (${aliancas.length})`} />
          <Tab label={`Rotas e acordos (${rotas.length})`} />
          <Tab label={`Favores (${pendentes.length ? `${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}` : data.favores.length})`} />
          <Tab label={`Ativos (${data.ativos.length})`} />
          <Tab label="Histórico" />
        </Tabs>

        {aba === 0 && (
          <Stack spacing={1}>
            {aliancas.length === 0 && <Typography color="text.secondary">Nenhuma aliança firmada. Elas nascem de cartas aceitas.</Typography>}
            {aliancas.map((p) => <Linha key={p.id} titulo="Aliança" com={p.com} turno={p.turnNumber} resumo={p.resumo} />)}
          </Stack>
        )}

        {aba === 1 && (
          <Stack spacing={1}>
            {rotas.length === 0 && <Typography color="text.secondary">Nenhum acordo comercial em vigor.</Typography>}
            {rotas.map((p) => <Linha key={p.id} titulo="Acordo comercial" com={p.com} turno={p.turnNumber} resumo={p.resumo} />)}
          </Stack>
        )}

        {aba === 2 && (
          <Stack spacing={1}>
            {data.favores.length === 0 && (
              <Typography color="text.secondary">
                Nenhum favor no razão. Favores nascem quando uma Casa faz algo por você e você aceita dever.
              </Typography>
            )}
            {data.favores.map((f) => (
              <Paper key={f.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2">{f.credor}</Typography>
                  <Chip
                    size="small"
                    color={f.status === "PENDING" ? "warning" : f.status === "ACCEPTED" ? "success" : "default"}
                    label={f.status === "PENDING" ? "esperando você" : f.status === "ACCEPTED" ? "você deve" : "recusado"}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ my: 0.5, maxWidth: "80ch" }}>{f.reason}</Typography>
                {f.status === "PENDING" && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="contained" disabled={ocupado === f.id} onClick={() => void responderFavor(f.id, true)}>
                      Aceitar e ficar devendo
                    </Button>
                    <Button size="small" color="inherit" disabled={ocupado === f.id} onClick={() => void responderFavor(f.id, false)}>
                      Recusar
                    </Button>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        )}

        {aba === 3 && (
          <Stack spacing={1}>
            {data.ativos.length === 0 && <Typography color="text.secondary">Nenhum ativo ainda.</Typography>}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {data.ativos.map((a) => <Chip key={a} label={a} />)}
            </Box>
          </Stack>
        )}

        {aba === 4 && (
          <Stack spacing={1}>
            {/* Uma recusa também é informação: quem já disse não, e por quê,
                muda como você escreve a próxima carta. */}
            {data.historico.length === 0 && <Typography color="text.secondary">Nada recusado ou rompido até agora.</Typography>}
            {data.historico.map((p) => (
              <Linha
                key={p.id}
                titulo={TIPO_ROTULO[p.tipo] ?? p.tipo}
                com={p.com}
                turno={p.turnNumber}
                resumo={p.resumo}
                chip={p.status === "REVOGADO" ? "rompido" : undefined}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
