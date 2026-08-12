import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Typography from "@mui/material/Typography";
import type { WikiEntry } from "@ravenloft/content";

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
 * Deliberately strict: only an exact title match (ignoring case, accents and
 * surrounding whitespace) counts. A wrong auto-link silently attaches an
 * entity's whole visual canon to the wrong piece of lore, which is far more
 * expensive to notice and undo than the author simply not getting a suggestion.
 */
export function suggestMatch(name: string, entries: WikiEntry[]): WikiEntry | null {
  const key = fold(name);
  if (!key) return null;
  return entries.find((e) => fold(e.title) === key) ?? null;
}

interface ReconciliacaoPanelProps {
  unlinked: UnlinkedEntity[];
  entries: WikiEntry[];
  onLink: (entityId: string, wikiEntryId: string) => void;
}

export function ReconciliacaoPanel({ unlinked, entries, onLink }: ReconciliacaoPanelProps) {
  if (unlinked.length === 0) return null;

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
              secondaryAction={
                match ? (
                  <Button size="small" onClick={() => onLink(entity.id, match.entryId)}>
                    {`Vincular a ${match.title}`}
                  </Button>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sem verbete correspondente
                  </Typography>
                )
              }
            >
              <Typography variant="body2">{entity.canonicalName}</Typography>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
