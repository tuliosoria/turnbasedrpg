import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import type { ComentarioAncorado } from "@ravenloft/content";
import { WikiMarkdown } from "../../components/WikiMarkdown";

/**
 * Um parágrafo do romance, com as duas ações da revisão ao lado.
 *
 * Existe separado da página porque a página já carregava leitura, navegação,
 * carregamento e gravação; somar edição e comentário por parágrafo dentro dela
 * faria um arquivo que ninguém segura na cabeça de uma vez.
 *
 * As ações só aparecem para quem tem token de mestre. Quem não tem recebe o
 * parágrafo e nada mais: nem botão, nem comentário, nem sinal de que existem.
 */
export function ParagrafoDoLivro({
  texto, indice, comentarios, podeEditar, onSalvarTexto, onComentar, onApagarComentario, ocupado,
}: {
  texto: string;
  indice: number;
  comentarios: ComentarioAncorado[];
  podeEditar: boolean;
  onSalvarTexto: (indice: number, novo: string) => void;
  onComentar: (indice: number, texto: string) => void;
  onApagarComentario: (id: string) => void;
  ocupado: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(texto);
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");

  const abrirEdicao = () => { setRascunho(texto); setEditando(true); };
  const salvar = () => { onSalvarTexto(indice, rascunho.trim()); setEditando(false); };
  const enviarComentario = () => {
    if (!comentario.trim()) return;
    onComentar(indice, comentario.trim());
    setComentario("");
    setComentando(false);
  };

  return (
    <Box
      sx={{
        position: "relative",
        // As ações ficam visíveis, discretas, sempre. Nasceram escondidas atrás
        // de hover e a primeira reação de quem abriu a página foi "não tô vendo
        // função para editar" — além de nunca aparecerem em tela de toque.
        "&:hover .acoes-do-paragrafo": { opacity: 1 },
      }}
    >
      {editando ? (
        <Stack spacing={1} sx={{ my: 1 }}>
          <TextField
            label={`Parágrafo ${indice + 1}`}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            autoFocus
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" disabled={ocupado} onClick={salvar}>Salvar</Button>
            <Button size="small" disabled={ocupado} onClick={() => setEditando(false)}>Descartar</Button>
          </Stack>
        </Stack>
      ) : (
        <>
          <WikiMarkdown body={texto} />
          {podeEditar && (
            <Stack
              className="acoes-do-paragrafo"
              direction="row"
              spacing={1}
              sx={{ opacity: 0.55, transition: "opacity 120ms", mt: -1, mb: 1 }}
            >
              <Button size="small" onClick={abrirEdicao}>Editar parágrafo</Button>
              <Button size="small" onClick={() => setComentando((v) => !v)}>Comentar parágrafo</Button>
            </Stack>
          )}
        </>
      )}

      {comentando && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          <TextField
            label="Comentário"
            placeholder="O que está errado aqui, e o que você quer no lugar."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            autoFocus
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" disabled={ocupado} onClick={enviarComentario}>Comentar</Button>
            <Button size="small" onClick={() => setComentando(false)}>Cancelar</Button>
          </Stack>
        </Stack>
      )}

      {comentarios.map((c) => (
        <Paper key={c.id} variant="outlined" sx={{ p: 1.5, mb: 1, borderLeft: 3, borderLeftColor: "warning.main" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{c.texto}</Typography>
            <IconButton size="small" aria-label="apagar comentário" onClick={() => onApagarComentario(c.id)}>
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
