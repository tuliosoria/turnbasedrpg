import { DEFAULT_WIKI_ENTRIES, type DefaultWikiEntry } from "./defaultWiki.js";
import { CAMPAIGN_GUIDE_ENTRIES } from "./lore/dnd/guide.js";

/**
 * What an empty wiki receives: the public encyclopedia plus the campaign
 * guide. Nav already promises `/valdren/campanha-dnd`; without the guide
 * here, that route redirects to the index.
 *
 * DEFAULT_WIKI_ENTRIES stays the generated encyclopedia so regenerate
 * scripts do not have to know about the guide. seedDefaultWiki no-ops
 * once the wiki has any entries — existing campaigns need
 * seed-campaign-guide.mjs.
 */
export const SEED_WIKI_ENTRIES: DefaultWikiEntry[] = [
  ...DEFAULT_WIKI_ENTRIES,
  ...CAMPAIGN_GUIDE_ENTRIES,
];
