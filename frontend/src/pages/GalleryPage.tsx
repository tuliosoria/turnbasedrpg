import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../api/ApiProvider";
import { MundoLayout } from "../components/MundoLayout";
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

function resumo(caption: string): string {
  const primeiroParagrafo = caption
    .replace(/^#{1,6}\s+.*$/gm, "")
    .trim()
    .split(/\n\s*\n/)[0] ?? "";
  const texto = primeiroParagrafo
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > 220 ? `${texto.slice(0, 217).trimEnd()}…` : texto;
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
      <MundoLayout>
        <Alert severity="error">{error}</Alert>
      </MundoLayout>
    );
  }

  if (!entries) {
    return (
      <MundoLayout>
        <LoadingState />
      </MundoLayout>
    );
  }

  const images = toImages(entries);

  return (
    <MundoLayout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Crônica de Valdren
          </Typography>
          <Typography color="text.secondary">
            A história do reino contada em imagens, turno a turno.
          </Typography>
          <Link component={RouterLink} to="/valdren" sx={{ display: "inline-block", mt: 1 }}>
            Explorar a crônica
          </Link>
        </Box>

        {images.length === 0 ? (
          <Alert severity="info">Nenhuma imagem foi registrada ainda.</Alert>
        ) : (
          images.map((image) => (
            <Card key={`${image.turnId}-${image.kind}`} component="section">
              <Box
                component="img"
                src={image.imageUrl}
                alt={`Ilustração do ${image.kind === "event" ? "evento" : "resultado"} do turno ${image.turnId}`}
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
                {resumo(image.caption) && <Typography variant="body2">{resumo(image.caption)}</Typography>}
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </MundoLayout>
  );
}
