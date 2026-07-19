import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import type { GalleryEntry } from "../types/api";

interface GalleryImage {
  turnId: number;
  kind: "event" | "result";
  caption: string;
  imageUrl: string;
}

function toImages(entries: GalleryEntry[]): GalleryImage[] {
  const images: GalleryImage[] = [];
  for (const entry of entries) {
    if (entry.eventImageUrl) {
      images.push({ turnId: entry.turnId, kind: "event", caption: entry.publicEvent, imageUrl: entry.eventImageUrl });
    }
    if (entry.resultImageUrl) {
      images.push({ turnId: entry.turnId, kind: "result", caption: entry.publicResult, imageUrl: entry.resultImageUrl });
    }
  }
  return images;
}

export function GalleryPage() {
  const api = useApi();
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await api.getGallery());
    } catch {
      setError("Não foi possível carregar a galeria.");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  }

  if (!entries) {
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );
  }

  const images = toImages(entries);

  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Crônica de Valdren
          </Typography>
          <Typography color="text.secondary">
            A história do reino contada em imagens, turno a turno.
          </Typography>
        </Box>

        {images.length === 0 ? (
          <Alert severity="info">Nenhuma imagem foi registrada ainda.</Alert>
        ) : (
          images.map((image) => (
            <Card key={`${image.turnId}-${image.kind}`} component="section">
              <Box
                component="img"
                src={image.imageUrl}
                alt={image.caption || `Turno ${image.turnId}`}
                sx={{ width: "100%", display: "block" }}
              />
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip size="small" label={`Turno ${image.turnId}`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={image.kind === "event" ? "Evento" : "Resultado"}
                  />
                </Stack>
                {image.caption && <Typography variant="body2">{image.caption}</Typography>}
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Layout>
  );
}
