import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PENDENCIA_DESTINO, totalPendente, type Pendencias } from "@ravenloft/content";

/**
 * O que está esperando o Mestre, em cima de tudo e em dourado.
 *
 * Nasceu de "estou perdido como admin". O painel tem quatro grupos e treze
 * seções, e o único aviso de trabalho parado contava projetos e rascunho — de
 * cânone, espionagem e briefing do Porto não havia sinal nenhum, então a única
 * forma de saber era abrir aba por aba e olhar.
 *
 * Cada linha leva direto ao lugar. É o que separa "há três coisas paradas" de
 * "há três coisas paradas e eu sei onde".
 *
 * Some por completo quando não há nada. Uma faixa que diz "0 pendências" ocupa
 * o topo da tela todo dia para não informar nada, e ensina o olho a pular a
 * região onde o aviso de verdade vai aparecer.
 */
export function PainelDePendencias({
  pendencias,
  onIr,
}: {
  pendencias: Pendencias;
  onIr: (tab: string, sec?: string) => void;
}) {
  const total = totalPendente(pendencias);
  if (total === 0) return null;

  const linhas = (Object.keys(PENDENCIA_DESTINO) as (keyof Pendencias)[])
    .filter((k) => pendencias[k] > 0)
    .map((k) => ({ chave: k, ...PENDENCIA_DESTINO[k], n: pendencias[k] }));

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        borderColor: "warning.main",
        // A cor cheia ficaria berrante numa tela escura de trabalho diário; o
        // que precisa saltar é a borda e o número, não o retângulo inteiro.
        bgcolor: (t) => `${t.palette.warning.main}14`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="h3" sx={{ color: "warning.main", fontSize: "1.05rem" }}>
          {total === 1 ? "1 coisa esperando por você" : `${total} coisas esperando por você`}
        </Typography>
      </Stack>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {linhas.map((l) => (
          <Button
            key={l.chave}
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => onIr(l.tab, l.sec)}
          >
            {l.label(l.n)}
          </Button>
        ))}
      </Box>
    </Paper>
  );
}
