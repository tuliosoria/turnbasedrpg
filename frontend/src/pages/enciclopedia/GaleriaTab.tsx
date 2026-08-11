import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../../components/LoadingState";
import type { VisualAsset } from "@ravenloft/content";

export function GaleriaTab() {
  const api = useApi();
  const [assets, setAssets] = useState<VisualAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisualAsset | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssets(await api.getVisualGallery());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a galeria.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>
        {error}
      </Alert>
    );
  }

  if (!assets) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <Typography>Nenhuma imagem canônica ainda.</Typography>;
  }

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        {assets.map((asset) => (
          <Card key={asset.id}>
            <CardActionArea onClick={() => setSelected(asset)}>
              <CardMedia
                component="img"
                image={asset.thumbnailUrl ?? asset.storageUrl}
                alt={asset.description}
                sx={{ aspectRatio: "3/2", objectFit: "cover" }}
              />
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="lg">
        {selected && (
          <Box sx={{ p: 2 }}>
            <Box
              component="img"
              src={selected.storageUrl}
              alt={selected.description}
              sx={{ maxWidth: "100%", display: "block" }}
            />
            <Typography sx={{ mt: 1 }}>{selected.description}</Typography>
          </Box>
        )}
      </Dialog>
    </>
  );
}
