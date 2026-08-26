import { useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  WIKI_SECTIONS,
  isCanonWikiSection,
  VISUAL_ENTITY_TYPES,
  VISUAL_ENTITY_TYPE_LABELS,
  CANON_MAX_TRAITS,
  type CanonProposal,
  type CanonReview,
  type VisualEntityType,
} from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { loadAdminToken } from "../../auth/adminSession";
import type { CanoneEscrito } from "../../api/client";

/** O mínimo de uma Casa que o seletor precisa; `House` do domínio já satisfaz. */
export interface CasaDoSeletor {
  houseId: string;
  name: string;
}

// Seções fora do cânone são regras de mesa e têm a própria porta, a Bíblia. O
// Escriba escreve ficção, então nem oferece essas.
const SECOES = WIKI_SECTIONS.filter((s) => isCanonWikiSection(s.id));

const SECAO_PADRAO = SECOES[0]?.id ?? "casas";

interface Campos {
  title: string;
  section: string;
  canonicalName: string;
  summary: string;
  entityType: VisualEntityType | "";
  traits: string;
  body: string;
  houseId: string;
}

const VAZIO: Campos = {
  title: "",
  section: SECAO_PADRAO,
  canonicalName: "",
  summary: "",
  entityType: "CHARACTER",
  traits: "",
  body: "",
  houseId: "",
};

function paraProposta(c: Campos): CanonProposal {
  return {
    title: c.title.trim(),
    section: c.section,
    body: c.body.trim(),
    summary: c.summary.trim(),
    entityType: c.entityType === "" ? null : c.entityType,
    // O nome canônico é o que batiza a entidade e o slug. Deixá-lo vazio é
    // comum quando o Mestre escreve depressa, então o título assume.
    canonicalName: c.canonicalName.trim() || c.title.trim(),
    immutableTraits: c.traits
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, CANON_MAX_TRAITS),
    houseId: null,
  };
}

/**
 * O Escriba: a porta de autoria do Mestre, sem imagem nenhuma.
 *
 * Um caminho, dois modos, sem alternância: os campos estruturados estão sempre
 * visíveis e sempre editáveis. Quem quiser ajuda escreve texto livre e aperta
 * "Consultar o Escriba", que preenche os campos; quem quiser escrever à mão
 * simplesmente ignora esse botão. O modo manual sai de graça.
 */
export function EscribaTab({ casas }: { casas: CasaDoSeletor[] }) {
  const api = useApi();
  const [rawText, setRawText] = useState("");
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [review, setReview] = useState<CanonReview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [escrito, setEscrito] = useState<CanoneEscrito | null>(null);

  const set = useCallback(<K extends keyof Campos>(k: K, v: Campos[K]) => {
    setCampos((c) => ({ ...c, [k]: v }));
  }, []);

  const consultar = useCallback(async () => {
    const token = loadAdminToken();
    if (!token || ocupado || !rawText.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      const { proposal, review: parecer } = await api.escribaPreview(token, rawText.trim());
      setCampos((c) => ({
        ...c,
        title: proposal.title,
        section: isCanonWikiSection(proposal.section) ? proposal.section : c.section,
        canonicalName: proposal.canonicalName,
        summary: proposal.summary,
        entityType: proposal.entityType ?? "",
        traits: proposal.immutableTraits.join("\n"),
        body: proposal.body,
        // A Casa de propósito não vem da IA: ela devolve o nome ("Vargen") onde
        // o banco espera o id sorteado. Quem escolhe é o Mestre, no seletor.
      }));
      setReview(parecer);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A IA não respondeu.");
    } finally {
      setOcupado(false);
    }
  }, [api, ocupado, rawText]);

  const publicar = useCallback(async () => {
    const token = loadAdminToken();
    if (!token || ocupado) return;
    if (!campos.title.trim() || !campos.body.trim()) {
      setErro("Título e texto do verbete são obrigatórios.");
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const r = await api.escribaPublicar(token, {
        proposal: paraProposta(campos),
        houseId: campos.houseId || null,
      });
      setEscrito(r);
      setCampos(VAZIO);
      setRawText("");
      setReview(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setOcupado(false);
    }
  }, [api, campos, ocupado]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Box>
        <Typography variant="h6">Escriba</Typography>
        <Typography variant="body2" color="text.secondary">
          Escreva cânone direto — personagens, lugares, história. Publica na hora, na
          Enciclopédia, sem imagem. A ilustração, se um dia vier, é assunto do Estúdio.
        </Typography>
      </Box>

      {escrito && (
        <Alert severity="success" onClose={() => setEscrito(null)}>
          Verbete publicado no cânone.{" "}
          {escrito.visualEntityId
            ? "A entidade também foi criada — o Estúdio já pode ilustrá-la."
            : "Sem entidade própria, como você pediu."}
        </Alert>
      )}
      {erro && (
        <Alert severity="error" onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Box>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="O que você quer tornar canônico (opcional)"
          helperText="Escreva solto e deixe a IA organizar nos campos abaixo — ou pule direto para eles."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <Button sx={{ mt: 1 }} disabled={ocupado || !rawText.trim()} onClick={() => void consultar()}>
          Consultar o Escriba
        </Button>
      </Box>

      {review && review.verdict !== "OK" && (
        <Alert severity="warning" onClose={() => setReview(null)}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            A IA levantou ressalvas — você publica por cima se quiser.
          </Typography>
          {review.flags.map((f, i) => (
            <Typography key={i} variant="body2">
              {f.severity}: {f.message}
            </Typography>
          ))}
        </Alert>
      )}

      <Divider />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="Título do verbete"
          value={campos.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <TextField
          select
          fullWidth
          label="Seção"
          value={campos.section}
          onChange={(e) => set("section", e.target.value)}
        >
          {SECOES.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TextField
        fullWidth
        multiline
        minRows={8}
        label="Texto do verbete"
        value={campos.body}
        onChange={(e) => set("body", e.target.value)}
      />

      <Divider>
        <Chip size="small" label="Ficha" />
      </Divider>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          fullWidth
          label="Tipo de entidade"
          helperText="“Nenhuma” cria só o verbete, sem personagem nem lugar próprio."
          value={campos.entityType}
          onChange={(e) => set("entityType", e.target.value as Campos["entityType"])}
        >
          <MenuItem value="">Nenhuma</MenuItem>
          {VISUAL_ENTITY_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {VISUAL_ENTITY_TYPE_LABELS[t]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          label="Casa"
          helperText="Muito do que você escreve não pertence a Casa alguma."
          value={campos.houseId}
          onChange={(e) => set("houseId", e.target.value)}
        >
          <MenuItem value="">Nenhuma</MenuItem>
          {casas.map((c) => (
            <MenuItem key={c.houseId} value={c.houseId}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="Nome canônico"
          helperText="Vazio usa o título."
          value={campos.canonicalName}
          onChange={(e) => set("canonicalName", e.target.value)}
        />
        <TextField
          fullWidth
          label="Resumo"
          helperText="Uma linha, para listagens."
          value={campos.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </Stack>

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Traços imutáveis"
        helperText={`Um por linha, no máximo ${CANON_MAX_TRAITS}. É o que mantém a figura igual quando o Estúdio ilustrar.`}
        value={campos.traits}
        onChange={(e) => set("traits", e.target.value)}
      />

      <Box>
        <Button variant="contained" disabled={ocupado} onClick={() => void publicar()}>
          Publicar no cânone
        </Button>
      </Box>
    </Stack>
  );
}
