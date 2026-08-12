import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  WIKI_SECTIONS,
  type VisualEntity,
  type VisualEntityType,
  type WikiEntry,
} from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import type { UpdateVisualEntityInput } from "../../api/client";
import { loadAdminToken } from "../../auth/adminSession";
import { LoadingState } from "../../components/LoadingState";
import { CanonSheet } from "./CanonSheet";
import { ReconciliacaoPanel } from "./ReconciliacaoPanel";

/**
 * A promoted entry's type is fixed at creation — the update endpoint does not
 * accept entityType — so we derive the best guess available instead of picking
 * one blindly. The section is the only structured signal the wiki carries, but
 * the signal is only as good as the section's real contents, so every key below
 * is justified against shared/src/defaultWiki.ts rather than against the
 * section's label. Everything else falls back to SCENE, which is what
 * illustrating an abstract topic ("Idiomas", "Rumores") actually produces. The
 * type only feeds a "Tipo de imagem" line in the prompt, so a bad guess degrades
 * the prompt rather than the canon — but it degrades it permanently.
 *
 * Deliberately absent, despite the label naming a kind of thing:
 *  - povos: five entries, all cultural topics (Idiomas, Alimentação, Família e
 *    herança, Educação, Justiça cotidiana). Not one is an ancestry.
 *  - calendario: the calendar, the week and lists of festivals — recurring
 *    institutions, not the single occurrences EVENT implies.
 *  - magia: six entries, of which only "Ordem dos Três" is an order; HOUSE would
 *    mistype the other five to fix one.
 *  - criaturas, mortos-vivos, historias: no entries at all in the wiki.
 */
const SECTION_ENTITY_TYPE: Record<string, VisualEntityType> = {
  casas: "HOUSE",
  religioes: "HOUSE",
  "os-magos": "HOUSE",
  cidades: "CITY",
  geografia: "REGION",
  brumas: "REGION",
  guerras: "EVENT",
  expedicao: "EVENT",
  "crise-atual": "EVENT",
};

export function entityTypeForSection(section: string): VisualEntityType {
  return SECTION_ENTITY_TYPE[section] ?? "SCENE";
}

/** Ordered by WIKI_SECTIONS; empty sections would render an empty, broken-looking tab. */
export function firstPopulatedSection(entries: WikiEntry[]): string | null {
  const populated = new Set(entries.map((e) => e.section));
  return WIKI_SECTIONS.find((s) => populated.has(s.id))?.id ?? null;
}

const SUMMARY_MAX = 280;

/**
 * Wiki bodies open with a markdown metadata blockquote and headings, so a raw
 * prefix of the body is unusable both as a card subtitle and as prompt input.
 * We take the first real prose paragraph instead, capped on a word boundary:
 * enough to seed the field the author edits in the canon sheet straight after
 * promoting, without dumping pages of lore into a prompt-facing description.
 */
