import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fullCodex, SEATS, seatKeyForAffiliation, seatKeyForHouseId, type NpcIdentity, type VisualEntity } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { Layout } from "../../components/Layout";
import { portraitEntityId } from "./portraitEntityId";

/** Uma carta do elenco, venha ela do Codex ou do cânone aprovado pelo Mestre. */
interface CastMember {
  id: string;
  name: string;
  role: string;
  major: boolean;
  /** Id da entidade visual que carrega o retrato. */
  portraitId: string;
  fromCanon: boolean;
}

/** A sede sob a qual entram os personagens do cânone sem Casa reconhecível. */
const UNSEATED_KEY = "__canone__";
const UNSEATED_NAME = "Outros nomes do cânone";

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function fromCodex(npc: NpcIdentity): CastMember {
  return {
    id: npc.id,
    name: npc.name,
    role: npc.role,
    major: npc.tier === "MAJOR",
    portraitId: portraitEntityId(npc.id),
    fromCanon: false,
  };
}

function fromEntity(entity: VisualEntity): CastMember {
  return {
    id: entity.id,
    name: entity.canonicalName,
    role: entity.publicDescription,
    major: false,
    portraitId: entity.id,
    fromCanon: true,
  };
}

/**
 * O elenco de Valdren, agrupado por Casa/Organização. Os personagens de maior
 * peso (Major) já têm retrato canônico; os demais entram com um marcador de
 * iniciais até ganharem imagem. O texto vem do Codex (client-side), então a
 * lista aparece inteira mesmo se o acervo de imagens não responder.
 *
 * Ao Codex somam-se os personagens que os jogadores propuseram e o Mestre
 * aprovou pelo Adicionar Canônico: a aprovação cria uma entidade visual com
 * `wikiEntryId`, e é esse campo que os distingue das entidades seedadas para os
 * NPCs do Codex. Sem isso o jogador aprovava um personagem e não o via em lugar
 * nenhum do elenco.
 */
export function PersonagensIndexPage() {
  const api = useApi();
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [canon, setCanon] = useState<VisualEntity[]>([]);

  const cast = useMemo(() => {
    const npcs = fullCodex();
    const bySeat = new Map<string, CastMember[]>();
    for (const seat of SEATS) bySeat.set(seat.key, []);
    const push = (key: string, member: CastMember) => {
      const list = bySeat.get(key) ?? bySeat.set(key, []).get(key)!;
      list.push(member);
    };

    for (const npc of npcs) push(seatKeyForAffiliation(npc.affiliation), fromCodex(npc));

    // Um verbete aprovado sobre alguém que já está no Codex não vira uma segunda
    // carta: é a mesma pessoa, e o texto novo vive na Enciclopédia.
    const known = new Set(npcs.map((n) => fold(n.name)));
    for (const entity of canon) {
      if (known.has(fold(entity.canonicalName))) continue;
      const seatKey = (entity.houseId ? seatKeyForHouseId(entity.houseId) : null) ?? UNSEATED_KEY;
      push(seatKey, fromEntity(entity));
    }

    for (const list of bySeat.values()) {
      list.sort((a, b) => (a.major === b.major ? a.name.localeCompare(b.name) : a.major ? -1 : 1));
    }
    return bySeat;
  }, [canon]);

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
    try {
      const entities = await api.listVisualEntities();
      setCanon(entities.filter((e) => e.entityType === "CHARACTER" && Boolean(e.wikiEntryId)));
    } catch {
      // Sem o acervo o elenco do Codex ainda aparece inteiro.
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

        {[...SEATS, { key: UNSEATED_KEY, name: UNSEATED_NAME }].map((seat) => {
          const people = cast.get(seat.key) ?? [];
          if (people.length === 0) return null;
          return (
            <Box key={seat.key}>
              <Typography variant="overline" color="text.secondary">{seat.name}</Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, mt: 0.5 }}>
                {people.map((npc) => {
                  const thumb = portraits[npc.portraitId];
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
                              {npc.major && <Chip label="principal" size="small" variant="outlined" />}
                              {npc.fromCanon && <Chip label="do cânone" size="small" variant="outlined" color="primary" />}
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
