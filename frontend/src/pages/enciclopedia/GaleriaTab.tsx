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
import Chip from "@mui/material/Chip";
import CardActions from "@mui/material/CardActions";
import { loadAdminToken } from "../../auth/adminSession";
import type { VisualAsset, VisualStyleBible } from "@ravenloft/content";

interface GaleriaTabProps {
  isAdmin?: boolean;
}

export function GaleriaTab({ isAdmin = false }: GaleriaTabProps) {
  const api = useApi();
  const [assets, setAssets] = useState<VisualAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisualAsset | null>(null);
  const [bible, setBible] = useState<VisualStyleBible | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gallery, styleBible] = await Promise.all([
        api.getVisualGallery(),
        api.getVisualStyleBible().catch(() => null),
      ]);
      setAssets(gallery);
      setBible(styleBible);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a galeria.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // A reference image constrains palette and lighting far more reliably than
  // any wording in the prompt, so the gallery is where it gets designated —
  // the author is already looking at the image they consider on-model.
  const setStyleReference = useCallback(
    async (assetId: string) => {
      const token = loadAdminToken();
      if (!token) return;
      setSaving(assetId);
      try {
        setBible(await api.updateVisualStyleBible(token, { referenceAssetIds: [assetId] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao definir a referência de estilo.");
      } finally {
        setSaving(null);
      }
    },
    [api],
  );

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

  const hasReference = (bible?.referenceAssetIds.length ?? 0) > 0;

  return (
    <>
      {!hasReference && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nenhuma imagem definida como referência de estilo. A consistência entre imagens depende apenas do texto até que uma seja escolhida.
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        {assets.map((asset) => {
          const isReference = bible?.referenceAssetIds.includes(asset.id) ?? false;
          return (
            <Card key={asset.id}>
              <CardActionArea onClick={() => setSelected(asset)}>
                <CardMedia
                  component="img"
                  image={asset.thumbnailUrl ?? asset.storageUrl}
                  alt={asset.description}
                  sx={{ aspectRatio: "3/2", objectFit: "cover" }}
                />
              </CardActionArea>
              <CardActions>
                {isReference ? (
                  <Chip size="small" color="primary" label="Referência de estilo" />
                ) : (
                  isAdmin && (
                    <Button
                      size="small"
                      disabled={saving === asset.id}
                      onClick={() => void setStyleReference(asset.id)}
                    >
                      Usar como referência de estilo
                    </Button>
                  )
                )}
              </CardActions>
            </Card>
          );
        })}
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