export function loreSummary(body: string): string {
  const paragraph = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !/^[>#\-*|\d]/.test(p));
  if (!paragraph) return "";

  const clean = paragraph
    .replace(/\s*\n\s*/g, " ")
    .replace(/\*\*|__|[*_`]/g, "")
    .trim();
  if (clean.length <= SUMMARY_MAX) return clean;

  const cut = clean.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}…`;
}

interface AcervoTabProps {
  isAdmin: boolean;
}

export function AcervoTab({ isAdmin }: AcervoTabProps) {
  const api = useApi();
  const [entries, setEntries] = useState<WikiEntry[] | null>(null);
  const [entities, setEntities] = useState<VisualEntity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [wiki, visual] = await Promise.all([api.getWiki(), api.listVisualEntities()]);
      setEntries(wiki);
      setEntities(visual);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o acervo.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  /** wikiEntryId -> the visual entity that claims it. */
  const byEntryId = useMemo(() => {
    const map = new Map<string, VisualEntity>();
    for (const entity of entities ?? []) {
      if (entity.wikiEntryId) map.set(entity.wikiEntryId, entity);
    }
    return map;
  }, [entities]);

  const sections = useMemo(() => {
    const populated = new Set((entries ?? []).map((e) => e.section));
    return WIKI_SECTIONS.filter((s) => populated.has(s.id));
  }, [entries]);

  const activeSection = section ?? firstPopulatedSection(entries ?? []);

  const visible = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => e.section === activeSection)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR")),
    [entries, activeSection],
  );

  const unlinked = useMemo(
    () =>
      (entities ?? [])
        .filter((e) => !e.wikiEntryId)
        .map((e) => ({ id: e.id, canonicalName: e.canonicalName })),
    [entities],
  );

  const upsert = useCallback((entity: VisualEntity) => {
    setEntities((prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((e) => e.id === entity.id);
      if (idx === -1) return [...list, entity];
      return [...list.slice(0, idx), entity, ...list.slice(idx + 1)];
    });
  }, []);

  const promote = useCallback(
    async (entry: WikiEntry) => {
      const token = loadAdminToken();
      if (!token || busy) return;
      setBusy(true);
      setError(null);
      try {
        const created = await api.createVisualEntity(token, {
          canonicalName: entry.title,
          entityType: entityTypeForSection(entry.section),
          publicDescription: loreSummary(entry.body),
          wikiEntryId: entry.entryId,
        });
        upsert(created);
        setSelectedId(created.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao criar a entidade visual.");
      } finally {
        setBusy(false);
      }
    },
    [api, busy, upsert],
  );

  const saveCanon = useCallback(
    async (entityId: string, patch: UpdateVisualEntityInput) => {
      const token = loadAdminToken();
      if (!token) return;
      setBusy(true);
      try {
        upsert(await api.updateVisualEntity(token, entityId, patch));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao salvar o cânone.");
      } finally {
        setBusy(false);
      }
    },
    [api, upsert],
  );

  const link = useCallback(
    (entityId: string, wikiEntryId: string) => void saveCanon(entityId, { wikiEntryId }),
    [saveCanon],
  );

  if (error && !entries) {
    return (
      <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>
        {error}
      </Alert>
    );
  }

  if (!entries || !entities) return <LoadingState />;

  const selected = entities.find((e) => e.id === selectedId) ?? null;

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Cada verbete da enciclopédia pode ganhar um cânone visual — a descrição que toda imagem
          futura precisa respeitar.
        </Typography>
        <Typography variant="subtitle2">
          {`${entries.filter((e) => byEntryId.has(e.entryId)).length} de ${entries.length} verbetes com cânone visual`}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
        {sections.map((s) => (
          <Button
            key={s.id}
            size="small"
            variant={s.id === activeSection ? "contained" : "outlined"}
            aria-pressed={s.id === activeSection}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </Stack>

      <List disablePadding>
        {visible.map((entry) => {
          const entity = byEntryId.get(entry.entryId);
          return (
            <ListItem
              key={entry.entryId}
              divider
              sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}
            >
              <Typography variant="body1" sx={{ flexGrow: 1, minWidth: "40%" }}>
                {entry.title}
              </Typography>
              <Chip size="small" variant="outlined" label="lore ✓" />
              <Chip
                size="small"
                color={entity ? "success" : "default"}
                variant="outlined"
                label={entity ? "visual ✓" : "visual ✗"}
              />
              {entity ? (
                <Button size="small" onClick={() => setSelectedId(entity.id)}>
                  Ver cânone visual
                </Button>
              ) : (
                isAdmin && (
                  <Button size="small" disabled={busy} onClick={() => void promote(entry)}>
                    Criar entidade visual
                  </Button>
                )
              )}
            </ListItem>
          );
        })}
        {visible.length === 0 && (
          <Typography color="text.secondary">Nenhum verbete nesta seção.</Typography>
        )}
      </List>

      {isAdmin && <ReconciliacaoPanel unlinked={unlinked} entries={entries} onLink={link} />}

      <Dialog open={!!selected} onClose={() => setSelectedId(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.canonicalName}</DialogTitle>
            <DialogContent>
              {/* CanonSheet seeds its editing state from props once and never
                  resyncs, so the key must change whenever the entity behind it
                  does. Including the version also remounts it after a save: the
                  server assigns real ids to newly added traits, and re-saving a
                  sheet still holding the client-side "new-N" ids would make the
                  server treat those traits as brand new — resetting their
                  provenance to AUTHORED and dropping their origin asset. */}
              <CanonSheet
                key={`${selected.id}:${selected.version}`}
                entity={selected}
                isAdmin={isAdmin}
                saving={busy}
                onSave={(patch) => void saveCanon(selected.id, patch)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedId(null)}>Fechar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
