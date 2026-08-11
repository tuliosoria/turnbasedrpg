import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../../components/LoadingState";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";

export function EntidadesTab() {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisualEntity | null>(null);
  const [assets, setAssets] = useState<VisualAsset[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntities(await api.listVisualEntities());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar entidades.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(
    async (entity: VisualEntity) => {
      setSelected(entity);
      setAssets([]);
      try {
        setAssets(await api.getVisualEntityAssets(entity.id));
      } catch {
        setAssets([]);
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

  if (!entities) {
    return <LoadingState />;
  }

  if (entities.length === 0) {
    return <Typography>Nenhuma entidade cadastrada ainda.</Typography>;
  }

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        {entities.map((entity) => (
          <Card key={entity.id}>
            <CardActionArea onClick={() => void open(entity)}>
              <CardContent>
                <Typography variant="h6">{entity.canonicalName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {entity.publicDescription}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.canonicalName}</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>{selected.publicDescription}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {assets.map((asset) => (
                  <Card key={asset.id}>
                    <CardMedia
                      component="img"
                      image={asset.thumbnailUrl ?? asset.storageUrl}
                      alt={asset.description}
                      sx={{ aspectRatio: "3/2", objectFit: "cover" }}
                    />
                  </Card>
                ))}
              </Box>
              {assets.length === 0 && <Typography color="text.secondary">Sem imagens para esta entidade.</Typography>}
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
