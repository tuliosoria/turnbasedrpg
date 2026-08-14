import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { addressableNpcs, emptyDynamic, SEATS, type NpcDynamic, type NpcIdentity } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";

/**
 * O admin dos Living Characters: ver e editar o estado vivo que o Relationship
 * Engine mantém — humor, objetivo, lealdade, e as relações multidimensionais
 * com sua memória. É onde o Mestre revisa o que a IA gravou depois de um turno
 * e corrige o que estiver fora de tom.
 */
export function AdminLivingTab({ adminToken, busy }: { adminToken: string; busy: boolean }) {
  const npcs = useMemo(() => addressableNpcs().sort((a, b) => a.name.localeCompare(b.name)), []);
  const api = useApi();
  const [selected, setSelected] = useState<NpcIdentity>(npcs[0]);
  const [byKey, setByKey] = useState<Record<string, NpcDynamic>>({});
  const [draft, setDraft] = useState<NpcDynamic>(emptyDynamic(npcs[0].affiliation, npcs[0].id));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const key = (n: { affiliation: string; id: string }) => `${n.affiliation}#${n.id}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.adminListNpcDynamics(adminToken);
      setByKey(Object.fromEntries(list.map((d) => [key(d), d])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os personagens vivos.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Preenche os campos; não zera o "salvo" aqui, senão salvar (que atualiza
  // byKey) apagaria o aviso de sucesso na hora.
  useEffect(() => {
    setDraft(byKey[key(selected)] ?? emptyDynamic(selected.affiliation, selected.id));
  }, [selected, byKey]);

  // O aviso some só ao trocar de personagem.
  useEffect(() => {
    setSaved(false);
  }, [selected]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const state = await api.adminPutNpcDynamic(adminToken, draft);
      setByKey((prev) => ({ ...prev, [key(state)]: state }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }, [api, adminToken, draft]);

  const setRelationSummary = (entity: string, summary: string) => {
    setDraft((d) => ({ ...d, relations: { ...d.relations, [entity]: { ...(d.relations[entity] ?? { trust: 50, respect: 50, fear: 20, resentment: 10, obligation: 20, summary: "" }), summary } } }));
  };

  // Entidades sem relação registrada ainda, para o Mestre poder criar uma —
  // é o que a aba plana fazia com "percepções", agora no modelo rico.
  const [addEntity, setAddEntity] = useState("");
  const missingEntities = SEATS.filter((s) => s.key !== selected.affiliation && !draft.relations[s.key]);
  const addRelation = () => {
    if (!addEntity) return;
    setDraft((d) => ({ ...d, relations: { ...d.relations, [addEntity]: { trust: 50, respect: 50, fear: 20, resentment: 10, obligation: 20, summary: "" } } }));
    setAddEntity("");
  };

  const relationEntries = Object.entries(draft.relations);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        O estado vivo de cada personagem, mantido pelo Relationship Engine a cada turno. Reveja e corrija
        o que estiver fora de tom; deixe em branco para que ele responda só pelo cânone.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        select
        label="Personagem"
        value={key(selected)}
        onChange={(e) => setSelected(npcs.find((n) => key(n) === e.target.value) ?? npcs[0])}
        sx={{ maxWidth: 360 }}
      >
        {npcs.map((n) => (
          <MenuItem key={key(n)} value={key(n)}>
            {n.name} — {n.affiliation}{byKey[key(n)] ? " ·" : ""}
          </MenuItem>
        ))}
      </TextField>

      <TextField label="Humor agora" value={draft.mood} onChange={(e) => setDraft((d) => ({ ...d, mood: e.target.value }))} fullWidth />
      <TextField label="Objetivo imediato" value={draft.objective} onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))} fullWidth multiline minRows={2} />
      <TextField label="Lealdade agora" value={draft.loyalty} onChange={(e) => setDraft((d) => ({ ...d, loyalty: e.target.value }))} fullWidth />
      <TextField label="Nota do Mestre (o que te preocupa)" value={draft.concerns} onChange={(e) => setDraft((d) => ({ ...d, concerns: e.target.value }))} fullWidth multiline minRows={2} />

      <Divider />

      <Box>
        <Typography variant="overline" color="text.secondary">Relações (as dimensões são mantidas pela IA)</Typography>
        {relationEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nenhuma relação registrada ainda.</Typography>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {relationEntries.map(([entity, r]) => (
              <Paper key={entity} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">{entity}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  confiança {r.trust} · respeito {r.respect} · medo {r.fear} · ressentimento {r.resentment} · obrigação {r.obligation}
                </Typography>
                <TextField
                  label="Resumo (o que a IA usa no roleplay)"
                  value={r.summary}
                  onChange={(e) => setRelationSummary(entity, e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                />
              </Paper>
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
          <TextField
            select
            size="small"
            label="Adicionar relação com"
            value={addEntity}
            onChange={(e) => setAddEntity(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {missingEntities.map((s) => (
              <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="outlined" onClick={addRelation} disabled={!addEntity}>Adicionar</Button>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="overline" color="text.secondary">Memória (o que o personagem viveu)</Typography>
        {draft.memory.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Sem memórias ainda. O Relationship Engine as escreve a cada turno.</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {[...draft.memory].sort((a, b) => b.turnNumber - a.turnNumber).map((m, i) => (
              <Typography key={i} variant="body2">
                <strong>Turno {m.turnNumber}:</strong> {m.description}
                {m.impact ? <Typography component="span" variant="caption" color="text.secondary"> · {m.impact}</Typography> : null}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>

      <Box>
        <Button variant="contained" onClick={() => void save()} disabled={busy || saving}>
          {saving ? "Salvando…" : "Salvar estado vivo"}
        </Button>
        {saved && <Alert severity="success" sx={{ mt: 1 }}>Estado salvo.</Alert>}
      </Box>
    </Stack>
  );
}
