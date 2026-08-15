import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fullCodex, SEATS, seatKeyForAffiliation, type NpcIdentity } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { Layout } from "../../components/Layout";
import { portraitEntityId } from "./portraitEntityId";

/** Só o que é público sobre o personagem — segredos e linhas vermelhas ficam com o Mestre. */
const FIELDS: { key: keyof NpcIdentity; label: string }[] = [
  { key: "personality", label: "Temperamento" },
  { key: "speechStyle", label: "Como fala" },
  { key: "values", label: "O que valoriza" },
  { key: "ambitions", label: "O que busca" },
];

export function PersonagemPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const [portrait, setPortrait] = useState<string | null>(null);

  const npc = useMemo(() => fullCodex().find((n) => n.id === id) ?? null, [id]);
  const seatName = useMemo(
    () => (npc ? SEATS.find((s) => s.key === seatKeyForAffiliation(npc.affiliation))?.name ?? npc.affiliation : ""),
    [npc],
  );

  const loadPortrait = useCallback(async () => {
    if (!npc) return;
    try {
      const assets = await api.getVisualEntityAssets(portraitEntityId(npc.id));
      const portraitAsset = assets.find((a) => a.assetType === "PORTRAIT") ?? assets[0];
      setPortrait(portraitAsset ? portraitAsset.storageUrl : null);
    } catch {
      // Sem retrato a ficha ainda vale: mostra só o texto.
    }
  }, [api, npc]);

  useEffect(() => {
    void loadPortrait();
  }, [loadPortrait]);

  if (!npc) {
    return (
      <Layout>
        <Stack spacing={2}>
          <Typography variant="h5">Personagem não encontrado</Typography>
          <Button component={RouterLink} to="/personagens" variant="outlined" sx={{ alignSelf: "flex-start" }}>
            Voltar aos personagens
          </Button>
        </Stack>
      </Layout>
    );
  }

  return (
    <Layout>
      <Stack spacing={2}>
        <Button component={RouterLink} to="/personagens" size="small" sx={{ alignSelf: "flex-start" }}>
          ← Personagens
        </Button>

        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 340px) 1fr" }, alignItems: "start" }}>
          <Box
            sx={{
              borderRadius: 2, overflow: "hidden", aspectRatio: "2 / 3",
              bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {portrait ? (
              <Box component="img" src={portrait} alt={npc.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                Retrato em breve
              </Typography>
            )}
          </Box>

          <Stack spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4">{npc.name}</Typography>
                {npc.tier === "MAJOR" && <Chip label="principal" size="small" color="primary" variant="outlined" />}
              </Stack>
              <Typography variant="subtitle1" color="text.secondary">{npc.role}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Chip label={seatName} size="small" />
                {npc.location && <Chip label={npc.location} size="small" variant="outlined" />}
              </Stack>
            </Box>

            <Divider />

            {FIELDS.map(({ key, label }) => {
              const value = String(npc[key] ?? "").trim();
              if (!value) return null;
              return (
                <Box key={key}>
                  <Typography variant="overline" color="text.secondary">{label}</Typography>
                  <Typography variant="body1">{value}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>
    </Layout>
  );
}
