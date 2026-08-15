import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fullCodex, SEATS, seatKeyForAffiliation, type NpcIdentity } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { Layout } from "../../components/Layout";
import { portraitEntityId } from "./portraitEntityId";

/**
 * O elenco de Valdren, agrupado por Casa/Organização. Os personagens de maior
 * peso (Major) já têm retrato canônico; os demais entram com um marcador de
 * iniciais até ganharem imagem. O texto vem do Codex (client-side), então a
 * lista aparece inteira mesmo se o acervo de imagens não responder.
 */
export function PersonagensIndexPage() {
  const api = useApi();
  const [portraits, setPortraits] = useState<Record<string, string>>({});

  const cast = useMemo(() => {
    const npcs = fullCodex();
    const bySeat = new Map<string, NpcIdentity[]>();
    for (const seat of SEATS) bySeat.set(seat.key, []);
    for (const npc of npcs) {
      const seatKey = seatKeyForAffiliation(npc.affiliation);
      (bySeat.get(seatKey) ?? bySeat.set(seatKey, []).get(seatKey)!).push(npc);
    }
    for (const list of bySeat.values()) {
      list.sort((a, b) => (a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier === "MAJOR" ? -1 : 1));
    }
    return bySeat;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const assets = await api.getVisualGallery();
      const found: Record<string, string> = {};
      for (const a of assets) {
        if (a.assetType === "PORTRAIT" && a.entityId) found[a.entityId] = a.thumbnailUrl ?? a.storageUrl;
      }
      setPortraits(found);
    } catch {
      // Sem retratos o índice ainda funciona: mostra as iniciais.
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const initials = (name: string) =>
    name.replace(/^(Lorde|Lady|Ser|Mestra?|Príncipe|Princesa)\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

  return (
    <Layout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Personagens de Valdren</Typography>
          <Typography variant="body2" color="text.secondary">
            Quem move o reino — líderes, magos e mãos por trás de cada Casa e Ordem.
          </Typography>
        </Box>

        {SEATS.map((seat) => {
          const people = cast.get(seat.key) ?? [];
          if (people.length === 0) return null;
          return (
            <Box key={seat.key}>
              <Typography variant="overline" color="text.secondary">{seat.name}</Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, mt: 0.5 }}>
                {people.map((npc) => {
                  const thumb = portraits[portraitEntityId(npc.id)];
                  return (
                    <Card key={npc.id} variant="outlined">
                      <CardActionArea component={RouterLink} to={`/personagens/${npc.id}`}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5 }}>
                          <Avatar src={thumb} alt={npc.name} sx={{ width: 56, height: 56 }}>
                            {initials(npc.name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography variant="subtitle2" noWrap>{npc.name}</Typography>
                              {npc.tier === "MAJOR" && <Chip label="principal" size="small" variant="outlined" />}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              {npc.role}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Layout>
  );
}
