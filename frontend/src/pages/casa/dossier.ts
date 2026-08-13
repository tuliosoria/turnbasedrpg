import {
  HOUSE_CANON, HOUSE_CHARACTERS, LEADER_PERSONAS, SEATS,
  isDeadInChronicle, mentionsHouse,
  type HouseCanon, type HouseCharacter, type LeaderPersona, type Seat,
} from "@ravenloft/content";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";
import type { WikiEntry } from "../../types/api";

/**
 * Reúne, para uma Casa, tudo que o cânone e o acervo têm sobre ela.
 *
 * Fica separado do componente porque a parte difícil não é desenhar: é decidir
 * quem está vivo, quais imagens pertencem a esta Casa e quais verbetes falam
 * dela. Isso é testável; JSX não precisa ser.
 */

export interface HouseFigure extends HouseCharacter {
  /** Derivado da crônica desta campanha, nunca do cânone do mundo. */
  dead: boolean;
}

export interface HouseDossier {
  key: string;
  seat: Seat;
  canon: HouseCanon | null;
  leader: (LeaderPersona & { dead: boolean }) | null;
  figures: HouseFigure[];
  emblemUrl: string | null;
  images: VisualAsset[];
  articles: WikiEntry[];
}

export function knownHouseKeys(): string[] {
  return SEATS.map((s) => s.key);
}

export function buildDossier(
  houseKey: string,
  input: { assets: VisualAsset[]; entities: VisualEntity[]; wiki: WikiEntry[]; chronicle: string },
): HouseDossier | null {
  const seat = SEATS.find((s) => s.key === houseKey);
  if (!seat) return null;

  const persona = LEADER_PERSONAS[houseKey] ?? null;
  const figures = (HOUSE_CHARACTERS[houseKey] ?? []).map((c) => ({
    ...c,
    dead: isDeadInChronicle(c.name, input.chronicle),
  }));

  // O emblema tem id previsível porque foi sempre gerado pelo mesmo script.
  const emblem = input.assets.find((a) => a.entityId === `emblem-${houseKey}`);

  // As demais imagens chegam pela entidade retratada, que leva o nome da Casa
  // ou o da cidade-sede — nunca a chave.
  const entityNames = new Map(input.entities.map((e) => [e.id, e.canonicalName]));
  const images = input.assets.filter(
    (a) =>
      a.id !== emblem?.id &&
      a.entityId !== `emblem-${houseKey}` &&
      mentionsHouse(entityNames.get(a.entityId ?? "") ?? a.entityId, houseKey),
  );

  const articles = input.wiki.filter((w) => mentionsHouse(w.title, houseKey));

  return {
    key: houseKey,
    seat,
    canon: HOUSE_CANON[houseKey] ?? null,
    leader: persona ? { ...persona, dead: isDeadInChronicle(persona.leaderName, input.chronicle) } : null,
    figures,
    emblemUrl: emblem?.storageUrl ?? null,
    images,
    articles,
  };
}

/** "155.000 habitantes", com o separador que o cânone usa. */
export function formatPopulation(value: number | null): string {
  if (value === null) return "não recenseada";
  return `${value.toLocaleString("pt-BR")} habitantes`;
}
