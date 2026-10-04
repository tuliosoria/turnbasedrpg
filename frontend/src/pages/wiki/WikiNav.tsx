import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { WIKI_GROUPS, wikiSectionLabel } from "@ravenloft/content";

/** Só grupos com seção povoada: uma seção vazia no índice é uma promessa que a wiki não cumpre. */
export function WikiNav({ current, populated }: { current: string; populated: Set<string> }) {
  return (
    <Box component="nav" aria-label="Seções da crônica">
      {WIKI_GROUPS.map((group) => {
        const sections = group.sections.filter((id) => populated.has(id));
        if (sections.length === 0) return null;

        return (
          <Box key={group.id} sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              component="h2"
              sx={{ display: "block", px: 2, mb: 0.5 }}
            >
              {group.label}
            </Typography>
            <List dense disablePadding>
              {sections.map((id) => {
                const active = id === current;
                return (
                  <ListItem key={id} disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={`/valdren/${id}`}
                      selected={active}
                      sx={{
                        borderLeft: 2,
                        borderColor: active ? "primary.main" : "transparent",
                        "&.Mui-selected": { backgroundColor: "action.hover" },
                      }}
                    >
                      <ListItemText
                        primary={wikiSectionLabel(id)}
                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight: active ? 700 : 400,
                              color: active ? "text.primary" : "text.secondary",
                            },
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        );
      })}
    </Box>
  );
}
