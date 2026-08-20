import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Layout } from "../../components/Layout";
import { HISTORIAS } from "./historias";

/**
 * "Histórias Contadas": os verbetes de Valdren narrados. Só áudio — vídeo pesava
 * dezenas de vezes mais para entregar a mesma voz.
 */
export function HistoriasPage() {
  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Histórias Contadas</Typography>
          <Typography variant="body2" color="text.secondary">
            As crônicas de Valdren, narradas. Dê o play e ouça o reino se contar.
          </Typography>
        </Box>

        {HISTORIAS.length === 0 ? (
          <Typography color="text.secondary">Nenhuma história narrada ainda.</Typography>
        ) : (
          <Stack spacing={2}>
            {HISTORIAS.map((h) => (
              <Paper key={h.id} component="article" variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h6">{h.title}</Typography>
                  <Chip size="small" variant="outlined" label={`voz de ${h.voice}`} />
                  {h.duration && <Chip size="small" variant="outlined" label={h.duration} />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  {h.description}
                </Typography>
                {/* preload="metadata" traz só o cabeçalho: a duração aparece na
                    barra e o play começa quase imediato. Com "none" o player
                    ficava sem duração e sem reação enquanto baixava o arquivo
                    inteiro, e parecia travado. O <source> com type ajuda o
                    Safari a escolher o decodificador sem adivinhar. */}
                <Box component="audio" controls preload="metadata" sx={{ width: "100%" }}>
                  <source src={h.audioUrl} type="audio/mpeg" />
                  Seu navegador não suporta áudio.
                </Box>
                {h.section && (
                  <Button component={RouterLink} to={`/valdren/${h.section}`} size="small" sx={{ mt: 1 }}>
                    Ler na Enciclopédia
                  </Button>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Layout>
  );
}
