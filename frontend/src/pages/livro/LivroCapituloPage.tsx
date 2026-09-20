import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, Link as RouterLink, Navigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BOOK_PART_IDS, bookPartLabel, paragrafosDe, reancorar, type BookChapter, type ComentarioDoLivro } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { adminTokenSnapshot, subscribeAdminToken } from "../../auth/adminSession";
import { MundoLayout } from "../../components/MundoLayout";
import { LoadingState } from "../../components/LoadingState";
import { ParagrafoDoLivro } from "./ParagrafoDoLivro";

function readingOrder(chapters: BookChapter[]): BookChapter[] {
  const partIndex = (id: string) => {
    const i = BOOK_PART_IDS.indexOf(id);
    return i === -1 ? BOOK_PART_IDS.length : i;
  };
  return [...chapters].sort((a, b) => {
    const pa = partIndex(a.part);
    const pb = partIndex(b.part);
    if (pa !== pb) return pa - pb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

/**
 * O capítulo, lido como se lê um livro.
 *
 * O Mestre lê o próprio rascunho aqui. A rota pública filtra por `publicado`, e
 * enquanto o romance não é do reino ele está inteiro em rascunho — sem esta
 * porta, a página feita para ler o livro responderia "ainda não foi publicado"
 * justamente a quem o escreveu, e ler cento e vinte mil palavras viraria ler
 * dentro de um campo de edição do painel.
 *
 * Editar e comentar moram no parágrafo, junto do texto: a correção nasce da
 * leitura, e obrigar a trocar de tela entre notar e anotar é o que faz a nota
 * não ser escrita. A precisão é do parágrafo porque é assim que se revisa
 * livro — "o terceiro parágrafo está frio" é pior que apontar o parágrafo.
 */
export function LivroCapituloPage() {
  const api = useApi();
  const { chapterId } = useParams<{ chapterId: string }>();
  const adminToken = useSyncExternalStore(subscribeAdminToken, adminTokenSnapshot, () => null);
  const [chapters, setChapters] = useState<BookChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setChapters(adminToken ? await api.adminListBook(adminToken) : await api.getBook());
    } catch {
      setError("Não foi possível carregar O mundo de Valdren.");
    }
  }, [api, adminToken]);

  useEffect(() => { void carregar(); }, [carregar]);

  const ordered = useMemo(() => (chapters ? readingOrder(chapters) : []), [chapters]);
  const index = useMemo(
    () => ordered.findIndex((c) => c.chapterId === chapterId),
    [ordered, chapterId],
  );
  const chapter = index === -1 ? null : ordered[index];

  const paragrafos = useMemo(() => (chapter ? paragrafosDe(chapter.body) : []), [chapter?.body]);

  // Os comentários são colocados no capítulo de HOJE, e não no de quando foram
  // escritos. Quem perdeu o trecho vira órfão e aparece no fim, com o texto
  // antigo citado: perde o lugar, nunca a existência.
  const ancorados = useMemo(
    () => reancorar(chapter?.comentarios ?? [], paragrafos),
    [chapter?.comentarios, paragrafos],
  );
  const porParagrafo = useMemo(() => {
    const mapa = new Map<number, typeof ancorados>();
    for (const c of ancorados.filter((x) => !x.orfao)) {
      mapa.set(c.paragrafo, [...(mapa.get(c.paragrafo) ?? []), c]);
    }
    return mapa;
  }, [ancorados]);
  const orfaos = useMemo(() => ancorados.filter((c) => c.orfao), [ancorados]);

  const salvar = useCallback(
    async (campos: { body?: string; comentarios?: ComentarioDoLivro[] }) => {
      if (!chapter || !adminToken) return;
      setSalvando(true);
      setAviso(null);
      try {
        await api.adminUpdateBookChapter(adminToken, chapter.chapterId, {
          part: chapter.part,
          order: chapter.order,
          title: chapter.title,
          status: chapter.status,
          body: campos.body ?? chapter.body,
          // Mandar só o que mudou: o servidor preserva os comentários quando
          // eles não vêm, e é isso que impede uma correção de vírgula de
          // apagar a revisão inteira.
          ...(campos.comentarios === undefined ? {} : { comentarios: campos.comentarios }),
        });
        setAviso("Salvo.");
        await carregar();
      } catch {
        setAviso("Não deu para salvar. O que você escreveu continua aqui.");
      } finally {
        setSalvando(false);
      }
    },
    [api, adminToken, chapter, carregar],
  );

  /** Troca um parágrafo e devolve o capítulo inteiro, com o resto intacto. */
  const salvarParagrafo = useCallback(
    (indice: number, novo: string) => {
      const proximos = [...paragrafos];
      proximos[indice] = novo;
      void salvar({ body: proximos.join("\n\n") });
    },
    [paragrafos, salvar],
  );

  const comentar = useCallback(
    (indice: number, texto: string) => {
      void salvar({
        comentarios: [
          ...(chapter?.comentarios ?? []),
          {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            paragrafo: indice,
            // O trecho vai junto porque o índice não sobrevive à reescrita.
            trecho: paragrafos[indice] ?? "",
            texto,
            criadoEm: new Date().toISOString(),
          },
        ],
      });
    },
    [chapter?.comentarios, paragrafos, salvar],
  );

  const apagarComentario = useCallback(
    (id: string) => {
      void salvar({ comentarios: (chapter?.comentarios ?? []).filter((c) => c.id !== id) });
    },
    [chapter?.comentarios, salvar],
  );

  if (error) {
    return (
      <MundoLayout>
        <Alert severity="error">{error}</Alert>
      </MundoLayout>
    );
  }

  if (!chapters) {
    return (
      <MundoLayout>
        <LoadingState />
      </MundoLayout>
    );
  }

  // Para o jogador, um capítulo em rascunho simplesmente não existe.
  if (!chapter) {
    return <Navigate to="/livro" replace />;
  }

  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;

  return (
    <MundoLayout>
      <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "72ch" }}>
        <Box>
          <Link component={RouterLink} to="/livro" variant="body2" underline="hover">
            O Livro
          </Link>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {bookPartLabel(chapter.part)}
            </Typography>
            {chapter.status === "rascunho" && (
              <Chip size="small" color="warning" variant="outlined" label="rascunho" />
            )}
          </Stack>
          <Typography variant="h2" sx={{ mt: 0.5 }} gutterBottom>
            {chapter.title}
          </Typography>
        </Box>

        <Stack spacing={0}>
          {paragrafos.map((p, i) => (
            <ParagrafoDoLivro
              key={`${chapter.chapterId}-${i}`}
              texto={p}
              indice={i}
              comentarios={porParagrafo.get(i) ?? []}
              podeEditar={!!adminToken}
              onSalvarTexto={salvarParagrafo}
              onComentar={comentar}
              onApagarComentario={apagarComentario}
              ocupado={salvando}
            />
          ))}
        </Stack>

        {adminToken && orfaos.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, borderColor: "warning.main" }}>
            <Typography variant="overline" color="text.secondary" display="block">
              Comentários sem lugar no texto
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              O trecho que eles criticavam foi reescrito. Ficam aqui em vez de sumir.
            </Typography>
            {orfaos.map((c) => (
              <Box key={c.id} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  &ldquo;{c.trecho.slice(0, 160)}&rdquo;
                </Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{c.texto}</Typography>
                  <Button size="small" onClick={() => apagarComentario(c.id)}>Apagar comentário</Button>
                </Stack>
              </Box>
            ))}
          </Paper>
        )}

        {aviso && <Typography variant="caption" color="text.secondary">{aviso}</Typography>}

        <Divider />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
          {prev ? (
            <Link component={RouterLink} to={`/livro/${prev.chapterId}`} underline="hover">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link component={RouterLink} to={`/livro/${next.chapterId}`} underline="hover">
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </Stack>
      </Stack>
    </MundoLayout>
  );
}
