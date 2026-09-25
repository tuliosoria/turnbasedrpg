import { useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { MundoLayout, useWikiDoMundo } from "../../components/MundoLayout";
import { LoadingState } from "../../components/LoadingState";
import { WikiMarkdown } from "../../components/WikiMarkdown";
import { houseProfileFor, type VisualAsset, type VisualEntity } from "@ravenloft/content";
import { buildDossier, formatPopulation, knownHouseKeys } from "./dossier";

/** Um dado do dossiê, omitido quando o cânone não o traz. */
function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{value}</Typography>
    </Box>
  );
}

export function CasaPage() {
  const { chave } = useParams<{ chave: string }>();
  const known = useMemo(() => knownHouseKeys(), []);
  if (!chave || !known.includes(chave)) return <Navigate to="/casas" replace />;

  return (
    <MundoLayout>
      <CasaConteudo chave={chave} />
    </MundoLayout>
  );
}

/**
 * Galeria, entidades e crônica continuam desta página.
 *
 * A wiki não: a casca já a baixou para a barra. A galeria fica de fora da
 * casca de propósito — livro e histórias não precisam dela.
 */
function CasaConteudo({ chave }: { chave: string }) {
  const api = useApi();
  const { entries, falhou } = useWikiDoMundo();
  const perfil = houseProfileFor(chave);
  const [acervo, setAcervo] = useState<{ assets: VisualAsset[]; entities: VisualEntity[]; chronicle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setAcervo(null);
    setError(null);
    Promise.all([api.getVisualGallery(), api.listVisualEntities(), api.getChronicle()])
      .then(([assets, entities, chronicle]) => {
        if (vivo) setAcervo({ assets, entities, chronicle });
      })
      .catch(() => {
        if (vivo) setError("Não foi possível carregar o dossiê desta Casa.");
      });
    return () => {
      vivo = false;
    };
  }, [api, chave]);

  const dossier = useMemo(() => {
    if (!acervo || !entries) return null;
    return buildDossier(chave, { ...acervo, wiki: entries });
  }, [acervo, entries, chave]);

  if (error || falhou) {
    return <Alert severity="error">Não foi possível carregar o dossiê desta Casa.</Alert>;
  }
  if (!dossier) {
    return <LoadingState label="Reunindo o dossiê da Casa…" />;
  }

  const { seat, canon, leader, figures, emblemUrl, images, articles } = dossier;

  return (
    <>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
          {emblemUrl && (
            <Box
              component="img"
              src={emblemUrl}
              alt={`Brasão da ${seat.name}`}
              sx={{ width: 160, height: 160, objectFit: "contain", flexShrink: 0 }}
            />
          )}
          <Box>
            <Typography variant="h4">{seat.name}</Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Sede em {seat.seat}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
              <Chip size="small" label={formatPopulation(canon?.population ?? null)} />
              {canon?.sustainableTroops && (
                <Chip size="small" variant="outlined" label={`${canon.sustainableTroops.toLocaleString("pt-BR")} soldados sustentáveis`} />
              )}
              {canon?.emergencyTroops && (
                <Chip size="small" variant="outlined" label={`${canon.emergencyTroops.toLocaleString("pt-BR")} em emergência`} />
              )}
            </Stack>
          </Box>
        </Stack>

        {leader && (
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Quem responde pela Casa</Typography>
              <Typography variant="h6">
                {leader.leaderName}
                {leader.dead && <Chip size="small" color="default" label="morto" sx={{ ml: 1 }} />}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>{leader.title}</Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Fact label="Temperamento" value={leader.temperament} />
                <Fact label="Nunca aceitará" value={leader.refuses} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* O que os números da Casa realmente significam. É a informação que
            decide uma negociação: quem tem ferro e não tem trigo precisa
            conversar com quem planta, goste ou não. */}
        {perfil && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>O que a Casa tem</Typography>
              <Stack spacing={1.5}>
                <Fact label="Riqueza" value={perfil.wealth} />
                <Fact label="Recursos" value={perfil.resources} />
                <Fact label="Soldados" value={perfil.soldiers} />
                <Fact label="Controle" value={perfil.control} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {canon && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Território e povo</Typography>
              <Stack spacing={1.5}>
                <Fact label="Região" value={canon.region} />
                <Fact label="Cidades" value={canon.mainCity} />
                <Fact label="Quem vive lá" value={canon.society} />
                <Fact label="Capacidade militar" value={canon.military} />
                <Fact label="Pressão demográfica" value={canon.demographicPressure} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {figures.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>Figuras importantes</Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              {figures.map((f) => (
                <Card key={f.name}>
                  <CardContent>
                    <Typography variant="subtitle1">
                      {f.name}
                      {f.dead && <Chip size="small" label="morto" sx={{ ml: 1 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{f.role}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>{f.description}</Typography>
                    <Divider sx={{ my: 1.5 }} />
                    {/*
                      O que a figura quer e o que ela esconde saíram daqui: são
                      dado do Mestre, e antecipá-los tornava o jogo previsível.
                      A história pública dela vive na ficha.
                    */}
                    <Link component={RouterLink} to={`/personagens/${f.npcId}`} variant="body2">
                      Ver a história
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {images.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>Imagens canônicas</Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              {images.map((a) => (
                <Box
                  key={a.id}
                  component="img"
                  src={a.thumbnailUrl ?? a.storageUrl}
                  alt={`Imagem canônica da ${seat.name}`}
                  sx={{ width: "100%", borderRadius: 1 }}
                />
              ))}
            </Box>
          </Box>
        )}

        {articles.map((a) => (
          <Card key={a.title}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{a.title}</Typography>
              <WikiMarkdown body={a.body} />
            </CardContent>
          </Card>
        ))}

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Link component={RouterLink} to="/casas">Todas as Casas de Valdren</Link>
          <Link component={RouterLink} to="/valdren/casas">As Casas na crônica</Link>
        </Stack>
      </Stack>
    </>
  );
}
