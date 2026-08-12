import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WIKI_SECTIONS, wikiSectionLabel, type WikiEntry } from "@ravenloft/content";

export interface UnlinkedEntity {
  id: string;
  canonicalName: string;
}

/** Case- and accent-insensitive key used to compare a name against a title. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/**
 * Wiki titles are written `Nome — Epíteto`. A plain hyphen only separates when
 * it is surrounded by spaces: "Khar-Durak" and "Sahra-Lun" are single names and
 * must never be cut down to "Khar" or "Sahra".
 */
const EPITHET_SEPARATOR = /\s*[—–]\s*|\s+-\s+/;

function titleHead(title: string): string {
  const at = title.search(EPITHET_SEPARATOR);
  return (at === -1 ? title : title.slice(0, at)).trim();
}

/**
 * The keys an entity name may legitimately be known by, most specific first.
 * Seeded names carry the alternate name in parentheses — "Euralune (Ninho
 * Alto)", "Solarion (Sahra-Lun)" — and the wiki files those cities under the
 * parenthetical, not the outer name.
 */
function nameKeys(name: string): string[] {
  const keys: string[] = [];
  const push = (candidate: string) => {
    const key = fold(candidate);
    if (key && !keys.includes(key)) keys.push(key);
  };
  push(name);
  const parenthetical = /^([^()]+)\(([^()]+)\)\s*$/.exec(name.trim());
  if (parenthetical) {
    push(parenthetical[1]);
    push(parenthetical[2]);
  }
  return keys;
}

/**
 * Deliberately strict: every comparison is an exact match of folded text, never
 * a fuzzy score, and a key matching more than one entry yields nothing at all. A
 * wrong auto-link silently attaches an entity's whole visual canon to the wrong
 * piece of lore, which is far more expensive to notice and undo than the author
 * picking the entry by hand. What it does allow is the two shapes the real data
 * uses: the wiki's `Nome — Epíteto` titles, and the seed's parenthetical names.
 */
export function suggestMatch(name: string, entries: WikiEntry[]): WikiEntry | null {
  for (const key of nameKeys(name)) {
    for (const project of [(e: WikiEntry) => e.title, (e: WikiEntry) => titleHead(e.title)]) {
      const hits = entries.filter((e) => fold(project(e)) === key);
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) return null;
    }
  }
  return null;
}

const SECTION_ORDER = new Map(WIKI_SECTIONS.map((s, i) => [s.id, i]));

/** Grouped picker options: 100+ flat titles are unusable to scan. */
function pickerOptions(entries: WikiEntry[]): WikiEntry[] {
  return [...entries].sort(
    (a, b) =>
      (SECTION_ORDER.get(a.section) ?? Number.MAX_SAFE_INTEGER) -
        (SECTION_ORDER.get(b.section) ?? Number.MAX_SAFE_INTEGER) ||
      a.section.localeCompare(b.section, "pt-BR") ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}

interface ReconciliacaoPanelProps {
  unlinked: UnlinkedEntity[];
  entries: WikiEntry[];
  onLink: (entityId: string, wikiEntryId: string) => void;
}

export function ReconciliacaoPanel({ unlinked, entries, onLink }: ReconciliacaoPanelProps) {
  if (unlinked.length === 0) return null;

  const options = pickerOptions(entries);

  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle1">Entidades sem verbete</Typography>
      <Typography variant="caption" color="text.secondary">
        Estas entidades visuais ainda não apontam para nenhum verbete da enciclopédia.
      </Typography>
      <List dense>
        {unlinked.map((entity) => {
          const match = suggestMatch(entity.canonicalName, entries);
          return (
            <ListItem
              key={entity.id}
              disableGutters
              sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}
            >
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: "30%" }}>
                {entity.canonicalName}
              </Typography>

              {match && (
                <Button size="small" variant="outlined" onClick={() => onLink(entity.id, match.entryId)}>
                  {`Vincular a ${match.title}`}
                </Button>
              )}

              {/* Always offered. The matcher is conservative by design, so most
                  entities get no suggestion, and without a manual path the panel
                  would just report the problem it exists to solve. */}
              <Autocomplete
                size="small"
                sx={{ minWidth: 260, flexGrow: match ? 0 : 1 }}
                options={options}
                groupBy={(o) => wikiSectionLabel(o.section)}
                getOptionLabel={(o) => o.title}
                isOptionEqualToValue={(a, b) => a.entryId === b.entryId}
                value={null}
                blurOnSelect
                onChange={(_, chosen) => {
                  if (chosen) onLink(entity.id, chosen.entryId);
                }}
                noOptionsText="Nenhum verbete encontrado"
                renderInput={(params) => (
                  <TextField {...params} label={match ? "Vincular a outro verbete" : "Escolher verbete"} />
                )}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
