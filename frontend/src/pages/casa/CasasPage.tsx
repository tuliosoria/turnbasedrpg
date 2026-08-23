import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { HOUSE_CANON, SEATS } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { MundoLayout } from "../../components/MundoLayout";
import { formatPopulation } from "./dossier";

/**
 * As dezesseis potências, com brasão, para chegar à página de cada uma.
 *
 * Os brasões vêm do acervo; o resto é cânone compilado, então a lista aparece
 * inteira mesmo se o acervo não responder.
 */
export function CasasPage() {
  const api = useApi();
  const [emblems, setEmblems] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const assets = await api.getVisualGallery();
      const found: Record<string, string> = {};
      for (const a of assets) {
        const key = a.entityId?.startsWith("emblem-") ? a.entityId.slice(7) : null;
        if (key) found[key] = a.thumbnailUrl ?? a.storageUrl;
      }
      setEmblems(found);
    } catch {
      // O brasão é ornamento: sem ele a lista continua utilizável.
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <MundoLayout>
      <Stack spacing={2}>
        <Typography variant="h4">As Casas de Valdren</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr", xl: "repeat(4, 1fr)" } }}>
          {SEATS.map((seat) => (
            <Card key={seat.key}>
              <CardActionArea component={RouterLink} to={`/casa/${seat.key}`}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {emblems[seat.key] && (
                      <Box
                        component="img"
                        src={emblems[seat.key]}
                        alt={`Brasão da ${seat.name}`}
                        sx={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }}
                      />
                    )}
                    <Box>
                      <Typography variant="subtitle1">{seat.name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {seat.seat}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatPopulation(HOUSE_CANON[seat.key]?.population ?? null)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Stack>
    </MundoLayout>
  );
}
