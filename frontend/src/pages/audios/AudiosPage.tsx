import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Layout } from "../../components/Layout";
import { NARRACOES } from "./narracoes";

/**
 * "Áudios": as narrações da Enciclopédia. Cada uma é um vídeo com uma imagem de
 * fundo (o mapa, um retrato…) enquanto a voz conta o texto do verbete.
 */
export function AudiosPage() {
  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Áudios</Typography>
          <Typography variant="body2" color="text.secondary">
            As crônicas de Valdren, narradas. Dê o play e ouça o reino se contar.
          </Typography>
        </Box>

        {NARRACOES.length === 0 ? (
          <Typography color="text.secondary">Nenhuma narração ainda.</Typography>
        ) : (
          <Stack spacing={4}>
            {NARRACOES.map((n) => (
              <Box key={n.id} component="section">
                <Typography variant="h6">{n.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {n.description}
                </Typography>
                <Box
                  component="video"
                  controls
                  preload="metadata"
                  poster={n.poster}
                  sx={{ width: "100%", maxWidth: 900, borderRadius: 2, display: "block", bgcolor: "#000" }}
                >
                  <source src={n.videoUrl} type="video/mp4" />
                  Seu navegador não suporta vídeo.
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Layout>
  );
}
