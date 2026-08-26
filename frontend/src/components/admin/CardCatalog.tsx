import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DEFAULT_PROJECT_TEMPLATES, CATEGORY_LABELS } from "@ravenloft/content";

/**
 * As cartas que existem no jogo, para o Mestre consultar.
 *
 * O painel só mostrava cartas pendentes e ativas — o que as Casas já pediram.
 * O catálogo inteiro não aparecia em lugar nenhum do lado do Mestre, então uma
 * mecânica que ele mesmo encomendou podia ficar invisível para ele: a Rede das
 * Lanternas é a carta número quarenta de sessenta e cinco, e ele nunca a
 * encontrou. Sem isto, o Mestre não sabe o que pode oferecer a um jogador que
 * pergunta "o que eu posso fazer?".
 */
export function CardCatalog() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("ALL");

  const cartas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      if (categoria !== "ALL" && t.category !== categoria) return false;
      if (!q) return true;
      return `${t.title} ${t.description}`.toLowerCase().includes(q);
    });
  }, [busca, categoria]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          select
          size="small"
          label="Categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">Todas</MenuItem>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth
          label="Buscar por título ou descrição"
          placeholder="lanterna, espião, muralha…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {cartas.length} de {DEFAULT_PROJECT_TEMPLATES.length} projetos
      </Typography>

      {cartas.map((t) => (
        <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography fontWeight="bold">{t.title}</Typography>
            <Chip size="small" label={CATEGORY_LABELS[t.category]} />
            <Chip size="small" variant="outlined" label={`${t.durationTurns} turno(s)`} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t.description}
          </Typography>
          {t.risks.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="warning.main">Risco: {t.risks.join("; ")}</Typography>
            </Box>
          )}
        </Paper>
      ))}
    </Stack>
  );
}
