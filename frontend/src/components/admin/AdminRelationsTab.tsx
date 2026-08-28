import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import {
  RELATION_AXES,
  RELATION_AXIS_LABELS,
  RELATION_DEFAULT,
  levelOf,
  type RelationAxis,
  type RelationLevel,
} from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../LoadingState";
import type { HouseRelationMatrix, HouseRelationView } from "../../api/client";

/**
 * O valor que um clique grava.
 *
 * Fica no meio da faixa para o Mestre poder ajustar fino depois sem que a
 * relação escorregue de nível ao primeiro empurrão.
 */
const VALOR_DO_NIVEL: Record<RelationLevel, number> = { RUIM: 17, MEDIO: RELATION_DEFAULT, BOM: 83 };

const CORES: Record<RelationLevel, "error" | "warning" | "success"> = {
  RUIM: "error",
  MEDIO: "warning",
  BOM: "success",
};

type Rascunho = { amizade: number; comercio: number; favores: number; note: string };

function rascunhoDe(r: HouseRelationView | undefined): Rascunho {
  return {
    amizade: r?.amizade ?? RELATION_DEFAULT,
    comercio: r?.comercio ?? RELATION_DEFAULT,
    favores: r?.favores ?? RELATION_DEFAULT,
    note: r?.note ?? "",
  };
}

function iguais(a: Rascunho, b: Rascunho): boolean {
  return a.amizade === b.amizade && a.comercio === b.comercio && a.favores === b.favores && a.note === b.note;
}

/**
 * Como cada Casa vê as outras: amizade, comércio e favores.
 *
 * A relação é direcional de propósito — a Casa do Ouro pode cortejar Khazdrun
 * enquanto Khazdrun desconfia dela, e é dessa assimetria que sai a política. Por
 * isso o painel escolhe UMA Casa e mostra o que ELA sente, com o lado inverso ao
 * lado apenas para leitura.
 *
 * O que o Mestre grava aqui entra na próxima carta que a IA escrever: muda o
 * tom, o preço e a disposição a favores, sem tocar nas linhas vermelhas.
 */
export function AdminRelationsTab({ adminToken }: { adminToken: string }) {
  const api = useApi();
  const [data, setData] = useState<HouseRelationMatrix | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [origem, setOrigem] = useState("");
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const matriz = await api.adminGetRelations(adminToken);
      setData(matriz);
      setOrigem((atual) => atual || (matriz.seats[0]?.key ?? ""));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as relações.");
    }
  }, [api, adminToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porPar = useMemo(() => {
    const mapa = new Map<string, HouseRelationView>();
    for (const r of data?.relations ?? []) mapa.set(`${r.fromKey}#${r.toKey}`, r);
    return mapa;
  }, [data]);

  const salvos = useMemo(() => {
    const m: Record<string, Rascunho> = {};
    for (const s of data?.seats ?? []) {
      if (s.key === origem) continue;
      m[s.key] = rascunhoDe(porPar.get(`${origem}#${s.key}`));
    }
    return m;
  }, [data, origem, porPar]);

  const editar = (destino: string, campo: keyof Rascunho, valor: number | string) => {
    setRascunhos((r) => ({
      ...r,
      [destino]: { ...(r[destino] ?? salvos[destino]), [campo]: valor } as Rascunho,
    }));
  };

  const gravar = async (destino: string) => {
    const valor = rascunhos[destino] ?? salvos[destino];
    setSalvando(destino);
    setErro(null);
    try {
      const salvo = await api.adminPutRelation(adminToken, { fromKey: origem, toKey: destino, ...valor });
      setData((d) =>
        d
          ? {
              ...d,
              relations: [...d.relations.filter((r) => !(r.fromKey === origem && r.toKey === destino)), salvo],
            }
          : d,
      );
      setRascunhos((r) => {
        const { [destino]: _, ...resto } = r;
        return resto;
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gravar a relação.");
    } finally {
      setSalvando(null);
    }
  };

  if (erro && !data) return <Alert severity="error">{erro}</Alert>;
  if (!data) return <LoadingState />;

  const nomeDe = (key: string) => data.seats.find((s) => s.key === key)?.name ?? key;
  const outras = data.seats.filter((s) => s.key !== origem);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Como esta Casa vê as outras. É direcional: o que você grava aqui muda o tom, o preço e a
        disposição a favores nas cartas que ela responder — nunca as linhas vermelhas dela. O par que
        você nunca tocar vale médio e não entra no prompt.
      </Typography>

      {erro && <Alert severity="error" onClose={() => setErro(null)}>{erro}</Alert>}

      <TextField
        select
        label="Quem sente"
        value={origem}
        onChange={(e) => {
          setOrigem(e.target.value);
          setRascunhos({});
        }}
        sx={{ maxWidth: 320 }}
      >
        {data.seats.map((s) => (
          <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>
        ))}
      </TextField>

      {outras.map((s) => {
        const atual = rascunhos[s.key] ?? salvos[s.key] ?? rascunhoDe(undefined);
        const sujo = !iguais(atual, salvos[s.key] ?? rascunhoDe(undefined));
        const definido = porPar.has(`${origem}#${s.key}`);
        const salvo = porPar.get(`${origem}#${s.key}`);
        const inverso = porPar.get(`${s.key}#${origem}`);

        return (
          <Paper key={s.key} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{s.name}</Typography>
                {!definido && <Chip size="small" variant="outlined" label="padrão" />}
                {salvo?.divergencia && (
                  <Chip
                    size="small"
                    color="warning"
                    label={salvo.divergencia.kind === "perdoado" ? "ferida antiga, boa relação" : "laço antigo, má relação"}
                  />
                )}
                {/* O outro lado da moeda. Só leitura: para editar, o Mestre
                    troca de Casa acima — assim ele nunca grava sem perceber
                    que está falando pela outra. */}
                {inverso && (
                  <Typography variant="caption" color="text.secondary">
                    Como {s.name} vê {nomeDe(origem)}: {inverso.resumo}
                  </Typography>
                )}
              </Stack>

              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
                {RELATION_AXES.map((eixo: RelationAxis) => (
                  <Box key={eixo}>
                    <Typography variant="overline" color="text.secondary">
                      {RELATION_AXIS_LABELS[eixo]}
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      size="small"
                      color={CORES[levelOf(atual[eixo])]}
                      value={levelOf(atual[eixo])}
                      onChange={(_, nivel: RelationLevel | null) => {
                        if (nivel) editar(s.key, eixo, VALOR_DO_NIVEL[nivel]);
                      }}
                    >
                      <ToggleButton value="RUIM">Ruim</ToggleButton>
                      <ToggleButton value="MEDIO">Médio</ToggleButton>
                      <ToggleButton value="BOM">Bom</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                ))}
              </Box>

              {salvo?.divergencia && (
                <Alert severity="warning">{salvo.divergencia.explanation}</Alert>
              )}

              <TextField
                label="Por quê (a IA lê isto ao responder)"
                placeholder="Traíram na votação do Conselho; desde então cobramos à vista."
                value={atual.note}
                onChange={(e) => editar(s.key, "note", e.target.value)}
                size="small"
                multiline
                minRows={1}
                inputProps={{ maxLength: 600 }}
                helperText={`${atual.note.length}/600`}
              />

              <Box>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!sujo || salvando === s.key}
                  onClick={() => void gravar(s.key)}
                >
                  {salvando === s.key ? "Gravando…" : "Gravar"}
                </Button>
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
