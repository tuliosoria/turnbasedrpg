import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { HOUSE_CHARACTERS, SEATS, characterId } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import type { NpcState } from "../../types/api";

/**
 * O estado dinâmico de cada NPC, ajustado pelo Mestre.
 *
 * Humor, favores, uma nota, e a percepção de cada outra Casa. É a camada de
 * cima da carta que aquele NPC escreve: colore ou contradiz o canon quando o
 * Mestre quer. Vazio significa que o NPC responde só a partir do canon e da
 * situação do turno.
 */
export function AdminNpcsTab({ adminToken, busy }: { adminToken: string; busy: boolean }) {
  const api = useApi();
  const [houseKey, setHouseKey] = useState<string>(SEATS[0].key);
  const [charId, setCharId] = useState<string>("");
  const [states, setStates] = useState<Record<string, NpcState>>({});
  const [mood, setMood] = useState("");
  const [favors, setFavors] = useState("");
  const [note, setNote] = useState("");
  const [perceptions, setPerceptions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const roster = HOUSE_CHARACTERS[houseKey] ?? [];
  const stateKey = (hk: string, cid: string) => `${hk}#${cid}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.adminListNpcStates(adminToken);
      setStates(Object.fromEntries(list.map((s) => [stateKey(s.houseKey, s.characterId), s])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os estados.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ao trocar de Casa, escolhe a primeira pessoa dela.
  useEffect(() => {
    const first = roster[0] ? characterId(roster[0].name) : "";
    setCharId(first);
  }, [houseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega o estado da pessoa nos campos. Depende de `states` para preencher
  // quando o carregamento assíncrono chega, mas não zera o "salvo" aqui: salvar
  // atualiza `states`, e isto rerodaria e apagaria o aviso de sucesso na hora.
  useEffect(() => {
    const s = states[stateKey(houseKey, charId)];
    setMood(s?.mood ?? "");
    setFavors(s?.favors ?? "");
    setNote(s?.note ?? "");
    setPerceptions(s?.perceptions ?? {});
  }, [houseKey, charId, states]);

  // O aviso de sucesso some só ao navegar para outro NPC, não ao salvar.
  useEffect(() => {
    setSaved(false);
  }, [houseKey, charId]);

  const otherHouses = useMemo(() => SEATS.filter((s) => s.key !== houseKey), [houseKey]);

  const save = useCallback(async () => {
    if (!charId) return;
    setSaving(true);
    setError(null);
    try {
      const state = await api.adminPutNpcState(adminToken, { houseKey, characterId: charId, mood, favors, note, perceptions });
      setStates((prev) => ({ ...prev, [stateKey(houseKey, charId)]: state }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }, [api, adminToken, houseKey, charId, mood, favors, note, perceptions]);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Ajuste o estado de cada NPC. Isso pesa mais que o cânone nas cartas que essa pessoa escrever.
        Deixe em branco para que ela responda só pelo cânone e pela situação do turno.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Casa" value={houseKey} onChange={(e) => setHouseKey(e.target.value)} sx={{ minWidth: 220 }}>
          {SEATS.map((s) => (
            <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Pessoa" value={charId} onChange={(e) => setCharId(e.target.value)} sx={{ minWidth: 260 }} disabled={roster.length === 0}>
          {roster.map((c) => {
            const id = characterId(c.name);
            const touched = !!states[stateKey(houseKey, id)];
            return (
              <MenuItem key={id} value={id}>{c.name}{touched ? " ·" : ""}</MenuItem>
            );
          })}
        </TextField>
      </Stack>

      <TextField label="Humor agora" value={mood} onChange={(e) => setMood(e.target.value)} fullWidth placeholder="exausta e desconfiada; esperançoso; com raiva da Coroa" />
      <TextField label="Favores em jogo" value={favors} onChange={(e) => setFavors(e.target.value)} fullWidth multiline minRows={2} placeholder="deve uma escolta a Vargen; cobra uma dívida da Casa do Ouro" />
      <TextField label="Nota do Mestre" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} placeholder="acabou de enterrar a mãe; sabe de um segredo que ainda não usou" />

      <Box>
        <Typography variant="overline" color="text.secondary">Percepção das outras Casas</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Cada uma só entra na carta quando é aquela Casa que escreve.
        </Typography>
        <Stack spacing={1}>
          {otherHouses.map((h) => (
            <TextField
              key={h.key}
              label={h.name}
              size="small"
              value={perceptions[h.key] ?? ""}
              onChange={(e) => setPerceptions((prev) => ({ ...prev, [h.key]: e.target.value }))}
              fullWidth
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Button variant="contained" onClick={() => void save()} disabled={busy || saving || !charId}>
          {saving ? "Salvando…" : "Salvar estado"}
        </Button>
        {saved && <Alert severity="success" sx={{ mt: 1 }}>Estado salvo.</Alert>}
      </Box>
    </Stack>
  );
}
