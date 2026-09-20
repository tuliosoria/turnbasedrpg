import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import type { ComentarioAncorado } from "@ravenloft/content";
import { WikiMarkdown } from "../../components/WikiMarkdown";

/**
 * Um parágrafo do romance, com o comentário que ele recebeu.
 *
 * A primeira versão pôs "Editar parágrafo" e "Comentar parágrafo" como dois
 * botões preenchidos entre cada parágrafo. A página virou uma escada de botões
 * com a prosa espremida no meio. Num leitor de romance a ferramenta tem de
 * sumir dentro da leitura: sobra um ícone pequeno ao fim do parágrafo, e o
 * texto se edita clicando nele.
 *
 * Só aparece para quem tem token de mestre. Quem não tem recebe o parágrafo e
 * nada mais: nem ícone, nem comentário, nem sinal de que existem.
 */
export function ParagrafoDoLivro({
  texto, indice, comentarios, podeComentar, onComentar, onApagarComentario, ocupado,
}: {
  texto: string;
  indice: number;
  comentarios: ComentarioAncorado[];
  podeComentar: boolean;
  onComentar: (indice: number, texto: string) => void;
  onApagarComentario: (id: string) => void;
  ocupado: boolean;
}) {
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");

  const enviar = () => {
    if (!comentario.trim()) return;
    onComentar(indice, comentario.trim());
    setComentario("");
    setComentando(false);
  };

  // O clique aqui é do comentário, e não do editor de capítulo que envolve a
  // prosa inteira.
  const soMeu = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <Box sx={{ "&:hover .marca-de-comentario": { opacity: 0.8 } }}>
      <WikiMarkdown body={texto} />

      {podeComentar && (
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={0.5}
          onClick={soMeu}
          sx={{ mt: -1.5, mb: 1 }}
        >
          {comentarios.length > 0 && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {comentarios.length}
            </Typography>
          )}
          <IconButton
            className="marca-de-comentario"
            size="small"
            aria-label="Comentar parágrafo"
            onClick={() => setComentando((v) => !v)}
            sx={{
              // Presente sempre, quase apagado em repouso. Escondê-lo atrás de
              // hover já custou uma versão: o autor abriu a página, não achou a
              // ferramenta, e em tela de toque ela não apareceria nunca.
              opacity: comentarios.length > 0 ? 0.8 : 0.28,
              transition: "opacity 120ms",
              "&:hover": { opacity: 1 },
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      )}

      {comentando && (
        <Stack spacing={1} sx={{ mb: 2 }} onClick={soMeu}>
          <TextField
            label="Comentário"
            placeholder="O que está errado aqui, e o que você quer no lugar."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            size="small"
            autoFocus
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" disabled={ocupado} onClick={enviar}>Comentar</Button>
            <Button size="small" onClick={() => setComentando(false)}>Cancelar</Button>
          </Stack>
        </Stack>
      )}

      {comentarios.map((c) => (
        <Box
          key={c.id}
          onClick={soMeu}
          sx={{
            mb: 1.5, pl: 1.5, py: 0.5,
            // Um fio de um pixel. Barra grossa colorida na lateral é adorno, e
            // adorno compete com a prosa que ela deveria estar servindo.
            borderLeft: "1px solid",
            borderLeftColor: "warning.main",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
              {c.texto}
            </Typography>
            <IconButton size="small" aria-label="apagar comentário" onClick={() => onApagarComentario(c.id)}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
