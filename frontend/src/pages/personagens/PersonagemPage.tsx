import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fullCodex, SEATS, seatKeyForAffiliation, seatKeyForHouseId, type NpcIdentity, type VisualEntity, type WikiEntry } from "@ravenloft/content";
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
  const [canon, setCanon] = useState<VisualEntity | null>(null);
  const [canonEntry, setCanonEntry] = useState<WikiEntry | null>(null);
  // Até a busca do cânone terminar não sabemos se o id é desconhecido ou apenas
  // ainda não carregou, e anunciar "não encontrado" antes disso pisca em falso.
  const [loading, setLoading] = useState(true);

  const npc = useMemo(() => fullCodex().find((n) => n.id === id) ?? null, [id]);
  const seatName = useMemo(() => {
    const key = npc ? seatKeyForAffiliation(npc.affiliation) : canon?.houseId ? seatKeyForHouseId(canon.houseId) : null;
    if (!key) return npc?.affiliation ?? "";
    return SEATS.find((s) => s.key === key)?.name ?? npc?.affiliation ?? "";
  }, [npc, canon]);

  const load = useCallback(async () => {
    // O Codex é a fonte dos NPCs autorados; quem não está nele pode ser um
    // personagem que um jogador propôs e o Mestre aprovou pelo Adicionar
    // Canônico, e nesse caso a ficha vem da entidade visual e do verbete.
    const entityId = npc ? portraitEntityId(npc.id) : id;
    let entity: VisualEntity | null = null;
    let entry: WikiEntry | null = null;
    if (!npc) {
      try {
        entity = await api.getVisualEntity(id);
        if (entity.wikiEntryId) {
          try {
            const entries = await api.getWiki();
            entry = entries.find((e) => e.entryId === entity!.wikiEntryId) ?? null;
          } catch {
            // Sem o verbete a ficha ainda mostra nome, retrato e resumo.
          }
        }
      } catch {
        // Id que não é do Codex nem do acervo: cai no "não encontrado".
      }
    }

    let portraitUrl: string | null = null;
    try {
      const assets = await api.getVisualEntityAssets(entityId);
      const portraitAsset = assets.find((a) => a.assetType === "PORTRAIT") ?? assets[0];
      portraitUrl = portraitAsset ? portraitAsset.storageUrl : null;
    } catch {
      // Sem retrato a ficha ainda vale: mostra só o texto.
    }
    return { entity, entry, portraitUrl };
  }, [api, npc, id]);

  useEffect(() => {
    // A rota não troca de instância entre uma ficha e outra, então o estado da
    // anterior precisa sair de cena: sem isso um NPC do Codex herdaria o
    // verbete do personagem do cânone visitado antes.
    let current = true;
    setCanon(null);
    setCanonEntry(null);
    setPortrait(null);
    setLoading(true);
    void load().then(({ entity, entry, portraitUrl }) => {
      if (!current) return;
      setCanon(entity);
      setCanonEntry(entry);
      setPortrait(portraitUrl);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [load]);

  if (!npc && !canon) {
    return (
      <Layout>
        <Stack spacing={2}>
          <Typography variant="h5">{loading ? "Carregando…" : "Personagem não encontrado"}</Typography>
          <Button component={RouterLink} to="/personagens" variant="outlined" sx={{ alignSelf: "flex-start" }}>
            Voltar aos personagens
          </Button>
        </Stack>
      </Layout>
    );
  }

  const name = npc?.name ?? canon!.canonicalName;
  const role = npc?.role ?? canon!.publicDescription;

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
              <Box component="img" src={portrait} alt={name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                Retrato em breve
              </Typography>
            )}
          </Box>

          <Stack spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4">{name}</Typography>
                {npc?.tier === "MAJOR" && <Chip label="principal" size="small" color="primary" variant="outlined" />}
                {canon && <Chip label="do cânone" size="small" color="primary" variant="outlined" />}
              </Stack>
              <Typography variant="subtitle1" color="text.secondary">{role}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {seatName && <Chip label={seatName} size="small" />}
                {npc?.location && <Chip label={npc.location} size="small" variant="outlined" />}
              </Stack>
            </Box>

            <Divider />

            {npc
              ? FIELDS.map(({ key, label }) => {
                  const value = String(npc[key] ?? "").trim();
                  if (!value) return null;
                  return (
                    <Box key={key}>
                      <Typography variant="overline" color="text.secondary">{label}</Typography>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  );
                })
              : null}

            {canonEntry && (
              <Box>
                <Typography variant="overline" color="text.secondary">Verbete</Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{canonEntry.body}</Typography>
                <Button
                  component={RouterLink}
                  to={`/valdren/${canonEntry.section}`}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Ver na Enciclopédia
                </Button>
              </Box>
            )}

            {canon && !canonEntry && canon.immutableTraits.length > 0 && (
              <Box>
                <Typography variant="overline" color="text.secondary">Traços</Typography>
                <Typography variant="body1">{canon.immutableTraits.map((t) => t.text).join(" · ")}</Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
    </Layout>
  );
}
